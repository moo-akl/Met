import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable } from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";

const router = Router();

/**
 * POST /api/chats/notify
 *
 * Send an FCM push notification to the recipient of a chat message.
 * Called by the client immediately after a successful Firestore batch
 * commit so notification delivery does NOT depend on Cloud Functions.
 *
 * Reads the recipient's push token from Postgres (guaranteed to be
 * present once the push-token endpoint returns 200). Sends via the
 * Firebase Admin Messaging SDK. Always returns 200 — the notification
 * is best-effort and must never block the chat UX.
 */
router.post("/chats/notify", requireUid, async (req, res) => {
  const callerUid = req.uid!;

  const recipientUid =
    typeof req.body?.recipientUid === "string"
      ? req.body.recipientUid.trim()
      : null;
  const text =
    typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const chatPeerUid =
    typeof req.body?.chatPeerUid === "string"
      ? req.body.chatPeerUid.trim()
      : callerUid;

  if (!recipientUid) {
    res.status(400).json({ message: "recipientUid required" });
    return;
  }

  if (recipientUid === callerUid) {
    res.json({ sent: false, reason: "self" });
    return;
  }

  try {
    const [callerRow, recipientRow] = await Promise.all([
      db
        .select({ displayName: profilesTable.displayName })
        .from(profilesTable)
        .where(eq(profilesTable.uid, callerUid))
        .limit(1),
      db
        .select({ pushToken: profilesTable.pushToken })
        .from(profilesTable)
        .where(eq(profilesTable.uid, recipientUid))
        .limit(1),
    ]);

    const pushToken = recipientRow[0]?.pushToken ?? null;
    if (!pushToken) {
      req.log.info({ recipientUid }, "chats/notify: no push token, skipping");
      res.json({ sent: false, reason: "no_token" });
      return;
    }

    const senderName = callerRow[0]?.displayName ?? "Someone";
    const body = text.length > 0 ? text.slice(0, 200) : "📷 Photo";

    const { adminMessaging } = await import("../lib/firebaseAdmin");
    await adminMessaging().send({
      token: pushToken,
      notification: {
        title: senderName,
        body,
      },
      android: {
        priority: "high",
        notification: {
          channelId: "default",
          sound: "default",
          priority: "high",
        },
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            "content-available": 1,
          },
        },
      },
      data: {
        type: "chat_message",
        chatPeerUid,
      },
    });

    req.log.info({ recipientUid }, "chats/notify: FCM sent");
    res.json({ sent: true });
  } catch (err) {
    req.log.warn({ err, recipientUid }, "chats/notify: FCM send failed");
    res.json({ sent: false, reason: "fcm_error" });
  }
});

export default router;
