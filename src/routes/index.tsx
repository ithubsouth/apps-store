import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Download, Package, ArrowRight, Search } from "lucide-react";
import { listApps } from "@/lib/apps.functions";
import { SiteHeader, formatBytes } from "@/components/site-header";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["apps"],
    queryFn: () => listApps(),
  });

  const apps = data?.apps || [];

  const filteredApps = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return apps;

    return apps.filter(app =>
      app.name.toLowerCase().includes(query) ||
      app.category.toLowerCase().includes(query) ||
      app.description.toLowerCase().includes(query)
    );
  }, [apps, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">All apps</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredApps.length} app{filteredApps.length === 1 ? "" : "s"} available
            </p>
          </div>

          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search apps by name, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none ring-primary/20 transition focus:border-primary focus:ring-4"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : filteredApps.length === 0 ? (
          <EmptyState isSearching={searchQuery.length > 0} />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredApps.map((a) => (
              <AppCard key={a.id} app={a} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} · App Store
      </footer>
    </div>
  );
}

function AppCard({ app }: { app: any }) {
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

function EmptyState({ isSearching }: { isSearching?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
      <div
        className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-primary-foreground"
        style={{ background: "var(--gradient-hero)" }}
      >
        <Download className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-bold">
        {isSearching ? "No apps found" : "No apps yet"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {isSearching
          ? "Try adjusting your search terms to find what you're looking for."
          : "Once an admin uploads apps, they'll appear here."}
      </p>
    </div>
  );
}
