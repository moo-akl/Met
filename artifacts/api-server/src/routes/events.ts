import { Router } from "express";
import {
  and,
  asc,
  arrayContains,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  ne,
  or,
} from "drizzle-orm";
import {
  communityEventRsvpsTable,
  communityEventPlanMessagesTable,
  communityEventPlanNotificationPreferencesTable,
  communityEventsTable,
  db,
  eventAttendanceTable,
  profilesTable,
  venueEventRsvpsTable,
  venueEventsTable,
  venueOwnerProfilesTable,
} from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import {
  createIpRateLimiter,
  createUserRateLimiter,
} from "../middlewares/rateLimit";
import {
  CreateCommunityEventInviteLinkResponse,
  CreateCommunityEventBody,
  CreateCommunityEventResponse,
  GetCommunityEventPlanChatResponse,
  SetCommunityEventPlanChatNotificationsBody,
  SetCommunityEventPlanChatNotificationsResponse,
  SendCommunityEventPlanChatMessageBody,
  SendCommunityEventPlanChatMessageResponse,
  CheckInEventByLocationBody,
  CheckInEventByLocationParams,
  CheckInEventByLocationResponse,
  CheckInEventByQrBody,
  CheckInEventByQrResponse,
  GetEventAttendeesParams,
  GetEventAttendeesResponse,
  GetEventCheckinQrBody,
  GetEventCheckinQrParams,
  GetEventCheckinQrResponse,
  GetCommunityEventForEditResponse,
  GetEventDetailsResponse,
  ResolveEventInviteBody,
  ResolveEventInviteResponse,
  RsvpToEventInviteBody,
  SearchEventLocationsQueryParams,
  SearchEventLocationsResponse,
  UpdateCommunityEventBody,
  UpdateCommunityEventResponse,
} from "@workspace/api-zod";
import { searchPhotonLocations } from "../lib/eventLocationSearch";
import {
  buildEventInviteUrl,
  createEventInviteLinkFields,
  createEventInvitePasscodeFields,
  decryptEventInviteToken,
  hashEventInviteToken,
  isValidEventInviteToken,
  verifyEventInvitePasscode,
} from "../lib/eventInviteLinks";
import {
  buildEventCheckinUrl,
  createEventCheckinLinkFields,
  decryptEventCheckinToken,
  hashEventCheckinToken,
  isValidEventCheckinToken,
} from "../lib/eventCheckinLinks";
import { notifyCommunityEventPlanMessage } from "../lib/eventNotifications";
import { verifyAppCheckToken } from "../lib/firebaseAdmin";
import { z } from "zod";

const router = Router();
const eventWriteLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 12,
  name: "event-write",
});
const eventLocationSearchLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 30,
  name: "event-location-search",
});
const eventInviteResolveLimit = createIpRateLimiter({
  windowMs: 60_000,
  max: 20,
  name: "event-invite-resolve",
});
const eventCheckinLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 8,
  name: "event-checkin",
});
const eventPlanMessageLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 30,
  name: "community-event-plan-message",
});

const rsvpStatusSchema = z.enum(["going", "maybe", "not_going"]);

function getEventId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) return null;
  const eventId = Number(value);
  return Number.isSafeInteger(eventId) && eventId > 0 ? eventId : null;
}

type EventKind = "venue" | "member";

