// Real-time Firestore chat between two connected users.
//
// Structure:
//   chats/{chatId}           — top-level doc with lastMessage + lastReadAt
//   chats/{chatId}/messages/ — ordered message sub-collection
//
// chatId = [uidA, uidB].sort().join("_") so both users share one doc.

import { getFirestoreModule } from "./client";

export function getChatId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

export interface ChatMessage {
  id: string;
  from: string;
  text: string;
  sentAt: number; // epoch ms
}

export interface ChatMeta {
  lastMessage: { text: string; from: string; sentAt: number } | null;
  lastReadAt: Record<string, number>; // uid → epoch ms
}

type MaybeTimestamp = { toMillis?: () => number } | number | null | undefined;
function toEpochMs(v: MaybeTimestamp): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && typeof v.toMillis === "function") {
    try { return v.toMillis(); } catch { return Date.now(); }
  }
  return Date.now();
}

/**
 * Send a message from `fromUid` to the chat shared with `toUid`.
 * Also updates the top-level chat doc's lastMessage + lastReadAt for sender.
 */
export async function sendMessage(
  fromUid: string,
  toUid: string,
  text: string,
): Promise<boolean> {
  const fs = await getFirestoreModule();
  if (!fs) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  try {
    const chatId = getChatId(fromUid, toUid);
    const now = Date.now();
    const chatRef = fs.collection("chats").doc(chatId);
    const msgRef = chatRef.collection("messages").doc();

    const fsMod = await import("@react-native-firebase/firestore");
    const serverNow = fsMod.default.FieldValue.serverTimestamp();

    const batch = fs.batch();
    batch.set(msgRef, { from: fromUid, text: trimmed, sentAt: serverNow });
    batch.set(
      chatRef,
      {
        participants: [fromUid, toUid].sort(),
        lastMessage: { text: trimmed, from: fromUid, sentAt: serverNow },
        [`lastReadAt.${fromUid}`]: now,
      },
      { merge: true },
    );
    await batch.commit();
    return true;
  } catch (err) {
    console.warn("[chat] sendMessage failed", err);
    return false;
  }
}

/**
 * Subscribe to messages in the chat between the two users.
 * Listener receives the full ordered array of messages on every change.
 * Returns an async-resolved unsubscribe.
 */
export async function subscribeToMessages(
  myUid: string,
  peerUid: string,
  listener: (messages: ChatMessage[]) => void,
): Promise<() => void> {
  let cancelled = false;
  let real: (() => void) | null = null;
  const fs = await getFirestoreModule();
  if (!fs) return () => {};
  if (cancelled) return () => {};

  const chatId = getChatId(myUid, peerUid);
  real = fs
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("sentAt", "asc")
    .limitToLast(200)
    .onSnapshot(
      (snap) => {
        const msgs: ChatMessage[] = [];
        snap.forEach((doc) => {
          const d = doc.data() as Record<string, unknown>;
          msgs.push({
            id: doc.id,
            from: typeof d["from"] === "string" ? d["from"] : "",
            text: typeof d["text"] === "string" ? d["text"] : "",
            sentAt: toEpochMs(d["sentAt"] as MaybeTimestamp),
          });
        });
        listener(msgs);
      },
      (err) => {
        console.warn("[chat] messages snapshot error", err);
      },
    );

  return () => {
    cancelled = true;
    if (real) real();
  };
}

/**
 * Mark messages as read by updating lastReadAt for myUid on the chat doc.
 */
export async function markChatRead(
  myUid: string,
  peerUid: string,
): Promise<void> {
  const fs = await getFirestoreModule();
  if (!fs) return;
  try {
    const chatId = getChatId(myUid, peerUid);
    await fs
      .collection("chats")
      .doc(chatId)
      .set({ [`lastReadAt.${myUid}`]: Date.now() }, { merge: true });
  } catch (err) {
    console.warn("[chat] markChatRead failed", err);
  }
}

/**
 * Subscribe to the top-level chat meta doc (lastMessage + lastReadAt).
 * Used by the connections list to show an unread badge.
 */
export async function subscribeToChatMeta(
  myUid: string,
  peerUid: string,
  listener: (meta: ChatMeta | null) => void,
): Promise<() => void> {
  let cancelled = false;
  let real: (() => void) | null = null;
  const fs = await getFirestoreModule();
  if (!fs) return () => {};
  if (cancelled) return () => {};

  const chatId = getChatId(myUid, peerUid);
  real = fs
    .collection("chats")
    .doc(chatId)
    .onSnapshot(
      (snap) => {
        if (!snap.exists) { listener(null); return; }
        const d = snap.data() as Record<string, unknown> | undefined;
        if (!d) { listener(null); return; }
        const lm = d["lastMessage"] as Record<string, unknown> | undefined;
        const lra = (d["lastReadAt"] ?? {}) as Record<string, unknown>;
        const lastReadAt: Record<string, number> = {};
        for (const [k, v] of Object.entries(lra)) {
          lastReadAt[k] = toEpochMs(v as MaybeTimestamp);
        }
        listener({
          lastMessage: lm
            ? {
                text: typeof lm["text"] === "string" ? lm["text"] : "",
                from: typeof lm["from"] === "string" ? lm["from"] : "",
                sentAt: toEpochMs(lm["sentAt"] as MaybeTimestamp),
              }
            : null,
          lastReadAt,
        });
      },
      (err) => {
        console.warn("[chat] meta snapshot error", err);
      },
    );

  return () => {
    cancelled = true;
    if (real) real();
  };
}
