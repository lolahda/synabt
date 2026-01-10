-- =====================================================
-- AI Video Production Platform - Complete Database Schema
-- =====================================================
-- This file contains the complete database structure for the AI Video Production Platform
-- Run this script on a fresh Supabase project to set up all tables, functions, triggers, and policies
-- =====================================================

-- =====================================================
-- 1. EXTENSIONS
-- =====================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 2. TABLES
-- =====================================================

-- -----------------------------------------------------
-- Table: user_profiles
-- Description: Extended user profile information synced with auth.users
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------
-- Table: admin_users
-- Description: Stores admin user email addresses for role management
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------
-- Table: api_keys
-- Description: Manages API keys for external services with automatic failover
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    api_key TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_service ON public.api_keys(service_name);

-- -----------------------------------------------------
-- Table: projects
-- Description: Main project information for video production
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    script TEXT NOT NULL,
    language TEXT,
    dialect TEXT,
    content_type TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    final_video_url TEXT,
    scene_count INTEGER DEFAULT 0,
    aspect_ratio TEXT DEFAULT '16:9',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- -----------------------------------------------------
-- Table: scenes
-- Description: Individual video scenes generated from script analysis
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    scene_number INTEGER NOT NULL,
    text_content TEXT NOT NULL,
    word_count INTEGER,
    estimated_duration REAL,
    character_prompt TEXT,
    video_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    sora_prediction_id TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, scene_number)
);

CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON public.scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_status ON public.scenes(status);

-- -----------------------------------------------------
-- Table: project_images
-- Description: Character reference images uploaded for video generation
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_images_project_id ON public.project_images(project_id);

-- =====================================================
-- 3. STORAGE BUCKETS
-- =====================================================

-- -----------------------------------------------------
-- Bucket: project-images
-- Description: Stores character reference images
-- -----------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'project-images',
    'project-images',
    true,
    10485760, -- 10 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------
-- Bucket: scene-videos
-- Description: Stores generated video scenes
-- -----------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'scene-videos',
    'scene-videos',
    true,
    1073741824, -- 1 GB
    ARRAY['video/mp4', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. FUNCTIONS
-- =====================================================

-- -----------------------------------------------------
-- Function: handle_new_user
-- Description: Automatically creates user profile when new user signs up
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, username)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------
-- Function: sync_user_metadata
-- Description: Syncs user metadata changes to user_profiles table
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_metadata()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.user_profiles
    SET
        username = COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'full_name', username),
        email = NEW.email
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------
-- Function: is_admin
-- Description: Checks if a user has admin privileges
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE email = user_email
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Trigger: Create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Sync user metadata on update
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_metadata();

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_images ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- RLS Policies: user_profiles
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profiles;
CREATE POLICY "Users can delete own profile"
    ON public.user_profiles
    FOR DELETE
    TO authenticated
    USING (auth.uid() = id);

-- -----------------------------------------------------
-- RLS Policies: admin_users
-- -----------------------------------------------------
DROP POLICY IF EXISTS "public_read_admin_check" ON public.admin_users;
CREATE POLICY "public_read_admin_check"
    ON public.admin_users
    FOR SELECT
    TO public
    USING (true);

-- -----------------------------------------------------
-- RLS Policies: api_keys
-- -----------------------------------------------------
DROP POLICY IF EXISTS "service_role_all_api_keys" ON public.api_keys;
CREATE POLICY "service_role_all_api_keys"
    ON public.api_keys
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------
-- RLS Policies: projects
-- -----------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_own_projects" ON public.projects;
CREATE POLICY "authenticated_select_own_projects"
    ON public.projects
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_insert_own_projects" ON public.projects;
CREATE POLICY "authenticated_insert_own_projects"
    ON public.projects
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_update_own_projects" ON public.projects;
CREATE POLICY "authenticated_update_own_projects"
    ON public.projects
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_delete_own_projects" ON public.projects;
CREATE POLICY "authenticated_delete_own_projects"
    ON public.projects
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- -----------------------------------------------------
-- RLS Policies: scenes
-- -----------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_own_scenes" ON public.scenes;
CREATE POLICY "authenticated_select_own_scenes"
    ON public.scenes
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = scenes.project_id
            AND projects.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "authenticated_insert_own_scenes" ON public.scenes;
CREATE POLICY "authenticated_insert_own_scenes"
    ON public.scenes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = scenes.project_id
            AND projects.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "authenticated_update_own_scenes" ON public.scenes;
CREATE POLICY "authenticated_update_own_scenes"
    ON public.scenes
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = scenes.project_id
            AND projects.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "authenticated_delete_own_scenes" ON public.scenes;
CREATE POLICY "authenticated_delete_own_scenes"
    ON public.scenes
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.projects
            WHERE projects.id = scenes.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- -----------------------------------------------------
-- RLS Policies: project_images
-- -----------------------------------------------------
DROP POLICY IF EXISTS "authenticated_select_own_project_images" ON public.project_images;
CREATE POLICY "authenticated_select_own_project_images"
    ON public.project_images
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_insert_own_project_images" ON public.project_images;
CREATE POLICY "authenticated_insert_own_project_images"
    ON public.project_images
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_delete_own_project_images" ON public.project_images;
CREATE POLICY "authenticated_delete_own_project_images"
    ON public.project_images
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- =====================================================
-- 7. STORAGE POLICIES
-- =====================================================

-- -----------------------------------------------------
-- Storage Policies: project-images
-- -----------------------------------------------------
DROP POLICY IF EXISTS "authenticated_insert_own_images" ON storage.objects;
CREATE POLICY "authenticated_insert_own_images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'project-images'
        AND (auth.uid())::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "public_read_project_images" ON storage.objects;
CREATE POLICY "public_read_project_images"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'project-images');

DROP POLICY IF EXISTS "service_role_all_operations_project_images" ON storage.objects;
CREATE POLICY "service_role_all_operations_project_images"
    ON storage.objects
    FOR ALL
    TO service_role
    USING (bucket_id = 'project-images')
    WITH CHECK (bucket_id = 'project-images');

-- -----------------------------------------------------
-- Storage Policies: scene-videos
-- -----------------------------------------------------
DROP POLICY IF EXISTS "public_read_scene_videos" ON storage.objects;
CREATE POLICY "public_read_scene_videos"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'scene-videos');

DROP POLICY IF EXISTS "service_role_all_operations_scene_videos" ON storage.objects;
CREATE POLICY "service_role_all_operations_scene_videos"
    ON storage.objects
    FOR ALL
    TO service_role
    USING (bucket_id = 'scene-videos')
    WITH CHECK (bucket_id = 'scene-videos');

-- =====================================================
-- 8. INITIAL DATA
-- =====================================================

-- Insert admin user (replace with your email)
INSERT INTO public.admin_users (email)
VALUES ('husseinshaaban44@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- SCHEMA SETUP COMPLETE
-- =====================================================
-- Next Steps:
-- 1. Deploy Edge Functions from supabase/functions/ directory
-- 2. Configure Auth settings (Email OTP length: 8)
-- 3. Add API keys via Admin Panel (AtlasCloud, Sora2API, Shotstack)
-- =====================================================
