---
name: Expo web screenshot capture
description: Reliable screenshots of nested routes in the Expo app's web preview.
---

Directly opening a nested Expo route in the preview screenshot can render a blank page. Start the root demo screen first, navigate to the target route in the same browser session, and wait for `document.fonts.ready` before capturing so icon fonts have loaded.

**Why:** A direct route capture rendered blank, and early captures showed missing icon glyphs; warming the app and waiting for fonts produced complete, current screens.

**How to apply:** Use this sequence for Expo web screenshots, especially nested tab routes and screens that use vector icons. For long screens, choose a deliberate mobile viewport rather than relying on full-page capture.
