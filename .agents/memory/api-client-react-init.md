---
name: api-client-react initialization
description: setBaseUrl and setAuthTokenGetter from @workspace/api-client-react must be called at module level in _layout.tsx before any network hooks fire.
---

## Rule
`@workspace/api-client-react` exports `setBaseUrl` and `setAuthTokenGetter`.
Both **must** be called at module level in `artifacts/met/app/_layout.tsx` before
any React Query hooks or plain functions from that package are invoked.

**Why:** The package's internal `customFetch` uses module-level `_baseUrl` and
`_authTokenGetter` variables. If `setBaseUrl()` is never called, every request
hits `undefined` as the host. If `setAuthTokenGetter()` is never called, all
requests go out unauthenticated. Orval generation can also rewrite the package
barrel to export only generated files, silently dropping these custom exports
and breaking the app's startup import.

**How to apply:** After running Orval, verify the package barrel still exports
`setBaseUrl`, `setAuthTokenGetter`, and `AuthTokenGetter` from `custom-fetch`,
alongside generated outputs. Keep both setters at module level in
`artifacts/met/app/_layout.tsx`. The token getter should match the pattern in
`lib/api/client.ts`: dynamically import `@react-native-firebase/auth`, call
`getIdToken(false)` then fall back to `getIdToken(true)` on failure, and return
`null` when no current user.
