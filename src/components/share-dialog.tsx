import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Bluetooth, Check, Copy, Loader2, QrCode, Share2, Smartphone, Wifi, X } from "lucide-react";

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

  const canShare = useMemo(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    [],
  );

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    QRCode.toDataURL(pageUrl, { width: 480, margin: 1, errorCorrectionLevel: "M" })
      .then(setQr)
      .catch(() => setQr(null));
  }, [open, pageUrl]);

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

  async function shareFile() {
    setBusy("file");
    setStatus("Preparing the file…");
    try {
      const url = await getFileUrl();
      const res = await fetch(url);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const file = new File([blob], apkFilename, {
        type: "application/vnd.android.package-archive",
      });

      if (navigator.canShare?.({ files: [file] })) {
        setStatus(null);
        await navigator.share({ files: [file], title: appName });
      } else {
        setStatus(
          "This browser can't hand the file to Bluetooth / Nearby Share. Download the APK first, then share it from your Files app.",
        );
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") setStatus(null);
      else setStatus("Couldn't share the file. Try downloading it and sharing from Files.");
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
            <h2 className="font-display text-lg font-bold">Share {appName}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Phone → phone, phone → TV / panel, or Windows → Android.
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
            Point the other device's camera at this code. Works on Android TV, panels and Windows —
            both devices just need internet or the same network.
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          {canShare && (
            <button
              onClick={shareFile}
              disabled={busy !== null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-70"
              style={{ background: "var(--gradient-hero)" }}
            >
              {busy === "file" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bluetooth className="h-4 w-4" />
              )}
              Send file via Bluetooth / Nearby Share
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
              <b className="text-foreground">Mobile → mobile:</b> use “Send file” and pick Nearby
              Share, Quick Share or Bluetooth in your phone's share sheet — no internet needed on
              the receiver.
            </span>
          </p>
          <p className="flex gap-2">
            <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <b className="text-foreground">TV / panel / Windows:</b> scan the QR code or open the
              copied link in the device's browser and download directly.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
