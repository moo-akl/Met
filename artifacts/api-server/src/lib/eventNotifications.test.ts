import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";
import {
  communityEventHostRatingsTable,
  communityEventJoinRequestsTable,
  communityEventRsvpsTable,
  communityEventsTable,
  db,
  notificationInboxTable,
  profilesTable,
} from "@workspace/db";

const pushMock = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("./push", () => ({
  sendPushWithStatus: pushMock.send,
}));

import {
  notifyCommunityEventChange,
  notifyCommunityEventJoinDecision,
  notifyCommunityEventJoinRequest,
  notifyCommunityEventPlanMessage,
  runDueCommunityEventHostRatingPrompts,
} from "./eventNotifications";

const hasDatabase = Boolean(process.env["DATABASE_URL"]);
const prefix = `itest-hangout-rating-prompt-${process.pid}-${Date.now()}`;
const hostUid = `${prefix}-host`;
const acceptedUid = `${prefix}-accepted`;
const fallbackLocaleUid = `${prefix}-fallback-locale`;
const ratedUid = `${prefix}-rated`;
const mutedUid = `${prefix}-muted`;
const noTokenUid = `${prefix}-no-token`;
const pendingUid = `${prefix}-pending`;
const rsvpOnlyUid = `${prefix}-rsvp-only`;

const privateEventDetails = {
  title: `${prefix}-PRIVATE_HANGOUT_TITLE_DO_NOT_LEAK`,
  location: `${prefix}-PRIVATE_HANGOUT_LOCATION_DO_NOT_LEAK`,
  description: `${prefix}-PRIVATE_HANGOUT_DESCRIPTION_DO_NOT_LEAK`,
};

const profileFixtures = [
  {
    uid: hostUid,
    displayName: "Host",
    pushToken: `ExponentPushToken[${prefix}-host]`,
    preferredLocale: "fr",
  },
  {
    uid: acceptedUid,
    displayName: "Accepted guest",
    pushToken: `ExponentPushToken[${prefix}-accepted]`,
    preferredLocale: "es",
  },
  {
    uid: fallbackLocaleUid,
    displayName: "Unsupported locale guest",
    pushToken: `ExponentPushToken[${prefix}-fallback]`,
    preferredLocale: "xx",
  },
  { uid: ratedUid, displayName: "Already rated", pushToken: `ExponentPushToken[${prefix}-rated]` },
  {
    uid: mutedUid,
    displayName: "Muted guest",
    pushToken: `ExponentPushToken[${prefix}-muted]`,
    notificationPrefs: { notifyEventUpdates: false },
  },
  { uid: noTokenUid, displayName: "No push token" },
  { uid: pendingUid, displayName: "Pending guest", pushToken: `ExponentPushToken[${prefix}-pending]` },
  { uid: rsvpOnlyUid, displayName: "RSVP only", pushToken: `ExponentPushToken[${prefix}-rsvp]` },
];

const eventIds: number[] = [];

function expectNoPrivateEventDetails(payloads: unknown[]) {
  const serializedPayloads = payloads.map((payload) => JSON.stringify(payload));
  for (const privateDetail of Object.values(privateEventDetails)) {
    expect(
      serializedPayloads.every((payload) => !payload?.includes(privateDetail)),
    ).toBe(true);
  }
}

async function cleanup() {
  await db.delete(notificationInboxTable).where(inArray(
    notificationInboxTable.uid,
    profileFixtures.map(({ uid }) => uid),
  ));
  if (eventIds.length > 0) {
    await db.delete(communityEventHostRatingsTable).where(
      inArray(communityEventHostRatingsTable.eventId, eventIds),
    );
    await db.delete(communityEventJoinRequestsTable).where(
      inArray(communityEventJoinRequestsTable.eventId, eventIds),
    );
    await db.delete(communityEventRsvpsTable).where(
      inArray(communityEventRsvpsTable.eventId, eventIds),
    );
    await db.delete(communityEventsTable).where(
      inArray(communityEventsTable.id, eventIds),
    );
    eventIds.length = 0;
  }
  await db.delete(profilesTable).where(inArray(
    profilesTable.uid,
    profileFixtures.map(({ uid }) => uid),
  ));
}

