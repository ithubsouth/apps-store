import { Bluetooth, Wifi } from "lucide-react";

/**
 * Quick jump into the device's own Wi-Fi / Bluetooth settings.
 * Android browsers honour these intent URLs; elsewhere they simply do nothing,
 * so the buttons stay harmless.
 */
const WIFI_INTENT =
  "intent://settings#Intent;action=android.settings.WIFI_SETTINGS;end";
const BT_INTENT =
  "intent://settings#Intent;action=android.settings.BLUETOOTH_SETTINGS;end";

export function DeviceSettings() {
  return (
    <div className="mb-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Receiving an app? Just switch on Wi-Fi or Bluetooth — nothing else to open.
      </p>
      <div className="flex gap-2">
        <a
          href={WIFI_INTENT}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition hover:bg-muted"
        >
          <Wifi className="h-3.5 w-3.5" /> Wi-Fi settings
        </a>
        <a
          href={BT_INTENT}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition hover:bg-muted"
        >
          <Bluetooth className="h-3.5 w-3.5" /> Bluetooth settings
        </a>
      </div>
    </div>
  );
}
