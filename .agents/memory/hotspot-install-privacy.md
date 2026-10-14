---
name: Hotspot installation privacy boundary
description: Approval and privacy constraints for recovering a scanned hotspot through first installation.
---

Treat deferred installation recovery as approval-gated research before
implementation. Keep existing printed QR URLs and return-to-browser/Open Met
or rescan fallback. Never promise guaranteed iOS recovery or use clipboard or
fingerprinting tricks. Across installation carry only a scoped, expiring
check-in intent, not private account data.

**Why:** The user explicitly set these boundaries for evaluating first-time
hotspot installation; a vendor SDK or apparently helpful tracking is not
implicitly authorized.

**How to apply:** Obtain explicit approval before adding a provider or new data
processing, including a first-party install handoff. Evaluate current platform
limits and service costs first. See `docs/hotspot-deferred-install-proposal.md`
for the dated research; recheck vendor terms before any purchase.
