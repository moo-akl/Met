---
name: Event map pin visibility
description: Map visibility and expiry rules for events and hangout plans.
---

Show event, Hangout, and Plan pins only when the signed-in user has a Going RSVP, starting two hours before the event and ending at its end time. Treat a personal Plan's creator as going even without a self-RSVP. Invitation-only events and personal plans may appear only to people already authorized to view them; never expose their title, location, or time to unauthorized viewers. When no end time is stored, keep the existing four-hour default duration.

**Why:** The user requested only Going map pins, with a two-hour lead-in and removal when an event ends. Personal Plan creators are implicitly attending, while the existing privacy boundary and four-hour missing-end fallback remain important.

**How to apply:** Enforce event access in the server response, keep the map cache scoped to the authenticated user, include in-progress events and creator-owned personal Plans, and remove pins outside the two-hour-to-end window without requiring manual refresh.
