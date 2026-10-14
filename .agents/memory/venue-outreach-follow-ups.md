---
name: Venue outreach follow-up storage
description: Design constraint for preserving next-contact plans across invitation history changes.
---

Store next-contact plans independently from individual venue outreach email records and allow them to exist before a venue profile is created. An invitation may be resent or converted into an application without replacing the outreach history.

**Why:** Outreach begins before a venue owner profile necessarily exists, and new email events must not erase a handoff plan.

**How to apply:** When extending the invited-venue queue, keep follow-up state keyed to the venue/prospect rather than to a single send, and preserve the identity transition when an unlinked prospect later becomes a profile.
