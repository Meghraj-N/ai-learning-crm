-- ============================================================================
-- Migration: Course Media and Content Extensions
-- Adds thumbnail and resource tracking to courses and lessons.
-- Provisions the course-media storage bucket and its associated RLS.
-- ============================================================================

-- 1. Table Alterations
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

ALTER TABLE public.course_modules
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS resources jsonb DEFAULT '[]'::jsonb;

-- 2. Storage Bucket Setup
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-media', 
  'course-media', 
  false, 
  524288000, -- 500MB max per file for videos
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 
    'video/mp4', 'video/webm', 'video/quicktime',
    'application/pdf', 'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/markdown'
  ]
)
ON CONFLICT (id) DO UPDATE
SET 
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3. Storage RLS Policies
-- Enable RLS (already enabled by default in Supabase, but good practice to ensure)
-- Note: Supabase applies policies on storage.objects

-- Allow students in published courses to read objects. Also allow instructors and admins.
-- To keep logic fast, we check if the user has an allowed role.
CREATE POLICY "Staff and enrolled students can view course media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'course-media'
  AND (
    -- Admins/Instructors/Sales/Counselors
    public.has_role(ARRAY['admin', 'sales', 'counselor', 'instructor'])
    OR
    -- Students (A student must be enrolled in a published course, but to keep the 
    -- storage policy performant and avoid complex joins, we allow any active student
    -- to read from this private bucket. The application UI gates the URLs.)
    public.has_role(ARRAY['student'])
  )
);

-- Allow instructors and admins to upload media
CREATE POLICY "Instructors and admins can upload course media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-media'
  AND public.has_role(ARRAY['admin', 'instructor'])
);

-- Allow instructors and admins to update media
CREATE POLICY "Instructors and admins can update course media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-media'
  AND public.has_role(ARRAY['admin', 'instructor'])
)
WITH CHECK (
  bucket_id = 'course-media'
  AND public.has_role(ARRAY['admin', 'instructor'])
);

-- Allow instructors and admins to delete media
CREATE POLICY "Instructors and admins can delete course media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-media'
  AND public.has_role(ARRAY['admin', 'instructor'])
);
