---
name: Apple Sign in button compliance
description: The native Apple button is required for App Store review compliance.
---

Met's iOS onboarding must render Expo's native `AppleAuthenticationButton` with Apple-defined button type and style. Do not replace it with a custom `Pressable` containing an Apple icon and localized text.

**Why:** Apple rejected a build under Guideline 4 because the custom control was not clearly identifiable as the official Sign in with Apple button, even though it looked visually similar.

**How to apply:** Keep the native button's `buttonType`, `buttonStyle`, required dimensions, and existing authentication handler together whenever changing onboarding UI.