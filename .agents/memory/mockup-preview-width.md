---
name: Mockup preview width constraints
description: Responsive layout sizing for full-page components inside the mockup sandbox preview wrapper.
---

Constrain the top-level preview component and key hero/grid children to the viewport width. Give grid children `min-w-0` where content must shrink and prevent intrinsic-width content from expanding the preview wrapper. A wide child can push the hero outside the visible phone viewport, making the page appear blank even though it loaded without browser errors.

**Why:** A Met landing-page variant appeared blank on a phone viewport and clipped on desktop while the extracted current page worked at the same sizes; the cause was unbounded intrinsic width, not missing assets or animation timing.

**How to apply:** Before presenting a responsive mockup, capture narrow and desktop screenshots. If content appears blank or cropped, compare the extracted current frame at the same viewport, then inspect root/hero width constraints and grid-item minimum widths.
