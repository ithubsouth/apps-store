import { createServerFn } from "@tanstack/react-start";

export const getAdminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { useSession } = await import("@tanstack/react-start/server");
  const { getSessionConfig } = await import("./gate.server");
  const session = await useSession(getSessionConfig());
  return { isAdmin: !!session.data.unlocked };
});

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string }) => data)
  .handler(async ({ data }) => {
    const { useSession } = await import("@tanstack/react-start/server");
    const { getSessionConfig, matches } = await import("./gate.server");

    const expected = process.env.ADMIN_PASSCODE || "Admin@123";

    if (!data.passcode) {
      return { ok: false as const };
    }

    if (!matches(data.passcode, expected)) {
      return { ok: false as const };
    }
    const session = await useSession(getSessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { useSession } = await import("@tanstack/react-start/server");
  const { getSessionConfig } = await import("./gate.server");
  const session = await useSession(getSessionConfig());
  await session.clear();
  return { ok: true as const };
});

export const fixDatabaseSecurity = createServerFn({ method: "POST" }).handler(async () => {
  return {
    success: false,
    message: "Manual intervention required.",
    sql: `
-- 1. Create/Update buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-icons', 'app-icons', true), ('apks', 'apks', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Policies (Allow anyone to upload/read/delete)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id IN ('app-icons', 'apks'));
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('app-icons', 'apks'));
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id IN ('app-icons', 'apks'));
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id IN ('app-icons', 'apks'));

-- 3. Table Permissions & Schema
ALTER TABLE public.apps ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.apps DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.apps TO anon, authenticated, service_role;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.audit_logs TO anon, authenticated, service_role;
    `
  };
});

