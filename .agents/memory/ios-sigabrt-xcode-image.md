---
name: iOS SIGABRT — EAS Xcode image update
description: Silent iOS crash caused by EAS updating the Xcode build image, triggering a RN TurboModule NSException bug. Fix is a patch to RCTTurboModule.mm wired via pnpm patchedDependencies.
---

# iOS SIGABRT from EAS Xcode Image Update

## The rule
When a TestFlight build silently crashes on start with **no code changes** between the last working build and the broken one, suspect the EAS Xcode image was silently updated.

**Why:** EAS `macos-sequoia-15.6-xcode-26.0` (and similar Xcode 26 tags) are mutable — EAS can update them between builds. Newer Xcode 26 snapshots trigger a known React Native bug: void async TurboModule methods rethrow `NSException` as an uncatchable C++ exception on background queues → SIGABRT.

## The fix
`artifacts/met/patches/react-native+0.81.5.patch` patches `RCTTurboModule.mm` to swallow those exceptions (logs via `RCTLogError` instead of rethrowing). The patch is wired in root `package.json`:

```json
"pnpm": {
  "patchedDependencies": {
    "react-native@0.81.5": "artifacts/met/patches/react-native+0.81.5.patch"
  }
}
```

pnpm applies it automatically during `pnpm install`, so EAS builds always get it.

**Why pnpm over patch-package:** patch-package requires a manual `eas-post-install.js` step that rollbacks can silently delete. pnpm's `patchedDependencies` fails `pnpm install` outright if the patch file is missing.

## How to apply
1. Verify `artifacts/met/patches/react-native+0.81.5.patch` exists on disk.
2. Verify root `package.json` has the `pnpm.patchedDependencies` entry above.
3. Bump `buildNumber` / `versionCode` in `artifacts/met/app.json`.
4. Push an `ios-build-*` tag to trigger GitHub Actions build.
5. After preview build passes, run workflow manually: `profile=production, submit=true`.

## Diagnostic checklist for silent iOS crash
1. Same code as working build? → Xcode image update (this issue).
2. New native package added without EAS rebuild? → `[RN Firebase new native module crash]`.
3. Duplicate build number uploaded? → `[TestFlight duplicate build number crash]`.
4. App Check enforcement enabled? → `[App Check enforcement blocks Firestore]`.
