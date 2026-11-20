---
name: Local reminder inbox timing
description: How scheduled device reminders become visible in the server-backed inbox.
---

Save local event reminders to the inbox when they are scheduled, using the scheduled fire time as their creation time. Inbox queries must hide future-dated rows, and cancelling a reminder must remove its inbox row.

**Why:** A device-scheduled reminder can fire while the app is offline, so the inbox needs a server record created in advance without showing the reminder before it is due.

**How to apply:** Keep event reminder scheduling, inbox due-time filtering, rescheduling, and cancellation in sync when changing local reminder behavior.
