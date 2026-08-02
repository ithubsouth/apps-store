import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Bluetooth, Check, Copy, Download, Loader2, QrCode, Share2, Smartphone, Unplug, Wifi, X } from "lucide-react";

type ShareDialogProps = {
  open: boolean;
  onClose: () => void;
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
  appName,
  apkFilename,
  pageUrl,
  getFileUrl,
}: ShareDialogProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<null | "file" | "link">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canShare = useMemo(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    [],
  );

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setPreparedFile(null);
    setProgress(null);
    QRCode.toDataURL(pageUrl, { width: 480, margin: 1, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [open, pageUrl]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!open) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl);
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
      await navigator.share({ title: appName, text: `Install ${appName}`, url: pageUrl });
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") setStatus("Sharing was cancelled or unavailable.");
    } finally {
      setBusy(null);
    }
  }

  async function prepareFile() {
    setBusy("file");
    setStatus("Downloading the APK once for offline wireless sharing…");
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const url = await getFileUrl();
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error("download failed");
      const total = Number(res.headers.get("content-length")) || 0;
      const reader = res.body?.getReader();
      if (!reader) throw new Error("stream unavailable");
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.byteLength;
          if (total) setProgress(Math.round((received / total) * 100));
        }
      }
      const blob = new Blob(chunks as BlobPart[], { type: "application/vnd.android.package-archive" });
      const file = new File([blob], apkFilename, {
        type: "application/vnd.android.package-archive",
      });
      setPreparedFile(file);
      setProgress(100);
      setStatus("APK ready. Tap “Share APK now” to open your device's wireless share options.");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") setStatus("Preparation cancelled.");
      else setStatus("This browser couldn't prepare the APK. Download it, then share it from the Files app.");
    } finally {
      abortRef.current = null;
      setBusy(null);
    }
  }

  function sharePreparedFile() {
    if (!preparedFile) return;
    setStatus(null);
    try {
      if (!navigator.canShare?.({ files: [preparedFile] })) {
        setStatus("This browser blocks APK file sharing. Save the APK and share it from the Files app instead.");
        return;
      }
      void navigator.share({ files: [preparedFile], title: appName }).catch((err: Error) => {
        if (err?.name !== "AbortError") setStatus("The system share sheet couldn't send this APK. Save it and share from Files.");
      });
    } catch {
      setStatus("The system share sheet couldn't open. Save the APK and share it from Files.");
    }
  }

  function savePreparedFile() {
    if (!preparedFile) return;
    const url = URL.createObjectURL(preparedFile);
    const link = document.createElement("a");
    link.href = url;
    link.download = apkFilename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
            <h2 className="font-display text-lg font-bold">Share {appName}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Fast link sharing or an offline APK handoff through your device.
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

        <div className="mt-5 flex flex-col items-center rounded-2xl border border-border bg-background p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <QrCode className="h-3.5 w-3.5" /> Scan to install
          </div>
          {qr ? (
            <img
              src={qr}
              alt={`QR code linking to ${appName}`}
              className="mt-3 h-44 w-44 rounded-xl bg-white p-2"
            />
          ) : (
            <div className="mt-3 h-44 w-44 animate-pulse rounded-xl bg-muted" />
          )}
          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            Scan on any receiver with a camera and browser. The receiver downloads directly.
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          {canShare && !preparedFile && (
            <button
              onClick={prepareFile}
              disabled={busy !== null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-70"
              style={{ background: "var(--gradient-hero)" }}
            >
              {busy === "file" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bluetooth className="h-4 w-4" />
              )}
              {busy === "file" && progress !== null ? `Preparing APK · ${progress}%` : "Prepare APK for wireless share"}
            </button>
          )}

          {canShare && preparedFile && (
            <button
              onClick={sharePreparedFile}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Bluetooth className="h-4 w-4" /> Share APK now
            </button>
          )}

          {preparedFile && (
            <button
              onClick={savePreparedFile}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-muted"
            >
              <Download className="h-4 w-4" /> Save APK to Files
            </button>
          )}

          {canShare && (
            <button
              onClick={shareLink}
              disabled={busy !== null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-70"
            >
              <Share2 className="h-4 w-4" /> Share install link
            </button>
          )}

          <button
            onClick={copyLink}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold transition hover:bg-muted"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {copied ? "Link copied" : "Copy install link"}
          </button>
        </div>

        {status && (
          <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">{status}</p>
        )}

        <div className="mt-5 space-y-2 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          <p className="flex gap-2">
            <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <b className="text-foreground">Android → Android:</b> prepare once, tap “Share APK
              now”, then choose Quick Share, Nearby Share or Bluetooth. Wi-Fi and Bluetooth may be
              enabled without joining a Wi-Fi network.
            </span>
          </p>
          <p className="flex gap-2">
            <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <b className="text-foreground">Google TV / panel without a browser:</b> a receiver app
              that accepts files must already be installed. On the sender, share the saved APK from
              Files to that receiver app. A web page cannot discover a TV or install its receiver.
            </span>
          </p>
          <p className="flex gap-2">
            <Unplug className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span><b className="text-foreground">Disconnect:</b> sharing is a one-time transfer, not
            a permanent connection. Close the system share screen; for Quick Share, turn device
            visibility off afterward if desired.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
