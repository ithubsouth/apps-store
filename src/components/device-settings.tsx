import { Settings } from "lucide-react";

const SETTINGS_INTENT = "intent:#Intent;action=android.settings.SETTINGS;end";
const LENOVO_SETTINGS_INTENT =
  "intent://settings/#Intent;action=android.settings.SETTINGS;package=com.android.settings;end";
const TV_SETTINGS_INTENT =
  "intent://settings/#Intent;action=android.settings.SETTINGS;package=com.android.tv.settings;end";

function getSettingsIntent(userAgent: string) {
  if (/Android TV|GoogleTV|SmartTV|SMART-TV|BRAVIA|AFT[A-Z]/i.test(userAgent)) {
    return TV_SETTINGS_INTENT;
  }

  if (/Lenovo|TB301FU|TB301XU|TB305FU/i.test(userAgent)) {
    return LENOVO_SETTINGS_INTENT;
  }

  return SETTINGS_INTENT;
}

export function DeviceSettings() {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;

  return (
    <a
      href={getSettingsIntent(userAgent)}
      onClick={(event) => {
        if (!/Android/i.test(userAgent)) event.preventDefault();
      }}
      aria-label="Open system settings"
      title="Open system settings"
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border transition hover:bg-muted"
    >
      <Settings className="h-4 w-4" />
    </a>
  );
}
