import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Package, ArrowRight } from "lucide-react";
import { listApps } from "@/lib/apps.functions";
import { SiteHeader, formatBytes } from "@/components/site-header";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { data: apps, isLoading } = useQuery({
    queryKey: ["apps"],
    queryFn: () => listApps(),
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section
        className="border-b border-border/60"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="mx-auto max-w-6xl px-6 py-16 text-primary-foreground sm:py-20">
          <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
            Internal · LEAD Group
          </span>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            The LEAD app catalog.
            <br />
            <span className="text-white/70">One place for every internal app.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/80">
            Browse, download and install the latest versions of LEAD's classroom and teacher
            apps — no sign in required.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">All apps</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {apps?.length ?? 0} app{(apps?.length ?? 0) === 1 ? "" : "s"} available
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : !apps?.length ? (
          <EmptyState />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {apps.map((a) => (
              <AppCard key={a.id} app={a} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LEAD Group · Internal use only
      </footer>
    </div>
  );
}

function AppCard({ app }: { app: Awaited<ReturnType<typeof listApps>>[number] }) {
  return (
    <Link
      to="/app/$id"
      params={{ id: app.id }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="relative flex aspect-[16/10] items-center justify-center overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        {app.icon_url ? (
          <img
            src={app.icon_url}
            alt={`${app.name} preview`}
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="h-16 w-16 text-white/80" strokeWidth={1.5} />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
          {app.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-lg font-bold text-foreground">{app.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{app.description}</p>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs">
          <div className="flex gap-4 text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">v{app.version}</span>
            </span>
            <span>{formatBytes(app.size_bytes)}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-primary transition group-hover:gap-2">
            View <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
      <div
        className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-primary-foreground"
        style={{ background: "var(--gradient-hero)" }}
      >
        <Download className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold">No apps yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Once an admin uploads apps, they'll appear here.
      </p>
    </div>
  );
}
