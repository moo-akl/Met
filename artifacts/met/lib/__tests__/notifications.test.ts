/**
 * Tests for the notification tap routing and listener dedup logic.
 *
 * Covers:
 * - routeNotifTap: each notification type maps to the correct router.push path
 * - routeNotifTap: missing uid fields → returns false, push not called
 * - setupNotificationListeners: foreground tap fires onTap with correct data
 * - setupNotificationListeners: cold-start tap fires onTap with correct data
 * - setupNotificationListeners: dedup prevents double-fire for the same id
 * - setupNotificationListeners: shared tappedIds set is populated so the
 *   foreground banner listener can skip already-tapped notifications
 */

jest.mock("expo-notifications", () => ({
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
}));

jest.mock("../storage", () => ({
  loadPushToken: jest.fn().mockResolvedValue(null),
  savePushToken: jest.fn().mockResolvedValue(undefined),
}));

import * as Notifications from "expo-notifications";
import { NotifData, routeNotifTap, setupNotificationListeners } from "../notifications";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResponse(id: string, data: Record<string, unknown>) {
  return {
    notification: {
      request: {
        identifier: id,
        content: { data },
      },
    },
  };
}

/** Returns the listener callback that was passed to addNotificationResponseReceivedListener */
function capturedForegroundListener() {
  return (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock
    .calls[0][0] as (response: ReturnType<typeof makeResponse>) => void;
}

// ---------------------------------------------------------------------------
// routeNotifTap — routing logic
// ---------------------------------------------------------------------------

describe("routeNotifTap", () => {
  let push: jest.Mock;

  beforeEach(() => {
    push = jest.fn();
  });

  it("routes chat_message to /chat/<chatPeerUid>", () => {
    const data: NotifData = { type: "chat_message", chatPeerUid: "user-abc" };
    const result = routeNotifTap(data, { push });
    expect(result).toBe(true);
    expect(push).toHaveBeenCalledWith("/chat/user-abc");
  });

  it("routes reveal_accepted to /connection/<fromUid>", () => {
    const data: NotifData = { type: "reveal_accepted", fromUid: "user-xyz" };
    const result = routeNotifTap(data, { push });
    expect(result).toBe(true);
    expect(push).toHaveBeenCalledWith("/connection/user-xyz");
  });

  it("routes encounter to /encounter/<encounterId>", () => {
    const data: NotifData = { type: "encounter", encounterId: "enc-123" };
    const result = routeNotifTap(data, { push });
    expect(result).toBe(true);
    expect(push).toHaveBeenCalledWith("/encounter/enc-123");
  });

  it("routes reveal_request to /encounter/<fromUid> when encounterId absent", () => {
    const data: NotifData = { type: "reveal_request", fromUid: "user-req" };
    const result = routeNotifTap(data, { push });
    expect(result).toBe(true);
    expect(push).toHaveBeenCalledWith("/encounter/user-req");
  });

  it("routes unknown type to /encounter/<encounterId>", () => {
    const data: NotifData = { encounterId: "enc-999" };
    const result = routeNotifTap(data, { push });
    expect(result).toBe(true);
    expect(push).toHaveBeenCalledWith("/encounter/enc-999");
  });

  it("prefers encounterId over fromUid for encounter fallback", () => {
    const data: NotifData = { type: "encounter", encounterId: "enc-id", fromUid: "from-id" };
    routeNotifTap(data, { push });
    expect(push).toHaveBeenCalledWith("/encounter/enc-id");
  });

  it("returns false and does not push when chat_message has no chatPeerUid", () => {
    const data: NotifData = { type: "chat_message" };
    const result = routeNotifTap(data, { push });
    expect(result).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("returns false and does not push when reveal_accepted has no fromUid", () => {
    const data: NotifData = { type: "reveal_accepted" };
    const result = routeNotifTap(data, { push });
    expect(result).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("returns false and does not push when encounter payload has no uid fields", () => {
    const data: NotifData = { type: "encounter" };
    const result = routeNotifTap(data, { push });
    expect(result).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("returns false and does not push for empty payload", () => {
    const result = routeNotifTap({}, { push });
    expect(result).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setupNotificationListeners — listener wiring and dedup
// ---------------------------------------------------------------------------

describe("setupNotificationListeners", () => {
  let removeMock: jest.Mock;

  beforeEach(() => {
    removeMock = jest.fn();
    (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({
      remove: removeMock,
    });
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Foreground tap
  // -------------------------------------------------------------------------

  it("foreground tap — calls onTap with chat_message data", () => {
    const onTap = jest.fn();
    setupNotificationListeners(onTap);

    const listener = capturedForegroundListener();
    listener(makeResponse("notif-1", { type: "chat_message", chatPeerUid: "peer-1" }));

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat_message", chatPeerUid: "peer-1" }),
    );
  });

  it("foreground tap — calls onTap with reveal_accepted data", () => {
    const onTap = jest.fn();
    setupNotificationListeners(onTap);

    capturedForegroundListener()(
      makeResponse("notif-2", { type: "reveal_accepted", fromUid: "user-a" }),
    );

    expect(onTap).toHaveBeenCalledWith(
      expect.objectContaining({ type: "reveal_accepted", fromUid: "user-a" }),
    );
  });

  it("foreground tap — calls onTap with encounter data", () => {
    const onTap = jest.fn();
    setupNotificationListeners(onTap);

    capturedForegroundListener()(
      makeResponse("notif-3", { type: "encounter", encounterId: "enc-42" }),
    );

    expect(onTap).toHaveBeenCalledWith(
      expect.objectContaining({ type: "encounter", encounterId: "enc-42" }),
    );
  });

  // -------------------------------------------------------------------------
  // Cold-start tap
  // -------------------------------------------------------------------------

  it("cold-start tap — calls onTap with chat_message data", async () => {
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(
      makeResponse("cold-1", { type: "chat_message", chatPeerUid: "peer-cold" }),
    );

    const onTap = jest.fn();
    setupNotificationListeners(onTap);

    await Promise.resolve(); // flush the getLastNotificationResponseAsync promise

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat_message", chatPeerUid: "peer-cold" }),
    );
  });

  it("cold-start tap — calls onTap with reveal_accepted data", async () => {
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(
      makeResponse("cold-2", { type: "reveal_accepted", fromUid: "user-cold" }),
    );

    const onTap = jest.fn();
    setupNotificationListeners(onTap);

    await Promise.resolve();

    expect(onTap).toHaveBeenCalledWith(
      expect.objectContaining({ type: "reveal_accepted", fromUid: "user-cold" }),
    );
  });

  it("cold-start tap — calls onTap with encounter data", async () => {
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(
      makeResponse("cold-3", { type: "encounter", encounterId: "enc-cold" }),
    );

    const onTap = jest.fn();
    setupNotificationListeners(onTap);

    await Promise.resolve();

    expect(onTap).toHaveBeenCalledWith(
      expect.objectContaining({ type: "encounter", encounterId: "enc-cold" }),
    );
  });

  it("cold-start tap — does nothing when getLastNotificationResponseAsync resolves null", async () => {
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(null);

    const onTap = jest.fn();
    setupNotificationListeners(onTap);

    await Promise.resolve();

    expect(onTap).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Dedup: same notification ID should only fire onTap once
  // -------------------------------------------------------------------------

  it("dedup — cold-start and foreground listener do not both fire for the same id", async () => {
    const sharedId = "dedup-notif-1";
    const data = { type: "chat_message", chatPeerUid: "dup-peer" };

    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(
      makeResponse(sharedId, data),
    );

    const onTap = jest.fn();
    setupNotificationListeners(onTap);

    // Cold-start fires first
    await Promise.resolve();
    expect(onTap).toHaveBeenCalledTimes(1);

    // Foreground listener fires for the same notification id
    capturedForegroundListener()(makeResponse(sharedId, data));

    // onTap must NOT be called a second time
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("dedup — foreground listener fires first, cold-start does not double-fire", async () => {
    const sharedId = "dedup-notif-2";
    const data = { type: "reveal_accepted", fromUid: "dup-user" };

    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(
      makeResponse(sharedId, data),
    );

    const onTap = jest.fn();
    setupNotificationListeners(onTap);

    // Foreground listener fires first (before the promise resolves)
    capturedForegroundListener()(makeResponse(sharedId, data));
    expect(onTap).toHaveBeenCalledTimes(1);

    // Cold-start promise resolves — same id should be skipped
    await Promise.resolve();
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("dedup — different notification ids each fire onTap independently", async () => {
    const onTap = jest.fn();
    setupNotificationListeners(onTap);

    capturedForegroundListener()(
      makeResponse("id-A", { type: "chat_message", chatPeerUid: "peer-a" }),
    );
    capturedForegroundListener()(
      makeResponse("id-B", { type: "chat_message", chatPeerUid: "peer-b" }),
    );

    expect(onTap).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Shared tappedIds set — banner suppression
  // -------------------------------------------------------------------------

  it("adds the notification id to the shared tappedIds set on foreground tap", () => {
    const tappedIds = new Set<string>();
    const onTap = jest.fn();
    setupNotificationListeners(onTap, tappedIds);

    capturedForegroundListener()(
      makeResponse("tap-id-1", { type: "chat_message", chatPeerUid: "peer-x" }),
    );

    expect(tappedIds.has("tap-id-1")).toBe(true);
  });

  it("adds the notification id to the shared tappedIds set on cold-start tap", async () => {
    const tappedIds = new Set<string>();
    (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValue(
      makeResponse("cold-tap-id", { type: "encounter", encounterId: "enc-x" }),
    );

    const onTap = jest.fn();
    setupNotificationListeners(onTap, tappedIds);

    await Promise.resolve();

    expect(tappedIds.has("cold-tap-id")).toBe(true);
  });

  it("shared tappedIds prevents banner listener seeing an already-tapped id", () => {
    const tappedIds = new Set<string>();
    const onTap = jest.fn();
    setupNotificationListeners(onTap, tappedIds);

    // Simulate tap listener firing and marking the id
    capturedForegroundListener()(
      makeResponse("tap-id-banner", { type: "chat_message", chatPeerUid: "peer-y" }),
    );

    // The banner listener would check tappedIds before showing
    expect(tappedIds.has("tap-id-banner")).toBe(true);
    // onTap was called once (routing), but the banner should be suppressed by the set
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  it("returns an unsubscribe function that removes the tap listener", () => {
    const onTap = jest.fn();
    const unsubscribe = setupNotificationListeners(onTap);

    unsubscribe();

    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
