---
name: pnpm patchedDependencies breaks Android prefab CLI
description: pnpm patch_hash= suffix in package paths causes prefab CLI v2.1.0 to abort with "no such option"
---

# pnpm patchedDependencies breaks Android prefab CLI

## The rule
Never use pnpm `patchedDependencies` for any package that is a transitive
dependency of a native Android module that uses CMake/prefab (e.g.
react-native-gesture-handler, react-native-reanimated). Apply RN patches via
Expo config plugins (`withDangerousMod`) instead.

**Why:** pnpm encodes the patch hash into every dependent package's directory
path as `_patch_hash=<hex>`. The Google `prefab` CLI (v2.1.0, used by AGP
8.x) parses positional package-path arguments using a CLI parser that treats
`=` as an option separator. A path containing `_patch_hash=xxxx` is
misinterpreted as a long option and the build aborts:

```
Error: no such option /tmp/runner/.../react-native-gesture-handler@2.28.0_react-native@0.81.5_patch_hash=ccdd41dde06db5bb1d62...
```

The error looks like a version or NDK mismatch but is actually a path-parsing
bug in the prefab CLI triggered by the `=` character.

**How to apply:** When a react-native source file needs patching:
1. Write a `withDangerousMod` plugin (platform `"ios"` or `"android"`) that
   applies the text replacement to the file in `node_modules/` during
   `expo prebuild`.
2. Register the plugin in `app.json`.
3. Keep the patch file for reference but do NOT add it to `patchedDependencies`.

## Fix applied
- Removed `patchedDependencies` for `react-native@0.81.5` from root `package.json`.
- Created `artifacts/met/plugins/with-ios-turbomodule-patch.js` — patches
  `RCTTurboModule.mm` (suppresses rethrown NSException → SIGABRT on iOS 26)
  via `withDangerousMod` during prebuild.
- Lockfile confirmed clean: zero `patch_hash=` occurrences after reinstall.
