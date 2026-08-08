import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Radio } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { beamReceive, type BeamHandle } from "@/lib/beam";
import { saveFile } from "@/lib/apk-cache";

export const Route = createFileRoute("/receive")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Receive an APK directly · LEAD App Store" },
      {
        name: "description",
        content:
          "Open this page on the receiving device to get an APK sent directly from another phone, laptop, TV or panel — no manual file sharing needed.",
      },
      { property: "og:title", content: "Receive an APK directly · LEAD App Store" },
      {
        property: "og:description",
        content: "Enter the beam code and the APK arrives and saves automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReceivePage,
});

function ReceivePage() {
  const initial =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("code") ?? "")
      : "";
  const [code, setCode] = useState(initial);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState<string | null>(null);
  const handle = useRef<BeamHandle | null>(null);

  function start(c: string) {
    if (c.length < 4) return;
    setActive(true);
    setDone(null);
    setPct(0);
    handle.current = beamReceive(c, {
      onStatus: setStatus,
      onProgress: (got, total) => total && setPct(Math.round((got / total) * 100)),
      onFile: (file, meta) => {
        saveFile(file, meta.name);
        setDone(meta.name);
        setStatus("Done — the APK saved to this device. Open it to install.");
        setActive(false);
      },
      onError: (m) => {
        setStatus(m);
        setActive(false);
      },
    });
  }

  useEffect(() => {
    if (initial) start(initial);
    return () => handle.current?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-md px-6 py-12">
        <h1 className="font-display text-2xl font-bold">Receive an app</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the 6-digit beam code shown on the sending device. The APK transfers directly
          between the two devices and saves here automatically.
        </p>

        <div className="mt-6 rounded-3xl border border-border bg-card p-6">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="000000"
            className="h-14 w-full rounded-xl border border-border bg-background text-center font-display text-2xl tracking-[0.4em] outline-none focus:border-primary"
          />
          <button
            onClick={() => start(code)}
            disabled={active || code.length < 6}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
            style={{ background: "var(--gradient-hero)" }}
          >
            {active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
            {active ? "Listening…" : "Start receiving"}
          </button>

          {pct > 0 && (
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: "var(--gradient-hero)" }}
              />
            </div>
          )}

          {status && (
            <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              {done && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
              <span>{status}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
