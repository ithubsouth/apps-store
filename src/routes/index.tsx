import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Download, Package, ArrowRight, Search, ListFilter } from "lucide-react";
import { listApps } from "@/lib/apps.functions";
import { SiteHeader, formatBytes } from "@/components/site-header";

export const Route = createFileRoute("/")({
  component: Home,
});

type SortOption = "manual" | "newest" | "oldest" | "name-asc" | "name-desc" | "size-asc" | "size-desc";

function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("manual");
  const { data, isLoading } = useQuery({
    queryKey: ["apps"],
    queryFn: () => listApps(),
  });

  const apps = data?.apps || [];
  const [visibleCount, setVisibleCount] = useState(12);

  const filteredApps = useMemo(() => {
    let result = [...apps];
    const query = searchQuery.toLowerCase().trim();

    if (query) {
      result = result.filter(app =>
        app.name.toLowerCase().includes(query) ||
        app.category.toLowerCase().includes(query) ||
        app.description.toLowerCase().includes(query)
      );
    }

    // Apply Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "manual":
          return (a.sort_order || 0) - (b.sort_order || 0);
        case "newest":
          return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
        case "oldest":
          return new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime();
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "size-asc":
          return (a.size_bytes || 0) - (b.size_bytes || 0);
        case "size-desc":
          return (b.size_bytes || 0) - (a.size_bytes || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [apps, searchQuery, sortBy]);

  const displayedApps = useMemo(() => {
    return filteredApps.slice(0, visibleCount);
  }, [filteredApps, visibleCount]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">All apps</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredApps.length} app{filteredApps.length === 1 ? "" : "s"} available
            </p>
          </div>

          <div className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search apps by name, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none ring-primary/20 transition focus:border-primary focus:ring-4"
              />
            </div>

            <div className="relative flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-1">
              <ListFilter className="h-4 w-4 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent py-1.5 pr-2 text-xs font-semibold outline-none cursor-pointer"
              >
                <option value="manual">Manual Order</option>
                <option value="newest">Latest Updates</option>
                <option value="oldest">Oldest First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="size-desc">Largest Size</option>
                <option value="size-asc">Smallest Size</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : filteredApps.length === 0 ? (
          <EmptyState isSearching={searchQuery.length > 0} />
        ) : (
          <>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {displayedApps.map((a) => (
                <AppCard key={a.id} app={a} />
              ))}
            </div>

            {visibleCount < filteredApps.length && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => setVisibleCount(prev => prev + 12)}
                  className="rounded-full border border-border bg-card px-8 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
                >
                  Load more apps
                </button>
              </div>
            )}
          </>
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
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:-translate-y-0.5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="relative flex aspect-square items-center justify-center overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        {app.icon_url ? (
          <img
            src={app.icon_url}
            alt={`${app.name} preview`}
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="h-10 w-10 text-white/80" strokeWidth={1.5} />
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
          {app.category || "General"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="truncate font-display text-sm font-bold text-foreground" title={app.name}>
          {app.name}
        </h3>
        <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2.5 text-[10px]">
          <div className="flex gap-2.5 text-muted-foreground">
            <span className="font-semibold text-foreground">v{app.version}</span>
            <span>{formatBytes(app.size_bytes)}</span>
          </div>
          <ArrowRight className="h-3 w-3 text-primary transition group-hover:translate-x-0.5" />
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
