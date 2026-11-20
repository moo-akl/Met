---
name: Mockup screenshot captures
description: Capture clean, high-resolution images from live mockup sandbox components.
---

For mockup sandbox exports, use the screenshot endpoint relative to the artifact's preview base (`/screenshot/<group>/<Component>`). The base already includes the preview prefix; adding it again duplicates the route. The endpoint removes sandbox controls and produces a 3× capture; when capturing that endpoint through app preview, use the intrinsic 3× viewport size or the browser only captures the top-left portion.

**Why:** Direct preview captures included sandbox UI, while a fully prefixed route failed because the preview base was already applied.

**How to apply:** Save from the relative screenshot route, set app-preview viewport dimensions to 3× the mockup viewport (for example, 1170×2532 for 390×844), then inspect the image and browser logs before embedding it in email or app media.
