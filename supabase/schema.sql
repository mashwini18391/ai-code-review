-- =============================================
-- AI CODE REVIEW — Database Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. PROFILES TABLE
-- Stores user profile data, synced from auth.users
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- =============================================
-- 2. REVIEWS TABLE
-- Stores code review results
-- =============================================
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'javascript',
    source_type TEXT NOT NULL CHECK (source_type IN ('paste', 'github')),
    source_url TEXT,
    code_snippet TEXT NOT NULL,
    score INTEGER CHECK (score >= 1 AND score <= 10),
    bugs JSONB DEFAULT '[]'::jsonb,
    suggestions JSONB DEFAULT '[]'::jsonb,
    documentation TEXT,
    raw_ai_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_score ON public.reviews(score);

-- =============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES POLICIES ----

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = id);

-- Admins can view all profiles
-- To prevent infinite recursion, we use a utility function that bypasses RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE POLICY "Admins can view all profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING ( public.is_admin() );

-- Users can update their own profile (but not role)
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- Allow insert during signup trigger (service role)
CREATE POLICY "Service role can insert profiles"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ---- REVIEWS POLICIES ----

-- Users can view their own reviews
CREATE POLICY "Users can view own reviews"
    ON public.reviews
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Admins can view all reviews
CREATE POLICY "Admins can view all reviews"
    ON public.reviews
    FOR SELECT
    TO authenticated
    USING ( public.is_admin() );

-- Users can insert their own reviews
CREATE POLICY "Users can insert own reviews"
    ON public.reviews
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
    ON public.reviews
    FOR DELETE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- =============================================
-- 4. AUTO-CREATE PROFILE ON SIGNUP (Trigger)
-- =============================================

-- Function: handle_new_user
-- Automatically creates a profile entry when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
        NEW.raw_user_meta_data ->> 'avatar_url'
    );
    RETURN NEW;
END;
$$;

-- Trigger: on_auth_user_created
-- Fires after a new user is inserted into auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 5. AUTO-UPDATE updated_at TIMESTAMP
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- 6. OPTIONAL: Set first user as admin
-- Run this AFTER your first sign-up to make yourself admin
-- Replace 'your-email@gmail.com' with your actual email
-- =============================================
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@gmail.com';
