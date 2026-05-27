---
name: Photo upload failure revert
description: On upload failure, the stale file:// URI must be reverted in AppContext and AsyncStorage
---

When a photo upload fails (422 moderation rejection, network error, etc.), the local `file://` URI was already written to both AppContext state and AsyncStorage by the `setProfile` call in `handleSave`. If `setProfileState` is not called to revert it:

1. The stale `file://` URI persists in AsyncStorage.
2. On next app launch, `FileSystem.readAsStringAsync` throws (temp file deleted by OS).
3. The catch block falls back to `photoUrl = lastSyncedPhotoUrlRef.current` which may be `null`.
4. `upsertMyProfile({ photoUrl: null })` silently wipes the user's photo from the server.
5. User is stuck: no photo, save button disabled.

**Why:** `lastSyncedPhotoUrlRef` is only updated on success, so a first-session failure leaves it as `null`.

**How to apply:** In the upload catch block (AppContext.tsx), always call `setProfileState` to revert `photoUri` to `lastSyncedPhotoUrlRef.current ?? ""` and call `saveProfile` to persist the revert to AsyncStorage.
