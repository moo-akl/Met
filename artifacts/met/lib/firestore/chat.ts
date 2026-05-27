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
 *
 * Strategy (no batch):
 *  1. Write the message document to the sub-collection (always a CREATE).
 *  2. Try to UPDATE the top-level chat meta doc (faster path, no participants check).
 *     If the doc doesn't exist yet, UPDATE fails → fall back to SET (CREATE) with
 *     the full participants array so the CREATE rule is satisfied.
 *
 * Why no batch?
 *  Batches with set(..., { merge:true }) on a non-existent doc are evaluated as
 *  CREATE, requiring the participants check. But the dot-notation key
 *  `lastReadAt.${uid}` inside a native-SDK set() is treated as a literal field
 *  name (not a nested path), which can confuse the rules evaluation.
 *  Separating the writes and using update() (which correctly interprets dot
 *  notation as field paths) is simpler and more predictable.
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

    // Step 1 — write the message (always a CREATE, rule: callerInChatId + from==uid).
    // This is the only critical write: if it fails we return false so the caller
    // can restore the draft. Everything after this is best-effort.
    await msgRef.set({ from: fromUid, text: trimmed, sentAt: now });

    // Step 2 — update chat meta doc (best-effort, fire-and-forget).
    // We deliberately do NOT await this: a meta-write failure must never make
    // sendMessage return false when the message itself was successfully stored.
    void (async () => {
      try {
        // update() interprets dot-notation as nested field paths (correct for
        // lastReadAt.{uid}). Fires the UPDATE rule: allow update: if callerInChatId().
        await chatRef.update({
          lastMessage: { text: trimmed, from: fromUid, sentAt: now },
          [`lastReadAt.${fromUid}`]: now,
        });
      } catch {
        // Doc doesn't exist yet → CREATE it with the participants array so the
        // Firestore CREATE rule (requires participants field) passes.
        try {
          await chatRef.set({
            participants: [fromUid, toUid].sort(),
            lastMessage: { text: trimmed, from: fromUid, sentAt: now },
            lastReadAt: { [fromUid]: now },
          });
        } catch (metaErr) {
          console.warn("[chat] meta update failed (non-critical)", metaErr);
        }
      }
    })();

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

  // Auto-retry: if the onSnapshot listener dies with an error
  // (e.g. PERMISSION_DENIED from a stale rule set), re-subscribe after
  // a short back-off so the UI recovers without needing an app restart.
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const RETRY_DELAYS = [2000, 5000, 15000]; // ms
  let retryCount = 0;

  function attach() {
    if (cancelled) return;
    if (real) { real(); real = null; }

    real = fs!
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .orderBy("sentAt", "asc")
      .limitToLast(200)
      .onSnapshot(
        (snap) => {
          retryCount = 0; // reset back-off on any successful snapshot
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
          console.warn("[chat] messages snapshot error — will retry", err);
          if (cancelled) return;
          const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
          retryCount++;
          retryTimer = setTimeout(attach, delay);
        },
      );
  }

  attach();

  return () => {
    cancelled = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (real) real();
  };
}

/**
 * Mark messages as read by updating lastReadAt for myUid on the chat doc.
 * Uses update() so dot-notation correctly sets the nested field.
 * Silently ignores errors (doc may not exist yet if no messages have been sent).
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
      .update({ [`lastReadAt.${myUid}`]: Date.now() });
  } catch {
    // Doc doesn't exist yet (no messages sent) — nothing to mark as read.
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
