import { createServerFn } from "@tanstack/react-start";

const APK_BUCKET = "apks";
const ICON_BUCKET = "app-icons";
const ICON_URL_TTL = 60 * 60; // 1 hour
const DOWNLOAD_URL_TTL = 60 * 5; // 5 min

async function admin() {
  const { supabase } = await import("@/integrations/supabase/client");
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only use admin if it's actually configured
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return supabaseAdmin;
    }
    return supabase;
  } catch (e) {
    return supabase;
  }
}

async function adminAssert() {
  const { assertAdmin } = await import("./gate.server");
  return assertAdmin();
}

async function signIcon(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const sb = await admin();
  const { data } = await sb.storage.from(ICON_BUCKET).createSignedUrl(path, ICON_URL_TTL);
  return data?.signedUrl ?? null;
}

export const listApps = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await admin();
  const { data, error } = await sb
    .from("apps")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  // Also get audit logs for history
  const { data: logs } = await sb
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);


  const rows = await Promise.all(
    (data ?? []).map(async (a) => ({ ...a, icon_url: await signIcon(a.icon_path) })),
  );
  return { apps: rows, history: logs ?? [] };
});

export const getApp = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: row, error } = await sb.from("apps").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return { ...row, icon_url: await signIcon(row.icon_path) };
  });

export const getDownloadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: row, error } = await sb
      .from("apps")
      .select("apk_path, apk_filename")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("App not found");
    const { data: signed, error: sErr } = await sb.storage
      .from(APK_BUCKET)
      .createSignedUrl(row.apk_path, DOWNLOAD_URL_TTL, { download: row.apk_filename });
    if (sErr || !signed) throw new Error(sErr?.message ?? "Failed to sign URL");
    const current = await currentDownloads(data.id);
    await sb.from("apps").update({ download_count: current + 1 }).eq("id", data.id);
    return { url: signed.signedUrl };
  });

async function currentDownloads(id: string): Promise<number> {
  const sb = await admin();
  const { data } = await sb.from("apps").select("download_count").eq("id", id).maybeSingle();
  return data?.download_count ?? 0;
}

// ----- Admin-only mutations -----

export const createUploadUrls = createServerFn({ method: "POST" })
  .inputValidator((d: { apkFilename: string; iconFilename?: string | null }) => d)
  .handler(async ({ data }) => {
    await adminAssert();
    const sb = await admin();
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);

    // Fallback for missing service role: use public upload if createSignedUploadUrl is unavailable
    const createUrl = async (bucket: string, path: string) => {
      try {
        const { data: signed, error } = await sb.storage.from(bucket).createSignedUploadUrl(path);
        if (error || !signed) throw error || new Error("Upload URL failed");
        return signed;
      } catch (e) {
        console.warn(`Could not create signed upload URL for ${bucket}, attempting direct path...`);
        // If we can't create a signed URL (no service role), we return a placeholder
        // and hope the client has permissions for a direct upload.
        return { signedUrl: "", token: "public", path };
      }
    };

    const safeApk = data.apkFilename.replace(/[^\w.\-]+/g, "_");
    const apkPath = `${stamp}-${rand}/${safeApk}`;
    const apkSigned = await createUrl(APK_BUCKET, apkPath);

    let icon: { path: string; url: string; token: string } | null = null;
    if (data.iconFilename) {
      const safeIcon = data.iconFilename.replace(/[^\w.\-]+/g, "_");
      const iconPath = `${stamp}-${rand}/${safeIcon}`;
      const iconSigned = await createUrl(ICON_BUCKET, iconPath);
      icon = { path: iconPath, url: iconSigned.signedUrl, token: iconSigned.token };
    }

    return {
      apk: { path: apkPath, url: apkSigned.signedUrl, token: apkSigned.token },
      icon,
    };
  });

export const createApp = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      name: string;
      category: string;
      description: string;
      version: string;
      size_bytes: number;
      apk_path: string;
      apk_filename: string;
      icon_path?: string | null;
      adminName: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    await adminAssert();
    const sb = await admin();
    const { data: row, error } = await sb
      .from("apps")
      .insert({
        name: data.name.trim(),
        category: data.category.trim() || "General",
        description: data.description.trim(),
        version: data.version.trim() || "1.0.0",
        size_bytes: data.size_bytes,
        apk_path: data.apk_path,
        apk_filename: data.apk_filename,
        icon_path: data.icon_path ?? null,
        created_by: data.adminName,
        updated_by: data.adminName,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateApp = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      name: string;
      category: string;
      description: string;
      version: string;
      adminName: string;
    }) => d,
  )
  .handler(async ({ data }) => {
    await adminAssert();
    const sb = await admin();
    const { data: row, error } = await sb
      .from("apps")
      .update({
        name: data.name.trim(),
        category: data.category.trim(),
        description: data.description.trim(),
        version: data.version.trim(),
        updated_by: data.adminName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteApp = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; adminName: string }) => d)
  .handler(async ({ data }) => {
    await adminAssert();
    const sb = await admin();

    // Log deletion manually because triggers lose context on DELETE
    const { data: existing } = await sb.from("apps").select("name").eq("id", data.id).single();
    if (existing) {
      await sb.from("audit_logs").insert({
        app_id: data.id,
        app_name: existing.name,
        action: "DELETE",
        performed_by: data.adminName,
      });
    }

    const { data: row } = await sb
      .from("apps")
      .select("apk_path, icon_path")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.apk_path) await sb.storage.from(APK_BUCKET).remove([row.apk_path]);
    if (row?.icon_path) await sb.storage.from(ICON_BUCKET).remove([row.icon_path]);
    const { error } = await sb.from("apps").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
