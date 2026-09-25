import { Link, useMatch } from "@tanstack/react-router";
import { Download, Package, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStatus } from "@/lib/gate.functions";
import {
  getDownloadedApk,
  listDownloadedApks,
  openApkFileManager,
  openApkInstaller,
  type DownloadedApk,
} from "@/lib/apk-cache";

export function SiteHeader() {
  const status = useServerFn(getAdminStatus);
  const { data } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => status(),
  });

  const isAdminPage = useMatch({ from: "/admin", shouldThrow: false });

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-primary-foreground shadow-sm"
            style={{ background: "var(--gradient-hero)" }}
          >
            <Package className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="font-display text-sm font-bold tracking-tight">App Store</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <DownloadedAppsMenu />
          <button
            type="button"
            onClick={() => window.location.reload()}
            aria-label="Refresh page"
            title="Refresh page"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition hover:bg-muted sm:h-9 sm:w-9"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function DownloadedAppsMenu() {
  const [open, setOpen] = useState(false);
  const [downloads, setDownloads] = useState<DownloadedApk[]>([]);

  function refreshDownloads() {
    setDownloads(listDownloadedApks());
  }

  useEffect(() => {
    refreshDownloads();
    window.addEventListener("apk-downloads-changed", refreshDownloads);
    return () => window.removeEventListener("apk-downloads-changed", refreshDownloads);
  }, []);

  async function install(item: DownloadedApk) {
    const file = await getDownloadedApk(item);
    if (file) {
      openApkInstaller(file);
    } else {
      window.alert("This APK is no longer available in browser storage. Download it again.");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="View downloaded apps"
        title="View downloaded apps"
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition hover:bg-muted sm:h-9 sm:w-9"
      >
        <Download className="h-4 w-4" />
        {downloads.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
            {downloads.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[calc(100vw-2rem)] max-w-72 rounded-xl border border-border bg-card p-3 shadow-lg sm:top-11">
          <p className="text-sm font-semibold">Downloaded apps</p>
          {downloads.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No APKs downloaded yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {downloads.map((item) => (
                <div key={item.cacheKey} className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 p-2">
                  <span className="min-w-0 truncate text-xs font-medium" title={item.filename}>
                    {item.filename}
                  </span>
                  <button
                    type="button"
                    onClick={() => install(item)}
                    className="shrink-0 rounded-md bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground"
                  >
                    Install
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={openApkFileManager}
            className="mt-3 w-full rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted"
          >
            Open media center / file manager
          </button>
        </div>
      )}
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
