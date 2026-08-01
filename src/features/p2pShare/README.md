# P2P Share demo

This folder contains a small React scaffold UI that can be used to exercise the
P2P share feature once the native Nearby Connections bridge is implemented.

How to use

1. Ensure the `p2pShare` feature flag is enabled in your feature flags config (see docs/feature-flags.md).
2. Mount the demo component in a page within your app, for example:

```tsx
import ShareDemo from 'src/features/p2pShare/ui/ShareDemo';

function P2PPage() {
  return <ShareDemo />;
}
```

3. Build and run on an Android device with Google Play Services. Implement the
native bridge (Android Nearby Connections) and wire the service factories in
src/features/p2pShare/index.ts to the bridge.

Notes
- The demo is intentionally minimal — it is a UX harness. The underlying
  discovery/transfer functions are not implemented in TypeScript and must be
  provided by a native module or an appropriate cross-platform plugin.
