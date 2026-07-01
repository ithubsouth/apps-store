
CREATE TABLE public.apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0.0',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  icon_path TEXT,
  apk_path TEXT NOT NULL,
  apk_filename TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.apps TO anon, authenticated;
GRANT ALL ON public.apps TO service_role;

-- RLS is disabled by default to allow easy internal uploads.
-- To secure this in production, run: ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apps DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER apps_set_updated_at
  BEFORE UPDATE ON public.apps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
