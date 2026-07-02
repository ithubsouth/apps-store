import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent, useMemo } from "react";
import { Loader2, LogOut, Lock, Shield, Trash2, Upload, Eye, EyeOff, History, Edit2, Check, X, Search } from "lucide-react";
import { toast } from "sonner";
import {
  getAdminStatus,
  lockAdmin,
  unlockAdmin,
  fixDatabaseSecurity,
} from "@/lib/gate.functions";
import {
  createApp,
  updateApp,
  createUploadUrls,
  deleteApp,
  listApps,
} from "@/lib/apps.functions";
import { SiteHeader, formatBytes, formatDate } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const status = useServerFn(getAdminStatus);
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => status(),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="grid h-11 w-11 place-items-center rounded-2xl text-primary-foreground"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold">Admin console</h1>
              <p className="text-sm text-muted-foreground">
                Upload and manage APKs for the internal store.
              </p>
            </div>
          </div>
          {data?.isAdmin && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Logged in as:</span>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                {typeof window !== 'undefined' ? localStorage.getItem("admin_name") || "Admin" : "Admin"}
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        ) : data?.isAdmin ? (
          <AdminPanel onLock={() => refetch()} />
        ) : (
          <UnlockForm onUnlocked={() => refetch()} />
        )}
      </div>
    </div>
  );
}

function UnlockForm({ onUnlocked }: { onUnlocked: () => void }) {
  const unlock = useServerFn(unlockAdmin);
  const [pwd, setPwd] = useState("");
  const [name, setName] = useState(typeof window !== 'undefined' ? localStorage.getItem("admin_name") || "" : "");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setPending(true);
    setError(false);
    try {
      const { ok } = await unlock({ data: { passcode: pwd } });
      if (ok) {
        localStorage.setItem("admin_name", name);
        toast.success("Admin access granted");
        onUnlocked();
      } else {
        setError(true);
        toast.error("Invalid passcode");
      }
    } catch (err) {
      console.error("Unlock error:", err);
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="mb-6 flex items-center gap-2 text-primary">
        <Lock className="h-4 w-4" />
        <span className="text-sm font-semibold">Admin access</span>
      </div>
      <h2 className="font-display text-xl font-bold">Enter your details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Identify yourself to manage the store.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. John Doe"
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none ring-ring/40 transition focus:ring-2"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Admin Passcode</label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Passcode"
              className="w-full rounded-xl border border-input bg-background pl-4 pr-11 py-2.5 text-sm outline-none ring-ring/40 transition focus:ring-2"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {error && <p className="text-xs text-destructive">Incorrect passcode.</p>}
        <button
          type="submit"
          disabled={pending || !pwd || !name}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
          style={{ background: "var(--gradient-hero)" }}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />} Unlock
        </button>
      </form>
    </div>
  );
}

