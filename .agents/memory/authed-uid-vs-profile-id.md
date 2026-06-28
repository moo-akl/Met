---
name: authedUid vs profile.id
description: Why Firestore paths must use authedUid from AppContext, not profile.id
---

# Use authedUid for Firestore paths, never profile.id

## The rule
Any Firestore document path or security-rule check that encodes the caller's UID must use `authedUid` from AppContext, not `profile?.id`.

**Why:** `profile.id` is loaded from AsyncStorage (saved during onboarding). If onboarding ran before Firebase Auth initialised, the profile gets stored with a `"local-" + random` prefix as its ID (see `app/onboarding.tsx` line ~573-580). `authedUid` comes directly from `auth.currentUser.uid` (via `subscribeToAuthState`) and is always the real Firebase UID.

When `profile.id = "local-abc123"` but `request.auth.uid = "xyz456"`:
- `getChatId("local-abc123", peerUid)` produces a chatId that doesn't contain "xyz456"
- `callerInChatId()` in Firestore rules fails → PERMISSION_DENIED on every read/write
- Result: chat shows permanent "Loading…", every send returns false

## How to apply
- Firestore subscriptions in AppContext already use `authedUid` (subscribeToMetPeople, subscribeToRequestsChange, etc.)
- Any NEW screen or component that needs the caller's UID for Firestore should destructure `authedUid` from `useApp()`
- `authedUid` is now exported in AppContextValue (`contexts/AppContext.tsx`)
- API calls that use `{ uid: ... }` in ApiOptions also switched to `authedUid` — update `api-options-auth.md` note accordingly
