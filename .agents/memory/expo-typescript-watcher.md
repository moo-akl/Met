---
name: Expo watcher compatibility
description: Security-pinned Metro uses a newer watcher payload that SDK 54 Expo CLI cannot consume directly.
---

Keep Metro security overrides when Expo CLI crashes on `eventsQueue is not iterable`.
Use an adapter scoped to Expo's observer subscriptions, never a global rewrite
of Metro's event emitter or shared payload. Apply it to every Expo Metro server
launcher, including publishing builders that use `expo start --no-dev`.

**Why:** Production exports passed, but the development server crashed on file
changes. Expo's dotenv observer assumes the old `eventsQueue` payload, while
newer Metro emits `changes` and `rootDir`. The helper's filename misleadingly
mentions TypeScript: `EXPO_NO_TYPESCRIPT_SETUP=1` skips only the separate
TypeScript bootstrap, not this unconditional dotenv observer. SDK 54 CLI patch
releases inspected on 2026-10-01 still expected the old payload. Downgrading Metro
would discard security fixes, and a global event rewrite would break Metro HMR.
Publishing failed after the iOS bundle was written because its separate
production-mode Metro server still installed this observer without the adapter.
An `expo export` passing does not verify a publishing path built on `expo start`.

**How to apply:** Normalize events only for Expo's observer, retaining its dotenv
filtering and listener cleanup. Keep the TypeScript setup flag and explicit CI
typechecks for the separate bootstrap path. Check both legacy and new payloads,
including file removals, while leaving ordinary Metro listeners unchanged.
Reevaluate the adapter on Expo CLI upgrades and fail explicitly on an unsupported
API rather than silently downgrading security pins.
Verify the actual publishing command through both sequential platform bundles;
writing the first bundle creates watcher events that can crash the second.