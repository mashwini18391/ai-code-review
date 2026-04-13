/// <reference path="../deno.d.ts" />
// =============================================
// AI Code Review — analyze-code Edge Function
// Sends code to OpenRouter API for AI analysis
// =============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Helper to create a JSON response with CORS headers
 */
function createJsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---- 1. Check Configuration ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    
    // Default to a highly stable free model if none specified
    const openrouterModel = Deno.env.get('OPENROUTER_MODEL') || 'meta-llama/llama-3.3-70b-instruct:free';

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey || !openrouterKey) {
      console.error('Missing configuration in analyze-code');
      return createJsonResponse({ 
        error: 'Server configuration error. Please check Supabase secrets.',
      }, 500);
    }

    // ---- 2. Validate Auth ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createJsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return createJsonResponse({ error: 'Invalid or expired token' }, 401);
    }

    // ---- 3. Parse & Validate Input ----
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return createJsonResponse({ error: 'Invalid JSON request body' }, 400);
    }

    const { code, language, title, source_type, source_url } = body;

    if (!code || typeof code !== 'string' || code.length < 10) {
      return createJsonResponse({ error: 'Valid code snippet is required' }, 400);
    }

    const sanitizedTitle = (title || 'Untitled Review').substring(0, 100);
    const sanitizedLanguage = (language || 'javascript').substring(0, 30);
    const sanitizedSourceType = ['paste', 'github'].includes(source_type) ? source_type : 'paste';

    // ---- 4. Chunk code if needed ----
    const maxChunkSize = 10000;
    const codeChunks: string[] = [];
    if (code.length <= maxChunkSize) {
      codeChunks.push(code);
    } else {
      const lines = code.split('\n');
      let currentChunk = '';
      for (const line of lines) {
        if ((currentChunk + '\n' + line).length > maxChunkSize && currentChunk.length > 0) {
          codeChunks.push(currentChunk);
          currentChunk = line;
        } else {
          currentChunk = currentChunk ? currentChunk + '\n' + line : line;
        }
      }
      if (currentChunk) codeChunks.push(currentChunk);
    }

    // ---- 5. Call OpenRouter API ----
    // We removed response_format: { type: 'json_object' } for better compatibility with free providers
    const systemPrompt = `You are a Senior Software Engineer. Review the provided ${sanitizedLanguage} code. 
Return your analysis strictly as a JSON object with NO preamble, NO postamble, and NO markdown fences.

Expected JSON Structure:
{
  "bugs": [
    { "issue": "description", "severity": "low|medium|high" }
  ],
  "suggestions": [
    { "before": "original code", "after": "improved code" }
  ],
  "improvedCode": "the complete rewritten code",
  "score": 1-10,
  "documentation": "explanation of functions"
}

IMPORTANT: Your response must be valid JSON and ONLY JSON.`;

    const combinedResult: { bugs: any[], suggestions: any[], improvedCode: string, score: number, documentation: string } = { bugs: [], suggestions: [], improvedCode: '', score: 0, documentation: '' };
    let chunkScores: number[] = [];

    for (let i = 0; i < codeChunks.length; i++) {
      const chunkLabel = codeChunks.length > 1 ? ` (Part ${i + 1} of ${codeChunks.length})` : '';

      try {
        console.log(`Calling OpenRouter for chunk ${i+1}/${codeChunks.length} using model ${openrouterModel}`);
        
        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': supabaseUrl,
            'X-Title': 'CodeLens AI',
          },
          body: JSON.stringify({
            model: openrouterModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Review this ${sanitizedLanguage} code${chunkLabel}:\n\n${codeChunks[i]}` },
            ],
            temperature: 0.2, // Lower temperature for more consistent JSON
            max_tokens: 3000,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`OpenRouter error (${aiResponse.status}):`, errText);
          return createJsonResponse({ error: `AI Provider error: ${aiResponse.status}`, details: errText }, 502);
        }

        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          console.error('OpenRouter returned empty content');
          return createJsonResponse({ error: 'AI returned an empty response' }, 502);
        }

        // Robust JSON parsing
        let parsed;
        try {
          let cleaned = content.trim();
          // Remove any accidental markdown fences
          if (cleaned.includes('```')) {
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) cleaned = match[0];
          }
          parsed = JSON.parse(cleaned);
        } catch (parseErr) {
          console.error('Failed to parse AI response. Content was:', content);
          return createJsonResponse({ error: 'AI returned malformed data', raw: content.substring(0, 100) + '...' }, 502);
        }

        // Merge results
        if (Array.isArray(parsed.bugs)) combinedResult.bugs.push(...parsed.bugs);
        if (Array.isArray(parsed.suggestions)) combinedResult.suggestions.push(...parsed.suggestions);
        if (parsed.improvedCode) combinedResult.improvedCode += (combinedResult.improvedCode ? '\n\n' : '') + parsed.improvedCode;
        if (typeof parsed.score === 'number') chunkScores.push(Math.max(1, Math.min(10, Math.round(parsed.score))));
        if (parsed.documentation) combinedResult.documentation += (combinedResult.documentation ? '\n\n' : '') + parsed.documentation;

      } catch (fetchErr: any) {
        console.error('Fetch error:', fetchErr);
        return createJsonResponse({ error: 'Connection to AI failed', details: fetchErr.message }, 504);
      }
    }

    // Final score
    combinedResult.score = chunkScores.length > 0
      ? Math.round(chunkScores.reduce((a, b) => a + b, 0) / chunkScores.length)
      : 5;

    // ---- 6. Store in Database ----
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: review, error: insertError } = await supabaseAdmin
      .from('reviews')
      .insert({
        user_id: user.id,
        title: sanitizedTitle,
        language: sanitizedLanguage,
        source_type: sanitizedSourceType,
        source_url: source_url || null,
        code_snippet: code.substring(0, 5000),
        score: combinedResult.score,
        bugs: combinedResult.bugs,
        suggestions: combinedResult.suggestions,
        documentation: combinedResult.documentation,
        raw_ai_response: combinedResult,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Storage error:', insertError);
      return createJsonResponse({ error: 'Failed to save review results' }, 500);
    }

    return createJsonResponse({
      review_id: review.id,
      score: combinedResult.score,
      bugs_count: combinedResult.bugs.length,
      suggestions_count: combinedResult.suggestions.length,
    });

  } catch (err: any) {
    console.error('Edge function crash:', err);
    return createJsonResponse({ error: 'Internal server error', details: err.message }, 500);
  }
});


