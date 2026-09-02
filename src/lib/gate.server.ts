import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

export function getSessionConfig() {
  return {
    password: process.env.SESSION_SECRET || "a-very-long-and-secure-fallback-secret-for-app-store",
    name: "app-store-admin",
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

const PASSCODE_KEY = "admin_passcode";

async function settingsClient() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) return supabaseAdmin;
  } catch {
    /* ignore */
  }
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

export async function getExpectedPasscode(): Promise<string> {
  try {
    const sb = await settingsClient();
    const { data } = await (sb as any)
      .from("app_settings")
      .select("value")
      .eq("key", PASSCODE_KEY)
      .maybeSingle();
    if (data?.value) return data.value as string;
  } catch {
    /* fall through to default */
  }
  return process.env.ADMIN_PASSCODE || "Admin@123";
}

export async function savePasscode(next: string, by: string) {
  const sb = await settingsClient();
  const { error } = await (sb as any)
    .from("app_settings")
    .upsert({ key: PASSCODE_KEY, value: next, updated_by: by, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export function matches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function assertAdmin() {
  const session = await useSession<GateSession>(getSessionConfig());
  if (!session.data.unlocked) {
    throw new Error("Unauthorized");
  }
}
