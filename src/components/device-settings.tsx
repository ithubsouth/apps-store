import { Settings } from "lucide-react";

const SETTINGS_INTENT =
  "intent://settings/#Intent;scheme=android-app;action=android.settings.SETTINGS;end";

export function DeviceSettings() {
  return (
    <a
      href={SETTINGS_INTENT}
      onClick={(event) => {
        if (!/Android/i.test(navigator.userAgent)) event.preventDefault();
      }}
      aria-label="Open system settings"
      title="Open system settings"
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border transition hover:bg-muted"
    >
      <Settings className="h-4 w-4" />
    </a>
  );
}