async function getCommunityEventPlanChatContext(eventId: number, uid: string) {
  const [event] = await db
    .select()
    .from(communityEventsTable)
    .where(
      and(
        eq(communityEventsTable.id, eventId),
        eq(communityEventsTable.isHidden, false),
      ),
    )
    .limit(1);
  if (!event) return null;

  const rsvps = await db
    .select({
      userUid: communityEventRsvpsTable.userUid,
      status: communityEventRsvpsTable.status,
    })
    .from(communityEventRsvpsTable)
    .where(eq(communityEventRsvpsTable.eventId, eventId));
  const canAccess =
    event.ownerUid === uid ||
    event.inviteeUids.includes(uid) ||
    rsvps.some(
      (rsvp) =>
        rsvp.userUid === uid &&
        (rsvp.status === "going" || rsvp.status === "maybe"),
    );
  return canAccess ? { event, rsvps } : null;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function eventCheckinOpen(startsAt: Date, endsAt: Date | null): boolean {
  const now = Date.now();
  const opensAt = startsAt.getTime() - 60 * 60_000;
  const closesAt = (endsAt?.getTime() ?? startsAt.getTime() + 4 * 60 * 60_000) + 2 * 60 * 60_000;
  return now >= opensAt && now <= closesAt;
}

async function insertEventAttendance(
  eventType: EventKind,
  eventId: number,
  userUid: string,
  checkInMethod: "qr" | "location",
) {
  const [inserted] = await db
    .insert(eventAttendanceTable)
    .values({ eventType, eventId, userUid, checkInMethod })
    .onConflictDoNothing({
      target: [
        eventAttendanceTable.eventType,
        eventAttendanceTable.eventId,
        eventAttendanceTable.userUid,
      ],
    })
    .returning({ checkedInAt: eventAttendanceTable.checkedInAt });
  if (inserted) return { alreadyCheckedIn: false, checkedInAt: inserted.checkedInAt };
  const [existing] = await db
    .select({ checkedInAt: eventAttendanceTable.checkedInAt })
    .from(eventAttendanceTable)
    .where(and(
      eq(eventAttendanceTable.eventType, eventType),
      eq(eventAttendanceTable.eventId, eventId),
      eq(eventAttendanceTable.userUid, userUid),
    ))
    .limit(1);
  return {
    alreadyCheckedIn: true,
    checkedInAt: existing?.checkedInAt ?? new Date(),
  };
}

function validateEventTimes(
  startsAtValue: string | Date,
  endsAtValue?: string | Date | null,
) {
  const startsAt =
    startsAtValue instanceof Date
      ? new Date(startsAtValue.getTime())
      : new Date(startsAtValue);
  const endsAt = endsAtValue
    ? endsAtValue instanceof Date
      ? new Date(endsAtValue.getTime())
      : new Date(endsAtValue)
    : null;
  if (startsAt <= new Date()) {
    return { error: "Event start time must be in the future." } as const;
  }
  if (endsAt && endsAt <= startsAt) {
    return { error: "Event end time must be after its start time." } as const;
  }
  return { startsAt, endsAt } as const;
}

function normalizeInvitees(inviteeUids: string[] | undefined, uid: string) {
  return [...new Set(inviteeUids ?? [])].filter((inviteeUid) => inviteeUid !== uid);
}

router.get("/events/feed", requireUid, async (req, res) => {
  const uid = req.uid!;
  const now = new Date();
  const [venueRows, memberRows] = await Promise.all([
    db
      .select({
        event: venueEventsTable,
        venueName: venueOwnerProfilesTable.businessName,
        latitude: venueOwnerProfilesTable.lat,
        longitude: venueOwnerProfilesTable.lng,
      })
      .from(venueEventsTable)
      .innerJoin(
        venueOwnerProfilesTable,
        eq(venueOwnerProfilesTable.placeId, venueEventsTable.placeId),
      )
      .where(
        and(
          eq(venueOwnerProfilesTable.isApproved, true),
          eq(venueOwnerProfilesTable.applicationStatus, "approved"),
          eq(venueEventsTable.isPublished, true),
          eq(venueEventsTable.isHidden, false),
          gte(venueEventsTable.startsAt, now),
          or(
            eq(venueEventsTable.visibility, "public"),
            eq(venueEventsTable.ownerUid, uid),
            arrayContains(venueEventsTable.inviteeUids, [uid]),
            exists(
              db
                .select({ id: venueEventRsvpsTable.id })
                .from(venueEventRsvpsTable)
                .where(
                  and(
                    eq(venueEventRsvpsTable.eventId, venueEventsTable.id),
                    eq(venueEventRsvpsTable.userUid, uid),
                  ),
                ),
            ),
          ),
        ),
      )
      .orderBy(venueEventsTable.startsAt)
      .limit(100),
    db
      .select({
        event: communityEventsTable,
        creatorName: profilesTable.displayName,
      })
      .from(communityEventsTable)
      .leftJoin(profilesTable, eq(profilesTable.uid, communityEventsTable.ownerUid))
      .where(
        and(
          eq(communityEventsTable.isHidden, false),
          gte(communityEventsTable.startsAt, now),
          or(
            eq(communityEventsTable.visibility, "public"),
            eq(communityEventsTable.ownerUid, uid),
            arrayContains(communityEventsTable.inviteeUids, [uid]),
            exists(
              db
                .select({ id: communityEventRsvpsTable.id })
                .from(communityEventRsvpsTable)
                .where(
                  and(
                    eq(communityEventRsvpsTable.eventId, communityEventsTable.id),
                    eq(communityEventRsvpsTable.userUid, uid),
                  ),
                ),
            ),
          ),
        ),
      )
      .orderBy(communityEventsTable.startsAt)
      .limit(100),
  ]);

  const venueIds = venueRows.map(({ event }) => event.id);
  const memberIds = memberRows.map(({ event }) => event.id);
  const [venueRsvps, memberRsvps] = await Promise.all([
    venueIds.length
      ? db
          .select({ eventId: venueEventRsvpsTable.eventId, status: venueEventRsvpsTable.status })
          .from(venueEventRsvpsTable)
          .where(and(inArray(venueEventRsvpsTable.eventId, venueIds), eq(venueEventRsvpsTable.userUid, uid)))
      : Promise.resolve([]),
    memberIds.length
      ? db
          .select({ eventId: communityEventRsvpsTable.eventId, userUid: communityEventRsvpsTable.userUid, status: communityEventRsvpsTable.status })
          .from(communityEventRsvpsTable)
          .where(inArray(communityEventRsvpsTable.eventId, memberIds))
      : Promise.resolve([]),
  ]);

  const myVenueRsvp = new Map(venueRsvps.map((rsvp) => [rsvp.eventId, rsvp.status]));
  const memberRsvpCounts = new Map<number, number>();
  const myMemberRsvp = new Map<number, string>();
  for (const rsvp of memberRsvps) {
    if (rsvp.status !== "not_going") {
      memberRsvpCounts.set(rsvp.eventId, (memberRsvpCounts.get(rsvp.eventId) ?? 0) + 1);
    }
    if (rsvp.userUid === uid) myMemberRsvp.set(rsvp.eventId, rsvp.status);
  }

  const events = [
    ...venueRows.map(({ event, venueName, latitude, longitude }) => ({
      eventType: "venue" as const,
      id: event.id,
      ownerUid: event.ownerUid,
      title: event.title,
      description: event.description,
      imageUrl: event.imageUrl,
      contactPhone: event.contactPhone,
      websiteUrl: event.websiteUrl,
      publicEmail: event.publicEmail,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: venueName,
      locationPlaceId: null,
      placeId: event.placeId,
      venueName,
      creatorName: null,
      latitude: latitude != null && Number.isFinite(Number(latitude)) ? Number(latitude) : null,
      longitude: longitude != null && Number.isFinite(Number(longitude)) ? Number(longitude) : null,
      visibility: event.visibility,
      rsvpCount: event.rsvpCount,
      myRsvp: myVenueRsvp.get(event.id) ?? null,
    })),
    ...memberRows.map(({ event, creatorName }) => ({
      eventType: "member" as const,
      id: event.id,
      ownerUid: event.ownerUid,
      title: event.title,
      description: event.description,
      imageUrl: event.imageUrl,
      contactPhone: event.contactPhone,
      websiteUrl: event.websiteUrl,
      publicEmail: event.publicEmail,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: event.location,
      locationPlaceId: event.locationPlaceId,
      placeId: null,
      venueName: null,
      creatorName,
      latitude: event.locationLatitude,
      longitude: event.locationLongitude,
      visibility: event.visibility,
      rsvpCount: memberRsvpCounts.get(event.id) ?? 0,
      myRsvp: myMemberRsvp.get(event.id) ?? null,
    })),
  ].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  res.json({ events });
});

router.post("/events", requireUid, eventWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const parsed = CreateCommunityEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid event details", errors: parsed.error.issues });
    return;
  }
  const times = validateEventTimes(parsed.data.startsAt, parsed.data.endsAt);
  if ("error" in times) {
    res.status(400).json({ message: times.error });
    return;
  }
  const hasLatitude = parsed.data.latitude != null;
  const hasLongitude = parsed.data.longitude != null;
  const hasPlaceId = Boolean(parsed.data.locationPlaceId);
  if (hasLatitude !== hasLongitude || hasLatitude !== hasPlaceId) {
    res.status(400).json({ message: "Choose a valid place result for this location." });
    return;
  }
  const inviteeUids = normalizeInvitees(parsed.data.inviteeUids, uid);
  const inviteLinkEnabled =
    parsed.data.visibility === "invite_only" &&
    parsed.data.inviteLinkEnabled === true;
  const invitePasscode = parsed.data.invitePasscode?.trim() || null;
  if (invitePasscode && !inviteLinkEnabled) {
    res.status(400).json({ message: "Enable the invite link before adding a passcode." });
    return;
  }
  if (
    parsed.data.visibility === "invite_only" &&
    inviteeUids.length === 0 &&
    !inviteLinkEnabled
  ) {
    res.status(400).json({
      message: "Select a connection or enable a shareable invite link.",
    });
    return;
  }
  let inviteLinkFields: {
    inviteTokenHash: string | null;
    inviteTokenEncrypted: string | null;
    invitePasscodeSalt: string | null;
    invitePasscodeHash: string | null;
  } = {
    inviteTokenHash: null,
    inviteTokenEncrypted: null,
    invitePasscodeSalt: null,
    invitePasscodeHash: null,
  };
  if (inviteLinkEnabled) {
    try {
      inviteLinkFields = createEventInviteLinkFields(invitePasscode);
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : "Invalid invite passcode.",
      });
      return;
    }
  }

  const [event] = await db
    .insert(communityEventsTable)
    .values({
      ownerUid: uid,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      contactPhone: parsed.data.contactPhone?.trim() || null,
      websiteUrl: parsed.data.websiteUrl?.trim() || null,
      publicEmail: parsed.data.publicEmail?.trim() || null,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      location: parsed.data.location?.trim() || null,
      locationPlaceId: parsed.data.locationPlaceId ?? null,
      locationLatitude: parsed.data.latitude ?? null,
      locationLongitude: parsed.data.longitude ?? null,
      visibility: parsed.data.visibility,
      inviteeUids: parsed.data.visibility === "invite_only" ? inviteeUids : [],
      ...inviteLinkFields,
    })
    .returning();
  const [profile] = await db
    .select({ displayName: profilesTable.displayName })
    .from(profilesTable)
    .where(eq(profilesTable.uid, uid))
    .limit(1);

  const response = CreateCommunityEventResponse.parse({
    eventType: "member",
    id: event.id,
    ownerUid: event.ownerUid,
    title: event.title,
    description: event.description,
    imageUrl: event.imageUrl,
    contactPhone: event.contactPhone,
    websiteUrl: event.websiteUrl,
    publicEmail: event.publicEmail,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: event.location,
    locationPlaceId: event.locationPlaceId,
    placeId: null,
    venueName: null,
    creatorName: profile?.displayName ?? null,
    latitude: event.locationLatitude,
    longitude: event.locationLongitude,
    visibility: event.visibility,
    rsvpCount: 0,
    myRsvp: null,
  });
  res.status(201).json(response);
});

