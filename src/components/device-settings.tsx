import { Settings } from "lucide-react";
import type { MouseEvent } from "react";

const SETTINGS_INTENT =
  "intent://settings/#Intent;action=android.settings.SETTINGS;end";

export function DeviceSettings() {
  function openSettings(event: MouseEvent<HTMLAnchorElement>) {
    const androidBridge = (
      window as Window & { Android?: { openSystemSettings?: () => void } }
    ).Android;

    if (androidBridge?.openSystemSettings) {
      event.preventDefault();
      androidBridge.openSystemSettings();
    }
  }

  return (
    <a
      href={SETTINGS_INTENT}
      onClick={(event) => {
        if (!/Android/i.test(navigator.userAgent)) event.preventDefault();
        else openSettings(event);
      }}
      aria-label="Open system settings"
      title="Open system settings"
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border transition hover:bg-muted"
    >
      <Settings className="h-4 w-4" />
    </a>
  );
}
