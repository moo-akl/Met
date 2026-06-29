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
  /** Whose turn it is to send next. null = either participant can go first. */
  nextSenderUid: string | null;
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
 * Writes are split into two sequential steps so the UI can report
 * exactly which step failed (message doc vs chat meta doc).
 *
 * Returns null on success, or a diagnostic error string on failure.
 */
export async function sendMessage(
  fromUid: string,
  toUid: string,
  text: string,
): Promise<string | null> {
  const fs = await getFirestoreModule();
  if (!fs) return "Firestore unavailable (native module not loaded)";
  const trimmed = text.trim();
  if (!trimmed) return "Empty message";

  if (!fromUid || !toUid) {
    return `Invalid UIDs — fromUid="${fromUid}" toUid="${toUid}"`;
  }

  // Cross-check: make sure the Firebase Auth current user matches the
  // fromUid we're about to write into the document. A mismatch would
  // cause an immediate permission-denied because the rules check
  // request.auth.uid == request.resource.data.from.
  let actualAuthUid: string | null = null;
  try {
    const authMod = await import("@react-native-firebase/auth");
    actualAuthUid = authMod.default().currentUser?.uid ?? null;
  } catch {
    // Non-fatal — proceed without the check.
  }
  if (actualAuthUid !== null && actualAuthUid !== fromUid) {
    return `Auth UID mismatch — fromUid="${fromUid}" but auth.uid="${actualAuthUid}"`;
  }

  const chatId = getChatId(fromUid, toUid);
  const now = Date.now();
  const chatRef = fs.collection("chats").doc(chatId);
  const msgRef = chatRef.collection("messages").doc();

  // Step 1: write the message doc. Rule: isAuthed() && from == uid.
  try {
    await msgRef.set({ from: fromUid, text: trimmed, sentAt: now });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "unknown";
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[chat] step1 msgRef.set failed", { code, fromUid, toUid, chatId, actualAuthUid });
    return `step1/msg [${code}] ${msg}`;
  }

  // Step 2: upsert the chat meta doc. Best-effort — a failure here
  // does NOT roll back the message, but we still surface the error so
  // the developer knows to investigate.
  try {
    await chatRef.set(
      {
        participants: [fromUid, toUid].sort(),
        lastMessage: { text: trimmed, from: fromUid, sentAt: now },
        lastReadAt: { [fromUid]: now },
        nextSenderUid: toUid,
      },
      { merge: true },
    );
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "unknown";
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[chat] step2 chatRef.set failed", { code, fromUid, toUid, chatId });
    // Message was sent — don't restore draft, but report the meta failure.
    return `step2/meta [${code}] ${msg}`;
  }

  return null; // full success
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
  if (!fs) {
    // Firestore unavailable (native module not linked or init failed).
    // Resolve the loading state so the UI doesn't spin forever.
    if (!cancelled) listener(null);
    return () => {};
  }
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
        const nextSenderUid =
          typeof d["nextSenderUid"] === "string" ? d["nextSenderUid"] : null;
        listener({
          lastMessage: lm
            ? {
                text: typeof lm["text"] === "string" ? lm["text"] : "",
                from: typeof lm["from"] === "string" ? lm["from"] : "",
                sentAt: toEpochMs(lm["sentAt"] as MaybeTimestamp),
              }
            : null,
          lastReadAt,
          nextSenderUid,
        });
      },
      (err) => {
        console.warn("[chat] meta snapshot error", err);
        // Always resolve loading state on error so the UI never hangs.
        listener(null);
      },
    );

  return () => {
    cancelled = true;
    if (real) real();
  };
}