function AdminPanel({ onLock }: { onLock: () => void }) {
  const lock = useServerFn(lockAdmin);
  const fix = useServerFn(fixDatabaseSecurity);
  const qc = useQueryClient();
  const [adminSearch, setAdminSearch] = useState("");
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["apps-admin"],
    queryFn: () => listApps(),
  });

  const apps = data?.apps || [];
  const history = data?.history || [];

  const filteredApps = useMemo(() => {
    const query = adminSearch.toLowerCase().trim();
    if (!query) return apps;
    return apps.filter((app: any) =>
      app.name.toLowerCase().includes(query) ||
      app.version.toLowerCase().includes(query) ||
      (app.created_by || "").toLowerCase().includes(query)
    );
  }, [apps, adminSearch]);

  async function handleLock() {
    await lock();
    qc.clear();
    toast.success("Logged out successfully");
    onLock();
  }

  async function handleFix() {
    toast.loading("Attempting to fix security...", { id: "fix" });
    const res = await fix();
    if (res.success) {
      toast.success(res.message, { id: "fix" });
      refetch();
    } else {
      toast.error("Could not fix automatically. Please use the Supabase SQL Editor.", {
        id: "fix",
        description: "Paste: ALTER TABLE public.apps DISABLE ROW LEVEL SECURITY;"
      });
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex justify-end items-center">
        <button
          onClick={handleLock}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Lock admin
        </button>
      </div>


      <UploadForm
        onCreated={() => {
          refetch();
          qc.invalidateQueries({ queryKey: ["apps"] });
        }}
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-lg font-bold">Manage apps</h2>
            <div className="relative w-full sm:max-w-[240px]">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search your apps..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                className="w-full rounded-xl border border-border bg-card py-1.5 pl-9 pr-3 text-xs outline-none focus:border-primary transition"
              />
            </div>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : !filteredApps.length ? (
            <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              {adminSearch ? "No matching apps found." : "No apps uploaded yet."}
            </p>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {filteredApps.map((a: any) => (
                <AppRow
                  key={a.id}
                  app={a}
                  onChanged={() => {
                    refetch();
                    qc.invalidateQueries({ queryKey: ["apps"] });
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-display text-lg font-bold">Activity log</h2>
          </div>
          <div className="space-y-3 overflow-hidden rounded-2xl border border-border bg-card p-4">
            {!history.length ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              history.map((log: any) => (
                <div key={log.id} className="border-l-2 border-primary/20 pl-3 py-0.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                    {log.action}
                  </div>
                  <p className="mt-0.5 text-xs font-medium">
                    {log.performed_by} <span className="text-muted-foreground font-normal">
                      {log.action === 'UPLOAD' ? 'uploaded' : log.action === 'EDIT' ? 'edited' : 'deleted'}
                    </span> {log.app_name}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{formatDate(log.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function AppRow({
  app,
  onChanged,
}: {
  app: any;
  onChanged: () => void;
}) {
  const del = useServerFn(deleteApp);
  const update = useServerFn(updateApp);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: app.name,
    version: app.version,
    category: app.category,
    description: app.description,
  });

  async function handleDelete() {
    const adminName = localStorage.getItem("admin_name") || "Admin";
    if (!confirm(`Delete "${app.name}"? This removes the APK file too.`)) return;
    setPending(true);
    try {
      await del({ data: { id: app.id, adminName } });
      toast.success("App deleted successfully");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete app");
    } finally {
      setPending(false);
    }
  }

  async function handleSave() {
    const adminName = localStorage.getItem("admin_name") || "Admin";
    setPending(true);
    try {
      await update({ data: { ...form, id: app.id, adminName } });
      toast.success("App updated successfully");
      setEditing(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <div className="p-4 space-y-3 bg-muted/30">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
            placeholder="App name"
          />
          <input
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            value={form.version}
            onChange={e => setForm({...form, version: e.target.value})}
            placeholder="Version"
          />
        </div>
        <textarea
          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm min-h-[60px]"
          value={form.description}
          onChange={e => setForm({...form, description: e.target.value})}
          placeholder="Description"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setEditing(false)}
            className="inline-flex h-8 items-center px-3 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 bg-primary px-3 text-xs font-medium text-primary-foreground rounded-lg"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div
        className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        {app.icon_url ? (
          <img src={app.icon_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-bold">{app.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-semibold">{app.name}</div>
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">v{app.version}</span>
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          By {app.created_by || 'Unknown'} · Updated by {app.updated_by || 'Unknown'}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setEditing(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          Delete
        </button>
      </div>
    </div>
  );
}

function UploadForm({ onCreated }: { onCreated: () => void }) {
  const getUrls = useServerFn(createUploadUrls);
  const create = useServerFn(createApp);
  const [form, setForm] = useState({
    name: "",
    category: "Education",
    version: "1.0.0",
    description: "",
  });
  const [apk, setApk] = useState<File | null>(null);
  const [icon, setIcon] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function reset() {
    setForm({ name: "", category: "Education", version: "1.0.0", description: "" });
    setApk(null);
    setIcon(null);
  }

  async function uploadWithSignedUrl(
    bucket: string,
    path: string,
    token: string,
    file: File,
  ) {
    if (token === "public") {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw new Error(error.message);
      return;
    }

    const { error } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(path, token, file, { contentType: file.type || undefined });
    if (error) throw new Error(error.message);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const adminName = typeof window !== 'undefined' ? localStorage.getItem("admin_name") || "Admin" : "Admin";
    if (!apk) {
      setError("Please choose an APK file.");
      return;
    }
    if (!form.name.trim()) {
      setError("Please enter an app name.");
      return;
    }
    setPending(true);
    try {
      setProgress("Requesting upload URL...");
      const urls = await getUrls({
        data: { apkFilename: apk.name, iconFilename: icon?.name ?? null },
      });
      setProgress("Uploading APK...");
      await uploadWithSignedUrl("apks", urls.apk.path, urls.apk.token, apk);
      if (icon && urls.icon) {
        setProgress("Uploading icon...");
        await uploadWithSignedUrl("app-icons", urls.icon.path, urls.icon.token, icon);
      }
      setProgress("Saving app...");
      await create({
        data: {
          name: form.name,
          category: form.category,
          description: form.description,
          version: form.version,
          size_bytes: apk.size,
          apk_path: urls.apk.path,
          apk_filename: apk.name,
          icon_path: urls.icon?.path ?? null,
          adminName,
        },
      });
      setProgress(null);
      reset();
      toast.success("App published successfully!");
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
      setProgress(null);
    }
  }

  return (
    <section
      className="rounded-2xl border border-border bg-card p-6 sm:p-8"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-2 mb-6">
        <Upload className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Upload a new app</h2>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field label="App name" required>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Classroom TV app"
          />
        </Field>
        <Field label="Category">
          <input
            className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Education"
          />
        </Field>
        <Field label="Version">
          <input
            className="input"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            placeholder="1.0.0"
          />
        </Field>
        <Field label="Icon / cover image (optional)">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setIcon(e.target.files?.[0] ?? null)}
            className="file-input"
          />
        </Field>
        <Field label="Description" full>
          <textarea
            className="input min-h-[90px] resize-y"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Play resource seamlessly on TV from teacher tablet"
          />
        </Field>
        <Field label="APK file" required full>
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(e) => setApk(e.target.files?.[0] ?? null)}
            className="file-input"
          />
          {apk && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {apk.name} · {formatBytes(apk.size)}
            </p>
          )}
        </Field>

        {error && (
          <div className="sm:col-span-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        {progress && (
          <div className="sm:col-span-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {progress}
          </div>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
            style={{ background: "var(--gradient-hero)" }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Publish app
          </button>
        </div>
      </form>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--color-input);
          background: var(--color-background);
          padding: 0.6rem 0.85rem;
          font-size: 0.875rem;
          outline: none;
          transition: box-shadow 0.15s;
        }
        .input:focus { box-shadow: 0 0 0 2px oklch(0.55 0.15 265 / 0.35); }
        .file-input {
          width: 100%;
          font-size: 0.85rem;
        }
        .file-input::file-selector-button {
          margin-right: 0.75rem;
          border: 0;
          border-radius: 0.6rem;
          background: var(--color-secondary);
          color: var(--color-secondary-foreground);
          padding: 0.45rem 0.85rem;
          font-weight: 600;
          font-size: 0.8rem;
          cursor: pointer;
        }
      `}</style>
    </section>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}
