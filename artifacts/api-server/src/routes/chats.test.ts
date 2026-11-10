import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };
  const sendPushWithStatus = vi.fn();
  return { chain, sendPushWithStatus };
});

vi.mock("@workspace/db", () => ({
  db: mocks.chain,
  profilesTable: {
    uid: "profiles.uid",
    displayName: "profiles.displayName",
    pushToken: "profiles.pushToken",
    notificationPrefs: "profiles.notificationPrefs",
  },
  revealRequestsTable: {
    status: "revealRequests.status",
    senderUid: "revealRequests.senderUid",
    recipientUid: "revealRequests.recipientUid",
    messageCount: "revealRequests.messageCount",
    updatedAt: "revealRequests.updatedAt",
  },
}));

vi.mock("../middlewares/requireUid", () => ({
  requireUid: (
    req: { uid?: string },
    _res: unknown,
    next: () => void,
  ) => {
    req.uid = "sender-uid";
    next();
  },
}));

vi.mock("../lib/push", () => ({
  sendPushWithStatus: mocks.sendPushWithStatus,
}));

import request from "supertest";
import app from "../app";

const senderRow = { displayName: "Sender" };
const enabledRecipientRow = {
  pushToken: "recipient-token",
  notificationPrefs: { notifyChat: true },
};

beforeAll(() => {
  delete process.env["REDIS_URL"];
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.chain.select.mockReturnThis();
  mocks.chain.from.mockReturnThis();
  mocks.chain.where.mockReturnThis();
  mocks.chain.limit
    .mockResolvedValueOnce([senderRow])
    .mockResolvedValueOnce([enabledRecipientRow]);
  mocks.sendPushWithStatus.mockResolvedValue({ sent: true });
});

describe("POST /api/chats/notify", () => {
  it("sends the push when chat notifications are enabled", async () => {
    const res = await request(app)
      .post("/api/chats/notify")
      .send({
        recipientUid: "recipient-uid",
        chatPeerUid: "sender-uid",
        text: "Hello",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: true });
    expect(mocks.sendPushWithStatus).toHaveBeenCalledWith(
      "recipient-token",
      expect.objectContaining({
        data: { type: "chat_message", chatPeerUid: "sender-uid" },
      }),
    );
  });

  it("does not send when the recipient opted out of chat notifications", async () => {
    mocks.chain.limit
      .mockReset()
      .mockResolvedValueOnce([senderRow])
      .mockResolvedValueOnce([{
        pushToken: "recipient-token",
        notificationPrefs: { notifyChat: false },
      }]);

    const res = await request(app)
      .post("/api/chats/notify")
      .send({
        recipientUid: "recipient-uid",
        chatPeerUid: "sender-uid",
        text: "Hello",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sent: false, reason: "preference_disabled" });
    expect(mocks.sendPushWithStatus).not.toHaveBeenCalled();
  });
});
