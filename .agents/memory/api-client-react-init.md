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
requests go out unauthenticated. Errors surface as generic "Failed to …" alerts
with no useful network error — easy to miss.

**How to apply:** Any new screen or hook that imports from
`@workspace/api-client-react` will work automatically once the two calls are in
`_layout.tsx`. The token getter should match the pattern in `lib/api/client.ts`:
dynamic import of `@react-native-firebase/auth`, call `getIdToken(false)` then
fall back to `getIdToken(true)` on failure. Return `null` when no current user.
