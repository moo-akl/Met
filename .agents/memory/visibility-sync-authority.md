---
name: Visibility synchronization authority
description: Why explicit visibility opt-ins rely on the server and why Firestore index readiness matters for privacy synchronization.
---

Phone-side Firestore suppression is a fail-safe for Hidden, not a prerequisite for becoming Visible. The server must clear stale location atomically with its visible mirror acknowledgement.

**Why:** A healthy canonical API and a phone's direct Firestore access can have different permissions, SDK availability, and connectivity. Requiring both before opt-in unnecessarily blocks becoming Visible. Removing that prerequisite is safe only when the server owns the stale-location barrier; stale-version rejection and failed-mirror rollback must remain intact.

**How to apply:** Preserve server acknowledgement before starting local discovery. Clear location for explicit opt-ins, not routine visible profile edits, which must preserve active presence.

Firestore index deployment acceptance is not index readiness. Do not diagnose a generic visibility warning as phone connectivity without checking the live server's index errors.

**Why:** Hidden can commit successfully while collection-group history cleanup fails because its index is missing, producing a retryable error despite effective discovery suppression. Firebase CLI can finish deploying while the index is still building.

**How to apply:** Preserve existing indexes when adding configuration and verify the required index is READY before declaring the infrastructure repair complete. Do not weaken privacy safeguards to bypass an index failure.