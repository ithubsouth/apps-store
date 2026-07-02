
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS updated_by text;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id uuid,
  app_name text NOT NULL,
  action text NOT NULL,
  performed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO anon, authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view audit logs" ON public.audit_logs;
CREATE POLICY "Anyone can view audit logs" ON public.audit_logs FOR SELECT USING (true);