router.get(
  "/event-locations/search",
  requireUid,
  eventLocationSearchLimit,
  async (req, res): Promise<void> => {
    const parsed = SearchEventLocationsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ message: "Enter at least three characters to search for a place." });
      return;
    }

    try {
      const locations = await searchPhotonLocations(parsed.data.q);
      res.json(SearchEventLocationsResponse.parse({ locations }));
    } catch (error) {
      req.log?.warn({ error }, "Event place search provider unavailable");
      res.status(503).json({ message: "Place search is temporarily unavailable." });
    }
  },
);

router.get("/events/:eventType/:eventId", requireUid, async (req, res): Promise<void> => {
  const uid = req.uid!;
  const eventType = req.params.eventType;
  const eventId = getEventId(req.params.eventId);
  if ((eventType !== "venue" && eventType !== "member") || !eventId) {
    res.status(400).json({ message: "Invalid event." });
    return;
  }

  if (eventType === "member") {
    const [row] = await db
      .select({
        event: communityEventsTable,
        creatorName: profilesTable.displayName,
      })
      .from(communityEventsTable)
      .leftJoin(profilesTable, eq(profilesTable.uid, communityEventsTable.ownerUid))
      .where(
        and(
          eq(communityEventsTable.id, eventId),
          eq(communityEventsTable.isHidden, false),
          or(
            eq(communityEventsTable.visibility, "public"),
            eq(communityEventsTable.ownerUid, uid),
            arrayContains(communityEventsTable.inviteeUids, [uid]),
            exists(
              db
                .select({ id: communityEventRsvpsTable.id })
                .from(communityEventRsvpsTable)
                .where(
                  and(
                    eq(communityEventRsvpsTable.eventId, communityEventsTable.id),
                    eq(communityEventRsvpsTable.userUid, uid),
                  ),
                ),
            ),
          ),
        ),
      )
      .limit(1);
    const event = row?.event;
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    const [rsvps, myRsvp] = await Promise.all([
      db
        .select({ status: communityEventRsvpsTable.status })
        .from(communityEventRsvpsTable)
        .where(and(eq(communityEventRsvpsTable.eventId, event.id), ne(communityEventRsvpsTable.status, "not_going"))),
      db
        .select({ status: communityEventRsvpsTable.status })
        .from(communityEventRsvpsTable)
        .where(
          and(
            eq(communityEventRsvpsTable.eventId, event.id),
            eq(communityEventRsvpsTable.userUid, uid),
          ),
        )
        .limit(1),
    ]);
    res.json(
      GetEventDetailsResponse.parse({
        eventType: "member",
        id: event.id,
        ownerUid: event.ownerUid,
        title: event.title,
        description: event.description,
        imageUrl: event.imageUrl,
        contactPhone: event.contactPhone,
        websiteUrl: event.websiteUrl,
        publicEmail: event.publicEmail,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        locationPlaceId: event.locationPlaceId,
        placeId: null,
        venueName: null,
        creatorName: row.creatorName,
        latitude: event.locationLatitude,
        longitude: event.locationLongitude,
        visibility: event.visibility,
        rsvpCount: rsvps.length,
        myRsvp: myRsvp[0]?.status ?? null,
      }),
    );
    return;
  }

  const [row] = await db
    .select({
      event: venueEventsTable,
      venueName: venueOwnerProfilesTable.businessName,
      latitude: venueOwnerProfilesTable.lat,
      longitude: venueOwnerProfilesTable.lng,
    })
    .from(venueEventsTable)
    .innerJoin(
      venueOwnerProfilesTable,
      eq(venueOwnerProfilesTable.placeId, venueEventsTable.placeId),
    )
    .where(
      and(
        eq(venueEventsTable.id, eventId),
        eq(venueEventsTable.isPublished, true),
        eq(venueEventsTable.isHidden, false),
        eq(venueOwnerProfilesTable.isApproved, true),
        eq(venueOwnerProfilesTable.applicationStatus, "approved"),
        or(
          eq(venueEventsTable.visibility, "public"),
          eq(venueEventsTable.ownerUid, uid),
          arrayContains(venueEventsTable.inviteeUids, [uid]),
          exists(
            db
              .select({ id: venueEventRsvpsTable.id })
              .from(venueEventRsvpsTable)
              .where(
                and(
                  eq(venueEventRsvpsTable.eventId, venueEventsTable.id),
                  eq(venueEventRsvpsTable.userUid, uid),
                ),
              ),
          ),
        ),
      ),
    )
    .limit(1);
  if (!row) {
    res.status(404).json({ message: "Event not found" });
    return;
  }
  const [myRsvp] = await db
    .select({ status: venueEventRsvpsTable.status })
    .from(venueEventRsvpsTable)
    .where(
      and(
        eq(venueEventRsvpsTable.eventId, row.event.id),
        eq(venueEventRsvpsTable.userUid, uid),
      ),
    )
    .limit(1);
  res.json(
    GetEventDetailsResponse.parse({
      eventType: "venue",
      id: row.event.id,
      ownerUid: row.event.ownerUid,
      title: row.event.title,
      description: row.event.description,
      imageUrl: row.event.imageUrl,
      contactPhone: row.event.contactPhone,
      websiteUrl: row.event.websiteUrl,
      publicEmail: row.event.publicEmail,
      startsAt: row.event.startsAt,
      endsAt: row.event.endsAt,
      location: row.venueName,
      locationPlaceId: null,
      placeId: row.event.placeId,
      venueName: row.venueName,
      creatorName: null,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      visibility: row.event.visibility,
      rsvpCount: row.event.rsvpCount,
      myRsvp: myRsvp?.status ?? null,
    }),
  );
});

