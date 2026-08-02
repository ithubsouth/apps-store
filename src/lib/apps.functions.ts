import { createServerFn } from "@tanstack/react-start";

const APK_BUCKET = "apks";
const ICON_BUCKET = "app-icons";

// Minimal safe columns that we are sure exist
const APP_COLUMNS = "id, name, category, description, version, size_bytes, apk_path, apk_filename, icon_path, created_by, updated_by, created_at, updated_at, download_count";

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
  return sb.storage.from(ICON_BUCKET).getPublicUrl(path).data.publicUrl;
}

export const listApps = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await admin();

  try {
    // Try with sort_order, but catch failure immediately
    const { data, error } = await sb
      .from("apps")
      .select(`${APP_COLUMNS}, sort_order`)
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false });

    if (error && error.message.includes("sort_order")) {
      console.warn("sort_order missing, falling back to basic columns");
      const { data: fallback, error: fallbackErr } = await sb
        .from("apps")
        .select(APP_COLUMNS)
        .order("updated_at", { ascending: false });

      if (fallbackErr) throw new Error(fallbackErr.message);
      return processResults(fallback, sb);
    }

    if (error) throw new Error(error.message);
    return processResults(data, sb);
  } catch (e) {
    console.error("listApps failed, using ultimate fallback", e);
    const { data: fallback } = await sb
      .from("apps")
      .select(APP_COLUMNS)
      .order("updated_at", { ascending: false });
    return processResults(fallback || [], sb);
  }
});

async function processResults(data: any[] | null, sb: any) {
  // Get audit logs
  const { data: logs } = await sb
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []).map((a) => ({
    ...a,
    icon_url: a.icon_path ? sb.storage.from(ICON_BUCKET).getPublicUrl(a.icon_path).data.publicUrl : null,
  }));
  return { apps: rows, history: logs ?? [] };
}

export const getApp = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: row, error } = await sb
      .from("apps")
      .select(APP_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();

    if (error) {
      // If specific columns fail, try * as last resort
      const { data: alt } = await sb.from("apps").select("*").eq("id", data.id).maybeSingle();
      if (alt) return { ...alt, icon_url: await signIcon(alt.icon_path) };
      throw new Error(error.message);
    }
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

    const publicUrl = sb.storage.from(APK_BUCKET).getPublicUrl(row.apk_path).data.publicUrl;
    return { url: `${publicUrl}?download=${encodeURIComponent(row.apk_filename)}` };
  });

// ----- Admin-only mutations -----

export const createUploadUrls = createServerFn({ method: "POST" })
  .inputValidator((d: { apkFilename: string; iconFilename?: string | null }) => d)
  .handler(async ({ data }) => {
    await adminAssert();
    const sb = await admin();
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);

    const createUrl = async (bucket: string, path: string) => {
      try {
        const { data: signed, error } = await sb.storage.from(bucket).createSignedUploadUrl(path);
        if (error || !signed) throw error || new Error("Upload URL failed");
        return signed;
      } catch (e) {
        console.warn(`Could not create signed upload URL for ${bucket}, attempting direct path...`);
        return { signedUrl: "", token: "public", path };
      }
    };

    const safeApk = data.apkFilename.replace(/[^\w.\-()]+/g, "_");
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

    // First, perform the insert
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
      .select(APP_COLUMNS) // Avoid * and avoid sort_order
      .maybeSingle();

    if (error) {
      if (error.message.includes("sort_order")) {
        // Retry without select, just get the ID
        const { data: retry } = await sb
          .from("apps")
          .select(APP_COLUMNS)
          .eq("apk_path", data.apk_path)
          .maybeSingle();
        if (retry) return retry;
      }
      throw new Error(error.message);
    }

    if (!row) throw new Error("App created but could not retrieve data");

    await sb.from("audit_logs").insert({
      app_id: row.id,
      app_name: row.name,
      action: "UPLOAD",
      performed_by: data.adminName,
    });
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
      apk_path?: string;
      apk_filename?: string;
      icon_path?: string | null;
      size_bytes?: number;
    }) => d,
  )
  .handler(async ({ data }) => {
    await adminAssert();
    const sb = await admin();
    const updateData: any = {
      name: data.name.trim(),
      category: data.category.trim() || "General",
      description: data.description.trim(),
      version: data.version.trim(),
      updated_by: data.adminName,
      updated_at: new Date().toISOString(),
    };

    if (data.apk_path) {
      updateData.apk_path = data.apk_path;
      updateData.apk_filename = data.apk_filename;
      updateData.size_bytes = data.size_bytes;
    }
    if (data.icon_path !== undefined) {
      updateData.icon_path = data.icon_path;
    }

    const { data: row, error } = await sb
      .from("apps")
      .update(updateData)
      .eq("id", data.id)
      .select(APP_COLUMNS)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("App not found");

    await sb.from("audit_logs").insert({
      app_id: row.id,
      app_name: row.name,
      action: "EDIT",
      performed_by: data.adminName,
    });
    return row;
  });

export const reorderApps = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; sort_order: number }[]) => d)
  .handler(async ({ data }) => {
    await adminAssert();
    const sb = await admin();

    for (const item of data) {
      const { error } = await sb
        .from("apps")
        .update({ sort_order: item.sort_order } as never)
        .eq("id", item.id);
      if (error) console.error(`Failed to update sort_order for ${item.id}`, error);
    }

    return { ok: true };
  });

export const deleteApp = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; adminName: string }) => d)
  .handler(async ({ data }) => {
    await adminAssert();
    const sb = await admin();

    const { data: existing } = await sb.from("apps").select("name").eq("id", data.id).maybeSingle();
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
