---
name: Venue owner and branch lifecycles
description: Additional venue applications must not reopen or downgrade an existing owner's approved lifecycle.
---

Treat an additional venue application as a separate lifecycle from first-time
owner registration. Approved owners must retain access to their existing venues
while applying for another venue or waiting for that venue's approval.

**Why:** An account-wide guard can incorrectly interpret an additional-venue
application as forbidden first-time onboarding and redirect away immediately.
Relaxing all registration restrictions instead would confuse the two lifecycles.

**How to apply:** Preserve explicit additional-venue intent through navigation
guards, keep ordinary registration restrictions, and test both approved-owner
branch access and non-approved applicant restrictions.