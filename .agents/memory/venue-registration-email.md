---
name: Venue registration email transport
description: Why registration-link emails use the connected Gmail account rather than the configured SMTP sender.
---

Keep venue registration-link email delivery on the connected Gmail integration unless there is a deliberate replacement. Do not retry through SMTP after an ambiguous Gmail send error.

**Why:** The configured Gmail SMTP login repeatedly returned authentication error 535, even after credentials were refreshed. The connected Gmail OAuth account could be reached successfully. A Gmail send can succeed despite a transport timeout, so switching to SMTP as an automatic fallback risks emailing duplicate setup links.

**How to apply:** When changing registration email delivery or investigating a reported "link generated but not sent" state, check the connected Gmail send path first. Other venue decision emails may still use SMTP; do not assume they are covered by the registration-link transport.