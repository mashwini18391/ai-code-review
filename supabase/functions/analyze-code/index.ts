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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---- 1. Validate Auth ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- 2. Parse & Validate Input ----
    const body = await req.json();
    const { code, language, title, source_type, source_url } = body;

    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Code is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (code.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Code is too short for meaningful analysis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (code.length > 50000) {
      return new Response(
        JSON.stringify({ error: 'Code exceeds 50,000 character limit' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sanitizedTitle = (title || 'Untitled Review').substring(0, 100);
    const sanitizedLanguage = (language || 'javascript').substring(0, 30);
    const sanitizedSourceType = ['paste', 'github'].includes(source_type) ? source_type : 'paste';

    // ---- 3. Chunk code if needed ----
    const maxChunkSize = 12000;
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

    // ---- 4. Call OpenRouter API ----
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!openrouterKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt
    const systemPrompt = `You are an expert senior software engineer performing a thorough code review. You must analyze the provided ${sanitizedLanguage} code and return ONLY a valid JSON object (no markdown, no extra text) with exactly this structure:

{
  "bugs": [
    { "issue": "description of the bug or vulnerability", "severity": "low | medium | high" }
  ],
  "suggestions": [
    { "before": "the original problematic code snippet", "after": "the improved code snippet" }
  ],
  "improvedCode": "The complete, fully refactored and updated code with all fixes applied.",
  "score": <integer 1-10>,
  "documentation": "A clear explanation of what each function/section does, written for developers."
}

ANALYSIS REQUIREMENTS:
- Detect logical errors, off-by-one errors, null/undefined issues
- Find syntax issues and anti-patterns
- Identify performance bottlenecks (O(n²) algorithms, memory leaks, unnecessary re-renders)
- Flag security vulnerabilities (SQL injection, XSS, CSRF, hardcoded secrets, insecure crypto)
- Check for missing error handling, edge cases, and race conditions
- Score fairly: 1-3 = critical issues, 4-5 = needs improvement, 6-7 = good with minor issues, 8-9 = very good, 10 = excellent
- Keep suggestions practical with real before/after code
- Documentation should explain purpose and behavior of each function/class

IMPORTANT: Return ONLY the JSON object. No markdown formatting, no code fences, no explanation outside the JSON.`;

    // For multiple chunks, combine analyses
    const combinedResult: { bugs: any[], suggestions: any[], improvedCode: string, score: number, documentation: string } = { bugs: [], suggestions: [], improvedCode: '', score: 0, documentation: '' };
    let chunkScores: number[] = [];

    for (let i = 0; i < codeChunks.length; i++) {
      const chunkLabel = codeChunks.length > 1 ? ` (Part ${i + 1} of ${codeChunks.length})` : '';

      const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': supabaseUrl,
          'X-Title': 'CodeLens AI - Code Review Tool',
        },
        body: JSON.stringify({
          model: Deno.env.get('OPENROUTER_MODEL') || 'google/gemini-2.0-flash-001:free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Review the following ${sanitizedLanguage} code${chunkLabel}:\n\n${codeChunks[i]}` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error('OpenRouter API error:', errText);
        return new Response(
          JSON.stringify({ error: `AI analysis failed: ${aiResponse.status}` }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content;

      if (!content) {
        return new Response(
          JSON.stringify({ error: 'AI returned empty response' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse the JSON response
      let parsed;
      try {
        // Clean potential markdown code fences
        let cleaned = content.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        }
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('Failed to parse AI response:', content);
        return new Response(
          JSON.stringify({ error: 'AI returned invalid JSON', raw: content }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Merge results
      if (Array.isArray(parsed.bugs)) {
        combinedResult.bugs.push(...parsed.bugs);
      }
      if (Array.isArray(parsed.suggestions)) {
        combinedResult.suggestions.push(...parsed.suggestions);
      }
      if (parsed.improvedCode) {
        combinedResult.improvedCode += (combinedResult.improvedCode ? '\n\n' : '') + parsed.improvedCode;
      }
      if (typeof parsed.score === 'number') {
        chunkScores.push(Math.max(1, Math.min(10, Math.round(parsed.score))));
      }
      if (parsed.documentation) {
        combinedResult.documentation += (combinedResult.documentation ? '\n\n' : '') + parsed.documentation;
      }
    }

    // Average the scores
    combinedResult.score = chunkScores.length > 0
      ? Math.round(chunkScores.reduce((a, b) => a + b, 0) / chunkScores.length)
      : 5;

    // ---- 5. Store in Database ----
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const codeSnippet = code.substring(0, 5000); // Store first 5000 chars for preview

    const { data: review, error: insertError } = await supabaseAdmin
      .from('reviews')
      .insert({
        user_id: user.id,
        title: sanitizedTitle,
        language: sanitizedLanguage,
        source_type: sanitizedSourceType,
        source_url: source_url || null,
        code_snippet: codeSnippet,
        score: combinedResult.score,
        bugs: combinedResult.bugs,
        suggestions: combinedResult.suggestions,
        documentation: combinedResult.documentation,
        raw_ai_response: combinedResult,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save review results' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- 6. Return Result ----
    return new Response(
      JSON.stringify({
        review_id: review.id,
        score: combinedResult.score,
        bugs_count: combinedResult.bugs.length,
        suggestions_count: combinedResult.suggestions.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
