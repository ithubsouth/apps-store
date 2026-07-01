import { createServerFn } from "@tanstack/react-start";
import { assertAdmin } from "./gate.functions";

const APK_BUCKET = "apks";
const ICON_BUCKET = "app-icons";
const ICON_URL_TTL = 60 * 60; // 1 hour
const DOWNLOAD_URL_TTL = 60 * 5; // 5 min

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
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
  const rows = await Promise.all(
    (data ?? []).map(async (a) => ({ ...a, icon_url: await signIcon(a.icon_path) })),
  );
  return rows;
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
    await assertAdmin();
    const sb = await admin();
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const safeApk = data.apkFilename.replace(/[^\w.\-]+/g, "_");
    const apkPath = `${stamp}-${rand}/${safeApk}`;
    const { data: apkSigned, error: apkErr } = await sb.storage
      .from(APK_BUCKET)
      .createSignedUploadUrl(apkPath);
    if (apkErr || !apkSigned) throw new Error(apkErr?.message ?? "APK upload URL failed");

    let icon: { path: string; url: string; token: string } | null = null;
    if (data.iconFilename) {
      const safeIcon = data.iconFilename.replace(/[^\w.\-]+/g, "_");
      const iconPath = `${stamp}-${rand}/${safeIcon}`;
      const { data: iconSigned, error: iconErr } = await sb.storage
        .from(ICON_BUCKET)
        .createSignedUploadUrl(iconPath);
      if (iconErr || !iconSigned) throw new Error(iconErr?.message ?? "Icon upload URL failed");
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
    }) => d,
  )
  .handler(async ({ data }) => {
    await assertAdmin();
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
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteApp = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await assertAdmin();
    const sb = await admin();
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
