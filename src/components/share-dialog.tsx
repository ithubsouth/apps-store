import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Bluetooth,
  Check,
  Copy,
  Download,
  Loader2,
  QrCode,
  Radio,
  Share2,
  X,
  Zap,
} from "lucide-react";
import { beamSend, makeBeamCode, type BeamHandle } from "@/lib/beam";
import { loadApk, getCachedApk, saveFile } from "@/lib/apk-cache";

type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
  appId: string;
  appName: string;
  apkFilename: string;
  /** Public page URL for this app (works on TVs, panels, Windows). */
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
  pageUrl,
  getFileUrl,
}: ShareDialogProps) {
  const cacheKey = `apk:${appId}:${apkFilename}`;

  const [beamCode] = useState(() => makeBeamCode());
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | "file" | "link" | "save">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [beamStatus, setBeamStatus] = useState<string | null>(null);
  const [beaming, setBeaming] = useState(false);
  const [pct, setPct] = useState(0);
  const [prep, setPrep] = useState(0);
  const beam = useRef<BeamHandle | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const receiveUrl = `${origin}/receive?code=${beamCode}`;

  const canShare = useMemo(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    [],
  );

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setBeamStatus(null);
    setPct(0);
    QRCode.toDataURL(receiveUrl, { width: 480, margin: 1, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [open, receiveUrl]);

  useEffect(() => {
    if (!open) {
      beam.current?.cancel();
      beam.current = null;
      setBeaming(false);
    }
  }, [open]);

  if (!open) return null;

  /** Fetch once, reuse for every action afterwards. */
  async function getFile() {
    const cached = getCachedApk(cacheKey);
    if (cached) return cached;
    return loadApk(cacheKey, apkFilename, getFileUrl, (l, t) =>
      setPrep(t ? Math.round((l / t) * 100) : 0),
    );
  }

  async function startBeam() {
    setBeamStatus("Preparing the APK…");
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
      setBeamStatus("Couldn't load the APK. Check your connection and try again.");
      setBeaming(false);
    }
  }

  function stopBeam() {
    beam.current?.cancel();
    beam.current = null;
    setBeaming(false);
    setBeamStatus("Transfer stopped.");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(receiveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatus("Couldn't copy — long-press the link to copy manually.");
    }
  }

  async function shareLink() {
    setBusy("link");
    setStatus(null);
    try {
      await navigator.share({
        title: appName,
        text: `Receive ${appName} — code ${beamCode}`,
        url: receiveUrl,
      });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setStatus("Sharing was cancelled or unavailable.");
    } finally {
      setBusy(null);
    }
  }

  async function shareFile() {
    setBusy("file");
    setStatus("Preparing the file…");
    try {
      const file = await getFile();
      if (navigator.canShare?.({ files: [file] })) {
        setStatus(null);
        await navigator.share({ files: [file], title: appName });
      } else {
        saveFile(file, apkFilename);
        setStatus(`This browser can't hand files to the share sheet — ${apkFilename} was saved instead.`);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") setStatus(null);
      else setStatus("Couldn't share the file. Try the direct beam above.");
    } finally {
      setBusy(null);
    }
  }

  async function saveApk() {
    setBusy("save");
    setStatus(null);
    try {
      saveFile(await getFile(), apkFilename);
      setStatus(`Saved ${apkFilename} to this device.`);
    } catch {
      setStatus("Couldn't download the file. Check your connection and try again.");
    } finally {
      setBusy(null);
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
        aria-label={`Share ${appName}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-6 sm:rounded-3xl"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold">Send {appName}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Laptop → phone, phone → phone, phone → TV or panel. The file transfers directly
              between the two devices.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close share dialog"
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Direct beam */}
        <div className="mt-5 rounded-2xl border border-border bg-background p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <Zap className="h-3.5 w-3.5" /> Direct beam — no manual sharing
          </div>

          <div className="mt-4 flex flex-col items-center">
            {qr ? (
              <img
                src={qr}
                alt={`QR code to receive ${appName}`}
                className="h-40 w-40 rounded-xl bg-white p-2"
              />
            ) : (
              <div className="h-40 w-40 animate-pulse rounded-xl bg-muted" />
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">
              On the receiving device scan this code, or open{" "}
              <b className="text-foreground">{origin.replace(/^https?:\/\//, "")}/receive</b> and
              enter
            </p>
            <div className="mt-2 font-display text-2xl font-bold tracking-[0.3em]">{beamCode}</div>
          </div>

          <button
            onClick={beaming ? stopBeam : startBeam}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
            style={{ background: "var(--gradient-hero)" }}
          >
            {beaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
            {beaming ? "Sending — tap to stop" : "Start direct transfer"}
          </button>

          {(pct > 0 || (beaming && prep > 0)) && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct || prep}%`, background: "var(--gradient-hero)" }}
              />
            </div>
          )}
          {beamStatus && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">{beamStatus}</p>
          )}
          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            On the same Wi-Fi the bytes travel straight over the local network and the APK saves
            itself on the receiver — nothing to open in Files.
          </p>
        </div>

        {/* Other options */}
        <div className="mt-4 grid gap-2">
          {canShare && (
            <button
              onClick={shareFile}
              disabled={busy !== null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-70"
            >
              {busy === "file" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bluetooth className="h-4 w-4" />
              )}
              Send via Bluetooth / Nearby Share
            </button>
          )}

          {canShare && (
            <button
              onClick={shareLink}
              disabled={busy !== null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-70"
            >
              <Share2 className="h-4 w-4" /> Share receive link
            </button>
          )}

          <button
            onClick={copyLink}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-muted"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? "Link copied" : "Copy receive link"}
          </button>

          <button
            onClick={saveApk}
            disabled={busy !== null}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-70"
          >
            {busy === "save" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Save APK to this device
          </button>
        </div>

        {status && (
          <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">{status}</p>
        )}

        <p className="mt-4 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          The APK is fetched only once per session — every transfer after that reuses the same copy
          instead of downloading again.
        </p>
      </div>
    </div>
  );
}
