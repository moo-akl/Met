---
name: Large venue campaign reviews
description: Browser testing and performance constraints when reviewing large global venue-prospect cohorts.
---

In global venue-prospect drafts and review, keep every recipient row available but create its email-preview iframe only when that row is expanded. Closing the row should unmount its iframe. Do not pre-create previews for all visible or selected recipients.

**Why:** Opening a review with 555 recipients previously mounted hundreds of individual previews and exceeded Playwright's default 30-second test timeout. Lazy previews let admins review any message without paying that cost up front.

**How to apply:** For large-cohort draft and review tests, assert all recipients remain available, no preview iframe exists before expansion, and only the chosen recipient's iframe is mounted and removed when closed.
