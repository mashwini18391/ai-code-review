/// <reference path="../deno.d.ts" />
// =============================================
// AI Code Review — admin-stats Edge Function
// Aggregates platform analytics for admin users
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---- 1. Check Configuration ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('Missing configuration in admin-stats');
      return createJsonResponse({ error: 'Server configuration error' }, 500);
    }

    // ---- 2. Validate Auth ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createJsonResponse({ error: 'Unauthorized' }, 401);
    }

    // Verify user identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('Auth verification failed:', authError);
      return createJsonResponse({ error: 'Invalid token' }, 401);
    }

    // ---- 3. Check Admin Role ----
    // Use service role (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return createJsonResponse({ error: 'Admin access required' }, 403);
    }

    // ---- 4. Fetch Analytics ----
    // Fetch profiles
    const { data: profiles, error: pError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch reviews
    const { data: reviews, error: rError } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (pError || rError) {
      console.error('Database fetch error:', pError || rError);
      return createJsonResponse({ error: 'Failed to fetch analytics data' }, 500);
    }

    const allProfiles = profiles || [];
    const allReviews = reviews || [];

    // Compute stats
    const totalUsers = allProfiles.length;
    const totalReviews = allReviews.length;
    const avgScore = totalReviews > 0
      ? allReviews.reduce((s: number, r: any) => s + (r.score || 0), 0) / totalReviews
      : 0;

    // Reviews per day (last 30 days)
    const dailyStats = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const dayReviews = allReviews.filter((r: any) => {
        const rd = new Date(r.created_at);
        return rd >= d && rd < nextD;
      });

      dailyStats.push({
        date: d.toISOString().slice(0, 10),
        count: dayReviews.length,
        avgScore: dayReviews.length > 0
          ? dayReviews.reduce((s: number, r: any) => s + (r.score || 0), 0) / dayReviews.length
          : null,
      });
    }

    // Score distribution
    const scoreDistribution = Array(10).fill(0);
    allReviews.forEach((r: any) => {
      const s = typeof r.score === 'number' ? Math.round(r.score) : parseInt(r.score);
      if (s >= 1 && s <= 10) {
        scoreDistribution[s - 1]++;
      }
    });

    // Language distribution
    const langDist: Record<string, number> = {};
    allReviews.forEach((r: any) => {
      const lang = r.language || 'Unknown';
      langDist[lang] = (langDist[lang] || 0) + 1;
    });

    return createJsonResponse({
      totalUsers,
      totalReviews,
      avgScore: Math.round(avgScore * 10) / 10,
      dailyStats,
      scoreDistribution,
      languageDistribution: langDist,
      recentUsers: allProfiles.slice(0, 20),
      recentReviews: allReviews.slice(0, 50),
    });

  } catch (err: any) {
    console.error('admin-stats error:', err);
    return createJsonResponse({ error: 'Internal server error', details: err.message }, 500);
  }
});

