import { Router } from "express";
import {
  and,
  arrayContains,
  eq,
  gte,
  inArray,
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
import { z } from "zod";

const router = Router();
const eventWriteLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 12,
  name: "event-write",
});

const inviteeUidsSchema = z.array(z.string().min(1).max(128)).max(200).default([]);
const eventVisibilitySchema = z.enum(["public", "invite_only"]);
const rsvpStatusSchema = z.enum(["going", "maybe", "not_going"]);

router.get("/events/feed", requireUid, async (req, res) => {
  const uid = req.uid!;
  const now = new Date();
  const [venueRows, memberRows] = await Promise.all([
    db
      .select({
        event: venueEventsTable,
        venueName: venueOwnerProfilesTable.businessName,
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
    ...venueRows.map(({ event, venueName }) => ({
      eventType: "venue" as const,
      id: event.id,
      ownerUid: event.ownerUid,
      title: event.title,
      description: event.description,
      imageUrl: event.imageUrl,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      location: venueName,
      placeId: event.placeId,
      venueName,
      creatorName: null,
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
      placeId: null,
      venueName: null,
      creatorName,
      visibility: event.visibility,
      rsvpCount: memberRsvpCounts.get(event.id) ?? 0,
      myRsvp: myMemberRsvp.get(event.id) ?? null,
    })),
  ].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  res.json({ events });
});

router.post("/events", requireUid, eventWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const schema = z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().max(2000).nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable().optional(),
    location: z.string().trim().max(200).nullable().optional(),
    visibility: eventVisibilitySchema,
    inviteeUids: inviteeUidsSchema,
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid event details", errors: parsed.error.issues });
    return;
  }
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  if (endsAt && endsAt <= startsAt) {
    res.status(400).json({ message: "Event end time must be after its start time." });
    return;
  }
  const inviteeUids = [...new Set(parsed.data.inviteeUids)].filter((inviteeUid) => inviteeUid !== uid);
  if (parsed.data.visibility === "invite_only" && inviteeUids.length === 0) {
    res.status(400).json({ message: "Select at least one Match for an invite-only event." });
    return;
  }

  const [event] = await db
    .insert(communityEventsTable)
    .values({
      ownerUid: uid,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      imageUrl: parsed.data.imageUrl ?? null,
      startsAt,
      endsAt,
      location: parsed.data.location?.trim() || null,
      visibility: parsed.data.visibility,
      inviteeUids: parsed.data.visibility === "invite_only" ? inviteeUids : [],
    })
    .returning();
  const [profile] = await db
    .select({ displayName: profilesTable.displayName })
    .from(profilesTable)
    .where(eq(profilesTable.uid, uid))
    .limit(1);

  res.status(201).json({
    eventType: "member",
    id: event.id,
    ownerUid: event.ownerUid,
    title: event.title,
    description: event.description,
    imageUrl: event.imageUrl,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: event.location,
    placeId: null,
    venueName: null,
    creatorName: profile?.displayName ?? null,
    visibility: event.visibility,
    rsvpCount: 0,
    myRsvp: null,
  });
});

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