router.post(
  "/event-invites/resolve",
  eventInviteResolveLimit,
  async (req, res): Promise<void> => {
    const parsed = ResolveEventInviteBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid invitation link." });
      return;
    }
    if (!isValidEventInviteToken(parsed.data.token)) {
      res.status(404).json({ message: "Invitation not found." });
      return;
    }

    const [row] = await db
      .select({
        event: communityEventsTable,
        creatorName: profilesTable.displayName,
      })
      .from(communityEventsTable)
      .leftJoin(
        profilesTable,
        eq(profilesTable.uid, communityEventsTable.ownerUid),
      )
      .where(
        and(
          eq(
            communityEventsTable.inviteTokenHash,
            hashEventInviteToken(parsed.data.token),
          ),
          or(
            eq(communityEventsTable.visibility, "invite_only"),
            eq(communityEventsTable.visibility, "public"),
          ),
          eq(communityEventsTable.isHidden, false),
        ),
      )
      .limit(1);
    if (!row) {
      const [venueRow] = await db
        .select({
          event: venueEventsTable,
          venueName: venueOwnerProfilesTable.businessName,
          latitude: venueOwnerProfilesTable.lat,
          longitude: venueOwnerProfilesTable.lng,
        })
        .from(venueEventsTable)
        .innerJoin(
          venueOwnerProfilesTable,
          eq(venueOwnerProfilesTable.placeId, venueEventsTable.placeId),
        )
        .where(and(
          eq(venueEventsTable.inviteTokenHash, hashEventInviteToken(parsed.data.token)),
          eq(venueEventsTable.visibility, "invite_only"),
          eq(venueEventsTable.isPublished, true),
          eq(venueEventsTable.isHidden, false),
          eq(venueOwnerProfilesTable.isApproved, true),
          eq(venueOwnerProfilesTable.applicationStatus, "approved"),
        ))
        .limit(1);
      if (!venueRow) {
        res.status(404).json({ message: "Invitation not found." });
        return;
      }
      const event = venueRow.event;
      const requiresPasscode = Boolean(event.invitePasscodeHash);
      if (requiresPasscode && !parsed.data.passcode) {
        res.setHeader("Cache-Control", "no-store");
        res.json(ResolveEventInviteResponse.parse({ requiresPasscode, event: null }));
        return;
      }
      if (!verifyEventInvitePasscode(
        parsed.data.passcode,
        event.invitePasscodeSalt,
        event.invitePasscodeHash,
      )) {
        res.status(401).json({ message: "That passcode does not match." });
        return;
      }
      const rsvps = await db
        .select({ status: venueEventRsvpsTable.status })
        .from(venueEventRsvpsTable)
        .where(and(
          eq(venueEventRsvpsTable.eventId, event.id),
          ne(venueEventRsvpsTable.status, "not_going"),
        ));
      res.setHeader("Cache-Control", "no-store");
      res.json(ResolveEventInviteResponse.parse({
        requiresPasscode,
        event: {
          eventType: "venue",
          id: event.id,
          title: event.title,
          description: event.description,
          imageUrl: event.imageUrl,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          location: venueRow.venueName,
          creatorName: null,
          latitude: venueRow.latitude != null ? Number(venueRow.latitude) : null,
          longitude: venueRow.longitude != null ? Number(venueRow.longitude) : null,
          rsvpCount: rsvps.length,
        },
      }));
      return;
    }

    const event = row.event;
    const requiresPasscode = Boolean(event.invitePasscodeHash);
    if (requiresPasscode && !parsed.data.passcode) {
      res.setHeader("Cache-Control", "no-store");
      res.json(ResolveEventInviteResponse.parse({ requiresPasscode, event: null }));
      return;
    }
    if (
      !verifyEventInvitePasscode(
        parsed.data.passcode,
        event.invitePasscodeSalt,
        event.invitePasscodeHash,
      )
    ) {
      res.status(401).json({ message: "That passcode does not match." });
      return;
    }

    const rsvps = await db
      .select({ status: communityEventRsvpsTable.status })
      .from(communityEventRsvpsTable)
      .where(
        and(
          eq(communityEventRsvpsTable.eventId, event.id),
          ne(communityEventRsvpsTable.status, "not_going"),
        ),
      );
    res.setHeader("Cache-Control", "no-store");
    res.json(
      ResolveEventInviteResponse.parse({
        requiresPasscode,
        event: {
          eventType: "member",
          id: event.id,
          title: event.title,
          description: event.description,
          imageUrl: event.imageUrl,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          location: event.location,
          creatorName: row.creatorName ?? null,
          latitude: event.locationLatitude,
          longitude: event.locationLongitude,
          rsvpCount: rsvps.length,
        },
      }),
    );
  },
);

router.get(
  "/community-events/:eventId/manage",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const eventId = getEventId(req.params.eventId);
    if (!eventId) {
      res.status(400).json({ message: "Invalid event id" });
      return;
    }
    const [event] = await db
      .select()
      .from(communityEventsTable)
      .where(and(
        eq(communityEventsTable.id, eventId),
        eq(communityEventsTable.isHidden, false),
        or(
          eq(communityEventsTable.visibility, "public"),
          eq(communityEventsTable.ownerUid, uid),
        ),
      ))
      .limit(1);
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    res.json(
      GetCommunityEventForEditResponse.parse({
        id: event.id,
        title: event.title,
        description: event.description,
        imageUrl: event.imageUrl,
        contactPhone: event.contactPhone,
        websiteUrl: event.websiteUrl,
        publicEmail: event.publicEmail,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        locationPlaceId: event.locationPlaceId,
        latitude: event.locationLatitude,
        longitude: event.locationLongitude,
        visibility: event.visibility,
        inviteeUids: event.inviteeUids,
        inviteLinkEnabled: Boolean(event.inviteTokenHash),
        invitePasscodeRequired: Boolean(event.invitePasscodeHash),
      }),
    );
  },
);

router.post(
  "/community-events/:eventId/invite-link",
  requireUid,
  eventWriteLimit,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const eventId = getEventId(req.params.eventId);
    if (!eventId) {
      res.status(400).json({ message: "Invalid event id" });
      return;
    }
    const [event] = await db
      .select()
      .from(communityEventsTable)
      .where(
        and(
          eq(communityEventsTable.id, eventId),
          eq(communityEventsTable.isHidden, false),
          or(
            eq(communityEventsTable.visibility, "public"),
            eq(communityEventsTable.ownerUid, uid),
          ),
        ),
      )
      .limit(1);
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    const ownerCanSharePrivateEvent =
      event.visibility === "invite_only" &&
      event.ownerUid === uid &&
      Boolean(event.inviteTokenHash && event.inviteTokenEncrypted);
    if (event.visibility === "invite_only" && !ownerCanSharePrivateEvent) {
      res.status(409).json({ message: "Invite link is disabled for this event." });
      return;
    }
    try {
      let token: string;
      let passcodeRequired: boolean;
      if (event.visibility === "public" && (!event.inviteTokenHash || !event.inviteTokenEncrypted)) {
        const fields = createEventInviteLinkFields();
        const [created] = await db
          .update(communityEventsTable)
          .set(fields)
          .where(and(
            eq(communityEventsTable.id, event.id),
            eq(communityEventsTable.visibility, "public"),
            eq(communityEventsTable.isHidden, false),
            isNull(communityEventsTable.inviteTokenHash),
          ))
          .returning({
            inviteTokenEncrypted: communityEventsTable.inviteTokenEncrypted,
          });
        const stored = created?.inviteTokenEncrypted
          ? created
          : (await db
              .select({ inviteTokenEncrypted: communityEventsTable.inviteTokenEncrypted })
              .from(communityEventsTable)
              .where(and(
                eq(communityEventsTable.id, event.id),
                eq(communityEventsTable.visibility, "public"),
                eq(communityEventsTable.isHidden, false),
              ))
              .limit(1))[0];
        if (!stored?.inviteTokenEncrypted) {
          res.status(409).json({ message: "This event can no longer be shared." });
          return;
        }
        token = decryptEventInviteToken(
          created ? fields.inviteTokenEncrypted : stored.inviteTokenEncrypted,
        );
        passcodeRequired = false;
      } else {
        if (!event.inviteTokenEncrypted) {
          res.status(409).json({ message: "Invite link is disabled for this event." });
          return;
        }
        token = decryptEventInviteToken(event.inviteTokenEncrypted);
        passcodeRequired = Boolean(event.invitePasscodeHash);
      }
      res.setHeader("Cache-Control", "no-store");
      res.json(
        CreateCommunityEventInviteLinkResponse.parse({
          url: buildEventInviteUrl(token),
          passcodeRequired,
        }),
      );
    } catch (error) {
      req.log?.error({ error, eventId }, "Could not decrypt community event invite link");
      res.status(503).json({
        message: "Invite link could not be loaded. Turn it off and on again to create a new link.",
      });
    }
  },
);

