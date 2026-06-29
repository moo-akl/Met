---
name: Chat features data model
description: Fields added to ChatMessage and ChatMeta for reactions, reply-to, delete, and clear history
---

## ChatMessage new fields (Firestore + TypeScript)
- `reactions?: Record<string, string[]>` — emoji → [uid, uid…]. Toggle via `toggleReaction(chatId, msgId, emoji, myUid)` which uses `fsMod.default.FieldValue.arrayUnion/arrayRemove`
- `replyTo?: { id, from, text, mediaType? }` — snapshot at send time; passed as 5th arg to `sendMessage()`
- `deleted?: boolean` — soft delete; UI shows "🗑 Message deleted" stub

## ChatMeta new field
- `clearedAt?: Record<string, number>` — uid → epoch ms. Chat screen filters `messages.filter(m => m.sentAt > clearedAt[myUid])` after subscribing

## FieldValue pattern
Use `const fsMod = await import("@react-native-firebase/firestore"); const FieldValue = fsMod.default.FieldValue;` — same pattern as encounters.ts and presence.ts

**Why:** The Firestore module's FieldValue is on the default export (the namespace), not on the instance returned by `getFirestoreModule()`.

## FCM Push Notification Pipeline (lessons from debugging)

### Full token flow
1. App start → `PushTokenRegistrar` (inside AppProvider) calls `registerAndUploadPushToken(authedUid)`
2. `messaging().getToken()` → FCM token → POST `/api/profiles/me/push-token`  
3. API server saves to Postgres `profiles.push_token` AND mirrors to Firestore `users/{uid}.pushToken`
4. Cloud Function reads `users/{recipientUid}.pushToken` from Firestore and sends via FCM Admin SDK

### Critical requirements
- **Must use `authedUid`** (not `profile?.id`) for the uid passed to `registerAndUploadPushToken`. profile.id can be "local-xxx" during onboarding.
- **`setBackgroundMessageHandler` must be registered in `index.js`** (before React) for Android killed-state messages. Created `artifacts/met/index.js` + set `"main": "./index.js"` in package.json.
- **Add `messaging().onTokenRefresh()`** listener to re-upload tokens when FCM rotates them.
- **iOS requires APNs Auth Key** in Firebase Console → Project Settings → Cloud Messaging → iOS app. Without it, FCM cannot deliver to iOS regardless of code.
- **Cloud Function `sendChatMessageNotification` reads `displayName`** from Firestore `users/{uid}` (mirrored by API server on every profile upsert) and `pushToken` from same doc.

### Firebase CLI in Replit
Firebase CLI hangs indefinitely (even on `--version`) in the Replit environment. Use `cd functions && npm run build` to compile, then deploy from local terminal or CI.

## Deep analysis — why Cloud Functions failed for chat notifications (June 2026)

- Cloud Functions are an untestable black box in the Replit environment
  (Firebase CLI hangs; no access to Firebase Function logs from here)
- Moved chat notification sending to `POST /api/chats/notify` on the API server:
  reads FCM token from Postgres → sends via `adminMessaging().send()`
- This pattern is more reliable: Postgres token storage is proven (200 logs),
  Admin SDK is proven (auth works), and failures appear in deployment logs
- `sendMessage` in chat.ts calls `api.notifyChatMessage(...)` fire-and-forget
  after `batch.commit()` — never blocks the chat write

## Firestore rules: message update permissions
- `allow update, delete: if false` broke both `toggleReaction` AND `deleteMessage`
- Fixed to allow:
  - Sender: update `deleted: true` only (affectedKeys check prevents injection)
  - Any participant: update `reactions` field only
- After any Firestore rules change: `firebase deploy --only firestore:rules`

## iOS FCM notifications: messaging/third-party-auth-error
Confirmed from deployment logs: Android notifications work (FCM sent ✓),
iOS fails with `messaging/third-party-auth-error`.
Root cause: APNs Auth Key NOT uploaded to Firebase Console.
Fix: Firebase Console → Project Settings → Cloud Messaging → Apple app → APNs Auth Key → upload .p8
This is a Console-only config step — no code changes needed.

## Unread chat badge (tab icon)
`useHasUnreadChats(myUid)` in `hooks/useHasUnreadChats.ts` — subscribes to
`chats` collection with `where("participants","array-contains", myUid)`.
Unread = lastMessage.from ≠ myUid AND sentAt > lastReadAt[myUid] AND sentAt > clearedAt[myUid].
Used in `(tabs)/_layout.tsx` via `ChatTabIcon` component with `useApp().authedUid`.
