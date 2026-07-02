<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Database & Storage Setup

Run the following SQL in the Supabase SQL Editor to fix RLS policy errors and ensure the app can upload files.

```sql
-- 1. Ensure buckets exist and are public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('app-icons', 'app-icons', true), ('apks', 'apks', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop restrictive policies
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;

-- 3. Create broad policies for both buckets
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id IN ('app-icons', 'apks'));

CREATE POLICY "Public Insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id IN ('app-icons', 'apks'));

CREATE POLICY "Public Update" ON storage.objects
    FOR UPDATE USING (bucket_id IN ('app-icons', 'apks'));

CREATE POLICY "Public Delete" ON storage.objects
    FOR DELETE USING (bucket_id IN ('app-icons', 'apks'));

-- 4. Ensure database tables are accessible
ALTER TABLE public.apps DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.apps TO anon, authenticated, service_role;

ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.audit_logs TO anon, authenticated, service_role;
```
