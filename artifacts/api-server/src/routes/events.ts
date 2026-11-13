import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  arrayContains,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import {
  communityEventRsvpsTable,
  communityEventJoinRequestsTable,
  communityEventPlanMessagesTable,
  communityEventPlanMediaUploadsTable,
  communityEventPlanNotificationPreferencesTable,
  communityEventHostRatingsTable,
  communityEventsTable,
  db,
  eventAttendanceTable,
  eventAttendanceCorrectionsTable,
  profilesTable,
  venueEventRsvpsTable,
  venueEventReviewsTable,
  venueEventNotificationRunsTable,
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
  GetMyCommunityEventPlanChatsResponse,
  MarkCommunityEventPlanChatReadResponse,
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
  GetNearbyHangoutsQueryParams,
  GetEventCheckinQrBody,
  GetEventCheckinQrParams,
  GetEventCheckinQrResponse,
  GetCommunityEventForEditResponse,
  GetEventDetailsResponse,
  RequestToJoinCommunityEventParams,
  RequestToJoinCommunityEventResponse,
  WithdrawCommunityEventJoinRequestParams,
  WithdrawCommunityEventJoinRequestResponse,
  DecideCommunityEventJoinRequestParams,
  DecideCommunityEventJoinRequestBody,
  DecideCommunityEventJoinRequestResponse,
  ResolveEventInviteBody,
  ResolveEventInviteResponse,
  RsvpToEventInviteBody,
  SearchEventLocationsQueryParams,
  SearchEventLocationsResponse,
  UpdateCommunityEventBody,
  UpdateCommunityEventResponse,
  RateCommunityEventHostBody,
  RateCommunityEventHostResponse,
  CreateEventReviewBody,
  CreateEventReviewParams,
  GetEventReviewsResponse,
  GetEventReviewsParams,
  GetHostPastHangoutsParams,
  GetHostPastHangoutsResponse,
  GetMyPastHangoutsResponse,
  GetMyPastMeetingsResponse,
  CreateCommunityEventPlanChatMediaUploadBody,
  CreateCommunityEventPlanChatMediaUploadResponse,
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
import {
  notifyCommunityEventChange,
  notifyCommunityEventJoinDecision,
  notifyCommunityEventJoinRequest,
  notifyCommunityEventPlanMessage,
} from "../lib/eventNotifications";
import { adminStorage, verifyAppCheckToken } from "../lib/firebaseAdmin";
import { dayOfMonthInTimeZone } from "../lib/communityEventRecurrence";
import {
  EVENT_PHOTO_MAX_COUNT,
  getEventPhotosExpireAt,
} from "../lib/eventPhotoRetention";
import { getVerifiedExplorerStatuses } from "../lib/verifiedExplorer";
import { z } from "zod";

const router = Router();
async function isVerifiedExplorer(uid: string): Promise<boolean> {
  const status = (await getVerifiedExplorerStatuses([uid])).get(uid);
  return status?.isVerifiedExplorer ?? false;
}

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

const planChatMediaTtlMs = 12 * 60 * 60 * 1000;
const planChatUploadUrlTtlMs = 10 * 60 * 1000;
const planChatReadUrlTtlMs = 60 * 60 * 1000;
const planChatMediaMaxBytes = {
  image: 8 * 1024 * 1024,
  voice: 15 * 1024 * 1024,
} as const;

function isPlanChatContentTypeAllowed(
  mediaType: "image" | "voice",
  contentType: string,
): boolean {
  return mediaType === "image"
    ? ["image/jpeg", "image/png", "image/webp"].includes(contentType)
    : ["audio/mp4", "audio/m4a"].includes(contentType);
}

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

  const tierCanAccess =
    !event.verifiedExplorersOnly || await isVerifiedExplorer(uid);
  const rsvps = await db
    .select({
      userUid: communityEventRsvpsTable.userUid,
      status: communityEventRsvpsTable.status,
    })
    .from(communityEventRsvpsTable)
    .where(eq(communityEventRsvpsTable.eventId, eventId));
  const canAccess = tierCanAccess && (
    event.ownerUid === uid ||
    (() => {
      const currentRsvp = rsvps.find((rsvp) => rsvp.userUid === uid);
      if (currentRsvp) {
        return currentRsvp.status === "going" || currentRsvp.status === "maybe";
      }
      return event.inviteeUids.includes(uid);
    })()
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

function getOwnedEventPhotoPath(rawUrl: string, uid: string): string | null {
  try {
    const url = new URL(rawUrl);
    let objectPath: string | null = null;
    if (url.hostname === "storage.googleapis.com") {
      const segments = url.pathname.split("/").filter(Boolean);
      objectPath = segments.slice(1).map(decodeURIComponent).join("/");
    } else if (url.hostname === "firebasestorage.googleapis.com") {
      const match = url.pathname.match(/^\/v0\/b\/[^/]+\/o\/(.+)$/);
      if (match) objectPath = decodeURIComponent(match[1]!);
    }
    if (
      !objectPath ||
      !objectPath.startsWith(`venue-event-images/${uid}/`) ||
      objectPath.split("/").some((part) => part === "..")
    ) {
      return null;
    }
    return objectPath;
  } catch {
    return null;
  }
}

function validateGalleryPhotos(
  photos: string[] | undefined,
  uid: string,
  existingPhotos: string[] = [],
): string[] | null {
  const uniquePhotos = [...new Set(photos ?? [])];
  if (uniquePhotos.length > EVENT_PHOTO_MAX_COUNT) return null;
  return uniquePhotos.every((photo) =>
    existingPhotos.includes(photo) || getOwnedEventPhotoPath(photo, uid) !== null,
  )
    ? uniquePhotos
    : null;
}

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

type ReviewRecord = {
  rating: number;
  reviewText: string | null;
  reviewerName: string | null;
  reviewerPhotoUrl: string | null;
  createdAt: Date;
};

async function getEventReviewsPayload(
  eventType: "venue" | "member",
  eventId: number,
  uid: string,
) {
  if (eventType === "member") {
    const [summary] = await db
      .select({
        averageRating: sql<number | null>`AVG(${communityEventHostRatingsTable.rating})::float8`,
        reviewCount: count(),
      })
      .from(communityEventHostRatingsTable)
      .where(eq(communityEventHostRatingsTable.eventId, eventId));
    const [reviews, [mine]] = await Promise.all([
      db
        .select({
          rating: communityEventHostRatingsTable.rating,
          reviewText: communityEventHostRatingsTable.reviewText,
          reviewerName: profilesTable.displayName,
          reviewerPhotoUrl: profilesTable.photoUrl,
          createdAt: communityEventHostRatingsTable.createdAt,
        })
        .from(communityEventHostRatingsTable)
        .leftJoin(
          profilesTable,
          eq(profilesTable.uid, communityEventHostRatingsTable.reviewerUid),
        )
        .where(eq(communityEventHostRatingsTable.eventId, eventId))
        .orderBy(desc(communityEventHostRatingsTable.createdAt))
        .limit(100),
      db
        .select({
          rating: communityEventHostRatingsTable.rating,
          reviewText: communityEventHostRatingsTable.reviewText,
          reviewerName: profilesTable.displayName,
          reviewerPhotoUrl: profilesTable.photoUrl,
          createdAt: communityEventHostRatingsTable.createdAt,
        })
        .from(communityEventHostRatingsTable)
        .leftJoin(
          profilesTable,
          eq(profilesTable.uid, communityEventHostRatingsTable.reviewerUid),
        )
        .where(and(
          eq(communityEventHostRatingsTable.eventId, eventId),
          eq(communityEventHostRatingsTable.reviewerUid, uid),
        ))
        .limit(1),
    ]);
    const serialize = (review: ReviewRecord) => ({
      ...review,
      reviewerName: review.reviewerName || "Met member",
      reviewerPhotoUrl: review.reviewerPhotoUrl ?? null,
      createdAt: review.createdAt.toISOString(),
    });
    return GetEventReviewsResponse.parse({
      reviews: reviews.map(serialize),
      myReview: mine ? serialize(mine) : null,
      averageRating: summary?.averageRating == null
        ? null
        : Number(summary.averageRating),
      reviewCount: Number(summary?.reviewCount ?? 0),
    });
  }

  const [summary] = await db
    .select({
      averageRating: sql<number | null>`AVG(${venueEventReviewsTable.rating})::float8`,
      reviewCount: count(),
    })
    .from(venueEventReviewsTable)
    .where(eq(venueEventReviewsTable.eventId, eventId));
  const [reviews, [mine]] = await Promise.all([
    db
      .select({
        rating: venueEventReviewsTable.rating,
        reviewText: venueEventReviewsTable.reviewText,
        reviewerName: profilesTable.displayName,
        reviewerPhotoUrl: profilesTable.photoUrl,
        createdAt: venueEventReviewsTable.createdAt,
      })
      .from(venueEventReviewsTable)
      .leftJoin(
        profilesTable,
        eq(profilesTable.uid, venueEventReviewsTable.reviewerUid),
      )
      .where(eq(venueEventReviewsTable.eventId, eventId))
      .orderBy(desc(venueEventReviewsTable.createdAt))
      .limit(100),
    db
      .select({
        rating: venueEventReviewsTable.rating,
        reviewText: venueEventReviewsTable.reviewText,
        reviewerName: profilesTable.displayName,
        reviewerPhotoUrl: profilesTable.photoUrl,
        createdAt: venueEventReviewsTable.createdAt,
      })
      .from(venueEventReviewsTable)
      .leftJoin(
        profilesTable,
        eq(profilesTable.uid, venueEventReviewsTable.reviewerUid),
      )
      .where(and(
        eq(venueEventReviewsTable.eventId, eventId),
        eq(venueEventReviewsTable.reviewerUid, uid),
      ))
      .limit(1),
  ]);
  const serialize = (review: ReviewRecord) => ({
    ...review,
    reviewerName: review.reviewerName || "Met member",
    reviewerPhotoUrl: review.reviewerPhotoUrl ?? null,
    createdAt: review.createdAt.toISOString(),
  });
  return GetEventReviewsResponse.parse({
    reviews: reviews.map(serialize),
    myReview: mine ? serialize(mine) : null,
    averageRating: summary?.averageRating == null
      ? null
      : Number(summary.averageRating),
    reviewCount: Number(summary?.reviewCount ?? 0),
  });
}

router.get("/events/hangouts/nearby", requireUid, async (req, res) => {
  const viewerUid = req.uid!;
  const parsed = GetNearbyHangoutsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid nearby hangout search parameters." });
    return;
  }
  const query = parsed.data;
  const viewerIsExplorer = await isVerifiedExplorer(viewerUid);
  if ((query.latitude == null) !== (query.longitude == null)) {
    res.status(400).json({ message: "Provide both latitude and longitude." });
    return;
  }
  if (query.date) {
    const date = new Date(`${query.date}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== query.date) {
      res.status(400).json({ message: "Invalid date." });
      return;
    }
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: query.timeZone });
  } catch {
    res.status(400).json({ message: "Invalid time zone." });
    return;
  }

  const conditions = [
    eq(communityEventsTable.isHidden, false),
    eq(communityEventsTable.visibility, "public"),
    eq(communityEventsTable.joinApprovalRequired, true),
    viewerIsExplorer ? undefined : eq(communityEventsTable.verifiedExplorersOnly, false),
    gte(communityEventsTable.startsAt, new Date()),
    query.locationQuery
      ? ilike(
          communityEventsTable.location,
          `%${query.locationQuery.replace(/[\\%_]/g, "\\$&")}%`,
        )
      : undefined,
  ];
  if (query.date) {
    conditions.push(
      sql`(${communityEventsTable.startsAt} AT TIME ZONE ${query.timeZone})::date = ${query.date}::date`,
    );
  }
  if (query.timePeriod !== "any") {
    const localHour = sql<number>`EXTRACT(HOUR FROM ${communityEventsTable.startsAt} AT TIME ZONE ${query.timeZone})`;
    const timeCondition =
      query.timePeriod === "morning"
        ? and(gte(localHour, 5), lt(localHour, 12))
        : query.timePeriod === "afternoon"
          ? and(gte(localHour, 12), lt(localHour, 17))
          : query.timePeriod === "evening"
            ? and(gte(localHour, 17), lt(localHour, 22))
            : or(gte(localHour, 22), lt(localHour, 5));
    conditions.push(timeCondition);
  }

  const hasLocation =
    query.latitude != null && query.longitude != null;
  const distanceExpression = hasLocation
    ? sql<number>`6371000 * acos(LEAST(1, GREATEST(-1,
        cos(radians(${query.latitude})) * cos(radians(${communityEventsTable.locationLatitude})) *
        cos(radians(${communityEventsTable.locationLongitude}) - radians(${query.longitude})) +
        sin(radians(${query.latitude})) * sin(radians(${communityEventsTable.locationLatitude}))
      )))`
    : null;
  const orderBy =
    query.sortMode === "nearest" && distanceExpression
      ? [
          asc(distanceExpression),
          asc(communityEventsTable.startsAt),
          asc(communityEventsTable.id),
        ]
      : [asc(communityEventsTable.startsAt), asc(communityEventsTable.id)];
  const rows = await db
    .select({
      id: communityEventsTable.id,
      ownerUid: communityEventsTable.ownerUid,
      title: communityEventsTable.title,
      description: communityEventsTable.description,
      imageUrl: communityEventsTable.imageUrl,
      galleryPhotos: communityEventsTable.galleryPhotos,
      startsAt: communityEventsTable.startsAt,
      location: communityEventsTable.location,
      latitude: communityEventsTable.locationLatitude,
      longitude: communityEventsTable.locationLongitude,
      creatorName: profilesTable.displayName,
      creatorPhotoUrl: profilesTable.photoUrl,
      verifiedExplorersOnly: communityEventsTable.verifiedExplorersOnly,
    })
    .from(communityEventsTable)
    .leftJoin(profilesTable, eq(profilesTable.uid, communityEventsTable.ownerUid))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(query.limit + 1)
    .offset(query.offset);

  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  const [hostStatuses, myJoinRequestRows] = await Promise.all([
    getVerifiedExplorerStatuses(page.map((event) => event.ownerUid)),
    page.length
      ? db
          .select({
            eventId: communityEventJoinRequestsTable.eventId,
            status: communityEventJoinRequestsTable.status,
          })
          .from(communityEventJoinRequestsTable)
          .where(and(
            inArray(
              communityEventJoinRequestsTable.eventId,
              page.map((event) => event.id),
            ),
            eq(communityEventJoinRequestsTable.userUid, viewerUid),
          ))
      : Promise.resolve([]),
  ]);
  const myJoinRequestStatus = new Map(
    myJoinRequestRows.map((request) => [request.eventId, request.status]),
  );
  res.json({
    events: page.map(({ ownerUid, ...event }) => ({
      eventType: "member" as const,
      ...event,
      ownerUid,
      myJoinRequestStatus: myJoinRequestStatus.get(event.id) ?? null,
      isVerifiedExplorerHost:
        hostStatuses.get(ownerUid)?.isVerifiedExplorer ?? false,
    })),
    nextOffset: hasMore ? query.offset + query.limit : null,
  });
});

router.get("/events/feed", requireUid, async (req, res) => {
  const uid = req.uid!;
  const viewerIsExplorer = await isVerifiedExplorer(uid);
  const now = new Date();
  const includeOngoing = req.query["includeOngoing"] === "true";
  // Match the existing four-hour default event window when no end time was set.
  const venueEventWindow = includeOngoing
    ? sql`COALESCE(${venueEventsTable.endsAt}, ${venueEventsTable.startsAt} + INTERVAL '4 hours') > ${now}`
    : gte(venueEventsTable.startsAt, now);
  const communityEventWindow = includeOngoing
    ? sql`COALESCE(${communityEventsTable.endsAt}, ${communityEventsTable.startsAt} + INTERVAL '4 hours') > ${now}`
    : gte(communityEventsTable.startsAt, now);
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
          venueEventWindow,
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
        creatorPhotoUrl: profilesTable.photoUrl,
      })
      .from(communityEventsTable)
      .leftJoin(profilesTable, eq(profilesTable.uid, communityEventsTable.ownerUid))
      .where(
        and(
          eq(communityEventsTable.isHidden, false),
          viewerIsExplorer ? undefined : eq(communityEventsTable.verifiedExplorersOnly, false),
          communityEventWindow,
          or(
            and(
              eq(communityEventsTable.visibility, "public"),
              eq(communityEventsTable.joinApprovalRequired, true),
            ),
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
  const hostStatuses = await getVerifiedExplorerStatuses(
    memberRows.map(({ event }) => event.ownerUid),
  );
  const [venueRsvps, memberRsvps, myMemberJoinRequests] = await Promise.all([
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
    memberIds.length
      ? db
          .select({
            eventId: communityEventJoinRequestsTable.eventId,
            status: communityEventJoinRequestsTable.status,
          })
          .from(communityEventJoinRequestsTable)
          .where(and(
            inArray(communityEventJoinRequestsTable.eventId, memberIds),
            eq(communityEventJoinRequestsTable.userUid, uid),
          ))
      : Promise.resolve([]),
  ]);

  const myVenueRsvp = new Map(venueRsvps.map((rsvp) => [rsvp.eventId, rsvp.status]));
  const memberRsvpCounts = new Map<number, number>();
  const myMemberRsvp = new Map<number, string>();
  const myMemberJoinRequest = new Map(
    myMemberJoinRequests.map((request) => [request.eventId, request.status]),
  );
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
      galleryPhotos: event.galleryPhotos,
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
      creatorPhotoUrl: null,
      latitude: latitude != null && Number.isFinite(Number(latitude)) ? Number(latitude) : null,
      longitude: longitude != null && Number.isFinite(Number(longitude)) ? Number(longitude) : null,
      visibility: event.visibility,
      rsvpCount: event.rsvpCount,
      myRsvp: myVenueRsvp.get(event.id) ?? null,
      isInvited: event.inviteeUids.includes(uid),
      joinApprovalRequired: false,
      myJoinRequestStatus: null,
      verifiedExplorersOnly: false,
      isVerifiedExplorerHost: false,
    })),
    ...memberRows.map(({ event, creatorName, creatorPhotoUrl }) => ({
      eventType: "member" as const,
      id: event.id,
      ownerUid: event.ownerUid,
      title: event.title,
      description: event.description,
      imageUrl: event.imageUrl,
      galleryPhotos: event.galleryPhotos,
      repeatFrequency: event.repeatFrequency,
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
      creatorPhotoUrl,
      latitude: event.locationLatitude,
      longitude: event.locationLongitude,
      visibility: event.visibility,
      rsvpCount: memberRsvpCounts.get(event.id) ?? 0,
      myRsvp: myMemberRsvp.get(event.id) ?? null,
      isInvited: event.inviteeUids.includes(uid),
      joinApprovalRequired: event.joinApprovalRequired,
      myJoinRequestStatus: myMemberJoinRequest.get(event.id) ?? null,
      verifiedExplorersOnly: event.verifiedExplorersOnly,
      isVerifiedExplorerHost:
        hostStatuses.get(event.ownerUid)?.isVerifiedExplorer ?? false,
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
  const hostIsExplorer = await isVerifiedExplorer(uid);
  const verifiedExplorersOnly = parsed.data.verifiedExplorersOnly === true;
  if (verifiedExplorersOnly && parsed.data.visibility !== "public") {
    res.status(400).json({ message: "Explorer-only plans must be public." });
    return;
  }
  if (verifiedExplorersOnly && !hostIsExplorer) {
    res.status(403).json({ message: "Verified Explorer status is required to host this plan." });
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
  const joinApprovalRequired = parsed.data.joinApprovalRequired === true;
  if (joinApprovalRequired && parsed.data.visibility !== "public") {
    res.status(400).json({ message: "Join requests require a public hangout plan." });
    return;
  }
  if (!joinApprovalRequired && parsed.data.visibility !== "invite_only") {
    res.status(400).json({
      message: "Plans are for invited friends. Public events are hosted by venues; use a Hangout for public meetups.",
    });
    return;
  }
  if (joinApprovalRequired && !parsed.data.location?.trim()) {
    res.status(400).json({ message: "Add a location for this hangout plan." });
    return;
  }
  if (joinApprovalRequired && (!hasPlaceId || !hasLatitude || !hasLongitude)) {
    res.status(400).json({ message: "Choose a place from the location search results." });
    return;
  }
  const galleryPhotos = validateGalleryPhotos(parsed.data.galleryPhotos, uid);
  if (!galleryPhotos) {
    res.status(400).json({ message: "Choose up to 10 photos uploaded to this account." });
    return;
  }
  const repeatFrequency = parsed.data.repeatFrequency ?? null;
  const recurrenceTimeZone = parsed.data.recurrenceTimeZone ?? "UTC";
  if (repeatFrequency && joinApprovalRequired) {
    res.status(400).json({ message: "Only private friend plans can repeat." });
    return;
  }
  if (!isValidTimeZone(recurrenceTimeZone)) {
    res.status(400).json({ message: "Choose a valid time zone." });
    return;
  }
  const imageUrl = galleryPhotos[0] ?? parsed.data.imageUrl ?? null;
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
      imageUrl,
      galleryPhotos,
      photosExpireAt: getEventPhotosExpireAt(
        times.startsAt,
        times.endsAt,
        Boolean(imageUrl || galleryPhotos.length),
      ),
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
      joinApprovalRequired,
      repeatFrequency: joinApprovalRequired ? null : repeatFrequency,
      recurrenceTimeZone,
      recurrenceDayOfMonth:
        !joinApprovalRequired && repeatFrequency === "monthly"
          ? dayOfMonthInTimeZone(times.startsAt, recurrenceTimeZone)
          : null,
      verifiedExplorersOnly,
      inviteeUids: parsed.data.visibility === "invite_only" ? inviteeUids : [],
      ...inviteLinkFields,
    })
    .returning();
  const [profile] = await db
    .select({
      displayName: profilesTable.displayName,
      photoUrl: profilesTable.photoUrl,
    })
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
    galleryPhotos: event.galleryPhotos,
    repeatFrequency: event.repeatFrequency,
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
    creatorPhotoUrl: profile?.photoUrl ?? null,
    latitude: event.locationLatitude,
    longitude: event.locationLongitude,
    visibility: event.visibility,
    rsvpCount: 0,
    myRsvp: null,
    joinApprovalRequired: event.joinApprovalRequired,
    myJoinRequestStatus: null,
    verifiedExplorersOnly: event.verifiedExplorersOnly,
    isVerifiedExplorerHost: hostIsExplorer,
    pendingJoinRequestCount: 0,
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

router.get(
  "/events/:eventType/:eventId/reviews",
  requireUid,
  async (req, res): Promise<void> => {
    const parsed = GetEventReviewsParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid event." });
      return;
    }
    const { eventType, eventId } = parsed.data;
    const uid = req.uid!;
    let canView = false;
    if (eventType === "member") {
      const [event] = await db
        .select()
        .from(communityEventsTable)
        .where(and(
          eq(communityEventsTable.id, eventId),
          eq(communityEventsTable.isHidden, false),
        ))
        .limit(1);
      if (!event) {
        res.status(404).json({ message: "Event not found." });
        return;
      }
      const [rsvp] = await db
        .select({ id: communityEventRsvpsTable.id })
        .from(communityEventRsvpsTable)
        .where(and(
          eq(communityEventRsvpsTable.eventId, eventId),
          eq(communityEventRsvpsTable.userUid, uid),
        ))
        .limit(1);
      canView =
        (event.visibility === "public" && event.joinApprovalRequired) ||
        event.ownerUid === uid ||
        event.inviteeUids.includes(uid) ||
        Boolean(rsvp);
      if (!canView) {
        res.status(404).json({ message: "Event not found." });
        return;
      }
    } else {
      const [row] = await db
        .select({
          event: venueEventsTable,
          isApproved: venueOwnerProfilesTable.isApproved,
          applicationStatus: venueOwnerProfilesTable.applicationStatus,
        })
        .from(venueEventsTable)
        .innerJoin(
          venueOwnerProfilesTable,
          eq(venueOwnerProfilesTable.placeId, venueEventsTable.placeId),
        )
        .where(and(
          eq(venueEventsTable.id, eventId),
          eq(venueEventsTable.isPublished, true),
          eq(venueEventsTable.isHidden, false),
          eq(venueOwnerProfilesTable.isApproved, true),
          eq(venueOwnerProfilesTable.applicationStatus, "approved"),
        ))
        .limit(1);
      if (!row) {
        res.status(404).json({ message: "Event not found." });
        return;
      }
      const [rsvp] = await db
        .select({ id: venueEventRsvpsTable.id })
        .from(venueEventRsvpsTable)
        .where(and(
          eq(venueEventRsvpsTable.eventId, eventId),
          eq(venueEventRsvpsTable.userUid, uid),
        ))
        .limit(1);
      canView =
        row.event.visibility === "public" ||
        row.event.ownerUid === uid ||
        row.event.inviteeUids.includes(uid) ||
        Boolean(rsvp);
      if (!canView) {
        res.status(404).json({ message: "Event not found." });
        return;
      }
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(await getEventReviewsPayload(eventType, eventId, uid));
  },
);

router.post(
  "/events/:eventType/:eventId/reviews",
  requireUid,
  eventWriteLimit,
  async (req, res): Promise<void> => {
    const params = CreateEventReviewParams.safeParse(req.params);
    const parsed = CreateEventReviewBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ message: "Choose a rating from 1 to 5." });
      return;
    }
    const { eventType, eventId } = params.data;
    const reviewerUid = req.uid!;
    const now = new Date();
    const reviewText = parsed.data.reviewText?.trim() || null;
    let eligible = false;

    if (eventType === "member") {
      const [event] = await db
        .select()
        .from(communityEventsTable)
        .where(and(
          eq(communityEventsTable.id, eventId),
          eq(communityEventsTable.isHidden, false),
        ))
        .limit(1);
      if (!event || event.ownerUid === reviewerUid) {
        res.status(404).json({ message: "Event not found." });
        return;
      }
      const eventEndsAt =
        event.endsAt ?? new Date(event.startsAt.getTime() + 4 * 60 * 60 * 1000);
      if (eventEndsAt > now) {
        res.status(409).json({ message: "This event has not ended yet." });
        return;
      }
      if (event.joinApprovalRequired) {
        const [accepted] = await db
          .select({ id: communityEventJoinRequestsTable.id })
          .from(communityEventJoinRequestsTable)
          .where(and(
            eq(communityEventJoinRequestsTable.eventId, eventId),
            eq(communityEventJoinRequestsTable.userUid, reviewerUid),
            eq(communityEventJoinRequestsTable.status, "accepted"),
          ))
          .limit(1);
        eligible = Boolean(accepted);
      } else {
        const [rsvp] = await db
          .select({ id: communityEventRsvpsTable.id })
          .from(communityEventRsvpsTable)
          .where(and(
            eq(communityEventRsvpsTable.eventId, eventId),
            eq(communityEventRsvpsTable.userUid, reviewerUid),
            inArray(communityEventRsvpsTable.status, ["going", "maybe"]),
          ))
          .limit(1);
        eligible = Boolean(rsvp);
      }
      if (!eligible) {
        res.status(403).json({ message: "Only guests who joined this event can review it." });
        return;
      }
      const [inserted] = await db
        .insert(communityEventHostRatingsTable)
        .values({ eventId, reviewerUid, rating: parsed.data.rating, reviewText })
        .onConflictDoNothing({
          target: [
            communityEventHostRatingsTable.eventId,
            communityEventHostRatingsTable.reviewerUid,
          ],
        })
        .returning({ id: communityEventHostRatingsTable.id });
      if (!inserted) {
        res.status(409).json({ message: "You have already reviewed this event." });
        return;
      }
    } else {
      const [event] = await db
        .select()
        .from(venueEventsTable)
        .where(and(
          eq(venueEventsTable.id, eventId),
          eq(venueEventsTable.isPublished, true),
          eq(venueEventsTable.isHidden, false),
        ))
        .limit(1);
      if (!event || event.ownerUid === reviewerUid) {
        res.status(404).json({ message: "Event not found." });
        return;
      }
      const eventEndsAt =
        event.endsAt ?? new Date(event.startsAt.getTime() + 4 * 60 * 60 * 1000);
      if (eventEndsAt > now) {
        res.status(409).json({ message: "This event has not ended yet." });
        return;
      }
      const [rsvp] = await db
        .select({ id: venueEventRsvpsTable.id })
        .from(venueEventRsvpsTable)
        .where(and(
          eq(venueEventRsvpsTable.eventId, eventId),
          eq(venueEventRsvpsTable.userUid, reviewerUid),
          inArray(venueEventRsvpsTable.status, ["going", "maybe"]),
        ))
        .limit(1);
      const [attendance] = await db
        .select({ id: eventAttendanceTable.id })
        .from(eventAttendanceTable)
        .where(and(
          eq(eventAttendanceTable.eventType, "venue"),
          eq(eventAttendanceTable.eventId, eventId),
          eq(eventAttendanceTable.userUid, reviewerUid),
        ))
        .limit(1);
      eligible = Boolean(rsvp || attendance);
      if (!eligible) {
        res.status(403).json({ message: "Only guests who joined this event can review it." });
        return;
      }
      const [inserted] = await db
        .insert(venueEventReviewsTable)
        .values({ eventId, reviewerUid, rating: parsed.data.rating, reviewText })
        .onConflictDoNothing({
          target: [
            venueEventReviewsTable.eventId,
            venueEventReviewsTable.reviewerUid,
          ],
        })
        .returning({ id: venueEventReviewsTable.id });
      if (!inserted) {
        res.status(409).json({ message: "You have already reviewed this event." });
        return;
      }
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(201).json(
      await getEventReviewsPayload(eventType, eventId, reviewerUid),
    );
  },
);

router.post(
  "/community-events/:eventId/host-rating",
  requireUid,
  eventWriteLimit,
  async (req, res): Promise<void> => {
    const reviewerUid = req.uid!;
    const eventId = getEventId(req.params.eventId);
    const parsed = RateCommunityEventHostBody.safeParse(req.body);
    if (!eventId || !parsed.success) {
      res.status(400).json({ message: "Choose a rating from 1 to 5." });
      return;
    }

    const [event] = await db
      .select({
        id: communityEventsTable.id,
        ownerUid: communityEventsTable.ownerUid,
        startsAt: communityEventsTable.startsAt,
        endsAt: communityEventsTable.endsAt,
        joinApprovalRequired: communityEventsTable.joinApprovalRequired,
        repeatFrequency: communityEventsTable.repeatFrequency,
      })
      .from(communityEventsTable)
      .where(and(
        eq(communityEventsTable.id, eventId),
        eq(communityEventsTable.isHidden, false),
      ))
      .limit(1);
    if (!event || event.ownerUid === reviewerUid) {
      res.status(404).json({ message: "Plan not found." });
      return;
    }

    if (event.repeatFrequency) {
      res.status(409).json({ message: "Ongoing recurring plans cannot be reviewed." });
      return;
    }
    const eventEnd = event.endsAt ??
      new Date(event.startsAt.getTime() + 4 * 60 * 60 * 1000);
    if (eventEnd.getTime() > Date.now()) {
      res.status(409).json({ message: "This plan has not ended yet." });
      return;
    }

    const eligibleGuest = event.joinApprovalRequired
      ? await db
          .select({ id: communityEventJoinRequestsTable.id })
          .from(communityEventJoinRequestsTable)
          .where(and(
            eq(communityEventJoinRequestsTable.eventId, eventId),
            eq(communityEventJoinRequestsTable.userUid, reviewerUid),
            eq(communityEventJoinRequestsTable.status, "accepted"),
          ))
          .limit(1)
      : await db
          .select({ id: communityEventRsvpsTable.id })
          .from(communityEventRsvpsTable)
          .where(and(
            eq(communityEventRsvpsTable.eventId, eventId),
            eq(communityEventRsvpsTable.userUid, reviewerUid),
            inArray(communityEventRsvpsTable.status, ["going", "maybe"]),
          ))
          .limit(1);
    if (eligibleGuest.length === 0) {
      res.status(403).json({ message: "Only guests who joined this plan can rate the host." });
      return;
    }

    const [inserted] = await db
      .insert(communityEventHostRatingsTable)
      .values({ eventId, reviewerUid, rating: parsed.data.rating })
      .onConflictDoNothing({
        target: [
          communityEventHostRatingsTable.eventId,
          communityEventHostRatingsTable.reviewerUid,
        ],
      })
      .returning({ id: communityEventHostRatingsTable.id });
    if (!inserted) {
      res.status(409).json({ message: "You have already rated this host for this event." });
      return;
    }

    const [summary] = await db
      .select({
        averageRating: sql<number | null>`AVG(${communityEventHostRatingsTable.rating})::float8`,
        reviewCount: count(),
      })
      .from(communityEventHostRatingsTable)
      .innerJoin(
        communityEventsTable,
        eq(communityEventsTable.id, communityEventHostRatingsTable.eventId),
      )
      .where(and(
        eq(communityEventsTable.ownerUid, event.ownerUid),
        eq(communityEventsTable.isHidden, false),
        sql`COALESCE(${communityEventsTable.endsAt}, ${communityEventsTable.startsAt}) <= NOW()`,
      ));
    res.json(RateCommunityEventHostResponse.parse({
      averageRating: summary?.averageRating == null
        ? null
        : Number(summary.averageRating),
      reviewCount: Number(summary?.reviewCount ?? 0),
      myRating: parsed.data.rating,
    }));
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
    const viewerIsExplorer = await isVerifiedExplorer(uid);
    const [row] = await db
      .select({
        event: communityEventsTable,
        creatorName: profilesTable.displayName,
        creatorPhotoUrl: profilesTable.photoUrl,
      })
      .from(communityEventsTable)
      .leftJoin(profilesTable, eq(profilesTable.uid, communityEventsTable.ownerUid))
      .where(
        and(
          eq(communityEventsTable.id, eventId),
          eq(communityEventsTable.isHidden, false),
          viewerIsExplorer ? undefined : eq(communityEventsTable.verifiedExplorersOnly, false),
          or(
            and(
              eq(communityEventsTable.visibility, "public"),
              eq(communityEventsTable.joinApprovalRequired, true),
            ),
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
    const [rsvps, myRsvp, myJoinRequest] = await Promise.all([
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
      db
        .select({ status: communityEventJoinRequestsTable.status })
        .from(communityEventJoinRequestsTable)
        .where(and(
          eq(communityEventJoinRequestsTable.eventId, event.id),
          eq(communityEventJoinRequestsTable.userUid, uid),
        ))
        .limit(1),
    ]);
    let meetingHostRating: {
      averageRating: number | null;
      reviewCount: number;
      myRating: number | null;
    } | null = null;
    {
      const [summary] = await db
        .select({
          averageRating: sql<number | null>`AVG(${communityEventHostRatingsTable.rating})::float8`,
          reviewCount: count(),
        })
        .from(communityEventHostRatingsTable)
        .innerJoin(
          communityEventsTable,
          eq(communityEventsTable.id, communityEventHostRatingsTable.eventId),
        )
        .where(and(
          eq(communityEventsTable.ownerUid, event.ownerUid),
          eq(communityEventsTable.isHidden, false),
          sql`COALESCE(${communityEventsTable.endsAt}, ${communityEventsTable.startsAt}) <= NOW()`,
        ));
      const currentEventEnded =
        (event.endsAt ?? event.startsAt).getTime() <= Date.now();
      const canRate = currentEventEnded &&
        event.ownerUid !== uid &&
        (event.joinApprovalRequired
          ? myJoinRequest[0]?.status === "accepted"
          : myRsvp[0]?.status === "going" || myRsvp[0]?.status === "maybe");
      const [myRating] =
        canRate
          ? await db
              .select({ rating: communityEventHostRatingsTable.rating })
              .from(communityEventHostRatingsTable)
              .where(and(
                eq(communityEventHostRatingsTable.eventId, event.id),
                eq(communityEventHostRatingsTable.reviewerUid, uid),
              ))
              .limit(1)
          : [];
      meetingHostRating = {
        averageRating: summary?.averageRating == null
          ? null
          : Number(summary.averageRating),
        reviewCount: Number(summary?.reviewCount ?? 0),
        myRating: myRating?.rating ?? null,
      };
    }
    let pendingJoinRequestCount: number | undefined;
    if (event.ownerUid === uid && event.joinApprovalRequired) {
      const [pendingCount] = await db
        .select({ value: count() })
        .from(communityEventJoinRequestsTable)
        .where(and(
          eq(communityEventJoinRequestsTable.eventId, event.id),
          eq(communityEventJoinRequestsTable.status, "pending"),
        ));
      pendingJoinRequestCount = Number(pendingCount?.value ?? 0);
    }
    res.json(
      GetEventDetailsResponse.parse({
        eventType: "member",
        id: event.id,
        ownerUid: event.ownerUid,
        title: event.title,
        description: event.description,
        imageUrl: event.imageUrl,
      galleryPhotos: event.galleryPhotos,
      repeatFrequency: event.repeatFrequency,
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
        creatorPhotoUrl: row.creatorPhotoUrl,
        latitude: event.locationLatitude,
        longitude: event.locationLongitude,
        visibility: event.visibility,
        rsvpCount: rsvps.length,
        myRsvp: myRsvp[0]?.status ?? null,
        isInvited: event.inviteeUids.includes(uid),
        joinApprovalRequired: event.joinApprovalRequired,
        verifiedExplorersOnly: event.verifiedExplorersOnly,
        isVerifiedExplorerHost: await isVerifiedExplorer(event.ownerUid),
        myJoinRequestStatus: myJoinRequest[0]?.status ?? null,
        pendingJoinRequestCount,
        meetingHostRating,
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
      creatorPhotoUrl: null,
      creatorName: null,
      latitude: row.latitude != null ? Number(row.latitude) : null,
      longitude: row.longitude != null ? Number(row.longitude) : null,
      visibility: row.event.visibility,
      rsvpCount: row.event.rsvpCount,
      myRsvp: myRsvp?.status ?? null,
      isInvited: row.event.inviteeUids.includes(uid),
      joinApprovalRequired: false,
      verifiedExplorersOnly: false,
      isVerifiedExplorerHost: false,
      myJoinRequestStatus: null,
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
          eq(communityEventsTable.verifiedExplorersOnly, false),
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
    if (
      event.verifiedExplorersOnly &&
      event.ownerUid !== uid &&
      !(await isVerifiedExplorer(uid))
    ) {
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
        joinApprovalRequired: event.joinApprovalRequired,
        verifiedExplorersOnly: event.verifiedExplorersOnly,
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
  "/community-events/my-past-meetings",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const now = new Date();
    const [memberRows, venueRows] = await Promise.all([
      db
        .select({
          id: communityEventsTable.id,
          ownerUid: communityEventsTable.ownerUid,
          title: communityEventsTable.title,
          startsAt: communityEventsTable.startsAt,
          endsAt: communityEventsTable.endsAt,
          location: communityEventsTable.location,
          joinApprovalRequired: communityEventsTable.joinApprovalRequired,
          hostName: profilesTable.displayName,
          myRating: communityEventHostRatingsTable.rating,
        })
        .from(communityEventsTable)
        .leftJoin(profilesTable, eq(profilesTable.uid, communityEventsTable.ownerUid))
        .leftJoin(
          communityEventHostRatingsTable,
          and(
            eq(communityEventHostRatingsTable.eventId, communityEventsTable.id),
            eq(communityEventHostRatingsTable.reviewerUid, uid),
          ),
        )
        .where(and(
          eq(communityEventsTable.isHidden, false),
          sql`COALESCE(${communityEventsTable.endsAt}, ${communityEventsTable.startsAt} + INTERVAL '4 hours') <= ${now}`,
          or(
            eq(communityEventsTable.ownerUid, uid),
            exists(
              db
                .select({ id: communityEventRsvpsTable.id })
                .from(communityEventRsvpsTable)
                .where(and(
                  eq(communityEventRsvpsTable.eventId, communityEventsTable.id),
                  eq(communityEventRsvpsTable.userUid, uid),
                  inArray(communityEventRsvpsTable.status, ["going", "maybe"]),
                )),
            ),
            exists(
              db
                .select({ id: communityEventJoinRequestsTable.id })
                .from(communityEventJoinRequestsTable)
                .where(and(
                  eq(communityEventJoinRequestsTable.eventId, communityEventsTable.id),
                  eq(communityEventJoinRequestsTable.userUid, uid),
                  eq(communityEventJoinRequestsTable.status, "accepted"),
                )),
            ),
            exists(
              db
                .select({ id: eventAttendanceTable.id })
                .from(eventAttendanceTable)
                .where(and(
                  eq(eventAttendanceTable.eventType, "member"),
                  eq(eventAttendanceTable.eventId, communityEventsTable.id),
                  eq(eventAttendanceTable.userUid, uid),
                )),
            ),
          ),
        )),
      db
        .select({
          id: venueEventsTable.id,
          ownerUid: venueEventsTable.ownerUid,
          title: venueEventsTable.title,
          startsAt: venueEventsTable.startsAt,
          endsAt: venueEventsTable.endsAt,
          location: venueOwnerProfilesTable.businessName,
          hostName: venueOwnerProfilesTable.businessName,
        })
        .from(venueEventsTable)
        .innerJoin(
          venueOwnerProfilesTable,
          eq(venueOwnerProfilesTable.placeId, venueEventsTable.placeId),
        )
        .where(and(
          eq(venueOwnerProfilesTable.isApproved, true),
          eq(venueOwnerProfilesTable.applicationStatus, "approved"),
          eq(venueEventsTable.isPublished, true),
          eq(venueEventsTable.isHidden, false),
          sql`COALESCE(${venueEventsTable.endsAt}, ${venueEventsTable.startsAt} + INTERVAL '4 hours') <= ${now}`,
          or(
            eq(venueEventsTable.ownerUid, uid),
            exists(
              db
                .select({ id: venueEventRsvpsTable.id })
                .from(venueEventRsvpsTable)
                .where(and(
                  eq(venueEventRsvpsTable.eventId, venueEventsTable.id),
                  eq(venueEventRsvpsTable.userUid, uid),
                  inArray(venueEventRsvpsTable.status, ["going", "maybe"]),
                )),
            ),
            exists(
              db
                .select({ id: eventAttendanceTable.id })
                .from(eventAttendanceTable)
                .where(and(
                  eq(eventAttendanceTable.eventType, "venue"),
                  eq(eventAttendanceTable.eventId, venueEventsTable.id),
                  eq(eventAttendanceTable.userUid, uid),
                )),
            ),
          ),
        )),
    ]);

    const meetings = [
      ...memberRows.map((event) => ({
        type: event.joinApprovalRequired ? "hangout" as const : "plan" as const,
        eventType: "member" as const,
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt ?? null,
        location: event.location ?? null,
        hostName: event.hostName ?? null,
        isHost: event.ownerUid === uid,
        myRating: event.myRating ?? null,
      })),
      ...venueRows.map((event) => ({
        type: "event" as const,
        eventType: "venue" as const,
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt ?? null,
        location: event.location ?? null,
        hostName: event.hostName ?? null,
        isHost: event.ownerUid === uid,
        myRating: null,
      })),
    ].sort((a, b) =>
      b.startsAt.getTime() - a.startsAt.getTime() || b.id - a.id,
    );

    res.setHeader("Cache-Control", "no-store");
    res.json(GetMyPastMeetingsResponse.parse({
      meetings: meetings.map((meeting) => ({
        ...meeting,
        startsAt: meeting.startsAt.toISOString(),
        endsAt: meeting.endsAt?.toISOString() ?? null,
      })),
    }));
  },
);

router.get(
  "/community-events/my-past-hangouts",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const viewerIsExplorer = await isVerifiedExplorer(uid);
    const rows = await db
      .select({
        id: communityEventsTable.id,
        title: communityEventsTable.title,
        startsAt: communityEventsTable.startsAt,
        endsAt: communityEventsTable.endsAt,
        location: communityEventsTable.location,
        creatorName: profilesTable.displayName,
        myRating: communityEventHostRatingsTable.rating,
      })
      .from(communityEventsTable)
      .innerJoin(
        communityEventJoinRequestsTable,
        and(
          eq(communityEventJoinRequestsTable.eventId, communityEventsTable.id),
          eq(communityEventJoinRequestsTable.userUid, uid),
          eq(communityEventJoinRequestsTable.status, "accepted"),
        ),
      )
      .leftJoin(
        profilesTable,
        eq(profilesTable.uid, communityEventsTable.ownerUid),
      )
      .leftJoin(
        communityEventHostRatingsTable,
        and(
          eq(communityEventHostRatingsTable.eventId, communityEventsTable.id),
          eq(communityEventHostRatingsTable.reviewerUid, uid),
        ),
      )
      .where(and(
        eq(communityEventsTable.joinApprovalRequired, true),
        eq(communityEventsTable.isHidden, false),
        ne(communityEventsTable.ownerUid, uid),
        viewerIsExplorer
          ? undefined
          : eq(communityEventsTable.verifiedExplorersOnly, false),
        sql`COALESCE(${communityEventsTable.endsAt}, ${communityEventsTable.startsAt}) <= NOW()`,
      ))
      .orderBy(
        desc(sql`COALESCE(${communityEventsTable.endsAt}, ${communityEventsTable.startsAt})`),
        desc(communityEventsTable.id),
      );

    res.setHeader("Cache-Control", "no-store");
    res.json(GetMyPastHangoutsResponse.parse({
      events: rows.map((event) => ({
        ...event,
        endsAt: event.endsAt ?? null,
        location: event.location ?? null,
        creatorName: event.creatorName ?? null,
        myRating: event.myRating ?? null,
      })),
    }));
  },
);

router.get(
  "/community-events/hosts/:hostUid/past-hangouts",
  requireUid,
  async (req, res): Promise<void> => {
    const parsed = GetHostPastHangoutsParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid host." });
      return;
    }
    const hostUid = parsed.data.hostUid;
    const [profile] = await db
      .select({ uid: profilesTable.uid })
      .from(profilesTable)
      .where(eq(profilesTable.uid, hostUid))
      .limit(1);
    if (!profile) {
      res.status(404).json({ message: "Host profile not found." });
      return;
    }
    const eventRows = await db
      .select({
        id: communityEventsTable.id,
        title: communityEventsTable.title,
        startsAt: communityEventsTable.startsAt,
        endsAt: communityEventsTable.endsAt,
        imageUrl: communityEventsTable.imageUrl,
        galleryPhotos: communityEventsTable.galleryPhotos,
      })
      .from(communityEventsTable)
      .where(and(
        eq(communityEventsTable.ownerUid, hostUid),
        eq(communityEventsTable.joinApprovalRequired, true),
        eq(communityEventsTable.visibility, "public"),
        eq(communityEventsTable.isHidden, false),
        sql`COALESCE(${communityEventsTable.endsAt}, ${communityEventsTable.startsAt} + INTERVAL '4 hours') <= NOW()`,
      ))
      .orderBy(
        desc(sql`COALESCE(${communityEventsTable.endsAt}, ${communityEventsTable.startsAt})`),
        desc(communityEventsTable.id),
      )
      .limit(50);

    const eventIds = eventRows.map((event) => event.id);
    const [reviews, summaries] = eventIds.length
      ? await Promise.all([
          db
            .select({
              eventId: communityEventHostRatingsTable.eventId,
              rating: communityEventHostRatingsTable.rating,
              reviewText: communityEventHostRatingsTable.reviewText,
              reviewerName: profilesTable.displayName,
              reviewerPhotoUrl: profilesTable.photoUrl,
              createdAt: communityEventHostRatingsTable.createdAt,
            })
            .from(communityEventHostRatingsTable)
            .leftJoin(
              profilesTable,
              eq(profilesTable.uid, communityEventHostRatingsTable.reviewerUid),
            )
            .where(inArray(communityEventHostRatingsTable.eventId, eventIds))
            .orderBy(desc(communityEventHostRatingsTable.createdAt))
            .limit(2_000),
          db
            .select({
              eventId: communityEventHostRatingsTable.eventId,
              averageRating: sql<number | null>`AVG(${communityEventHostRatingsTable.rating})::float8`,
              reviewCount: count(),
            })
            .from(communityEventHostRatingsTable)
            .where(inArray(communityEventHostRatingsTable.eventId, eventIds))
            .groupBy(communityEventHostRatingsTable.eventId),
        ])
      : [[], []];
    const reviewsByEvent = new Map<number, ReviewRecord[]>();
    for (const review of reviews) {
      const group = reviewsByEvent.get(review.eventId) ?? [];
      if (group.length < 100) {
        group.push({
          rating: review.rating,
          reviewText: review.reviewText,
          reviewerName: review.reviewerName || "Met member",
          reviewerPhotoUrl: review.reviewerPhotoUrl ?? null,
          createdAt: review.createdAt,
        });
        reviewsByEvent.set(review.eventId, group);
      }
    }
    const summaryByEvent = new Map(summaries.map((summary) => [
      summary.eventId,
      {
        averageRating: summary.averageRating == null
          ? null
          : Number(summary.averageRating),
        reviewCount: Number(summary.reviewCount),
      },
    ]));
    res.setHeader("Cache-Control", "no-store");
    res.json(GetHostPastHangoutsResponse.parse({
      events: eventRows.map((event) => {
        const summary = summaryByEvent.get(event.id);
        return {
          ...event,
          endsAt: event.endsAt ?? null,
          galleryPhotos: event.galleryPhotos ?? [],
          averageRating: summary?.averageRating ?? null,
          reviewCount: summary?.reviewCount ?? 0,
          reviews: (reviewsByEvent.get(event.id) ?? []).map((review) => ({
            ...review,
            createdAt: review.createdAt.toISOString(),
          })),
        };
      }),
    }));
  },
);

router.get(
  "/community-events/my-plan-chats",
  requireUid,
  async (req, res): Promise<void> => {
    const uid = req.uid!;
    const viewerIsExplorer = await isVerifiedExplorer(uid);
    const candidateEvents = await db
      .select({
        id: communityEventsTable.id,
        ownerUid: communityEventsTable.ownerUid,
        title: communityEventsTable.title,
        joinApprovalRequired: communityEventsTable.joinApprovalRequired,
        verifiedExplorersOnly: communityEventsTable.verifiedExplorersOnly,
        inviteeUids: communityEventsTable.inviteeUids,
      })
      .from(communityEventsTable)
      .where(and(
        eq(communityEventsTable.isHidden, false),
        viewerIsExplorer ? undefined : eq(communityEventsTable.verifiedExplorersOnly, false),
        or(
          eq(communityEventsTable.ownerUid, uid),
          arrayContains(communityEventsTable.inviteeUids, [uid]),
          exists(
            db
              .select({ id: communityEventRsvpsTable.id })
              .from(communityEventRsvpsTable)
              .where(and(
                eq(communityEventRsvpsTable.eventId, communityEventsTable.id),
                eq(communityEventRsvpsTable.userUid, uid),
              )),
          ),
        ),
      ))
      .orderBy(desc(communityEventsTable.startsAt), desc(communityEventsTable.id));

    const eventIds = candidateEvents.map((event) => event.id);
    if (!eventIds.length) {
      res.setHeader("Cache-Control", "no-store");
      res.json(GetMyCommunityEventPlanChatsResponse.parse({ conversations: [] }));
      return;
    }

    const myRsvps = await db
      .select({
        eventId: communityEventRsvpsTable.eventId,
        status: communityEventRsvpsTable.status,
      })
      .from(communityEventRsvpsTable)
      .where(and(
        inArray(communityEventRsvpsTable.eventId, eventIds),
        eq(communityEventRsvpsTable.userUid, uid),
      ));
    const rsvpByEventId = new Map(myRsvps.map((rsvp) => [rsvp.eventId, rsvp.status]));
    const accessibleEventIds = candidateEvents
      .filter((event) => {
        if (event.ownerUid === uid) return true;
        const rsvpStatus = rsvpByEventId.get(event.id);
        if (rsvpStatus) return rsvpStatus === "going" || rsvpStatus === "maybe";
        return event.inviteeUids.includes(uid);
      })
      .map((event) => event.id);

    if (!accessibleEventIds.length) {
      res.setHeader("Cache-Control", "no-store");
      res.json(GetMyCommunityEventPlanChatsResponse.parse({ conversations: [] }));
      return;
    }

    const latestMessageId = db
      .select({ id: communityEventPlanMessagesTable.id })
      .from(communityEventPlanMessagesTable)
      .where(and(
        eq(communityEventPlanMessagesTable.eventId, communityEventsTable.id),
        or(
          isNull(communityEventPlanMessagesTable.mediaExpiresAt),
          gt(communityEventPlanMessagesTable.mediaExpiresAt, new Date()),
        ),
      ))
      .orderBy(
        desc(communityEventPlanMessagesTable.createdAt),
        desc(communityEventPlanMessagesTable.id),
      )
      .limit(1);
    const [rows, incomingRows] = await Promise.all([
      db
        .select({
          eventId: communityEventsTable.id,
          eventTitle: communityEventsTable.title,
          joinApprovalRequired: communityEventsTable.joinApprovalRequired,
          lastMessageId: communityEventPlanMessagesTable.id,
          lastMessageText: communityEventPlanMessagesTable.message,
          senderUid: communityEventPlanMessagesTable.senderUid,
          senderName: profilesTable.displayName,
          mediaType: communityEventPlanMessagesTable.mediaType,
          createdAt: communityEventPlanMessagesTable.createdAt,
          lastReadMessageId: communityEventPlanNotificationPreferencesTable.lastReadMessageId,
        })
        .from(communityEventsTable)
        .innerJoin(
          communityEventPlanMessagesTable,
          eq(communityEventPlanMessagesTable.id, latestMessageId),
        )
        .leftJoin(
          profilesTable,
          eq(profilesTable.uid, communityEventPlanMessagesTable.senderUid),
        )
        .leftJoin(
          communityEventPlanNotificationPreferencesTable,
          and(
            eq(communityEventPlanNotificationPreferencesTable.eventId, communityEventsTable.id),
            eq(communityEventPlanNotificationPreferencesTable.userUid, uid),
          ),
        )
        .where(inArray(communityEventsTable.id, accessibleEventIds))
        .orderBy(
          desc(communityEventPlanMessagesTable.createdAt),
          desc(communityEventPlanMessagesTable.id),
        ),
      db
        .select({
          eventId: communityEventPlanMessagesTable.eventId,
          lastIncomingMessageId: sql<number>`max(${communityEventPlanMessagesTable.id})`,
        })
        .from(communityEventPlanMessagesTable)
        .where(and(
          inArray(communityEventPlanMessagesTable.eventId, accessibleEventIds),
          ne(communityEventPlanMessagesTable.senderUid, uid),
          or(
            isNull(communityEventPlanMessagesTable.mediaExpiresAt),
            gt(communityEventPlanMessagesTable.mediaExpiresAt, new Date()),
          ),
        ))
        .groupBy(communityEventPlanMessagesTable.eventId),
    ]);
    const incomingMessageIdByEventId = new Map(
      incomingRows.map((row) => [row.eventId, row.lastIncomingMessageId]),
    );

    res.setHeader("Cache-Control", "no-store");
    res.json(
      GetMyCommunityEventPlanChatsResponse.parse({
        conversations: rows.map((row) => ({
          eventId: row.eventId,
          eventTitle: row.eventTitle,
          eventType: row.joinApprovalRequired ? "hangout" : "plan",
          lastMessageText: row.lastMessageText,
          senderUid: row.senderUid,
          senderName: row.senderName || "Met member",
          mediaType: row.mediaType === "image" || row.mediaType === "voice"
            ? row.mediaType
            : null,
          createdAt: row.createdAt.toISOString(),
          isUnread: (incomingMessageIdByEventId.get(row.eventId) ?? 0) >
            (row.lastReadMessageId ?? 0),
        })),
      }),
    );
  },
);

router.put(
  "/community-events/:eventId/plan-chat/read",
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

    const [latestMessage] = await db
      .select({ id: communityEventPlanMessagesTable.id })
      .from(communityEventPlanMessagesTable)
      .where(and(
        eq(communityEventPlanMessagesTable.eventId, eventId),
        or(
          isNull(communityEventPlanMessagesTable.mediaExpiresAt),
          gt(communityEventPlanMessagesTable.mediaExpiresAt, new Date()),
        ),
      ))
      .orderBy(desc(communityEventPlanMessagesTable.id))
      .limit(1);
    const readThroughMessageId = latestMessage?.id ?? null;
    const now = new Date();
    await db
      .insert(communityEventPlanNotificationPreferencesTable)
      .values({
        eventId,
        userUid: req.uid!,
        lastReadMessageId: readThroughMessageId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          communityEventPlanNotificationPreferencesTable.eventId,
          communityEventPlanNotificationPreferencesTable.userUid,
        ],
        set: {
          lastReadMessageId: sql`GREATEST(COALESCE(${communityEventPlanNotificationPreferencesTable.lastReadMessageId}, 0), COALESCE(excluded.last_read_message_id, 0))`,
          updatedAt: now,
        },
      });

    res.json(
      MarkCommunityEventPlanChatReadResponse.parse({
        readThroughMessageId,
      }),
    );
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
          mediaType: communityEventPlanMessagesTable.mediaType,
          mediaObjectPath: communityEventPlanMessagesTable.mediaObjectPath,
          audioDurationMs: communityEventPlanMessagesTable.audioDurationMs,
          mediaExpiresAt: communityEventPlanMessagesTable.mediaExpiresAt,
          createdAt: communityEventPlanMessagesTable.createdAt,
        })
        .from(communityEventPlanMessagesTable)
        .leftJoin(
          profilesTable,
          eq(profilesTable.uid, communityEventPlanMessagesTable.senderUid),
        )
        .where(and(
          eq(communityEventPlanMessagesTable.eventId, eventId),
          or(
            isNull(communityEventPlanMessagesTable.mediaExpiresAt),
            gt(communityEventPlanMessagesTable.mediaExpiresAt, new Date()),
          ),
        ))
        .orderBy(
          desc(communityEventPlanMessagesTable.createdAt),
          desc(communityEventPlanMessagesTable.id),
        )
        .limit(100),
      db
        .select({
          muted: communityEventPlanNotificationPreferencesTable.muted,
          lastReadMessageId: communityEventPlanNotificationPreferencesTable.lastReadMessageId,
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
    const readThroughMessageId =
      notificationPreference[0]?.lastReadMessageId ?? null;
    let firstUnreadMessage:
      | (typeof messages)[number]
      | undefined;
    const oldestLoadedMessageId = messages[messages.length - 1]?.id;
    if (
      oldestLoadedMessageId !== undefined &&
      (readThroughMessageId ?? 0) < oldestLoadedMessageId
    ) {
      const [firstUnread] = await db
        .select({
          id: communityEventPlanMessagesTable.id,
          senderUid: communityEventPlanMessagesTable.senderUid,
          senderName: profilesTable.displayName,
          senderPhotoUrl: profilesTable.photoUrl,
          text: communityEventPlanMessagesTable.message,
          mediaType: communityEventPlanMessagesTable.mediaType,
          mediaObjectPath: communityEventPlanMessagesTable.mediaObjectPath,
          audioDurationMs: communityEventPlanMessagesTable.audioDurationMs,
          mediaExpiresAt: communityEventPlanMessagesTable.mediaExpiresAt,
          createdAt: communityEventPlanMessagesTable.createdAt,
        })
        .from(communityEventPlanMessagesTable)
        .leftJoin(
          profilesTable,
          eq(profilesTable.uid, communityEventPlanMessagesTable.senderUid),
        )
        .where(and(
          eq(communityEventPlanMessagesTable.eventId, eventId),
          ne(communityEventPlanMessagesTable.senderUid, req.uid!),
          gt(communityEventPlanMessagesTable.id, readThroughMessageId ?? 0),
          or(
            isNull(communityEventPlanMessagesTable.mediaExpiresAt),
            gt(communityEventPlanMessagesTable.mediaExpiresAt, new Date()),
          ),
        ))
        .orderBy(
          communityEventPlanMessagesTable.createdAt,
          communityEventPlanMessagesTable.id,
        )
        .limit(1);
      firstUnreadMessage = firstUnread;
    }
    const chatMessages = firstUnreadMessage &&
      !messages.some((message) => message.id === firstUnreadMessage.id)
      ? [...messages, firstUnreadMessage]
      : messages;
    const orderedMessages = chatMessages.slice().sort(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() ||
        right.id - left.id,
    );
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
          joinApprovalRequired: context.event.joinApprovalRequired,
        },
        participants,
        notificationsMuted: notificationPreference[0]?.muted ?? false,
        readThroughMessageId,
        messages: await Promise.all(orderedMessages.reverse().map(async (message) => {
          let mediaUrl: string | null = null;
          if (message.mediaObjectPath && message.mediaType) {
            try {
              const [url] = await adminStorage()
                .bucket()
                .file(message.mediaObjectPath)
                .getSignedUrl({
                  action: "read",
                  expires: Date.now() + planChatReadUrlTtlMs,
                });
              mediaUrl = url;
            } catch (error) {
              req.log?.warn(
                { error, eventId, messageId: message.id },
                "Could not create event-plan media read URL",
              );
            }
          }
          return {
            id: message.id,
            senderUid: message.senderUid,
            senderName: message.senderName || "Met member",
            senderPhotoUrl: message.senderPhotoUrl ?? null,
            text: message.text,
            createdAt: message.createdAt.toISOString(),
            mediaType: message.mediaType === "image" || message.mediaType === "voice"
              ? message.mediaType
              : null,
            mediaUrl,
            audioDurationMs: message.audioDurationMs ?? null,
            mediaExpiresAt: message.mediaExpiresAt?.toISOString() ?? null,
          };
        })),
      }),
    );
  },
);

router.post(
  "/community-events/:eventId/plan-chat/media-upload",
  requireUid,
  eventPlanMessageLimit,
  async (req, res): Promise<void> => {
    const eventId = getEventId(req.params.eventId);
    if (!eventId) {
      res.status(400).json({ message: "Invalid event id." });
      return;
    }
    const parsed = CreateCommunityEventPlanChatMediaUploadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid event-chat media type." });
      return;
    }
    if (!isPlanChatContentTypeAllowed(parsed.data.mediaType, parsed.data.contentType)) {
      res.status(400).json({ message: "That file type is not supported." });
      return;
    }
    const context = await getCommunityEventPlanChatContext(eventId, req.uid!);
    if (!context) {
      res.status(404).json({ message: "Plan conversation not found." });
      return;
    }

    const mediaObjectPath =
      `community-event-plan-media/${eventId}/${req.uid!}/${randomUUID()}`;
    const expiresAt = new Date(Date.now() + planChatUploadUrlTtlMs);
    const maxBytes = planChatMediaMaxBytes[parsed.data.mediaType];
    try {
      const [policy] = await adminStorage()
        .bucket()
        .file(mediaObjectPath)
        .generateSignedPostPolicyV4({
          expires: expiresAt,
          fields: {
            key: mediaObjectPath,
            "Content-Type": parsed.data.contentType,
          },
          conditions: [
            // GCS requires numeric bounds in its signed POST policy.
            ["content-length-range", 1, maxBytes],
            ["eq", "$Content-Type", parsed.data.contentType],
          ],
        });
      await db.insert(communityEventPlanMediaUploadsTable).values({
        objectPath: mediaObjectPath,
        eventId,
        ownerUid: req.uid!,
        mediaType: parsed.data.mediaType,
        contentType: parsed.data.contentType,
        maxBytes,
        expiresAt,
      });

      res.setHeader("Cache-Control", "no-store");
      res.json(CreateCommunityEventPlanChatMediaUploadResponse.parse({
        uploadUrl: policy.url,
        uploadFields: policy.fields,
        mediaObjectPath,
        expiresAt: expiresAt.toISOString(),
        maxBytes,
      }));
    } catch (error) {
      req.log?.error({ error, eventId }, "Could not create event-chat media upload URL");
      res.status(503).json({ message: "Media upload is temporarily unavailable." });
    }
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
    const rawText = typeof req.body?.text === "string"
      ? req.body.text.trim()
      : req.body?.text;
    const parsed = SendCommunityEventPlanChatMessageBody.safeParse({
      ...req.body,
      text: rawText,
    });
    if (!parsed.success) {
      res.status(400).json({ message: "Enter a message up to 500 characters." });
      return;
    }
    const text = parsed.data.text ?? "";
    const mediaType = parsed.data.mediaType ?? null;
    const mediaObjectPath = parsed.data.mediaObjectPath ?? null;
    const audioDurationMs = parsed.data.audioDurationMs ?? null;
    if (
      (!text && !mediaType) ||
      Boolean(mediaType) !== Boolean(mediaObjectPath) ||
      (mediaType === "voice" && audioDurationMs == null) ||
      (mediaType !== "voice" && audioDurationMs != null)
    ) {
      res.status(400).json({ message: "Add text or one supported attachment." });
      return;
    }
    const context = await getCommunityEventPlanChatContext(eventId, req.uid!);
    if (!context) {
      res.status(404).json({ message: "Plan conversation not found." });
      return;
    }

    let mediaExpiresAt: Date | null = null;
    if (mediaType && mediaObjectPath) {
      const [reservation] = await db
        .select()
        .from(communityEventPlanMediaUploadsTable)
        .where(and(
          eq(communityEventPlanMediaUploadsTable.objectPath, mediaObjectPath),
          eq(communityEventPlanMediaUploadsTable.eventId, eventId),
          eq(communityEventPlanMediaUploadsTable.ownerUid, req.uid!),
          eq(communityEventPlanMediaUploadsTable.mediaType, mediaType),
          gt(communityEventPlanMediaUploadsTable.expiresAt, new Date()),
        ))
        .limit(1);
      if (!reservation) {
        res.status(400).json({ message: "The attachment is not available." });
        return;
      }
      try {
        const [metadata] = await adminStorage()
          .bucket()
          .file(mediaObjectPath)
          .getMetadata();
        const fileSize = Number(metadata.size);
        const maxBytes = reservation.maxBytes;
        const actualContentType = metadata.contentType ?? "";
        if (
          !Number.isFinite(fileSize) ||
          fileSize < 1 ||
          fileSize > maxBytes ||
          actualContentType !== reservation.contentType ||
          !isPlanChatContentTypeAllowed(mediaType, actualContentType)
        ) {
          res.status(400).json({ message: "The uploaded attachment is invalid." });
          return;
        }
      } catch {
        res.status(400).json({ message: "Upload the attachment before sending." });
        return;
      }
      mediaExpiresAt = new Date(Date.now() + planChatMediaTtlMs);
    }

    const [message] = await db
      .insert(communityEventPlanMessagesTable)
      .values({
        eventId,
        senderUid: req.uid!,
        message: text,
        mediaType,
        mediaObjectPath,
        audioDurationMs,
        mediaExpiresAt,
      })
      .returning();
    if (mediaObjectPath) {
      await db
        .delete(communityEventPlanMediaUploadsTable)
        .where(eq(communityEventPlanMediaUploadsTable.objectPath, mediaObjectPath));
    }
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
      isHangout: context.event.joinApprovalRequired,
    });

    let mediaUrl: string | null = null;
    if (mediaObjectPath) {
      try {
        const [url] = await adminStorage()
          .bucket()
          .file(mediaObjectPath)
          .getSignedUrl({
            action: "read",
            expires: Date.now() + planChatReadUrlTtlMs,
          });
        mediaUrl = url;
      } catch (error) {
        req.log?.warn(
          { error, eventId, messageId: message.id },
          "Could not create event-plan media read URL",
        );
      }
    }

    res.status(201).json(
      SendCommunityEventPlanChatMessageResponse.parse({
        message: {
          id: message.id,
          senderUid: message.senderUid,
          senderName: sender?.displayName || "Met member",
          senderPhotoUrl: sender?.photoUrl ?? null,
          text: message.message,
          createdAt: message.createdAt.toISOString(),
          mediaType,
          mediaUrl,
          audioDurationMs,
          mediaExpiresAt: mediaExpiresAt?.toISOString() ?? null,
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
    const nextVerifiedExplorersOnly = parsed.data.verifiedExplorersOnly === true;
    if (nextVerifiedExplorersOnly && parsed.data.visibility !== "public") {
      res.status(400).json({ message: "Explorer-only plans must be public." });
      return;
    }
    if (
      nextVerifiedExplorersOnly &&
      !existing.verifiedExplorersOnly &&
      !(await isVerifiedExplorer(uid))
    ) {
      res.status(403).json({ message: "Verified Explorer status is required to host this plan." });
      return;
    }
    if (existing.joinApprovalRequired && parsed.data.visibility !== "public") {
      res.status(400).json({ message: "Hangout plans must remain public." });
      return;
    }
    if (!existing.joinApprovalRequired && parsed.data.visibility !== "invite_only") {
      res.status(400).json({
        message: "Plans are for invited friends. Public events are hosted by venues; use a Hangout for public meetups.",
      });
      return;
    }
    const nextLocation = parsed.data.location?.trim() || null;
    const nextLocationPlaceId = parsed.data.locationPlaceId ?? null;
    const nextLatitude = parsed.data.latitude ?? null;
    const nextLongitude = parsed.data.longitude ?? null;
    const hangoutLocationChanged =
      nextLocation !== existing.location ||
      nextLocationPlaceId !== existing.locationPlaceId ||
      nextLatitude !== existing.locationLatitude ||
      nextLongitude !== existing.locationLongitude;
    if (
      existing.joinApprovalRequired &&
      hangoutLocationChanged &&
      (!nextLocationPlaceId || nextLatitude == null || nextLongitude == null)
    ) {
      res.status(400).json({ message: "Choose a place from the location search results." });
      return;
    }
    const nextGalleryPhotos = validateGalleryPhotos(
      parsed.data.galleryPhotos,
      uid,
      existing.galleryPhotos ?? [],
    );
    if (!nextGalleryPhotos) {
      res.status(400).json({ message: "Choose up to 10 photos uploaded to this account." });
      return;
    }
    const nextImageUrl = nextGalleryPhotos[0] ?? parsed.data.imageUrl ?? null;
    const nextRepeatFrequency = existing.joinApprovalRequired
      ? null
      : parsed.data.repeatFrequency ?? existing.repeatFrequency;
    const nextRecurrenceTimeZone =
      parsed.data.recurrenceTimeZone ?? existing.recurrenceTimeZone;
    if (!isValidTimeZone(nextRecurrenceTimeZone)) {
      res.status(400).json({ message: "Choose a valid time zone." });
      return;
    }
    const nextRecurrenceDayOfMonth = nextRepeatFrequency === "monthly"
      ? existing.repeatFrequency === "monthly" && existing.recurrenceDayOfMonth != null
        ? existing.recurrenceDayOfMonth
        : dayOfMonthInTimeZone(times.startsAt, nextRecurrenceTimeZone)
      : null;
    const hasChanges =
      parsed.data.title !== existing.title ||
      (parsed.data.description ?? null) !== existing.description ||
      nextImageUrl !== existing.imageUrl ||
      JSON.stringify(nextGalleryPhotos) !== JSON.stringify(existing.galleryPhotos ?? []) ||
      nextRepeatFrequency !== existing.repeatFrequency ||
      nextRecurrenceTimeZone !== existing.recurrenceTimeZone ||
      nextRecurrenceDayOfMonth !== existing.recurrenceDayOfMonth ||
      (parsed.data.contactPhone?.trim() || null) !== existing.contactPhone ||
      (parsed.data.websiteUrl?.trim() || null) !== existing.websiteUrl ||
      (parsed.data.publicEmail?.trim() || null) !== existing.publicEmail ||
      times.startsAt.getTime() !== existing.startsAt.getTime() ||
      (times.endsAt?.getTime() ?? null) !== (existing.endsAt?.getTime() ?? null) ||
      nextLocation !== existing.location ||
      nextLocationPlaceId !== existing.locationPlaceId ||
      nextLatitude !== existing.locationLatitude ||
      nextLongitude !== existing.locationLongitude ||
      parsed.data.visibility !== existing.visibility ||
      nextVerifiedExplorersOnly !== existing.verifiedExplorersOnly;
    const acceptedGuestUids =
      existing.joinApprovalRequired && hasChanges
        ? (
            await db
              .select({ userUid: communityEventJoinRequestsTable.userUid })
              .from(communityEventJoinRequestsTable)
              .where(and(
                eq(communityEventJoinRequestsTable.eventId, eventId),
                eq(communityEventJoinRequestsTable.status, "accepted"),
              ))
          ).map(({ userUid }) => userUid)
        : [];
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
        imageUrl: nextImageUrl,
        galleryPhotos: nextGalleryPhotos,
        photosExpireAt: getEventPhotosExpireAt(
          times.startsAt,
          times.endsAt,
          Boolean(nextImageUrl || nextGalleryPhotos.length),
        ),
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
        repeatFrequency: nextRepeatFrequency,
        recurrenceTimeZone: nextRecurrenceTimeZone,
        recurrenceDayOfMonth: nextRecurrenceDayOfMonth,
        verifiedExplorersOnly: nextVerifiedExplorersOnly,
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
    if (acceptedGuestUids.length > 0) {
      await notifyCommunityEventChange({
        eventId,
        recipientUids: acceptedGuestUids,
        type: "hangout_updated",
      });
    }
    const [profile, rsvps, myRsvp] = await Promise.all([
      db
        .select({
          displayName: profilesTable.displayName,
          photoUrl: profilesTable.photoUrl,
        })
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
        galleryPhotos: event.galleryPhotos,
        repeatFrequency: event.repeatFrequency,
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
        creatorPhotoUrl: profile[0]?.photoUrl ?? null,
        latitude: event.locationLatitude,
        longitude: event.locationLongitude,
        visibility: event.visibility,
        verifiedExplorersOnly: event.verifiedExplorersOnly,
        isVerifiedExplorerHost: await isVerifiedExplorer(event.ownerUid),
        rsvpCount: rsvps.length,
        myRsvp: myRsvp[0]?.status ?? null,
        joinApprovalRequired: event.joinApprovalRequired,
        myJoinRequestStatus: null,
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
        .select({
          id: communityEventsTable.id,
          joinApprovalRequired: communityEventsTable.joinApprovalRequired,
        })
        .from(communityEventsTable)
        .where(
          and(
            eq(communityEventsTable.id, eventId),
            eq(communityEventsTable.ownerUid, uid),
            eq(communityEventsTable.isHidden, false),
          ),
        )
        .limit(1);
      if (!event) return null;
      const acceptedGuestUids = event.joinApprovalRequired
        ? (
            await tx
              .select({ userUid: communityEventJoinRequestsTable.userUid })
              .from(communityEventJoinRequestsTable)
              .where(and(
                eq(communityEventJoinRequestsTable.eventId, eventId),
                eq(communityEventJoinRequestsTable.status, "accepted"),
              ))
          ).map(({ userUid }) => userUid)
        : [];
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
      return removed ? acceptedGuestUids : null;
    });
    if (!deleted) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    if (deleted.length > 0) {
      await notifyCommunityEventChange({
        eventId,
        recipientUids: deleted,
        type: "hangout_cancelled",
      });
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
          eq(communityEventsTable.verifiedExplorersOnly, false),
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
    if (event.verifiedExplorersOnly && !(await isVerifiedExplorer(uid))) {
      res.status(404).json({ message: "Event not found" });
      return;
    }
    if (event.joinApprovalRequired && event.ownerUid !== uid && !event.inviteeUids.includes(uid)) {
      const [acceptedRequest] = await db
        .select({ id: communityEventJoinRequestsTable.id })
        .from(communityEventJoinRequestsTable)
        .where(and(
          eq(communityEventJoinRequestsTable.eventId, eventId),
          eq(communityEventJoinRequestsTable.userUid, uid),
          eq(communityEventJoinRequestsTable.status, "accepted"),
        ))
        .limit(1);
      if (!acceptedRequest) {
        res.status(403).json({ message: "The host must accept your request before you can RSVP." });
        return;
      }
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

router.post(
  "/community-events/:eventId/join-requests",
  requireUid,
  eventWriteLimit,
  async (req, res): Promise<void> => {
    const params = RequestToJoinCommunityEventParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: "Invalid event id." });
      return;
    }
    const eventId = params.data.eventId;
    const uid = req.uid!;
    const [event] = await db
      .select({
        ownerUid: communityEventsTable.ownerUid,
        visibility: communityEventsTable.visibility,
        joinApprovalRequired: communityEventsTable.joinApprovalRequired,
        verifiedExplorersOnly: communityEventsTable.verifiedExplorersOnly,
        startsAt: communityEventsTable.startsAt,
      })
      .from(communityEventsTable)
      .where(and(
        eq(communityEventsTable.id, eventId),
        eq(communityEventsTable.isHidden, false),
      ))
      .limit(1);
    if (!event) {
      res.status(404).json({ message: "Event not found." });
      return;
    }
    if (event.verifiedExplorersOnly && !(await isVerifiedExplorer(uid))) {
      res.status(404).json({ message: "Event not found." });
      return;
    }
    if (!event.joinApprovalRequired || event.visibility !== "public") {
      res.status(403).json({ message: "This event does not accept join requests." });
      return;
    }
    if (event.ownerUid === uid) {
      res.status(400).json({ message: "The host cannot request to join their own plan." });
      return;
    }
    if (event.startsAt <= new Date()) {
      res.status(409).json({ message: "This hangout has already started." });
      return;
    }

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(communityEventJoinRequestsTable)
        .where(and(
          eq(communityEventJoinRequestsTable.eventId, eventId),
          eq(communityEventJoinRequestsTable.userUid, uid),
        ))
        .limit(1);
      if (existing?.status === "pending" || existing?.status === "accepted") {
        return {
          requestId: existing.id,
          status: existing.status,
          created: false,
          notifyHost: false,
        };
      }
      if (existing) {
        const [updated] = await tx
          .update(communityEventJoinRequestsTable)
          .set({
            status: "pending",
            createdAt: now,
            updatedAt: now,
            decidedAt: null,
          })
          .where(eq(communityEventJoinRequestsTable.id, existing.id))
          .returning({ id: communityEventJoinRequestsTable.id });
        return updated
          ? {
              requestId: updated.id,
              status: "pending" as const,
              created: false,
              notifyHost: true,
            }
          : null;
      }
      const [created] = await tx
        .insert(communityEventJoinRequestsTable)
        .values({
          eventId,
          userUid: uid,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [
            communityEventJoinRequestsTable.eventId,
            communityEventJoinRequestsTable.userUid,
          ],
        })
        .returning({ id: communityEventJoinRequestsTable.id });
      if (created) {
        return {
          requestId: created.id,
          status: "pending" as const,
          created: true,
          notifyHost: true,
        };
      }
      const [racedRequest] = await tx
        .select({
          id: communityEventJoinRequestsTable.id,
          status: communityEventJoinRequestsTable.status,
        })
        .from(communityEventJoinRequestsTable)
        .where(and(
          eq(communityEventJoinRequestsTable.eventId, eventId),
          eq(communityEventJoinRequestsTable.userUid, uid),
        ))
        .limit(1);
      return racedRequest
        ? {
            requestId: racedRequest.id,
            status: racedRequest.status,
            created: false,
            notifyHost: false,
          }
        : null;
    });
    if (!result) {
      res.status(409).json({ message: "The join request could not be saved. Try again." });
      return;
    }
    if (result.notifyHost && result.status === "pending") {
      await notifyCommunityEventJoinRequest({
        eventId,
        hostUid: event.ownerUid,
        requesterUid: uid,
      });
    }
    res.status(result.created ? 201 : 200).json(
      RequestToJoinCommunityEventResponse.parse({
        success: true,
        status: result.status,
        requestId: result.requestId,
      }),
    );
  },
);

router.delete(
  "/community-events/:eventId/join-requests",
  requireUid,
  eventWriteLimit,
  async (req, res): Promise<void> => {
    const params = WithdrawCommunityEventJoinRequestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ message: "Invalid event id." });
      return;
    }
    const [request] = await db
      .select({
        id: communityEventJoinRequestsTable.id,
        status: communityEventJoinRequestsTable.status,
      })
      .from(communityEventJoinRequestsTable)
      .where(and(
        eq(communityEventJoinRequestsTable.eventId, params.data.eventId),
        eq(communityEventJoinRequestsTable.userUid, req.uid!),
      ))
      .limit(1);
    if (!request) {
      res.status(404).json({ message: "Pending join request not found." });
      return;
    }
    if (request.status === "accepted") {
      res.status(409).json({ message: "An accepted request cannot be withdrawn." });
      return;
    }
    if (request.status !== "pending" && request.status !== "withdrawn") {
      res.status(409).json({ message: "Only a pending request can be withdrawn." });
      return;
    }
    if (request.status === "pending") {
      await db
        .update(communityEventJoinRequestsTable)
        .set({ status: "withdrawn", updatedAt: new Date(), decidedAt: null })
        .where(and(
          eq(communityEventJoinRequestsTable.id, request.id),
          eq(communityEventJoinRequestsTable.status, "pending"),
        ));
    }
    res.json(
      WithdrawCommunityEventJoinRequestResponse.parse({
        success: true,
        status: "withdrawn",
        requestId: request.id,
      }),
    );
  },
);

router.patch(
  "/community-events/:eventId/join-requests/:requestId",
  requireUid,
  eventWriteLimit,
  async (req, res): Promise<void> => {
    const params = DecideCommunityEventJoinRequestParams.safeParse(req.params);
    const parsed = DecideCommunityEventJoinRequestBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ message: "Invalid join request decision." });
      return;
    }
    const { eventId, requestId } = params.data;
    const [event] = await db
      .select({
        ownerUid: communityEventsTable.ownerUid,
        joinApprovalRequired: communityEventsTable.joinApprovalRequired,
      })
      .from(communityEventsTable)
      .where(and(
        eq(communityEventsTable.id, eventId),
        eq(communityEventsTable.isHidden, false),
      ))
      .limit(1);
    if (!event) {
      res.status(404).json({ message: "Event not found." });
      return;
    }
    if (event.ownerUid !== req.uid) {
      res.status(403).json({ message: "Only the event host can decide requests." });
      return;
    }
    if (!event.joinApprovalRequired) {
      res.status(409).json({ message: "This event does not accept join requests." });
      return;
    }
    const [request] = await db
      .select()
      .from(communityEventJoinRequestsTable)
      .where(and(
        eq(communityEventJoinRequestsTable.id, requestId),
        eq(communityEventJoinRequestsTable.eventId, eventId),
      ))
      .limit(1);
    if (!request) {
      res.status(404).json({ message: "Join request not found." });
      return;
    }
    const status = parsed.data.status;
    if (request.status === status) {
      res.json(
        DecideCommunityEventJoinRequestResponse.parse({
          success: true,
          status,
          requestId,
        }),
      );
      return;
    }
    if (request.status !== "pending") {
      res.status(409).json({ message: "This join request is no longer pending." });
      return;
    }

    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      const [decision] = await tx
        .update(communityEventJoinRequestsTable)
        .set({ status, updatedAt: now, decidedAt: now })
        .where(and(
          eq(communityEventJoinRequestsTable.id, requestId),
          eq(communityEventJoinRequestsTable.eventId, eventId),
          eq(communityEventJoinRequestsTable.status, "pending"),
        ))
        .returning({ id: communityEventJoinRequestsTable.id });
      if (!decision) return false;
      if (status === "accepted") {
        await tx
          .insert(communityEventRsvpsTable)
          .values({
            eventId,
            userUid: request.userUid,
            status: "going",
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [communityEventRsvpsTable.eventId, communityEventRsvpsTable.userUid],
            set: { status: "going", updatedAt: now },
          });
      }
      return true;
    });
    if (!updated) {
      res.status(409).json({ message: "This join request is no longer pending." });
      return;
    }
    await notifyCommunityEventJoinDecision({
      eventId,
      requesterUid: request.userUid,
      status,
    });
    res.json(
      DecideCommunityEventJoinRequestResponse.parse({
        success: true,
        status,
        requestId,
      }),
    );
  },
);

async function attendeeCanAccessEvent(
  eventType: EventKind,
  eventId: number,
  uid: string,
  visibility: string,
  ownerUid: string,
  inviteeUids: string[],
  joinApprovalRequired = false,
  verifiedExplorersOnly = false,
): Promise<boolean> {
  if (verifiedExplorersOnly && !(await isVerifiedExplorer(uid))) return false;
  if (ownerUid === uid || inviteeUids.includes(uid)) {
    return true;
  }
  if (visibility === "public" && (eventType === "venue" || joinApprovalRequired)) {
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
    if (memberEvent.joinApprovalRequired) {
      res.status(404).json({ message: "Hangouts do not use event check-in codes." });
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
      memberEvent.joinApprovalRequired,
      memberEvent.verifiedExplorersOnly,
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
      joinApprovalRequired: boolean;
      verifiedExplorersOnly: boolean;
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
        ? {
            ...row,
            joinApprovalRequired: false,
            verifiedExplorersOnly: false,
            latitude: row.latitude == null ? null : Number(row.latitude),
            longitude: row.longitude == null ? null : Number(row.longitude),
          }
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
          joinApprovalRequired: communityEventsTable.joinApprovalRequired,
          verifiedExplorersOnly: communityEventsTable.verifiedExplorersOnly,
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
    if (eventType === "member" && event.joinApprovalRequired) {
      res.status(404).json({ message: "Hangouts do not use event check-ins." });
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
      event.joinApprovalRequired,
      event.verifiedExplorersOnly,
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
    if (event.joinApprovalRequired) {
      res.status(409).json({ message: "Hangouts do not use event check-in codes." });
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
        checkedInByUid: eventAttendanceTable.checkedInByUid,
        manualReason: eventAttendanceTable.manualReason,
        checkedInAt: eventAttendanceTable.checkedInAt,
      })
      .from(eventAttendanceTable)
      .leftJoin(profilesTable, eq(profilesTable.uid, eventAttendanceTable.userUid))
      .where(and(
        eq(eventAttendanceTable.eventType, eventType),
        eq(eventAttendanceTable.eventId, eventId),
      ))
      .orderBy(eventAttendanceTable.checkedInAt);
    const rsvps = eventType === "venue"
      ? await db
        .select({
          uid: venueEventRsvpsTable.userUid,
          displayName: profilesTable.displayName,
          photoUrl: profilesTable.photoUrl,
          status: venueEventRsvpsTable.status,
        })
        .from(venueEventRsvpsTable)
        .leftJoin(profilesTable, eq(profilesTable.uid, venueEventRsvpsTable.userUid))
        .where(eq(venueEventRsvpsTable.eventId, eventId))
        .orderBy(desc(venueEventRsvpsTable.updatedAt))
      : await db
        .select({
          uid: communityEventRsvpsTable.userUid,
          displayName: profilesTable.displayName,
          photoUrl: profilesTable.photoUrl,
          status: communityEventRsvpsTable.status,
        })
        .from(communityEventRsvpsTable)
        .leftJoin(profilesTable, eq(profilesTable.uid, communityEventRsvpsTable.userUid))
        .where(eq(communityEventRsvpsTable.eventId, eventId))
        .orderBy(desc(communityEventRsvpsTable.updatedAt));
    const joinRequests = eventType === "member"
      ? await db
        .select({
          id: communityEventJoinRequestsTable.id,
          uid: communityEventJoinRequestsTable.userUid,
          displayName: profilesTable.displayName,
          photoUrl: profilesTable.photoUrl,
          status: communityEventJoinRequestsTable.status,
          createdAt: communityEventJoinRequestsTable.createdAt,
        })
        .from(communityEventJoinRequestsTable)
        .leftJoin(profilesTable, eq(profilesTable.uid, communityEventJoinRequestsTable.userUid))
        .where(and(
          eq(communityEventJoinRequestsTable.eventId, eventId),
          eq(communityEventJoinRequestsTable.status, "pending"),
        ))
        .orderBy(asc(communityEventJoinRequestsTable.createdAt))
      : [];
    const explorerStatuses = await getVerifiedExplorerStatuses(
      joinRequests.map((request) => request.uid),
    );
    const prioritizedJoinRequests = [...joinRequests].sort((a, b) => {
      const aIsExplorer = explorerStatuses.get(a.uid)?.isVerifiedExplorer ?? false;
      const bIsExplorer = explorerStatuses.get(b.uid)?.isVerifiedExplorer ?? false;
      return Number(bIsExplorer) - Number(aIsExplorer) ||
        a.createdAt.getTime() - b.createdAt.getTime();
    });
    const corrections = await db
      .select({
        uid: eventAttendanceCorrectionsTable.userUid,
        displayName: profilesTable.displayName,
        action: eventAttendanceCorrectionsTable.action,
        previousMethod: eventAttendanceCorrectionsTable.previousMethod,
        reason: eventAttendanceCorrectionsTable.reason,
        actorUid: eventAttendanceCorrectionsTable.actorUid,
        createdAt: eventAttendanceCorrectionsTable.createdAt,
      })
      .from(eventAttendanceCorrectionsTable)
      .leftJoin(profilesTable, eq(profilesTable.uid, eventAttendanceCorrectionsTable.userUid))
      .where(and(
        eq(eventAttendanceCorrectionsTable.eventType, eventType),
        eq(eventAttendanceCorrectionsTable.eventId, eventId),
      ))
      .orderBy(desc(eventAttendanceCorrectionsTable.createdAt))
      .limit(20);
    // Community plans do not have scheduled notification runs.
    const notificationRuns = eventType === "venue"
      ? await db
        .select({
          kind: venueEventNotificationRunsTable.kind,
          status: venueEventNotificationRunsTable.status,
          recipientCount: venueEventNotificationRunsTable.recipientCount,
          sentCount: venueEventNotificationRunsTable.sentCount,
          skippedCount: venueEventNotificationRunsTable.skippedCount,
          failedCount: venueEventNotificationRunsTable.failedCount,
          startedAt: venueEventNotificationRunsTable.startedAt,
        })
        .from(venueEventNotificationRunsTable)
        .where(eq(venueEventNotificationRunsTable.eventId, eventId))
        .orderBy(desc(venueEventNotificationRunsTable.startedAt))
        .limit(10)
      : [];
    res.setHeader("Cache-Control", "no-store");
    res.json(GetEventAttendeesResponse.parse({
      attendees: attendees.map((attendee) => ({
        ...attendee,
        displayName: attendee.displayName ?? "Met member",
      })),
      rsvps: rsvps.map((rsvp) => ({
        ...rsvp,
        displayName: rsvp.displayName ?? "Met member",
      })),
      joinRequests: prioritizedJoinRequests.map((request) => ({
        ...request,
        displayName: request.displayName ?? "Met member",
        isVerifiedExplorer:
          explorerStatuses.get(request.uid)?.isVerifiedExplorer ?? false,
      })),
      corrections: corrections.map((correction) => ({
        ...correction,
        displayName: correction.displayName ?? "Met member",
      })),
      notificationRuns,
    }));
  },
);

export default router;
