---
name: pnpm Metro watcher ENOENT
description: Diagnose Metro watcher failures caused by pnpm virtual-store churn and avoid incompatible Metro transitive overrides.
---

**Rule:** Complete workspace dependency installs before starting or restarting Expo Metro. A watcher that runs during `pnpm install` can encounter a temporary `*_tmp_*` package directory and exit with `ENOENT`; restart only after the install finishes. If the error persists, check for unreferenced stale virtual-store package versions before removing anything.

**Why:** During dependency remediation, Metro's fallback watcher tried to watch a path inside a transient `side-channel_tmp_*` directory and exited. The Expo app started normally after the install completed and the workflow was restarted.

**How to apply:** After changing workspace dependencies, install first, then restart the Expo workflow once and confirm Metro reaches its ready message.

**Rule:** Do not force `image-size` 2.x into the current Metro line without verifying its API. Metro calls `image-size` as a default function, while 2.x documents a named `imageSize` export; upgrade the compatible Metro/Expo parent or add a tested adapter instead.

**Why:** An override could clear the audit finding while breaking Metro's asset bundling.

**How to apply:** Before changing this major dependency, verify the exact Metro consumer API and run an Expo bundle/build check. Keep the remaining audit finding visible until that compatibility work is safe.