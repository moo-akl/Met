---
name: Android Firestore batch hang
description: batch.commit() can hang indefinitely on Android when Play Integrity (App Check) is slow/fails; pattern for safely calling writeRevealResponse
---

On Android, `@react-native-firebase/firestore` batch.commit() can hang indefinitely when Play Integrity (App Check) is slow to initialise or fails to obtain a token. This manifests as any function that `await`s a Firestore batch commit appearing to do nothing — the Promise never rejects or resolves, leaving the caller stuck.

**Why:** `getFirestoreModule()` uses `Promise.all([initAppCheck(), import(...)])`. While `appCheckInitialized` is set eagerly (so re-entrant calls return immediately), a slow Play Integrity attestation can still cause the first `batch.commit()` to hang at the network layer inside the native bridge.

**How to apply:** Never `await writeRevealResponse(...)` on a UI-critical code path. Use `void writeRevealResponse(...)` so the Firestore write runs in the background. The REST API call (`api.acceptReveal` / `api.declineReveal`) is the authoritative path for Postgres and must remain awaited (or at minimum fire-and-forget before local state update). `updateEncounterStatus()` (local React state) must never be blocked by a Firestore write.

Affected functions in `AppContext.tsx`: `acceptRevealRequest`, `declineRevealRequest`.
