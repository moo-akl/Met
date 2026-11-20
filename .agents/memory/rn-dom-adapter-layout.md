---
name: React Native mockup layout
description: Translating React Native source components into DOM previews without changing their layout metrics.
---

When rendering React Native components in the mockup sandbox, merge style arrays in order before applying adapter defaults. Preserve React Native's default column direction for views, respect explicit `display` values, and convert numeric `lineHeight` values to pixel strings because CSS interprets numeric line heights as unitless multipliers.

**Why:** A style adapter that gets these defaults or units wrong can make otherwise-correct mobile layouts collapse or create large blank gaps in browser previews.

**How to apply:** Whenever React Native UI is shown through a DOM adapter, capture and review a full mobile-sized screenshot before presenting the preview.
