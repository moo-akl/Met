---
name: Gmail bounce reconciliation
description: Safety and payload-size requirements for reviewing stale Gmail bounce links.
---

The sync source pool may exceed the user-authorized count. Create a plan only when exactly the explicitly approved number of distinct, one-to-one Gmail Sent matches pass the existing sender, recipient, RFC message ID, and send-time checks. Do not change that count based on scan results without fresh user approval. Keep the separate apply confirmation and re-read Gmail notices and Sent messages during apply.

**Why:** The user first authorized exactly 136 verified entries, then separately authorized exactly 98 after a newer production scan yielded 98 verified matches from 162 candidates. The authorization is exact; a lower or higher verified count needs fresh approval.

**How to apply:** Keep the explicitly approved count aligned with the exact verification guard and tests. When the candidate pool or signed payload grows, keep OpenAPI length limits aligned on both the sync response's source token and preview request's source token, regenerate the API clients, and retain apply-time revalidation.

PostgreSQL timestamps can have microsecond precision, while JavaScript `Date` and ISO tokens preserve only milliseconds. Apply-time row guards must compare timestamp values within the serialized millisecond bucket, not use exact equality against a rounded plan timestamp.

**Why:** Exact `created_at`/`sent_at` equality can reject an unchanged outreach row after preview because the plan has already discarded PostgreSQL's sub-millisecond digits.

**How to apply:** Keep exact equality on stable identifiers and status fields; for timestamps serialized through `Date`, compare from the serialized millisecond up to (but not including) the next millisecond.