describe.runIf(hasDatabase)("completed Hangout rating prompts", () => {
  beforeEach(async () => {
    await cleanup();
    pushMock.send.mockReset().mockResolvedValue({ sent: true });
    await db.insert(profilesTable).values(profileFixtures);

    const past = new Date(Date.now() - 60 * 60_000);
    const [completed] = await db
      .insert(communityEventsTable)
      .values({
        ownerUid: hostUid,
        ...privateEventDetails,
        startsAt: new Date(past.getTime() - 60 * 60_000),
        endsAt: past,
        visibility: "public",
        joinApprovalRequired: true,
      })
      .returning({ id: communityEventsTable.id });
    eventIds.push(completed!.id);

    const [upcoming] = await db
      .insert(communityEventsTable)
      .values({
        ownerUid: hostUid,
        title: `${prefix} upcoming Hangout`,
        startsAt: new Date(Date.now() + 60 * 60_000),
        endsAt: new Date(Date.now() + 2 * 60 * 60_000),
        visibility: "public",
        joinApprovalRequired: true,
      })
      .returning({ id: communityEventsTable.id });
    eventIds.push(upcoming!.id);

    await db.insert(communityEventJoinRequestsTable).values([
      { eventId: completed!.id, userUid: acceptedUid, status: "accepted" },
      { eventId: completed!.id, userUid: fallbackLocaleUid, status: "accepted" },
      { eventId: completed!.id, userUid: ratedUid, status: "accepted" },
      { eventId: completed!.id, userUid: mutedUid, status: "accepted" },
      { eventId: completed!.id, userUid: noTokenUid, status: "accepted" },
      { eventId: completed!.id, userUid: pendingUid, status: "pending" },
      { eventId: upcoming!.id, userUid: acceptedUid, status: "accepted" },
    ]);
    await db.insert(communityEventRsvpsTable).values({
      eventId: completed!.id,
      userUid: rsvpOnlyUid,
      status: "going",
    });
    await db.insert(communityEventHostRatingsTable).values({
      eventId: completed!.id,
      reviewerUid: ratedUid,
      rating: 5,
    });
  });

  afterAll(cleanup);

  it("prompts only unrated accepted guests and claims each ended Hangout once", async () => {
    await Promise.all([
      runDueCommunityEventHostRatingPrompts(),
      runDueCommunityEventHostRatingPrompts(),
    ]);
    await runDueCommunityEventHostRatingPrompts();

    expect(pushMock.send).toHaveBeenCalledTimes(2);
    expect(pushMock.send).toHaveBeenCalledWith(
      `ExponentPushToken[${prefix}-accepted]`,
      {
        title: "¿Qué tal estuvo la quedada?",
        body: "La quedada ha terminado. Valora al anfitrión en Met.",
        data: {
          type: "hangout_host_rating_prompt",
          eventType: "member",
          eventId: String(eventIds[0]),
        },
      },
    );
    expect(pushMock.send).toHaveBeenCalledWith(
      `ExponentPushToken[${prefix}-fallback]`,
      {
        title: "How was the Hangout?",
        body: "Your Hangout has ended. Rate the host in Met.",
        data: {
          type: "hangout_host_rating_prompt",
          eventType: "member",
          eventId: String(eventIds[0]),
        },
      },
    );
    expectNoPrivateEventDetails(
      pushMock.send.mock.calls.map(([, payload]) => payload),
    );

    const eventRows = await db
      .select({
        id: communityEventsTable.id,
        ratingPromptSentAt: communityEventsTable.ratingPromptSentAt,
      })
      .from(communityEventsTable)
      .where(inArray(communityEventsTable.id, eventIds));
    const completed = eventRows.find(({ id }) => id === eventIds[0]);
    const upcoming = eventRows.find(({ id }) => id === eventIds[1]);
    expect(eventRows).toHaveLength(2);
    expect(completed?.ratingPromptSentAt).toBeInstanceOf(Date);
    expect(upcoming?.ratingPromptSentAt).toBeNull();
  });

  it("keeps join requests and decisions in the inbox when push cannot deliver", async () => {
    pushMock.send.mockResolvedValue({ sent: false, reason: "device_not_registered" });

    await notifyCommunityEventJoinRequest({
      eventId: 901,
      hostUid: noTokenUid,
      requesterUid: acceptedUid,
    });
    await notifyCommunityEventJoinDecision({
      eventId: 901,
      requesterUid: noTokenUid,
      status: "accepted",
    });
    await notifyCommunityEventJoinDecision({
      eventId: 901,
      requesterUid: acceptedUid,
      status: "declined",
    });

    const inboxRows = await db
      .select({
        title: notificationInboxTable.title,
        body: notificationInboxTable.body,
        data: notificationInboxTable.data,
      })
      .from(notificationInboxTable)
      .where(inArray(notificationInboxTable.uid, [noTokenUid, acceptedUid]));
    expect(inboxRows).toHaveLength(3);
    expect(inboxRows.map((row) => row.data.type)).toEqual(expect.arrayContaining([
      "hangout_join_request",
      "hangout_join_decision",
    ]));
    expect(inboxRows.filter((row) => row.data.type === "hangout_join_decision")
      .map((row) => row.data.requestStatus))
      .toEqual(expect.arrayContaining(["accepted", "declined"]));
  });

  it("keeps join requests in the inbox when push delivery succeeds", async () => {
    const eventId = 909_091;
    pushMock.send.mockClear();
    pushMock.send.mockResolvedValue({ sent: true });

    await notifyCommunityEventJoinRequest({
      eventId,
      hostUid,
      requesterUid: acceptedUid,
    });

    const inboxRows = await db
      .select({ data: notificationInboxTable.data })
      .from(notificationInboxTable)
      .where(inArray(notificationInboxTable.uid, [hostUid]));
    expect(inboxRows.some((row) =>
      row.data.type === "hangout_join_request" &&
      row.data.eventId === String(eventId),
    )).toBe(true);
    expect(pushMock.send).toHaveBeenCalledWith(
      `ExponentPushToken[${prefix}-host]`,
      expect.objectContaining({
        data: expect.objectContaining({
          type: "hangout_join_request",
          eventId: String(eventId),
        }),
      }),
    );
  });

  it("localizes join, decision, update, and cancellation notifications per recipient", async () => {
    const eventId = eventIds[0]!;

    await notifyCommunityEventJoinRequest({
      eventId,
      hostUid,
      requesterUid: acceptedUid,
    });
    await notifyCommunityEventJoinDecision({
      eventId,
      requesterUid: acceptedUid,
      status: "accepted",
    });
    await notifyCommunityEventJoinDecision({
      eventId,
      requesterUid: acceptedUid,
      status: "declined",
    });
    await notifyCommunityEventChange({
      eventId,
      recipientUids: [acceptedUid],
      type: "hangout_updated",
    });
    await notifyCommunityEventChange({
      eventId,
      recipientUids: [fallbackLocaleUid],
      type: "hangout_cancelled",
    });

    expect(pushMock.send).toHaveBeenCalledTimes(5);
    expect(pushMock.send).toHaveBeenCalledWith(
      `ExponentPushToken[${prefix}-host]`,
      {
        title: "Nouvelle demande pour rejoindre une rencontre",
        body: "Accepted guest a demandé à rejoindre votre plan. Ouvrez Met pour examiner la demande.",
        data: {
          type: "hangout_join_request",
          eventId: String(eventId),
          eventType: "member",
        },
      },
    );
    expect(pushMock.send).toHaveBeenCalledWith(
      `ExponentPushToken[${prefix}-accepted]`,
      {
        title: "Se aceptó tu solicitud para unirte a la quedada",
        body: "Ya puedes unirte al chat de la quedada. Toca para abrirlo.",
        data: {
          type: "hangout_join_decision",
          eventId: String(eventId),
          eventType: "member",
          requestStatus: "accepted",
        },
      },
    );
    expect(pushMock.send).toHaveBeenCalledWith(
      `ExponentPushToken[${prefix}-accepted]`,
      {
        title: "Se rechazó tu solicitud para unirte a la quedada",
        body: "Abre Met para descubrir otras quedadas.",
        data: {
          type: "hangout_join_decision",
          eventId: String(eventId),
          eventType: "member",
          requestStatus: "declined",
        },
      },
    );
    expect(pushMock.send).toHaveBeenCalledWith(
      `ExponentPushToken[${prefix}-accepted]`,
      {
        title: "Plan de quedada actualizado",
        body: "Ha cambiado una quedada a la que te uniste. Abre Met para ver los detalles.",
        data: {
          type: "hangout_updated",
          eventId: String(eventId),
          eventType: "member",
        },
      },
    );
    expect(pushMock.send).toHaveBeenCalledWith(
      `ExponentPushToken[${prefix}-fallback]`,
      {
        title: "Hangout plan cancelled",
        body: "A hangout you joined was cancelled. Open Met to see your plans.",
        data: {
          type: "hangout_cancelled",
          eventId: String(eventId),
          eventType: "member",
        },
      },
    );
  });

  it("labels Hangout message notifications as Hangout Chat", async () => {
    const eventId = eventIds[0]!;
    await notifyCommunityEventPlanMessage({
      eventId,
      participantUids: [hostUid, acceptedUid],
      senderUid: hostUid,
      isHangout: true,
    });

    expect(pushMock.send).toHaveBeenCalledTimes(1);
    expect(pushMock.send).toHaveBeenCalledWith(
      `ExponentPushToken[${prefix}-accepted]`,
      {
        title: "New message in your Hangout Chat",
        body: "Open Met to view the conversation.",
        data: {
          type: "event_plan_message",
          eventId: String(eventId),
          eventType: "member",
        },
      },
    );
  });

  it("keeps private Hangout details out of every lock-screen notification", async () => {
    const eventId = eventIds[0]!;

    await db
      .update(communityEventsTable)
      .set({
        visibility: "invite_only",
      })
      .where(inArray(communityEventsTable.id, [eventId]));

    await notifyCommunityEventJoinRequest({
      eventId,
      hostUid,
      requesterUid: acceptedUid,
    });
    await notifyCommunityEventJoinDecision({
      eventId,
      requesterUid: acceptedUid,
      status: "accepted",
    });
    await notifyCommunityEventJoinDecision({
      eventId,
      requesterUid: acceptedUid,
      status: "declined",
    });
    await notifyCommunityEventChange({
      eventId,
      recipientUids: [acceptedUid],
      type: "hangout_updated",
    });
    await notifyCommunityEventChange({
      eventId,
      recipientUids: [fallbackLocaleUid],
      type: "hangout_cancelled",
    });

    const notificationPayloads = pushMock.send.mock.calls.map(
      ([, payload]) => payload,
    );
    expect(notificationPayloads).toHaveLength(5);

    const joinRequestPayload = notificationPayloads.find(
      (payload) => payload.data.type === "hangout_join_request",
    );
    expect(joinRequestPayload).toMatchObject({
      title: "Nouvelle demande pour rejoindre une rencontre",
      body: "Accepted guest a demandé à rejoindre votre plan. Ouvrez Met pour examiner la demande.",
    });
    expect(
      notificationPayloads
        .filter((payload) => payload.data.type !== "hangout_join_request")
        .every((payload) => !JSON.stringify(payload).includes("Accepted guest")),
    ).toBe(true);

    expectNoPrivateEventDetails(notificationPayloads);
  });
});