router.get(
  "/community-events/:eventId/plan-chat",
  requireUid,
  async (req, res): Promise<void> => {
    const eventId = getEventId(req.params.eventId);
    if (!eventId) {
      res.status(400).json({ message: "Invalid event id." });
      return;
    }
    const context = await getCommunityEventPlanChatContext(eventId, req.uid!);
    if (!context) {
      res.status(404).json({ message: "Plan conversation not found." });
      return;
    }

    const activeRsvps = context.rsvps.filter(
      (rsvp) => rsvp.status === "going" || rsvp.status === "maybe",
    );
    const participantUids = [
      ...new Set([context.event.ownerUid, ...activeRsvps.map((rsvp) => rsvp.userUid)]),
    ];
    const [profiles, messages, notificationPreference] = await Promise.all([
      db
        .select({
          uid: profilesTable.uid,
          displayName: profilesTable.displayName,
          photoUrl: profilesTable.photoUrl,
        })
        .from(profilesTable)
        .where(inArray(profilesTable.uid, participantUids)),
      db
        .select({
          id: communityEventPlanMessagesTable.id,
          senderUid: communityEventPlanMessagesTable.senderUid,
          senderName: profilesTable.displayName,
          senderPhotoUrl: profilesTable.photoUrl,
          text: communityEventPlanMessagesTable.message,
          createdAt: communityEventPlanMessagesTable.createdAt,
        })
        .from(communityEventPlanMessagesTable)
        .leftJoin(
          profilesTable,
          eq(profilesTable.uid, communityEventPlanMessagesTable.senderUid),
        )
        .where(eq(communityEventPlanMessagesTable.eventId, eventId))
        .orderBy(
          desc(communityEventPlanMessagesTable.createdAt),
          desc(communityEventPlanMessagesTable.id),
        )
        .limit(100),
      db
        .select({
          muted: communityEventPlanNotificationPreferencesTable.muted,
        })
        .from(communityEventPlanNotificationPreferencesTable)
        .where(
          and(
            eq(communityEventPlanNotificationPreferencesTable.eventId, eventId),
            eq(communityEventPlanNotificationPreferencesTable.userUid, req.uid!),
          ),
        )
        .limit(1)
    ]);
    const profilesByUid = new Map(profiles.map((profile) => [profile.uid, profile]));
    const participants = participantUids.map((uid) => {
      const rsvp = activeRsvps.find((item) => item.userUid === uid);
      const profile = profilesByUid.get(uid);
      return {
        uid,
        displayName: profile?.displayName || "Met member",
        photoUrl: profile?.photoUrl ?? null,
        status: uid === context.event.ownerUid ? "host" : rsvp?.status,
      };
    });

    res.setHeader("Cache-Control", "no-store");
    res.json(
      GetCommunityEventPlanChatResponse.parse({
        event: {
          id: context.event.id,
          title: context.event.title,
          startsAt: context.event.startsAt,
          location: context.event.location,
        },
        participants,
        notificationsMuted: notificationPreference[0]?.muted ?? false,
        messages: messages.slice().reverse().map((message) => ({
          ...message,
          senderName: message.senderName || "Met member",
          senderPhotoUrl: message.senderPhotoUrl ?? null,
          createdAt: message.createdAt.toISOString(),
        })),
      }),
    );
  },
);

router.put(
  "/community-events/:eventId/plan-chat/notifications",
  requireUid,
  async (req, res): Promise<void> => {
    const eventId = getEventId(req.params.eventId);
    if (!eventId) {
      res.status(400).json({ message: "Invalid event id." });
      return;
    }
    const parsed = SetCommunityEventPlanChatNotificationsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid notification preference." });
      return;
    }
    const context = await getCommunityEventPlanChatContext(eventId, req.uid!);
    if (!context) {
      res.status(404).json({ message: "Plan conversation not found." });
      return;
    }

    const now = new Date();
    await db
      .insert(communityEventPlanNotificationPreferencesTable)
      .values({
        eventId,
        userUid: req.uid!,
        muted: parsed.data.muted,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          communityEventPlanNotificationPreferencesTable.eventId,
          communityEventPlanNotificationPreferencesTable.userUid,
        ],
        set: {
          muted: parsed.data.muted,
          updatedAt: now,
        },
      });

    res.json(
      SetCommunityEventPlanChatNotificationsResponse.parse({
        muted: parsed.data.muted,
      }),
    );
  },
);

router.post(
  "/community-events/:eventId/plan-chat",
  requireUid,
  eventPlanMessageLimit,
  async (req, res): Promise<void> => {
    const eventId = getEventId(req.params.eventId);
    if (!eventId) {
      res.status(400).json({ message: "Invalid event id." });
      return;
    }
    const rawText = req.body?.text;
    const parsed = SendCommunityEventPlanChatMessageBody.safeParse({
      text: typeof rawText === "string" ? rawText.trim() : rawText,
    });
    if (!parsed.success) {
      res.status(400).json({ message: "Enter a message up to 500 characters." });
      return;
    }
    const context = await getCommunityEventPlanChatContext(eventId, req.uid!);
    if (!context) {
      res.status(404).json({ message: "Plan conversation not found." });
      return;
    }

    const [message] = await db
      .insert(communityEventPlanMessagesTable)
      .values({
        eventId,
        senderUid: req.uid!,
        message: parsed.data.text,
      })
      .returning();
    const [sender] = await db
      .select({
        displayName: profilesTable.displayName,
        photoUrl: profilesTable.photoUrl,
      })
      .from(profilesTable)
      .where(eq(profilesTable.uid, req.uid!))
      .limit(1);

    await notifyCommunityEventPlanMessage({
      eventId,
      participantUids: [
        context.event.ownerUid,
        ...context.rsvps
          .filter((rsvp) => rsvp.status === "going" || rsvp.status === "maybe")
          .map((rsvp) => rsvp.userUid),
      ],
      senderUid: req.uid!,
    });

    res.status(201).json(
      SendCommunityEventPlanChatMessageResponse.parse({
        message: {
          id: message.id,
          senderUid: message.senderUid,
          senderName: sender?.displayName || "Met member",
          senderPhotoUrl: sender?.photoUrl ?? null,
          text: message.message,
          createdAt: message.createdAt.toISOString(),
        },
      }),
    );
  },
);

