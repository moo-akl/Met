---
name: Expo export memory limits
description: Avoid workspace restarts when verifying production Met bundles.
---

Run release exports one platform at a time with one Metro worker, and pause the Expo preview while exporting.

**Why:** Concurrent iOS/Android/web production exports plus a live preview bundle exhausted this workspace's memory and restarted it. Hermes compilation competes with Metro and preview workers; a bundle reaching 99.9% does not mean the export has finished.

**How to apply:** For dependency or bundler verification, use separate production exports for iOS, Android, and web with `--max-workers 1`. Confirm completed output and metadata, then restore the managed preview workflow. Avoid launching a screenshot-triggered preview bundle during export.

Keep cold-bundle compilation timeouts separate from ordinary network-download timeouts, and make the overall budget cover both sequential platforms plus manifest retrieval.

**Why:** After restoring a missing Babel dependency, a steadily progressing single-worker iOS bundle was aborted by the publishing builder's five-minute download limit before compilation could finish.

**How to apply:** Preserve bounded timeouts and single-worker memory limits. Do not assume a cold transform is hung merely because it takes longer than a normal file download, or raise parallelism to bypass the timeout.