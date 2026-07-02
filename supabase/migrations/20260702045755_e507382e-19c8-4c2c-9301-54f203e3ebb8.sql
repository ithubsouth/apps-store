GRANT SELECT ON public.apps TO anon;
GRANT SELECT ON public.apps TO authenticated;
GRANT ALL ON public.apps TO service_role;

GRANT ALL ON public.audit_logs TO service_role;
