
-- ABSOLUTE FIX: Disable RLS for the apps table and storage
-- Run this in the Supabase SQL Editor to fix the "RLS policy" error instantly.

-- 1. Disable RLS on the apps table
ALTER TABLE public.apps DISABLE ROW LEVEL SECURITY;

-- 2. Ensure all roles can do everything to the apps table
GRANT ALL ON public.apps TO anon, authenticated, service_role;

-- 3. Create buckets if they don't exist (must be done via Dashboard usually, but this is a helper)
-- Note: Storage buckets are in the 'storage' schema.

-- 4. Storage Policies (Allow anyone to do anything to 'apks' and 'app-icons')
DO $$
BEGIN
    -- Policy for 'apks' bucket
    INSERT INTO storage.policies (name, definition, check, operation, bucket_id)
    VALUES ('Allow All APK', '(true)', '(true)', 'INSERT', 'apks'),
           ('Allow All APK Select', '(true)', null, 'SELECT', 'apks'),
           ('Allow All APK Delete', '(true)', null, 'DELETE', 'apks')
    ON CONFLICT (name) DO NOTHING;

    -- Policy for 'app-icons' bucket
    INSERT INTO storage.policies (name, definition, check, operation, bucket_id)
    VALUES ('Allow All Icon', '(true)', '(true)', 'INSERT', 'app-icons'),
           ('Allow All Icon Select', '(true)', null, 'SELECT', 'app-icons'),
           ('Allow All Icon Delete', '(true)', null, 'DELETE', 'app-icons')
    ON CONFLICT (name) DO NOTHING;
END $$;
