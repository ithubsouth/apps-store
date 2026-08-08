import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Loader2, Package, Share2 } from "lucide-react";
import { useState } from "react";
import { getApp, getDownloadUrl } from "@/lib/apps.functions";
import { SiteHeader, formatBytes, formatDate } from "@/components/site-header";
import { ShareDialog } from "@/components/share-dialog";

export const Route = createFileRoute("/app/$id")({
  head: () => ({
    meta: [
      { title: "App details & APK download · LEAD App Store" },
      {
        name: "description",
        content:
          "View app details, download the APK, or share it to another phone, TV or panel via Nearby Share, Bluetooth or QR code.",
      },
      { property: "og:title", content: "App details & APK download · LEAD App Store" },
      {
        property: "og:description",
        content: "Download or share this Android app to phones, TVs and panels in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppDetail,
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-bold">App not found</h1>
        <Link to="/" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Back to all apps
        </Link>
      </div>
    </div>
  ),
});

function AppDetail() {
  const { id } = Route.useParams();
  const getDownload = useServerFn(getDownloadUrl);
  const [downloading, setDownloading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const { data: app, isLoading } = useQuery({
    queryKey: ["app", id],
    queryFn: async () => {
      const a = await getApp({ data: { id } });
      if (!a) throw notFound();
      return a;
    },
  });

  async function handleDownload() {
    if (!app) return;
    setDownloading(true);
    try {
      const { url } = await getDownload({ data: { id } });

      // Try to fetch the file and trigger download with the exact filename
      // This bypasses server-side encoding issues in the Content-Disposition header
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download request failed");

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = app.apk_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Blob download failed, falling back to direct navigation", err);
      // Fallback: if fetch fails (CORS, memory, etc), use direct navigation
      const { url } = await getDownload({ data: { id } });
      window.location.href = url;
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to all apps
        </Link>

        {isLoading || !app ? (
          <div className="mt-8 h-80 animate-pulse rounded-3xl bg-muted" />
        ) : (
          <div
            className="mt-6 overflow-hidden rounded-3xl border border-border bg-card"
            style={{ boxShadow: "var(--shadow-elevated)" }}
          >
            <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[280px_1fr]">
              <div
                className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl"
                style={{ background: "var(--gradient-hero)" }}
              >
                {app.icon_url ? (
                  <img src={app.icon_url} alt={app.name} className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-20 w-20 text-white/80" strokeWidth={1.5} />
                )}
              </div>

              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {app.category}
                </span>
                <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">{app.name}</h1>
                <p className="mt-3 text-base text-muted-foreground">{app.description}</p>

                <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-3">
                  <MetaField label="Version" value={app.version} />
                  <MetaField label="Size" value={formatBytes(app.size_bytes)} />
                  <MetaField label="Last updated" value={formatDate(app.updated_at)} />
                </dl>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-95 disabled:opacity-70"
                    style={{ background: "var(--gradient-hero)" }}
                  >
                    {downloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {downloading ? "Preparing..." : "Download APK"}
                  </button>
                  <button
                    onClick={() => setShareOpen(true)}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-semibold transition hover:bg-muted"
                  >
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {app.apk_filename} · {app.download_count} downloads
                </p>
              </div>
            </div>
          </div>
        )}

        {app && (
          <ShareDialog
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            appId={id}
            appName={app.name}
            apkFilename={app.apk_filename}
            pageUrl={typeof window !== "undefined" ? window.location.href : ""}
            getFileUrl={async () => (await getDownload({ data: { id } })).url}
          />
        )}
      </div>

    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
