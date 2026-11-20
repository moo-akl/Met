---
name: Native sheet header layout
description: Venue pages must use the same full-screen presentation for every entry path.
---

Use the same full-screen venue page presentation for map, saved-place, and QR entry paths. Do not restore a bottom-sheet presentation for map openings.

**Why:** The user requested that the venue page always look like the working QR-opening style after repeated native sheet overlap problems. Raising the header hid the cover, while grouping the header did not fix the user's native result.

**How to apply:** Keep Back and Save in the normal page header above the unobstructed cover photo, not floating over it or moved below it. Preserve QR verification and each route's back-navigation behavior. Native navigation still needs native verification; a web preview cannot prove its behavior.
