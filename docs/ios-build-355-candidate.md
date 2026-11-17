# iOS build 355 candidate

This source-only candidate preserves the current app features, Expo SDK,
bundle identity, security overrides, signing behavior, and startup diagnostics.
It is not yet a demonstrated fix for the iPhone startup failure.

## Changes

- Increment the iOS build number from 354 to 355; Android is unchanged.
- Inject the mobile importer's exact locked Expo version at the build-worker
  root instead of resolving its version range again.
- Stop the worker before native compilation if lockfile adaptation changes the
  Met importer, native package versions/integrities, or an existing native
  dependency snapshot.
- Keep the generated-provider capture already merged into main. Its report
  checks generation, not registration on an iPhone.

The native lock guard does not freeze every non-native build dependency or
CocoaPods input. It makes native dependency drift an explicit failure rather
than silently accepting a changed native graph.

## Checks completed

- Clean frozen install from this exact GitHub-main-based checkout.
- Worker-style lockfile adaptation verified 107 native package resolutions
  without changing the mobile importer or native dependency edges.
- Shared-library and mobile application TypeScript checks passed.
- 85 automated build, provider, signing-safety, and startup diagnostic tests
  passed; one macOS-only synthetic-profile test was skipped on Linux.
- No package manifest, committed lockfile, workflow, signing setting, app
  feature, or Android version was changed.

## Verification boundary

No native build, signing action, TestFlight submission, or release was started
while preparing this candidate. Device launch and upgrade checks remain pending.
The next binary's diagnostics must explicitly identify build 355. Compare its
runtime report with that same run's provider artifact; do not reuse reports
from earlier build numbers.

A passing build is not a startup fix. If lock verification stops the build,
review the dependency difference; do not remove the guard or retry blindly.
