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
  /** Firebase Storage download URL for an image attachment. */
  mediaUri?: string;
  /** Media type — currently only "image" is supported. */
  mediaType?: "image";
}

export interface ChatMeta {
  lastMessage: { text: string; from: string; sentAt: number; mediaType?: "image" } | null;
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
 * Compress and upload a local image URI to Firebase Storage.
 * Returns the public download URL.
 *
 * Compression strategy (for maximum space efficiency):
 *   - Resize longest edge to ≤1280 px
 *   - JPEG quality 0.75
 *   - Falls back to original URI if compression fails
 */
export async function uploadChatMedia(
  fromUid: string,
  toUid: string,
  localUri: string,
): Promise<string> {
  // ── 1. Compress ──────────────────────────────────────────────────────────
  let compressedUri = localUri;
  try {
    const manip = await import("expo-image-manipulator");
    // Support both legacy (manipulateAsync) and newer class-based APIs.
    if (typeof manip.manipulateAsync === "function") {
      const result = await manip.manipulateAsync(
        localUri,
        [{ resize: { width: 1280 } }],
        { compress: 0.75, format: manip.SaveFormat.JPEG },
      );
      compressedUri = result.uri;
    } else if (manip.ImageManipulator) {
      const ctx = (manip.ImageManipulator as { manipulate: (uri: string) => {
        resize: (opts: { width: number }) => { renderAsync: () => Promise<{ saveAsync: (opts: { compress: number; format: unknown }) => Promise<{ uri: string }> }> };
      } }).manipulate(localUri);
      const img = await ctx.resize({ width: 1280 }).renderAsync();
      const saved = await img.saveAsync({ compress: 0.75, format: (manip as { SaveFormat: { JPEG: unknown } }).SaveFormat.JPEG });
      compressedUri = saved.uri;
    }
  } catch {
    // Compression failed — upload the original; still better than nothing.
  }

  // ── 2. Upload to Firebase Storage ────────────────────────────────────────
  const storageMod = await import("@react-native-firebase/storage");
  const storageInstance = storageMod.default();
  const chatId = getChatId(fromUid, toUid);
  const ref = storageInstance.ref(`chats/${chatId}/${Date.now()}.jpg`);
  await ref.putFile(compressedUri);
  return ref.getDownloadURL();
}

/**
 * Send a message from `fromUid` to the chat shared with `toUid`.
 *
 * Accepts an optional `mediaUri` (Firebase Storage download URL).
 * Either `text` or `mediaUri` (or both) must be present.
 *
 * Uses a WriteBatch so the message doc and the chat meta update
 * (which flips nextSenderUid to enforce the ping-pong turn rule)
 * are committed atomically.
 *
 * Returns null on success, or an error string on failure.
 */
export async function sendMessage(
  fromUid: string,
  toUid: string,
  text: string,
  mediaUri?: string,
): Promise<string | null> {
  const fs = await getFirestoreModule();
  if (!fs) return "Firestore unavailable (native module not loaded)";
  const trimmed = text.trim();
  if (!trimmed && !mediaUri) return "Empty message";

  if (!fromUid || !toUid) {
    return `Invalid UIDs — fromUid="${fromUid}" toUid="${toUid}"`;
  }

  const chatId = getChatId(fromUid, toUid);
  const now = Date.now();
  const chatRef = fs.collection("chats").doc(chatId);
  const msgRef = chatRef.collection("messages").doc();

  // For the last-message preview: use text if present, otherwise "📷" placeholder
  const previewText = trimmed || "📷";

  try {
    const batch = fs.batch();

    // Message doc — the turn rule is enforced server-side in Firestore rules
    // (messages create requires nextSenderUid == null || == caller).
    const msgData: Record<string, unknown> = { from: fromUid, text: trimmed, sentAt: now };
    if (mediaUri) {
      msgData["mediaUri"] = mediaUri;
      msgData["mediaType"] = "image";
    }
    batch.set(msgRef, msgData);

    // Chat meta — flip the turn to the recipient so they can reply.
    const lastMessage: Record<string, unknown> = { text: previewText, from: fromUid, sentAt: now };
    if (mediaUri) lastMessage["mediaType"] = "image";
    batch.set(
      chatRef,
      {
        participants: [fromUid, toUid].sort(),
        lastMessage,
        lastReadAt: { [fromUid]: now },
        nextSenderUid: toUid,
      },
      { merge: true },
    );

    await batch.commit();
    return null;
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "unknown";
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[chat] sendMessage batch failed", { code, fromUid, toUid, chatId });
    return `[${code}] ${msg}`;
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
            const msg: ChatMessage = {
              id: doc.id,
              from: typeof d["from"] === "string" ? d["from"] : "",
              text: typeof d["text"] === "string" ? d["text"] : "",
              sentAt: toEpochMs(d["sentAt"] as MaybeTimestamp),
            };
            if (typeof d["mediaUri"] === "string") {
              msg.mediaUri = d["mediaUri"];
              msg.mediaType = "image";
            }
            msgs.push(msg);
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
                ...(lm["mediaType"] === "image" ? { mediaType: "image" as const } : {}),
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
