Nearby Connections (Android) — implementation notes

This file contains pointers for the Android implementation.

- Use Google Play Services Nearby Connections API: https://developers.google.com/nearby/connections
- Typical flow:
  - Sender: startAdvertising(serviceId, options, connectionLifecycleCallback)
  - Receiver: startDiscovery(serviceId, endpointDiscoveryCallback)
  - Once endpoints found, requestConnection(endpointId, connectionLifecycleCallback)
  - After onConnectionInitiated, call acceptConnection to get a PayloadCallback
  - Use Payload.fromFile or Payload.fromBytes for transfers

- Important flags/options:
  - Strategy: P2P_CLUSTER or P2P_POINT_TO_POINT. For simple P2P use P2P_POINT_TO_POINT or P2P_CLUSTER for multi-receiver.
  - Use Payload.Stream for chunked or large files and implement per-chunk verification.

- Native vs JS bridge:
  - If the app is React Native, use community plugin or create a native module that exposes minimal APIs (advertise/discover/connect/send/receive)
  - Ensure the native bridge routes events reliably and handles lifecycle (Activity/Service) correctly for background transfers.

- Edge cases:
  - Some OEMs restrict Wi‑Fi Direct; test on a variety of devices.
  - Android 12+ introduces NEARBY_DEVICES permission. Request it where applicable.

- Logging & telemetry:
  - Emit events for discovery success/failure, connect success/failure, payload errors, checksum mismatches

