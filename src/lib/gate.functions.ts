import { createServerFn } from "@tanstack/react-start";

export const ADMIN_EMAILS = [
  "gkmech22@gmail.com",
  "karthik.g@leadschool.in",
  "ithub.south@leadschool.in",
  "mohan.prasad@leadschool.in",
  "akhilesh.gupta@leadschool.in",
];

export const isAdminEmail = (email: string) =>
  ADMIN_EMAILS.includes(email.trim().toLowerCase());

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
    const { getSessionConfig, matches, getExpectedPasscode } = await import("./gate.server");

    const expected = await getExpectedPasscode();

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

export const setAdminPasscode = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; currentPasscode: string; newPasscode: string }) => data)
  .handler(async ({ data }) => {
    const { matches, getExpectedPasscode, savePasscode } = await import("./gate.server");

    const email = (data.email || "").trim().toLowerCase();
    if (!isAdminEmail(email)) {
      return { ok: false as const, error: "This email is not an authorised admin." };
    }
    if (!data.newPasscode || data.newPasscode.length < 6) {
      return { ok: false as const, error: "New password must be at least 6 characters." };
    }
    const expected = await getExpectedPasscode();
    if (!data.currentPasscode || !matches(data.currentPasscode, expected)) {
      return { ok: false as const, error: "Current password is incorrect." };
    }
    try {
      await savePasscode(data.newPasscode, email);
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Could not save password." };
    }
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

