---
name: Lazy-load heavy sheet components
description: Large bottom-sheet components with complex StyleSheet.create cause startup crashes on New Architecture / iOS 26 if imported statically; React.lazy() defers module evaluation.
---

## Rule

Any large bottom-sheet or modal component that is **not rendered on first paint** must be imported with `React.lazy()` + `React.Suspense fallback={null}` rather than a static `import`.

**Why:** In React Native 0.81 New Architecture (Fabric) on iOS 26+, `StyleSheet.create()` runs at module evaluation time. Style values that bypass the type system (e.g. `height: "100%" as unknown as number`) or use percentage strings where the CSS processor expects a number (`maxHeight: "92%"`) can trigger a style validation error. That JS fatal error hits `expo.controller.errorRecoveryQueue`, which calls `abort()` after 3 consecutive crashes. The crash log only shows the final SIGABRT — the original JS error is invisible without Sentry.

**How to apply:**

```typescript
// Instead of:
import { EnhancedHubSheet } from "@/components/EnhancedHubSheet";

// Use:
const EnhancedHubSheet = React.lazy(() =>
  import("@/components/EnhancedHubSheet").then((m) => ({
    default: m.EnhancedHubSheet,
  })),
);

// And at the render site:
{condition ? (
  <React.Suspense fallback={null}>
    <EnhancedHubSheet ... />
  </React.Suspense>
) : null}
```

Also avoid these style patterns in any StyleSheet.create — they work in Old Architecture but are risky in New Architecture:
- `height: "100%" as unknown as number` → use `alignSelf: "stretch"` or `flex: 1`
- `maxHeight: "92%"` → use `Math.round(Dimensions.get("window").height * 0.92)`

**Diagnostic pattern for this class of crash:**
- SIGABRT, `legacyInfo.threadTriggered.queue = "expo.controller.errorRecoveryQueue"`
- Crash within ~1-2 seconds of launch, Expo error recovery exhausted
- No JS stack trace in the crash log (Hermes bytecode crash)
- Consistent crash (every launch, not intermittent)
