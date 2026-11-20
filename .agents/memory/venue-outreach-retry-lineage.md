---
name: Venue outreach retry lineage
description: Rules for linking Venue Admin retries and cleaning up repeat Gmail bounces safely.
---

A repeat bounce may clear Venue Admin history only when the new send explicitly links to a bounced source with `retryOfLogId`. Never infer a retry from recipient or template equality alone. Validate the source and root against the same recipient and venue, clear only that retry chain, and retain Gmail message-ID tombstones so future syncs do not restore removed notices. Gmail messages themselves remain untouched.

**Why:** An unrelated send to the same address can bounce independently, and deleting a history row otherwise removes the marker needed to suppress its Gmail notice.

**How to apply:** Every retry send path must pass and validate `retryOfLogId`. Automatic sync and manual notice-link flows should share the same chain cleanup, while leaving unrelated outreach and Gmail messages intact.
