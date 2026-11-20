---
name: Hangout host ratings
description: Eligibility, isolation, and privacy rules for ratings attached to completed Hangouts.
---

Store host feedback against the specific Hangout, not in general peer reviews. Only accepted guests may submit a rating, and only after the Hangout has ended. Public responses contain the host's average and count, plus the viewer's own rating only when they were an accepted guest; never return reviewer identities or individual ratings.

Claim each completed Hangout's rating prompt atomically so periodic sweeps do not send duplicates. If delivery retries are later required, track recipient-level delivery state instead of clearing the claim after uncertain sends.

Localize Hangout pushes server-side for each recipient's preferred language, using the supported base language and English when the stored locale is missing or unsupported. Keep lock-screen copy generic: only a join requester’s intended display name may appear; never include an event title, location, or description.

**Why:** Event details may be private even when a notification is visible on a locked device; the requester’s display name is the only intended identity detail in a join-request alert.

**How to apply:** Preserve event association, guest eligibility, and aggregate-only privacy for ratings; keep notification deduplication durable across API processes, include per-recipient locale in every Hangout push, and test payloads against unique private event details.
