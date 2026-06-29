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
