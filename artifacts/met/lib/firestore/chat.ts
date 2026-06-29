// Real-time Firestore chat between two connected users.
//
// Structure:
//   chats/{chatId}           — top-level doc with lastMessage + lastReadAt
//   chats/{chatId}/messages/ — ordered message sub-collection
//
// chatId = [uidA, uidB].sort().join("_") so both users share one doc.

import { getFirestoreModule } from "./client";
import { api } from "../api/client";

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
  /** Media type — "image" or "audio". */
  mediaType?: "image" | "audio";
  /** Duration of audio clip in milliseconds. */
  audioDurationMs?: number;
  /** Reactions: emoji → array of UIDs who reacted. */
  reactions?: Record<string, string[]>;
  /** Message this is replying to (snapshot at send time). */
  replyTo?: { id: string; from: string; text: string; mediaType?: "image" | "audio" };
  /** Soft-deleted flag — message content hidden, stub shown instead. */
  deleted?: boolean;
}

export interface ChatMeta {
  lastMessage: {
    text: string;
    from: string;
    sentAt: number;
    mediaType?: "image" | "audio";
  } | null;
  lastReadAt: Record<string, number>; // uid → epoch ms
  /** Whose turn it is to send next. null = either participant can go first. */
  nextSenderUid: string | null;
  /** Per-user epoch ms — messages older than this are hidden for that user. */
  clearedAt?: Record<string, number>;
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
 */
export async function uploadChatMedia(
  fromUid: string,
  toUid: string,
  localUri: string,
): Promise<string> {
  const authMod = await import("@react-native-firebase/auth");
  const idToken = await authMod.default().currentUser?.getIdToken();
  if (!idToken) throw new Error("Not authenticated");

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

  const meta = (await uploadResponse.json()) as { downloadTokens?: string };
  const dlToken = meta.downloadTokens;
  if (!dlToken) throw new Error("No download token in upload response");

  return (
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}` +
    `?alt=media&token=${dlToken}`
  );
}

/**
 * Upload a local audio file URI to Firebase Storage via REST API.
 * Returns a token-bearing download URL. Supports m4a and mp4 audio.
 */
export async function uploadChatAudio(
  fromUid: string,
  toUid: string,
  localUri: string,
): Promise<string> {
  const authMod = await import("@react-native-firebase/auth");
  const idToken = await authMod.default().currentUser?.getIdToken();
  if (!idToken) throw new Error("Not authenticated");

  const BUCKET = "metapp-b4642.firebasestorage.app";
  const chatId = getChatId(fromUid, toUid);
  const storagePath = `chats/${chatId}/audio_${Date.now()}.m4a`;
  const encodedPath = encodeURIComponent(storagePath);
  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o` +
    `?uploadType=media&name=${encodedPath}`;

  const fileResponse = await fetch(localUri);
  if (!fileResponse.ok) throw new Error(`Cannot read audio file (${fileResponse.status})`);
  const blob = await fileResponse.blob();

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "audio/m4a",
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text().catch(() => String(uploadResponse.status));
    throw new Error(`Audio upload failed (${uploadResponse.status}): ${errText}`);
  }

  const meta = (await uploadResponse.json()) as { downloadTokens?: string };
  const dlToken = meta.downloadTokens;
  if (!dlToken) throw new Error("No download token in audio upload response");

