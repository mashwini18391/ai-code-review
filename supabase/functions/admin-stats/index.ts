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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify user identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role using service role (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all profiles
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch all reviews
    const { data: reviews } = await supabaseAdmin
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    const allProfiles = profiles || [];
    const allReviews = reviews || [];

    // Compute stats
    const totalUsers = allProfiles.length;
    const totalReviews = allReviews.length;
    const avgScore = totalReviews > 0
      ? allReviews.reduce((s: number, r: any) => s + (r.score || 0), 0) / totalReviews
      : 0;

    // Reviews per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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

    return new Response(
      JSON.stringify({
        totalUsers,
        totalReviews,
        avgScore: Math.round(avgScore * 10) / 10,
        dailyStats,
        scoreDistribution,
        languageDistribution: langDist,
        recentUsers: allProfiles.slice(0, 20),
        recentReviews: allReviews.slice(0, 50),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('admin-stats error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
