Feature flags and rollout notes

This project uses feature flags to gate large new functionality. For the P2P Share feature:

- Flag key: p2pShare
- Default: disabled in production

Add to your existing feature-flag config, for example:

{
  "p2pShare": false
}

During rollout, enable for internal QA first, then staged rollout.
