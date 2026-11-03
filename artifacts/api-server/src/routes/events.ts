import { Router } from "express";
import {
  and,
  arrayContains,
  eq,
  gte,
  inArray,
  ne,
  or,
} from "drizzle-orm";
import {
  communityEventRsvpsTable,
  communityEventsTable,
  db,
  profilesTable,
  venueEventRsvpsTable,
  venueEventsTable,
  venueOwnerProfilesTable,
} from "@workspace/db";
import { requireUid } from "../middlewares/requireUid";
import { createUserRateLimiter } from "../middlewares/rateLimit";
import {
  CreateCommunityEventBody,
  CreateCommunityEventResponse,
  GetCommunityEventForEditResponse,
  GetEventDetailsResponse,
  SearchEventLocationsQueryParams,
  SearchEventLocationsResponse,
  UpdateCommunityEventBody,
  UpdateCommunityEventResponse,
} from "@workspace/api-zod";
import { searchPhotonLocations } from "../lib/eventLocationSearch";
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

const rsvpStatusSchema = z.enum(["going", "maybe", "not_going"]);

function getEventId(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) return null;
  const eventId = Number(value);
  return Number.isSafeInteger(eventId) && eventId > 0 ? eventId : null;
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
  if (parsed.data.visibility === "invite_only" && inviteeUids.length === 0) {
    res.status(400).json({ message: "Select at least one Connection for an invite-only event." });
    return;
  }

  const [event] = await db
    .insert(communityEventsTable)
    .values({
      ownerUid: uid,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      location: parsed.data.location?.trim() || null,
      locationPlaceId: parsed.data.locationPlaceId ?? null,
      locationLatitude: parsed.data.latitude ?? null,
      locationLongitude: parsed.data.longitude ?? null,
      visibility: parsed.data.visibility,
      inviteeUids: parsed.data.visibility === "invite_only" ? inviteeUids : [],
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
      .where(and(eq(communityEventsTable.id, eventId), eq(communityEventsTable.isHidden, false)))
      .limit(1);
    const event = row?.event;
    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    const canView =
      event.visibility === "public" ||
      event.ownerUid === uid ||
      event.inviteeUids.includes(uid);
    if (!canView) {
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
      .where(
        and(
          eq(communityEventsTable.id, eventId),
          eq(communityEventsTable.ownerUid, uid),
          eq(communityEventsTable.isHidden, false),
        ),
      )
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
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        locationPlaceId: event.locationPlaceId,
        latitude: event.locationLatitude,
        longitude: event.locationLongitude,
        visibility: event.visibility,
        inviteeUids: event.inviteeUids,
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
    if (parsed.data.visibility === "invite_only" && inviteeUids.length === 0) {
      res.status(400).json({ message: "Select at least one Connection for an invite-only event." });
      return;
    }
    const [event] = await db
      .update(communityEventsTable)
      .set({
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        location: parsed.data.location?.trim() || null,
        locationPlaceId: parsed.data.locationPlaceId ?? null,
        locationLatitude: parsed.data.latitude ?? null,
        locationLongitude: parsed.data.longitude ?? null,
        visibility: parsed.data.visibility,
        inviteeUids: parsed.data.visibility === "invite_only" ? inviteeUids : [],
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

export default router;
