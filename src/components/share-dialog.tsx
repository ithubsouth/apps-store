import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Bluetooth, Check, Copy, Download, Loader2, QrCode, Share2, Smartphone, Unplug, Wifi, X } from "lucide-react";

type ShareDialogProps = { open: boolean; onClose: () => void; appName: string; apkFilename: string; pageUrl: string; getFileUrl: () => Promise<string> };

export function ShareDialog({ open, onClose, appName, apkFilename, pageUrl, getFileUrl }: ShareDialogProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const canShareLink = useMemo(() => typeof navigator !== "undefined" && typeof navigator.share === "function", []);

  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setDownloaded(false);
    QRCode.toDataURL(pageUrl, { width: 480, margin: 1, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(null));
  }, [open, pageUrl]);

  if (!open) return null;

  async function downloadForTransfer() {
    setBusy(true);
    setStatus(null);
    try {
      const url = await getFileUrl();
      const link = document.createElement("a");
      link.href = url;
      link.download = apkFilename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setDownloaded(true);
      setStatus(`Downloaded ${apkFilename}. Open Downloads or Files, long-press it, then tap Share.`);
    } catch {
      setStatus("The APK could not be downloaded. Check the connection and try again.");
    } finally { setBusy(false) }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setStatus("Couldn't copy the link. Long-press the address to copy it.") }
  }

  async function shareLink() {
    try { await navigator.share({ title: appName, text: `Install ${appName}`, url: pageUrl }) }
    catch (error) { if ((error as Error)?.name !== "AbortError") setStatus("The link share menu is unavailable on this browser.") }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={`Transfer ${appName}`} onClick={(event) => event.stopPropagation()} className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl sm:p-6" style={{ boxShadow: "var(--shadow-elevated)" }}>
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="font-display text-xl font-bold">Transfer {appName}</h2><p className="mt-1 text-sm text-muted-foreground">Use your device's Files app for reliable APK transfer.</p></div>
          <button onClick={onClose} aria-label="Close transfer dialog" className="rounded-full p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <button onClick={downloadForTransfer} disabled={busy} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-70">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : downloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {busy ? "Starting download…" : downloaded ? "Download APK again" : "Download APK to Files"}
        </button>
        {status && <p role="status" className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">{status}</p>}

        <div className="mt-5 space-y-4 border-y border-border py-5 text-xs leading-5">
          <Guide icon={Wifi} title="Quick Share / Wi-Fi Direct" steps={["Turn on Wi-Fi and Bluetooth on both devices. They do not need to join a Wi-Fi network.", "Download the APK above, then open Downloads or Files on the sender.", "Long-press the APK → Share → Quick Share, then choose the visible receiver.", "Accept on the receiver. Quick Share shows the active transfer and progress."]} />
          <p className="rounded-lg bg-muted p-3 text-[11px] text-muted-foreground">Wi-Fi Direct is negotiated automatically by Quick Share. A website cannot list Wi-Fi Direct peers or start that radio connection; Android permits only the operating system to do this.</p>
          <Guide icon={Bluetooth} title="Bluetooth" steps={["Pair both devices in Bluetooth settings.", "In Files, long-press the downloaded APK → Share → Bluetooth.", "Choose the paired receiver and accept the incoming file there."]} />
          <Guide icon={Smartphone} title="Google TV / panel" steps={["Use built-in Quick Share if the TV offers it.", "Otherwise install and open a file-receiver app on the TV/panel once.", "Open its matching sender on Android or Windows and select the downloaded APK."]} />
          <p className="text-[11px] text-muted-foreground">A TV with no browser, Quick Share, or receiver app cannot receive a file from a website. Some TVs also block Bluetooth file receiving.</p>
        </div>

        <div className="mt-5 flex flex-col items-center rounded-lg border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-xs font-semibold"><QrCode className="h-4 w-4 text-primary" /> Receiver has a browser</div>
          {qr ? <img src={qr} alt={`QR code linking to ${appName}`} className="mt-3 h-36 w-36 rounded-lg bg-card p-2" /> : <div className="mt-3 h-36 w-36 animate-pulse rounded-lg bg-muted" />}
          <p className="mt-2 text-center text-[11px] text-muted-foreground">Scan to open this app page and download directly.</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {canShareLink && <button onClick={shareLink} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-muted"><Share2 className="h-4 w-4" /> Share link</button>}
          <button onClick={copyLink} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:bg-muted ${canShareLink ? "" : "col-span-2"}`}>{copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy link"}</button>
        </div>
        <p className="mt-4 flex gap-2 border-t border-border pt-4 text-[11px] leading-5 text-muted-foreground"><Unplug className="mt-0.5 h-4 w-4 shrink-0" /><span><b className="text-foreground">Disconnect:</b> transfer ends automatically. Close the transfer screen, then turn off Quick Share visibility, Wi-Fi, or Bluetooth if desired.</span></p>
      </div>
    </div>
  )
}

function Guide({ icon: Icon, title, steps }: { icon: typeof Wifi; title: string; steps: string[] }) {
  return <section><h3 className="flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4 text-primary" /> {title}</h3><ol className="mt-2 space-y-2">{steps.map((step, index) => <li key={step} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{index + 1}</span><span>{step}</span></li>)}</ol></section>
}