---
name: Expo config-plugin resolution in pnpm
description: Fix missing Expo config-plugin imports from local and third-party plugins in a strict pnpm workspace.
---

In a pnpm workspace, a dependency declared by an Expo app may not resolve from a third-party plugin's real package path under `.pnpm`. If the plugin imports `@expo/config-plugins` without declaring it, add a targeted `packageExtensions` dependency for that plugin package. Local config plugins also need the SDK-matched `@expo/config-plugins` dependency in the app package.

**Why:** Expo loads plugins from their resolved file paths; pnpm's strict symlinks can prevent those files from seeing dependencies declared only by the consuming app. The app-level dependency alone did not fix the third-party plugin import.

**How to apply:** Inspect the first `MODULE_NOT_FOUND` stack and test `require.resolve` from both the plugin file and local config-plugin files. Match the config-plugins version to the installed Expo SDK, update the frozen lockfile, then verify Expo config evaluation and the static app build.
