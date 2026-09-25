import { Settings } from "lucide-react";
import type { MouseEvent } from "react";

const NATIVE_SETTINGS_URI = "leadappshare://open-settings";
const SETTINGS_INTENT = "intent://settings/#Intent;action=android.settings.SETTINGS;end";

export function DeviceSettings() {
  function openSettings(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const androidBridge = (
      window as Window & { Android?: { openSystemSettings?: () => void } }
    ).Android;

    if (androidBridge?.openSystemSettings) {
      androidBridge.openSystemSettings();
      return;
    }

    window.location.href = NATIVE_SETTINGS_URI;
    window.setTimeout(() => {
      window.location.href = SETTINGS_INTENT;
    }, 500);
  }

  return (
    <a
      href={SETTINGS_INTENT}
      onClick={openSettings}
      aria-label="Open system settings"
      title="Open system settings"
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border transition hover:bg-muted"
    >
      <Settings className="h-4 w-4" />
    </a>
  );
}
