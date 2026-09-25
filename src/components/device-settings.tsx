import { Settings } from "lucide-react";
const NATIVE_SETTINGS_URI = "leadappshare://open-settings";

export function DeviceSettings() {
  return (
    <a
      href={NATIVE_SETTINGS_URI}
      aria-label="Open system settings"
      title="Open system settings"
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border transition hover:bg-muted"
    >
      <Settings className="h-4 w-4" />
    </a>
  );
}
