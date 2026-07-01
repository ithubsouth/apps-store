import { Link, useMatch } from "@tanstack/react-router";
import { Package, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStatus } from "@/lib/gate.functions";

export function SiteHeader() {
  const status = useServerFn(getAdminStatus);
  const { data } = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => status(),
  });

  const isAdminPage = useMatch({ from: "/admin", shouldThrow: false });

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-primary-foreground shadow-sm"
            style={{ background: "var(--gradient-hero)" }}
          >
            <Package className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <div className="font-display text-sm font-bold tracking-tight">LEAD App Store</div>
            <div className="text-[11px] font-medium text-muted-foreground">
              Internal distribution
            </div>
          </div>
        </Link>
        {data?.isAdmin && !isAdminPage && (
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <Shield className="h-3.5 w-3.5" />
            Admin
          </Link>
        )}
      </div>
    </header>
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