router.put(
  "/community-events/:eventId",
  requireUid,
  eventWriteLimit,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const eventId = getEventId(req.params.eventId);
    if (!eventId) {
      res.status(400).json({ message: "Invalid event id" });
      return;
    }
    const parsed = UpdateCommunityEventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid event details", errors: parsed.error.issues });
      return;
    }
    const times = validateEventTimes(parsed.data.startsAt, parsed.data.endsAt);
    if ("error" in times) {
      res.status(400).json({ message: times.error });
      return;
    }
    const hasLatitude = parsed.data.latitude != null;
    const hasLongitude = parsed.data.longitude != null;
    const hasPlaceId = Boolean(parsed.data.locationPlaceId);
    if (hasLatitude !== hasLongitude || hasLatitude !== hasPlaceId) {
      res.status(400).json({ message: "Choose a valid place result for this location." });
      return;
    }
    const inviteeUids = normalizeInvitees(parsed.data.inviteeUids, uid);
    const [existing] = await db
      .select()
      .from(communityEventsTable)
      .where(
        and(
          eq(communityEventsTable.id, eventId),
          eq(communityEventsTable.ownerUid, uid),
          eq(communityEventsTable.isHidden, false),
        ),
      )
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    const passcodeInput = parsed.data.invitePasscode;
    const inviteLinkEnabled =
      parsed.data.visibility === "invite_only" &&
      (parsed.data.inviteLinkEnabled ?? Boolean(existing.inviteTokenHash));
    const invitePasscode = passcodeInput?.trim() || null;
    if (invitePasscode && !inviteLinkEnabled) {
      res.status(400).json({ message: "Enable the invite link before adding a passcode." });
      return;
    }
    if (
      parsed.data.visibility === "invite_only" &&
      inviteeUids.length === 0 &&
      !inviteLinkEnabled
    ) {
      res.status(400).json({
        message: "Select a connection or enable a shareable invite link.",
      });
      return;
    }

    let inviteLinkFields: {
      inviteTokenHash: string | null;
      inviteTokenEncrypted: string | null;
      invitePasscodeSalt: string | null;
      invitePasscodeHash: string | null;
    };
    if (!inviteLinkEnabled) {
      inviteLinkFields = {
        inviteTokenHash: null,
        inviteTokenEncrypted: null,
        invitePasscodeSalt: null,
        invitePasscodeHash: null,
      };
    } else if (
      !existing.inviteTokenHash ||
      !existing.inviteTokenEncrypted ||
      existing.visibility !== "invite_only"
    ) {
      try {
        inviteLinkFields = createEventInviteLinkFields(invitePasscode);
      } catch (error) {
        res.status(400).json({
          message: error instanceof Error ? error.message : "Invalid invite passcode.",
        });
        return;
      }
    } else if (passcodeInput !== undefined) {
      if (!invitePasscode) {
        inviteLinkFields = {
          inviteTokenHash: existing.inviteTokenHash,
          inviteTokenEncrypted: existing.inviteTokenEncrypted,
          invitePasscodeSalt: null,
          invitePasscodeHash: null,
        };
      } else {
        try {
          inviteLinkFields = {
            inviteTokenHash: existing.inviteTokenHash,
            inviteTokenEncrypted: existing.inviteTokenEncrypted,
            ...createEventInvitePasscodeFields(invitePasscode),
          };
        } catch (error) {
          res.status(400).json({
            message: error instanceof Error ? error.message : "Invalid invite passcode.",
          });
          return;
        }
      }
    } else {
      inviteLinkFields = {
        inviteTokenHash: existing.inviteTokenHash,
        inviteTokenEncrypted: existing.inviteTokenEncrypted,
        invitePasscodeSalt: existing.invitePasscodeSalt,
        invitePasscodeHash: existing.invitePasscodeHash,
      };
    }

    const [event] = await db
      .update(communityEventsTable)
      .set({
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        contactPhone: parsed.data.contactPhone?.trim() || null,
        websiteUrl: parsed.data.websiteUrl?.trim() || null,
        publicEmail: parsed.data.publicEmail?.trim() || null,
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        location: parsed.data.location?.trim() || null,
        locationPlaceId: parsed.data.locationPlaceId ?? null,
        locationLatitude: parsed.data.latitude ?? null,
        locationLongitude: parsed.data.longitude ?? null,
        visibility: parsed.data.visibility,
        inviteeUids: parsed.data.visibility === "invite_only" ? inviteeUids : [],
        ...inviteLinkFields,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(communityEventsTable.id, eventId),
          eq(communityEventsTable.ownerUid, uid),
          eq(communityEventsTable.isHidden, false),
        ),
      )
      .returning();
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    const [profile, rsvps, myRsvp] = await Promise.all([
      db
        .select({ displayName: profilesTable.displayName })
        .from(profilesTable)
        .where(eq(profilesTable.uid, uid))
        .limit(1),
      db
        .select({ status: communityEventRsvpsTable.status })
        .from(communityEventRsvpsTable)
        .where(
          and(
            eq(communityEventRsvpsTable.eventId, event.id),
            ne(communityEventRsvpsTable.status, "not_going"),
          ),
        ),
      db
        .select({ status: communityEventRsvpsTable.status })
        .from(communityEventRsvpsTable)
        .where(
          and(
            eq(communityEventRsvpsTable.eventId, event.id),
            eq(communityEventRsvpsTable.userUid, uid),
          ),
        )
        .limit(1),
    ]);
    res.json(
      UpdateCommunityEventResponse.parse({
        eventType: "member",
        id: event.id,
        ownerUid: event.ownerUid,
        title: event.title,
        description: event.description,
        imageUrl: event.imageUrl,
        contactPhone: event.contactPhone,
        websiteUrl: event.websiteUrl,
        publicEmail: event.publicEmail,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        locationPlaceId: event.locationPlaceId,
        placeId: null,
        venueName: null,
        creatorName: profile[0]?.displayName ?? null,
        latitude: event.locationLatitude,
        longitude: event.locationLongitude,
        visibility: event.visibility,
        rsvpCount: rsvps.length,
        myRsvp: myRsvp[0]?.status ?? null,
      }),
    );
  },
);

router.delete(
  "/community-events/:eventId",
  requireUid,
  eventWriteLimit,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const eventId = getEventId(req.params.eventId);
    if (!eventId) {
      res.status(400).json({ message: "Invalid event id" });
      return;
    }
    const deleted = await db.transaction(async (tx) => {
      const [event] = await tx
        .select({ id: communityEventsTable.id })
        .from(communityEventsTable)
        .where(
          and(
            eq(communityEventsTable.id, eventId),
            eq(communityEventsTable.ownerUid, uid),
            eq(communityEventsTable.isHidden, false),
          ),
        )
        .limit(1);
      if (!event) return false;
      await tx
        .delete(communityEventRsvpsTable)
        .where(eq(communityEventRsvpsTable.eventId, eventId));
      await tx
        .delete(eventAttendanceTable)
        .where(and(
          eq(eventAttendanceTable.eventType, "member"),
          eq(eventAttendanceTable.eventId, eventId),
        ));
      const [removed] = await tx
        .delete(communityEventsTable)
        .where(
          and(
            eq(communityEventsTable.id, eventId),
            eq(communityEventsTable.ownerUid, uid),
          ),
        )
        .returning({ id: communityEventsTable.id });
      return Boolean(removed);
    });
    if (!deleted) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    res.status(204).end();
  },
);

router.post(
  "/event-invites/rsvp",
  requireUid,
  eventWriteLimit,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const parsedBody = RsvpToEventInviteBody.safeParse(req.body);
    if (!parsedBody.success || !isValidEventInviteToken(parsedBody.data.token)) {
      res.status(400).json({ message: "Invalid event invitation." });
      return;
    }

    const [event] = await db
      .select()
      .from(communityEventsTable)
      .where(
        and(
          eq(
            communityEventsTable.inviteTokenHash,
            hashEventInviteToken(parsedBody.data.token),
          ),
          or(
            eq(communityEventsTable.visibility, "invite_only"),
            eq(communityEventsTable.visibility, "public"),
          ),
          eq(communityEventsTable.isHidden, false),
        ),
      )
      .limit(1);
    if (event && (
      !verifyEventInvitePasscode(
        parsedBody.data.passcode,
        event.invitePasscodeSalt,
        event.invitePasscodeHash,
      )
    )) {
      res.status(401).json({ message: "That passcode does not match." });
      return;
    }
    if (event) {
      await db
        .insert(communityEventRsvpsTable)
        .values({
          eventId: event.id,
          userUid: uid,
          status: parsedBody.data.status,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [communityEventRsvpsTable.eventId, communityEventRsvpsTable.userUid],
          set: { status: parsedBody.data.status, updatedAt: new Date() },
        });
      res.json({ success: true, status: parsedBody.data.status });
      return;
    }

    const [venueEvent] = await db
      .select()
      .from(venueEventsTable)
      .where(and(
        eq(venueEventsTable.inviteTokenHash, hashEventInviteToken(parsedBody.data.token)),
        eq(venueEventsTable.visibility, "invite_only"),
        eq(venueEventsTable.isPublished, true),
        eq(venueEventsTable.isHidden, false),
      ))
      .limit(1);
    if (!venueEvent) {
      res.status(404).json({ message: "Invitation not found." });
      return;
    }
    if (!verifyEventInvitePasscode(
      parsedBody.data.passcode,
      venueEvent.invitePasscodeSalt,
      venueEvent.invitePasscodeHash,
    )) {
      res.status(401).json({ message: "That passcode does not match." });
      return;
    }
    await db
      .insert(venueEventRsvpsTable)
      .values({
        eventId: venueEvent.id,
        userUid: uid,
        status: parsedBody.data.status,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [venueEventRsvpsTable.eventId, venueEventRsvpsTable.userUid],
        set: { status: parsedBody.data.status, updatedAt: new Date() },
      });
    const [rsvpCount] = await db
      .select({ value: count() })
      .from(venueEventRsvpsTable)
      .where(and(
        eq(venueEventRsvpsTable.eventId, venueEvent.id),
        ne(venueEventRsvpsTable.status, "not_going"),
      ));
    await db
      .update(venueEventsTable)
      .set({ rsvpCount: Number(rsvpCount?.value ?? 0), updatedAt: new Date() })
      .where(eq(venueEventsTable.id, venueEvent.id));
    res.json({ success: true, status: parsedBody.data.status });
  },
);

