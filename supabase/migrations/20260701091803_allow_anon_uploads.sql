
-- Allow anonymous uploads for local development / demo purposes
-- In a production environment, you should use service role keys or proper auth

ALTER POLICY "Anyone can view apps" ON public.apps RENAME TO "Allow all access to apps";
DROP POLICY "Allow all access to apps" ON public.apps;
CREATE POLICY "Allow all access to apps" ON public.apps FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON public.apps TO anon;

-- Note: Storage bucket policies usually need to be set via the Supabase dashboard
-- or a separate storage migration if using the storage API.
-- This migration only covers the 'apps' table.
