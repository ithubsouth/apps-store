# Peer-to-peer sharing — design & rollout

This document describes the architecture, UX, permissions, and rollout checklist for the peer-to-peer (P2P) app sharing feature (Wi‑Fi / Bluetooth) in this repository.

## Goal
Allow users to share application packages (APK) between devices using local connectivity with Android Nearby Connections as the primary POC technology.

## Supported flows (POC)
- Android -> Android (phone to phone)
- Android -> Android TV / Panel (phone -> Android TV)

Cross-platform (Windows -> Android) is out of scope for the initial POC; we'll add HTTP / WebRTC fallback in follow-ups.

## High-level architecture
- Discovery: Android Nearby Connections API (advertise & discover)
- Connection: Nearby Connections establishes a high-throughput P2P link (Wi‑Fi / Wi‑Fi Direct / Bluetooth fallback)
- Transfer: Chunked binary transfer with SHA‑256 checksums per-chunk and overall checksum; resume support
- Install: Receiver verifies checksum and APK signature and prompts user to install (user consent required)

## Components
- DiscoveryService (interface): advertise/listen, provide callbacks for found/connected
- TransferService (interface): send/receive file in chunks, resume, progress reporting
- ChecksumService (interface): compute and verify SHA‑256

## UX
- Sender: Share -> choose "Nearby devices" -> list of receivers -> confirm target -> start transfer
- Receiver: Receive -> shows incoming request with short code/photo-icon -> user accepts to start transfer -> shows install prompt after verification

## Security
- Always ask receiver to confirm before starting transfer
- Verify SHA‑256 checksum and APK signature before showing install prompt
- Transfers should be local-only and time-limited; use encryption where possible (Nearby Connections supports encrypted endpoints)

## Permissions & platform notes
- Android runtime permissions: BLUETOOTH, BLUETOOTH_ADMIN, ACCESS_FINE_LOCATION (for discovery on older Android), NEARBY_DEVICES (Android 12+), storage access for legacy devices
- Installing side-loaded APKs requires `REQUEST_INSTALL_PACKAGES` and user enabling "install unknown apps" for the installing app

## Reliability
- Chunked transfers with retries and exponential backoff
- Resume token: keep small manifest with file size, checksum, last-received offset
- Use WorkManager to continue transfers in background when possible

## Testing checklist
- Device matrix across vendors (Pixel, Samsung, Xiaomi, Huawei, Android TV brands)
- Large APK (>100MB), interrupted transfers, backgrounding, battery optimization/Doze
- UI flows for accept/decline, checksum mismatch, install blocked by Play Protect

## Rollout plan
1. Internal QA build with feature flag enabled for testers
2. Staged rollout (5% -> 25% -> 100%) monitoring success/failure metrics
3. Add cross-platform fallback (WebRTC / local HTTP + QR) in follow-up

## Next steps
- Implement TypeScript service interfaces and Node-side testing harness for POC
- Implement Android Nearby Connections module (native or via React Native / Capacitor plugin depending on stack)
