---
name: Venue activation reinstatement
description: Why reinstated venue listings receive an activation exception instead of immediately resuming expired deadlines.
---

Restoring a venue unlisted for missed activation milestones should also exempt it from those already-elapsed deadlines. Keep the original invitation and registration timestamps as audit history. A newly issued owner setup link may need its own future expiry even when the original activation deadline remains in the past.

**Why:** Clearing only the unlisted flag would cause the daily deadline processor to unlist the venue again on its next run. Rewriting the first invitation timestamp would falsely represent when the original offer was sent.

**How to apply:** If a future product policy asks to re-arm activation instead of granting an exception, design a new explicitly recorded activation attempt with its own window, reminders, and reasoned admin action; do not silently reset historical timestamps.