  return (
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodedPath}` +
    `?alt=media&token=${dlToken}`
  );
}

export interface SendMessageOpts {
  mediaUri?: string;
  audioUri?: string;
  audioDurationMs?: number;
  replyTo?: { id: string; from: string; text: string; mediaType?: "image" | "audio" };
}

/**
 * Send a message from `fromUid` to the chat shared with `toUid`.
 *
 * Pass media via opts.mediaUri (image) or opts.audioUri (voice clip).
 * Either text or one of the media fields (or both) must be present.
 *
 * Uses a WriteBatch so the message doc and the chat meta update are atomic.
 * Returns null on success, or an error string on failure.
 */
export async function sendMessage(
  fromUid: string,
  toUid: string,
  text: string,
  opts?: SendMessageOpts,
): Promise<string | null> {
  const fs = await getFirestoreModule();
  if (!fs) return "Firestore unavailable (native module not loaded)";
  const trimmed = text.trim();
  const mediaUri = opts?.mediaUri;
  const audioUri = opts?.audioUri;
  const audioDurationMs = opts?.audioDurationMs;
  const replyTo = opts?.replyTo;

  if (!trimmed && !mediaUri && !audioUri) return "Empty message";

  if (!fromUid || !toUid) {
    return `Invalid UIDs — fromUid="${fromUid}" toUid="${toUid}"`;
  }

  const chatId = getChatId(fromUid, toUid);
  const now = Date.now();
  const chatRef = fs.collection("chats").doc(chatId);
  const msgRef = chatRef.collection("messages").doc();

  const previewText = trimmed || (audioUri ? "🎤 Voice message" : "📷");

  try {
    const batch = fs.batch();

    const msgData: Record<string, unknown> = { from: fromUid, text: trimmed, sentAt: now };
    if (mediaUri) {
      msgData["mediaUri"] = mediaUri;
      msgData["mediaType"] = "image";
    }
    if (audioUri) {
      msgData["mediaUri"] = audioUri;
      msgData["mediaType"] = "audio";
      if (audioDurationMs) msgData["audioDurationMs"] = audioDurationMs;
    }
    if (replyTo) {
      msgData["replyTo"] = replyTo;
    }
    batch.set(msgRef, msgData);

    const lastMessage: Record<string, unknown> = { text: previewText, from: fromUid, sentAt: now };
    if (mediaUri) lastMessage["mediaType"] = "image";
    if (audioUri) lastMessage["mediaType"] = "audio";

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

    api
      .notifyChatMessage(
        { uid: fromUid },
        {
          recipientUid: toUid,
          text: trimmed || (audioUri ? "🎤 Voice message" : "📷 Photo"),
          chatPeerUid: fromUid,
        },
      )
      .catch(() => {});

    return null;
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "unknown";
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[chat] sendMessage batch failed", { code, fromUid, toUid, chatId });
    return `[${code}] ${msg}`;
  }
}

/**
 * Toggle a reaction emoji for `myUid` on a specific message.
 * If the user has already reacted with this emoji, remove it; otherwise add it.
 */
export async function toggleReaction(
  chatId: string,
  msgId: string,
  emoji: string,
  myUid: string,
): Promise<void> {
  const fs = await getFirestoreModule();
  if (!fs) return;

  const msgRef = fs.collection("chats").doc(chatId).collection("messages").doc(msgId);

  try {
    const snap = await msgRef.get();
    if (!snap.exists) return;
    const data = snap.data() as Record<string, unknown> | undefined;
    const reactions = (data?.["reactions"] ?? {}) as Record<string, string[]>;
    const current: string[] = reactions[emoji] ?? [];
    const alreadyReacted = current.includes(myUid);

    const fsMod = await import("@react-native-firebase/firestore");
    const FieldValue = fsMod.default.FieldValue;

    await msgRef.update({
      [`reactions.${emoji}`]: alreadyReacted
        ? FieldValue.arrayRemove(myUid)
        : FieldValue.arrayUnion(myUid),
    });
  } catch (err) {
    console.warn("[chat] toggleReaction failed", err);
  }
}

/**
 * Soft-delete a message (sets deleted: true).
 * Only the sender should call this (Firestore rules enforce ownership).
 */
export async function deleteMessage(
  chatId: string,
  msgId: string,
): Promise<void> {
  const fs = await getFirestoreModule();
  if (!fs) return;

  try {
    await fs
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .doc(msgId)
      .update({ deleted: true });
  } catch (err) {
    console.warn("[chat] deleteMessage failed", err);
    throw err;
  }
}

/**
 * Clear chat history for `myUid` by setting `clearedAt.[myUid]` to now.
 * Messages older than this timestamp are filtered out client-side.
 */
export async function clearChatHistory(
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
      .set({ clearedAt: { [myUid]: Date.now() } }, { merge: true });
  } catch (err) {
    console.warn("[chat] clearChatHistory failed", err);
    throw err;
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

  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const RETRY_DELAYS = [2000, 5000, 15000];
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
          retryCount = 0;
          const msgs: ChatMessage[] = [];
          snap.forEach((doc) => {
            const d = doc.data() as Record<string, unknown>;
            const mediaType = d["mediaType"] === "image"
              ? "image" as const
              : d["mediaType"] === "audio"
                ? "audio" as const
                : undefined;
            const msg: ChatMessage = {
              id: doc.id,
              from: typeof d["from"] === "string" ? d["from"] : "",
              text: typeof d["text"] === "string" ? d["text"] : "",
              sentAt: toEpochMs(d["sentAt"] as MaybeTimestamp),
            };
            if (typeof d["mediaUri"] === "string") {
              msg.mediaUri = d["mediaUri"];
              msg.mediaType = mediaType;
            }
            if (typeof d["audioDurationMs"] === "number") {
              msg.audioDurationMs = d["audioDurationMs"];
            }
            if (d["deleted"] === true) {
              msg.deleted = true;
            }
            if (d["replyTo"] && typeof d["replyTo"] === "object") {
              const rt = d["replyTo"] as Record<string, unknown>;
              const rtMediaType = rt["mediaType"] === "image"
                ? "image" as const
                : rt["mediaType"] === "audio"
                  ? "audio" as const
                  : undefined;
              msg.replyTo = {
                id: typeof rt["id"] === "string" ? rt["id"] : "",
                from: typeof rt["from"] === "string" ? rt["from"] : "",
                text: typeof rt["text"] === "string" ? rt["text"] : "",
                ...(rtMediaType ? { mediaType: rtMediaType } : {}),
              };
            }
            if (d["reactions"] && typeof d["reactions"] === "object") {
              const rawReactions = d["reactions"] as Record<string, unknown>;
              const reactions: Record<string, string[]> = {};
              for (const [emoji, uids] of Object.entries(rawReactions)) {
                if (Array.isArray(uids)) {
                  reactions[emoji] = uids.filter((u): u is string => typeof u === "string");
                }
              }
              if (Object.keys(reactions).length > 0) {
                msg.reactions = reactions;
              }
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
    // Doc doesn't exist yet — nothing to mark as read.
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

        const rawClearedAt = d["clearedAt"] as Record<string, unknown> | undefined;
        const clearedAt: Record<string, number> = {};
        if (rawClearedAt) {
          for (const [k, v] of Object.entries(rawClearedAt)) {
            clearedAt[k] = toEpochMs(v as MaybeTimestamp);
          }
        }

        const lmMediaType = lm?.["mediaType"] === "image"
          ? "image" as const
          : lm?.["mediaType"] === "audio"
            ? "audio" as const
            : undefined;

        listener({
          lastMessage: lm
            ? {
                text: typeof lm["text"] === "string" ? lm["text"] : "",
                from: typeof lm["from"] === "string" ? lm["from"] : "",
                sentAt: toEpochMs(lm["sentAt"] as MaybeTimestamp),
                ...(lmMediaType ? { mediaType: lmMediaType } : {}),
              }
            : null,
          lastReadAt,
          nextSenderUid,
          clearedAt,
        });
      },
      (err) => {
        console.warn("[chat] meta snapshot error", err);
        listener(null);
      },
    );

  return () => {
    cancelled = true;
    if (real) real();
  };
}
