---
name: Expo build dependency resolution
description: Clean publishing installs expose undeclared Babel dependencies hidden by local package symlinks.
---

Declare Babel presets and plugins named by the Met app's configuration as direct app dependencies, using versions compatible with its Expo SDK. Do not rely on Expo's transitive dependencies or an existing local node_modules symlink.

**Why:** Publishing failed to resolve babel-preset-expo after a clean pnpm install, although local resolution worked through an undeclared stale symlink. Having the preset somewhere in the lockfile was not sufficient to make it resolvable from the app's Babel config.

**How to apply:** Check the app manifest as well as module resolution from its config directory. Validate a frozen-lockfile install and the actual publishing builder, rather than trusting the development preview.
