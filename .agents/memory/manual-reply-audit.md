---
name: Manual outreach reply audit
description: Rules for manual reply confirmations in venue outreach history.
---

Admin-confirmed replies must remain distinct from Gmail-detected replies. Record each manual mark and undo as an append-only event with its actor and timestamp; derive the active manual state from the latest event.

**Why:** A manual correction must not fabricate Gmail metadata, and undoing a mistaken mark should retain an audit trail.

**How to apply:** When changing outreach history, reply filters, or no-reply eligibility, preserve Gmail classification as Gmail-only and account for the current manual mark separately.
