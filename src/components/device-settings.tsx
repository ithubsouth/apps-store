import { useState } from "react";
import { Settings } from "lucide-react";

/**
 * Android browsers block `intent://` navigation to the system Settings app
 * (only whitelisted intents from a user gesture on some builds work), so we
 * try it once and always show a plain-language fallback.
 */
const SETTINGS_INTENT =
  "intent://#Intent;action=android.settings.SETTINGS;package=com.android.settings;end";

export function DeviceSettings() {
  const [hint, setHint] = useState(false);

  function openSettings() {
    setHint(true);
    try {
      window.location.href = SETTINGS_INTENT;
    } catch {
      /* browser refused — the hint below covers it */
    }
  }

  return (
    <div className="mb-8 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Receiving an app? Just switch Wi-Fi or Bluetooth on — nothing else to open.
        </p>
        <button
          onClick={openSettings}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition hover:bg-muted"
        >
          <Settings className="h-3.5 w-3.5" /> Open system settings
        </button>
      </div>
      {hint && (
        <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-[11px] text-muted-foreground">
          If Settings didn&apos;t open, your browser blocks apps from launching it. Swipe down from
          the top of the screen and tap the Wi-Fi or Bluetooth tile instead.
        </p>
      )}
    </div>
  );
}
