# LEAD App Share — native companion apps

Direct APK transfer that works the way you asked: the receiver only turns on
Wi-Fi / Bluetooth, the sender sees device names, taps to connect, and the APK
is saved on the receiver automatically — no link, no code, no Files app.

## Why native

Web pages cannot scan Wi-Fi Direct names, pair Bluetooth, or keep connections
alive — browsers block all of it. These apps use Google Nearby Connections,
which discovers over Bluetooth and upgrades to Wi-Fi Direct / hotspot for the
actual bytes.

## Android sender + receiver (`native/android-share`)

Open `native/android-share` in Android Studio (Hedgehog+), let it sync, then
Run on any Android 7.0+ phone.

- **Receive**: open the app, tap "Make this device receivable". Nothing else —
  the APK lands in Downloads.
- **Send**: tap "Pick APK", "Find devices", then tap the receiver's name. The
  app connects and streams the APK immediately. Refresh re-scans.
- **Get from a Windows PC**: enter the address shown by the Windows sender
  (below) and tap the APK to pull it over the same Wi-Fi / hotspot.

The app also appears in Android's share sheet when sharing an APK file.

## Windows sender (`native/windows-sender`)

A small .NET 8 WPF app that:

1. Lets you drop in APK files.
2. Serves them over HTTP on port 8756 and shows the PC's LAN/hotspot IP.
3. On Android, open LEAD App Share → "Get from a Windows PC" → enter that IP.

Build: open in Visual Studio 2022 (or `dotnet build`) with the .NET 8 SDK.

> Note: Android-to-Windows direct push isn't possible without a companion
> listener on Windows; the pull model above is the reliable path.

## Building a signed APK for staff phones

Android Studio → Build → Generate Signed Bundle / APK → APK → create a keystore
once → release APK. Distribute that APK through the LEAD App Store web app
itself.
