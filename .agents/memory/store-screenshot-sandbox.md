---
name: Store screenshot sandbox safety
description: Why fictional capture states in the Expo web demo must be interaction-safe even when AppContext skips persistence.
---

Development-only screenshot fixtures should be read-only across the whole UI, not merely inside AppContext. If an interactive demo is needed later, gate every mutating action at its boundary instead of assuming the context has no authenticated UID.

**Why:** Separate screens can write to Firestore, the API, or local storage through their own helpers; an existing Firebase session can persist in the browser even while the screenshot context shows fictional data and reports no UID. For capture-only media, disabling focus and pointer interaction at the app root avoids triggering these actions.

**How to apply:** Keep `?demo=1` capture pages non-interactive while they show fictional profiles, or comprehensively audit and block mutation paths before making them interactive. Never treat skipped fixture persistence as proof of zero writes.