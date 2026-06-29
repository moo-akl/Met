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
 * Upload a local image URI to Firebase Storage via REST API.
 * Returns a token-bearing download URL (no auth headers needed for display).
 *
 * Does NOT compress — expo-image-manipulator is a native module that is only
 * safe to call from a build that explicitly links it. Compression can be
 * re-added once a new EAS build includes the module.
 *
 * The image picker returns a file:// URI by default (copyToCacheDirectory=true),
 * which React Native's Hermes fetch can read as a blob directly.
 */
export async function uploadChatMedia(
  fromUid: string,
  toUid: string,
  localUri: string,
): Promise<string> {
  // ── 1. Get Firebase Auth ID token ─────────────────────────────────────────
  const authMod = await import("@react-native-firebase/auth");
  const idToken = await authMod.default().currentUser?.getIdToken();
  if (!idToken) throw new Error("Not authenticated");

  // ── 2. Read file as blob and POST to Firebase Storage REST API ───────────
  //
  // Avoids @react-native-firebase/storage and expo-image-manipulator entirely —
  // both are native modules that require a fresh EAS build to link.
  // Hermes fetch natively handles file:// URIs as binary blobs.
  const BUCKET = "metapp-b4642.firebasestorage.app";
  const chatId = getChatId(fromUid, toUid);
  const storagePath = `chats/${chatId}/${Date.now()}.jpg`;
  const encodedPath = encodeURIComponent(storagePath);
  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o` +
    `?uploadType=media&name=${encodedPath}`;

  const fileResponse = await fetch(localUri);
  if (!fileResponse.ok) throw new Error(`Cannot read local file (${fileResponse.status})`);
  const blob = await fileResponse.blob();

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "image/jpeg",
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text().catch(() => String(uploadResponse.status));
    throw new Error(`Storage upload failed (${uploadResponse.status}): ${errText}`);
  }

  // ── 3. Return token-bearing download URL (no auth headers needed) ─────────
  const meta = (await uploadResponse.json()) as { downloadTokens?: string };
  const dlToken = meta.downloadTokens;
  if (!dlToken) throw new Error("No download token in upload response");

  return (
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}` +
    `?alt=media&token=${dlToken}`
  );
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
