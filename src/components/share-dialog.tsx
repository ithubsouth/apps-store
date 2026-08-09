import { useEffect, useRef, useState } from "react";
import { Loader2, Radio, RefreshCw, Wifi, X } from "lucide-react";
import { beamSend, makeBeamCode, type BeamHandle } from "@/lib/beam";
import { loadApk, getCachedApk, saveFile } from "@/lib/apk-cache";

type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
  appId: string;
  appName: string;
  apkFilename: string;
  pageUrl: string;
  /** Resolves a fresh, time-limited direct download URL for the APK. */
  getFileUrl: () => Promise<string>;
};

export function ShareDialog({
  open,
  onClose,
  appId,
  appName,
  apkFilename,
  getFileUrl,
}: ShareDialogProps) {
  const cacheKey = `apk:${appId}:${apkFilename}`;

  const [beamCode] = useState(() => makeBeamCode());
  const [busy, setBusy] = useState<null | "wifi" | "bt">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [prep, setPrep] = useState(0);
  const [showOther, setShowOther] = useState(false);
  const [beamStatus, setBeamStatus] = useState<string | null>(null);
  const [beaming, setBeaming] = useState(false);
  const [pct, setPct] = useState(0);
  const beam = useRef<BeamHandle | null>(null);

  const canShareFiles =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  useEffect(() => {
    if (!open) {
      beam.current?.cancel();
      beam.current = null;
      setBeaming(false);
      setStatus(null);
      setBeamStatus(null);
      setPct(0);
      setPrep(0);
      setShowOther(false);
    }
  }, [open]);

  if (!open) return null;

  async function getFile() {
    const cached = getCachedApk(cacheKey);
    if (cached) return cached;
    return loadApk(cacheKey, apkFilename, getFileUrl, (l, t) =>
      setPrep(t ? Math.round((l / t) * 100) : 0),
    );
  }

  /**
   * Hands the APK to Android's own nearby-device picker (Nearby / Quick Share).
   * That picker runs on Wi-Fi Direct underneath and lists the nearby devices by
   * name — Bluetooth targets show up in the very same sheet, so there is no
   * separate Bluetooth button. No browser exposes Wi-Fi Direct scanning itself.
   */
  async function nativeSend() {
    setBusy("wifi");
    setStatus("Getting the app ready…");
    try {
      const file = await getFile();
      if (navigator.canShare?.({ files: [file] })) {
        setStatus("Pick Nearby Share / Quick Share, then tap the receiving device in the list.");
        await navigator.share({ files: [file], title: appName });
        setStatus("Sent — the receiving device just has to accept it.");
      } else {
        setShowOther(true);
        setStatus(
          "This browser can't reach the device picker. Use the Wi-Fi transfer below instead.",
        );
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") setStatus(null);
      else setStatus("Transfer cancelled. Try again, or use the Wi-Fi transfer below.");
    } finally {
      setBusy(null);
    }
  }


  async function startBeam() {
    setBeamStatus("Getting the app ready…");
    setBeaming(true);
    setPct(0);
    try {
      const file = await getFile();
      beam.current = beamSend(beamCode, file, appName, {
        onStatus: setBeamStatus,
        onProgress: (sent, total) => setPct(Math.round((sent / total) * 100)),
        onDone: () => setBeaming(false),
        onError: (m) => {
          setBeamStatus(m);
          setBeaming(false);
        },
      });
    } catch {
      setBeamStatus("Couldn't get the app. Check your connection and try again.");
      setBeaming(false);
    }
  }

  function stopBeam() {
    beam.current?.cancel();
    beam.current = null;
    setBeaming(false);
    setBeamStatus("Transfer stopped.");
  }

  async function saveApk() {
    try {
      saveFile(await getFile(), apkFilename);
      setStatus(`Saved ${apkFilename} to this device.`);
    } catch {
      setStatus("Couldn't save the file. Check your connection and try again.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Send ${appName}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-6 sm:rounded-3xl"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold">Send {appName}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The receiver only needs Wi-Fi or Bluetooth switched on.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <button
            onClick={() => nativeSend()}
            disabled={busy !== null}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-70"
            style={{ background: "var(--gradient-hero)" }}
          >
            {busy === "wifi" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wifi className="h-4 w-4" />
            )}
            Wi-Fi Direct — show nearby devices
          </button>

          <button
            onClick={() => nativeSend()}
            disabled={busy !== null}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-70"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Refresh device list
          </button>
        </div>


        {prep > 0 && prep < 100 && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${prep}%`, background: "var(--gradient-hero)" }}
            />
          </div>
        )}
        {status && (
          <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            {status}
          </p>
        )}
        {!canShareFiles && (
          <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            This browser has no device picker. Use the Wi-Fi transfer below.
          </p>
        )}

        <button
          onClick={() => setShowOther((v) => !v)}
          className="mt-5 w-full text-center text-xs font-semibold text-primary hover:underline"
        >
          {showOther ? "Hide other ways" : "Other ways to send"}
        </button>

        {showOther && (
          <div className="mt-3 rounded-2xl border border-border bg-background p-5">
            <p className="text-xs text-muted-foreground">
              Put both devices on the same Wi-Fi — or turn on this device's hotspot and connect the
              other one to it. On the receiver open <b className="text-foreground">/receive</b> and
              type this code:
            </p>
            <div className="mt-3 text-center font-display text-2xl font-bold tracking-[0.3em]">
              {beamCode}
            </div>

            <button
              onClick={beaming ? stopBeam : startBeam}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-muted"
            >
              {beaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Radio className="h-4 w-4" />
              )}
              {beaming ? "Sending — tap to stop" : "Start Wi-Fi transfer"}
            </button>

            {pct > 0 && (
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: "var(--gradient-hero)" }}
                />
              </div>
            )}
            {beamStatus && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">{beamStatus}</p>
            )}

            <button
              onClick={saveApk}
              className="mt-3 w-full text-center text-[11px] text-muted-foreground hover:underline"
            >
              Save the APK to this device instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