router.post(
  "/community-events/:eventId/rsvp",
  requireUid,
  eventWriteLimit,
  async (req, res) => {
    const uid = req.uid!;
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId < 1) {
      res.status(400).json({ message: "Invalid event id" });
      return;
    }
    const parsed = z.object({ status: rsvpStatusSchema }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid RSVP status" });
      return;
    }
    const [event] = await db
      .select()
      .from(communityEventsTable)
      .where(and(eq(communityEventsTable.id, eventId), eq(communityEventsTable.isHidden, false)))
      .limit(1);
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    const canAttend =
      event.visibility === "public" ||
      event.ownerUid === uid ||
      event.inviteeUids.includes(uid);
    if (!canAttend) {
      res.status(403).json({ message: "This event is invitation-only." });
      return;
    }
    await db
      .insert(communityEventRsvpsTable)
      .values({ eventId, userUid: uid, status: parsed.data.status, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [communityEventRsvpsTable.eventId, communityEventRsvpsTable.userUid],
        set: { status: parsed.data.status, updatedAt: new Date() },
      });
    res.json({ success: true, status: parsed.data.status });
  },
);

async function attendeeCanAccessEvent(
  eventType: EventKind,
  eventId: number,
  uid: string,
  visibility: string,
  ownerUid: string,
  inviteeUids: string[],
): Promise<boolean> {
  if (visibility === "public" || ownerUid === uid || inviteeUids.includes(uid)) {
    return true;
  }
  const rsvps = eventType === "venue" ? venueEventRsvpsTable : communityEventRsvpsTable;
  const [rsvp] = await db
    .select({ id: rsvps.id })
    .from(rsvps)
    .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userUid, uid), ne(rsvps.status, "not_going")))
    .limit(1);
  return Boolean(rsvp);
}

router.post(
  "/events/check-in/qr",
  requireUid,
  eventCheckinLimit,
  async (req, res): Promise<void> => {
    const parsed = CheckInEventByQrBody.safeParse(req.body);
    if (!parsed.success || !isValidEventCheckinToken(parsed.data?.token ?? "")) {
      res.status(400).json({ message: "This event check-in code is invalid." });
      return;
    }
    const tokenHash = hashEventCheckinToken(parsed.data.token);
    const [venueEvent] = await db
      .select()
      .from(venueEventsTable)
      .where(and(
        eq(venueEventsTable.checkinTokenHash, tokenHash),
        eq(venueEventsTable.isPublished, true),
        eq(venueEventsTable.isHidden, false),
      ))
      .limit(1);
    if (venueEvent) {
      if (!eventCheckinOpen(venueEvent.startsAt, venueEvent.endsAt)) {
        res.status(403).json({ message: "Check-in is available near the event time." });
        return;
      }
      if (!(await attendeeCanAccessEvent(
        "venue",
        venueEvent.id,
        req.uid!,
        venueEvent.visibility,
        venueEvent.ownerUid,
        venueEvent.inviteeUids,
      ))) {
        res.status(403).json({ message: "This event is invitation-only." });
        return;
      }
      const attendance = await insertEventAttendance("venue", venueEvent.id, req.uid!, "qr");
      res.json(CheckInEventByQrResponse.parse({
        eventType: "venue",
        eventId: venueEvent.id,
        title: venueEvent.title,
        checkInMethod: "qr",
        ...attendance,
      }));
      return;
    }

    const [memberEvent] = await db
      .select()
      .from(communityEventsTable)
      .where(and(
        eq(communityEventsTable.checkinTokenHash, tokenHash),
        eq(communityEventsTable.isHidden, false),
      ))
      .limit(1);
    if (!memberEvent) {
      res.status(404).json({ message: "This event check-in code is invalid or has been replaced." });
      return;
    }
    if (!eventCheckinOpen(memberEvent.startsAt, memberEvent.endsAt)) {
      res.status(403).json({ message: "Check-in is available near the event time." });
      return;
    }
    if (!(await attendeeCanAccessEvent(
      "member",
      memberEvent.id,
      req.uid!,
      memberEvent.visibility,
      memberEvent.ownerUid,
      memberEvent.inviteeUids,
    ))) {
      res.status(403).json({ message: "This event is invitation-only." });
      return;
    }
    const attendance = await insertEventAttendance("member", memberEvent.id, req.uid!, "qr");
    res.json(CheckInEventByQrResponse.parse({
      eventType: "member",
      eventId: memberEvent.id,
      title: memberEvent.title,
      checkInMethod: "qr",
      ...attendance,
    }));
  },
);

