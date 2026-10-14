---
name: Duplicate React type versions under pnpm
description: React ref mismatches caused by an app and third-party declaration files resolving different @types/react versions in a pnpm workspace.
---

When React refs are reported as incompatible between two identical-looking `@types/react` types, inspect TypeScript's resolved file paths before changing component code. In this workspace, declarations loaded through pnpm's virtual store can resolve React types from a different version than the app's direct type dependency.

**Why:** React 19 ref callback types are structurally similar but can be incompatible across versions, so calendar and icon components can fail typechecking despite compiling successfully.

**How to apply:** Align the app's `@types/react` and `@types/react-dom` dependencies with the versions resolved by the affected declarations, update the lockfile, and avoid casts or component behavior changes.