router.post(
  "/events/:eventType/:eventId/check-in/location",
  requireUid,
  eventCheckinLimit,
  async (req, res): Promise<void> => {
    const params = CheckInEventByLocationParams.safeParse(req.params);
    const parsed = CheckInEventByLocationBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ message: "A valid event and current location are required." });
      return;
    }
    const eventType = params.data.eventType;
    const eventId = params.data.eventId;
    if (process.env.NODE_ENV === "production") {
      const appCheckToken = req.get("X-Firebase-AppCheck");
      if (!appCheckToken || !(await verifyAppCheckToken(appCheckToken))) {
        res.status(403).json({ message: "This device could not be verified. Scan the event QR code instead." });
        return;
      }
    }
    if (parsed.data.mocked) {
      res.status(403).json({ message: "Simulated locations cannot be used to check in." });
      return;
    }
    if (parsed.data.accuracy > 75) {
      res.status(403).json({ message: "Your location is not precise enough. Scan the event QR code instead." });
      return;
    }

    let event: {
      id: number;
      ownerUid: string;
      title: string;
      startsAt: Date;
      endsAt: Date | null;
      visibility: string;
      inviteeUids: string[];
      latitude: number | null;
      longitude: number | null;
    } | undefined;
    if (eventType === "venue") {
      const [row] = await db
        .select({
          id: venueEventsTable.id,
          ownerUid: venueEventsTable.ownerUid,
          title: venueEventsTable.title,
          startsAt: venueEventsTable.startsAt,
          endsAt: venueEventsTable.endsAt,
          visibility: venueEventsTable.visibility,
          inviteeUids: venueEventsTable.inviteeUids,
          latitude: venueOwnerProfilesTable.lat,
          longitude: venueOwnerProfilesTable.lng,
        })
        .from(venueEventsTable)
        .innerJoin(venueOwnerProfilesTable, eq(venueOwnerProfilesTable.placeId, venueEventsTable.placeId))
        .where(and(
          eq(venueEventsTable.id, eventId),
          eq(venueEventsTable.isPublished, true),
          eq(venueEventsTable.isHidden, false),
          eq(venueOwnerProfilesTable.isApproved, true),
        ))
        .limit(1);
      event = row
        ? { ...row, latitude: row.latitude == null ? null : Number(row.latitude), longitude: row.longitude == null ? null : Number(row.longitude) }
        : undefined;
    } else {
      const [row] = await db
        .select({
          id: communityEventsTable.id,
          ownerUid: communityEventsTable.ownerUid,
          title: communityEventsTable.title,
          startsAt: communityEventsTable.startsAt,
          endsAt: communityEventsTable.endsAt,
          visibility: communityEventsTable.visibility,
          inviteeUids: communityEventsTable.inviteeUids,
          latitude: communityEventsTable.locationLatitude,
          longitude: communityEventsTable.locationLongitude,
        })
        .from(communityEventsTable)
        .where(and(
          eq(communityEventsTable.id, eventId),
          eq(communityEventsTable.isHidden, false),
        ))
        .limit(1);
      event = row;
    }
    if (!event) {
      res.status(404).json({ message: "Event not found." });
      return;
    }
    if (!eventCheckinOpen(event.startsAt, event.endsAt)) {
      res.status(403).json({ message: "Check-in is available near the event time." });
      return;
    }
    if (!(await attendeeCanAccessEvent(
      eventType,
      eventId,
      req.uid!,
      event.visibility,
      event.ownerUid,
      event.inviteeUids,
    ))) {
      res.status(403).json({ message: "This event is invitation-only." });
      return;
    }
    if (
      event.latitude == null ||
      event.longitude == null ||
      !Number.isFinite(event.latitude) ||
      !Number.isFinite(event.longitude)
    ) {
      res.status(409).json({ message: "This event does not have a verified location. Scan its QR code instead." });
      return;
    }
    const distance = distanceMeters(
      parsed.data.latitude,
      parsed.data.longitude,
      event.latitude,
      event.longitude,
    );
    if (distance > 100 || distance + parsed.data.accuracy > 125) {
      res.status(403).json({ message: "Move closer to the event location to check in, or scan its QR code." });
      return;
    }
    const attendance = await insertEventAttendance(eventType, eventId, req.uid!, "location");
    res.json(CheckInEventByLocationResponse.parse({
      eventType,
      eventId,
      title: event.title,
      checkInMethod: "location",
      ...attendance,
    }));
  },
);

router.post(
  "/events/:eventType/:eventId/check-in-qr",
  requireUid,
  eventWriteLimit,
  async (req, res): Promise<void> => {
    const params = GetEventCheckinQrParams.safeParse(req.params);
    const body = GetEventCheckinQrBody.safeParse(req.body ?? {});
    if (!params.success || !body.success) {
      res.status(400).json({ message: "Invalid event." });
      return;
    }
    const { eventType, eventId } = params.data;
    const rotate = body.data.rotate;
    if (eventType === "venue") {
      const [event] = await db.select().from(venueEventsTable).where(and(
        eq(venueEventsTable.id, eventId),
        eq(venueEventsTable.ownerUid, req.uid!),
        eq(venueEventsTable.isHidden, false),
      )).limit(1);
      if (!event) {
        res.status(404).json({ message: "Event not found." });
        return;
      }
      try {
        let token: string;
        if (!rotate && event.checkinTokenEncrypted) {
          token = decryptEventCheckinToken(event.checkinTokenEncrypted);
        } else {
          const fields = createEventCheckinLinkFields();
          const [updated] = await db.update(venueEventsTable)
            .set({
              checkinTokenHash: fields.checkinTokenHash,
              checkinTokenEncrypted: fields.checkinTokenEncrypted,
              updatedAt: new Date(),
            })
            .where(eq(venueEventsTable.id, eventId))
            .returning({ checkinTokenEncrypted: venueEventsTable.checkinTokenEncrypted });
          if (!updated) {
            res.status(409).json({ message: "The event check-in code could not be saved." });
            return;
          }
          token = fields.token;
        }
        res.setHeader("Cache-Control", "no-store");
        res.json(GetEventCheckinQrResponse.parse({ url: buildEventCheckinUrl(token) }));
      } catch (error) {
        req.log?.error({ error, eventId }, "Could not create venue event check-in QR");
        res.status(503).json({ message: "The event check-in code could not be loaded." });
      }
      return;
    }
    const [event] = await db.select().from(communityEventsTable).where(and(
      eq(communityEventsTable.id, eventId),
      eq(communityEventsTable.ownerUid, req.uid!),
      eq(communityEventsTable.isHidden, false),
    )).limit(1);
    if (!event) {
      res.status(404).json({ message: "Event not found." });
      return;
    }
    try {
      let token: string;
      if (!rotate && event.checkinTokenEncrypted) {
        token = decryptEventCheckinToken(event.checkinTokenEncrypted);
      } else {
        const fields = createEventCheckinLinkFields();
        const [updated] = await db.update(communityEventsTable)
          .set({
            checkinTokenHash: fields.checkinTokenHash,
            checkinTokenEncrypted: fields.checkinTokenEncrypted,
            updatedAt: new Date(),
          })
          .where(eq(communityEventsTable.id, eventId))
          .returning({ checkinTokenEncrypted: communityEventsTable.checkinTokenEncrypted });
        if (!updated) {
          res.status(409).json({ message: "The event check-in code could not be saved." });
          return;
        }
        token = fields.token;
      }
      res.setHeader("Cache-Control", "no-store");
      res.json(GetEventCheckinQrResponse.parse({ url: buildEventCheckinUrl(token) }));
    } catch (error) {
      req.log?.error({ error, eventId }, "Could not create community event check-in QR");
      res.status(503).json({ message: "The event check-in code could not be loaded." });
    }
  },
);

router.get(
  "/events/:eventType/:eventId/attendees",
  requireUid,
  async (req, res): Promise<void> => {
    const params = GetEventAttendeesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: "Invalid event." });
      return;
    }
    const { eventType, eventId } = params.data;
    const eventTable = eventType === "venue" ? venueEventsTable : communityEventsTable;
    const [event] = await db.select({ id: eventTable.id }).from(eventTable).where(and(
      eq(eventTable.id, eventId),
      eq(eventTable.ownerUid, req.uid!),
      eq(eventTable.isHidden, false),
    )).limit(1);
    if (!event) {
      res.status(404).json({ message: "Event not found." });
      return;
    }
    const attendees = await db
      .select({
        uid: eventAttendanceTable.userUid,
        displayName: profilesTable.displayName,
        photoUrl: profilesTable.photoUrl,
        checkInMethod: eventAttendanceTable.checkInMethod,
        checkedInAt: eventAttendanceTable.checkedInAt,
      })
      .from(eventAttendanceTable)
      .leftJoin(profilesTable, eq(profilesTable.uid, eventAttendanceTable.userUid))
      .where(and(
        eq(eventAttendanceTable.eventType, eventType),
        eq(eventAttendanceTable.eventId, eventId),
      ))
      .orderBy(eventAttendanceTable.checkedInAt);
    res.setHeader("Cache-Control", "no-store");
    res.json(GetEventAttendeesResponse.parse({
      attendees: attendees.map((attendee) => ({
        ...attendee,
        displayName: attendee.displayName ?? "Met member",
      })),
    }));
  },
);

export default router;
