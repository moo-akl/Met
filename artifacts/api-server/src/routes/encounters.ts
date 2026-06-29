import { Router, type IRouter } from "express";
import { and, eq, desc, or } from "drizzle-orm";
import {
  db,
  encountersTable,
  profilesTable,
  revealRequestsTable,
  type Encounter,
  type Profile,
} from "@workspace/db";
import {
  LogEncounterBody,
  LogEncounterResponse,
  ListMyEncountersResponse,
  RecordEncounterBody,
  RecordEncounterResponse,
} from "@workspace/api-zod";
import { requireUid } from "../middlewares/requireUid";
import { createUserRateLimiter } from "../middlewares/rateLimit";
import { recordSymmetricEncounter } from "../lib/firestoreMirror";
import { sendPush, checkNearbyPushAllowed } from "../lib/push";
import { localiseInterest } from "../lib/interestLabels";

const router: IRouter = Router();

// Per-user rate limit for encounter write endpoints: 30 requests per minute.
// Encounters are proximity-triggered but a single session should never
// produce more than a handful per minute in normal use.
const encounterWriteLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 30,
  name: "user-encounter-write",
});

function serializeEncounter(e: Encounter) {
  return {
    id: e.id,
    observerUid: e.observerUid,
    observedUid: e.observedUid,
    firstSeenAt: e.firstSeenAt.toISOString(),
    lastSeenAt: e.lastSeenAt.toISOString(),
    encounterCount: e.encounterCount,
    lastRssi: e.lastRssi ?? null,
  };
}

function serializeProfile(p: Profile) {
  return {
    uid: p.uid,
    displayName: p.displayName,
    photoUrl: p.photoUrl ?? null,
    bio: p.bio ?? null,
    socials: (p.socials ?? {}) as Record<string, string>,
    interests: (p.interests ?? []) as string[],
    isVisible: p.isVisible,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// Encounter dedup window: if we already saw this person in the last 10
// minutes, just bump lastSeenAt without incrementing the count. Anything
// older counts as a new encounter session.
const ENCOUNTER_WINDOW_MS = 10 * 60 * 1000;

router.post("/encounters", requireUid, encounterWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const body = LogEncounterBody.parse(req.body);
  if (body.observedUid === uid) {
    res.status(400).json({ message: "Cannot log encounter with self" });
    return;
  }

  const now = new Date();
  const [existing] = await db
    .select()
    .from(encountersTable)
    .where(
      and(
        eq(encountersTable.observerUid, uid),
        eq(encountersTable.observedUid, body.observedUid),
      ),
    )
    .limit(1);

  let row: Encounter;
  if (!existing) {
    const [inserted] = await db
      .insert(encountersTable)
      .values({
        observerUid: uid,
        observedUid: body.observedUid,
        lastRssi: body.rssi ?? null,
      })
      .returning();
    row = inserted!;
  } else {
    const isNewSession =
      now.getTime() - existing.lastSeenAt.getTime() > ENCOUNTER_WINDOW_MS;
    const [updated] = await db
      .update(encountersTable)
      .set({
        lastSeenAt: now,
        lastRssi: body.rssi ?? existing.lastRssi,
        encounterCount: isNewSession
          ? existing.encounterCount + 1
          : existing.encounterCount,
      })
      .where(eq(encountersTable.id, existing.id))
      .returning();
    row = updated!;
  }

  // Best-effort push to the observed user — same rate-limit as
  // /encounters/record so GPS and Firestore detections don't double-notify.
  const [other] = await db
    .select({
      pushToken: profilesTable.pushToken,
      isVisible: profilesTable.isVisible,
      interests: profilesTable.interests,
      preferredLocale: profilesTable.preferredLocale,
    })
    .from(profilesTable)
    .where(eq(profilesTable.uid, body.observedUid))
    .limit(1);

  if (other?.pushToken && other.isVisible && checkNearbyPushAllowed(uid, body.observedUid)) {
    let pushBody = "You've crossed paths with someone.";
    const otherInterests = (other.interests ?? []) as string[];
    if (otherInterests.length > 0) {
      const [callerRow] = await db
        .select({ interests: profilesTable.interests })
        .from(profilesTable)
        .where(eq(profilesTable.uid, uid))
        .limit(1);
      const callerInterests = (callerRow?.interests ?? []) as string[];
      const callerLower = new Set(callerInterests.map((i) => i.toLowerCase()));
      const shared = otherInterests.filter((i) => callerLower.has(i.toLowerCase()));
      if (shared.length > 0) {
        const label = localiseInterest(shared[0], other.preferredLocale);
        pushBody = `Someone nearby also likes ${label}!`;
      }
    }
    await sendPush(other.pushToken, {
      title: "Someone nearby is using Met!",
      body: pushBody,
      data: { type: "encounter", encounterId: uid },
    });
  }

  res.json(LogEncounterResponse.parse(serializeEncounter(row)));
});

router.get("/encounters", requireUid, async (req, res) => {
  const uid = req.uid!;
  const rows = await db
    .select({
      encounter: encountersTable,
      profile: profilesTable,
    })
    .from(encountersTable)
    .leftJoin(
      profilesTable,
      eq(profilesTable.uid, encountersTable.observedUid),
    )
    .where(eq(encountersTable.observerUid, uid))
    .orderBy(desc(encountersTable.lastSeenAt));

  // Drop encounters whose observed profile no longer exists — there's
  // nothing meaningful to show for them.
  const items = rows
    .filter((r) => r.profile !== null)
    .map((r) => ({
      ...serializeEncounter(r.encounter),
      profile: serializeProfile(r.profile!),
    }));

  res.json(ListMyEncountersResponse.parse(items));
});

// POST /api/encounters/record — symmetric Firestore encounter write.
//
// Unlike POST /api/encounters (the legacy asymmetric Postgres endpoint
// kept for backwards-compat during the migration), this writes mirror
// docs to BOTH users' met_people subcollections in Firestore using a
// single batched commit. Profile data is read from Postgres so we can
// reject encounters with non-existent users early.
router.post("/encounters/record", requireUid, encounterWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const body = RecordEncounterBody.parse(req.body);

  if (body.otherUid === uid) {
    res.status(400).json({ message: "Cannot record encounter with self" });
    return;
  }

  // Reject encounters with non-existent profiles so a stray uid from a
  // BLE resolve cache miss never poisons the met_people subcollection
  // with an unresolvable doc id.
  const [other] = await db
    .select({
      uid: profilesTable.uid,
      isVisible: profilesTable.isVisible,
      pushToken: profilesTable.pushToken,
      interests: profilesTable.interests,
      preferredLocale: profilesTable.preferredLocale,
      displayName: profilesTable.displayName,
      notificationPrefs: profilesTable.notificationPrefs,
    })
    .from(profilesTable)
    .where(eq(profilesTable.uid, body.otherUid))
    .limit(1);
  if (!other) {
    res.status(404).json({ message: "Other user not found" });
    return;
  }
  // Don't expose Ghost Mode to the caller as a separate state — surface
  // the same 404 we'd return for a missing profile so a probing client
  // can't enumerate hidden users.
  if (!other.isVisible) {
    res.status(404).json({ message: "Other user not found" });
    return;
  }

  try {
    const result = await recordSymmetricEncounter({
      uidA: uid,
      uidB: body.otherUid,
      location: body.location ?? null,
    });

    // Check if observer and observed are already connected (mutual accepted reveal).
    // This determines which notification type to send.
    const [existingReveal] = await db
      .select({ id: revealRequestsTable.id })
      .from(revealRequestsTable)
      .where(
        and(
          eq(revealRequestsTable.status, "accepted"),
          or(
            and(
              eq(revealRequestsTable.senderUid, uid),
              eq(revealRequestsTable.recipientUid, body.otherUid),
            ),
            and(
              eq(revealRequestsTable.senderUid, body.otherUid),
              eq(revealRequestsTable.recipientUid, uid),
            ),
          ),
        ),
      )
      .limit(1);
    const isConnected = !!existingReveal;

    // Best-effort push to the other user — rate-limited to once per 15 min
    // per (observer, observed) pair so repeated BLE/GPS detections don't
    // spam. `encounterId` carries the observer's uid so the recipient's
    // tap-handler routes to /encounter/{observerUid}.
    if (other.pushToken && checkNearbyPushAllowed(uid, body.otherUid)) {
      const notifPrefs = other.notificationPrefs as {
        notifyNewEncounters?: boolean;
        notifyReencounter?: boolean;
        notifyChat?: boolean;
      } | null | undefined;

      if (isConnected) {
        // Re-encounter alert: user is near someone they already know.
        // Respect the notifyReencounter preference (default enabled = null/undefined).
        if (notifPrefs?.notifyReencounter !== false) {
          // Fetch the observer's display name for personalised copy.
          const [callerRow] = await db
            .select({ displayName: profilesTable.displayName })
            .from(profilesTable)
            .where(eq(profilesTable.uid, uid))
            .limit(1);
          const callerName = callerRow?.displayName ?? "Someone you know";
          await sendPush(other.pushToken, {
            title: "You've crossed paths again! 👋",
            body: `${callerName} is nearby.`,
            data: { type: "reencounter", encounterId: uid },
          });
        }
      } else {
        // New encounter notification. Respect the notifyNewEncounters pref.
        if (notifPrefs?.notifyNewEncounters !== false) {
          // Build an interest-aware body: if the two users share at least one
          // interest, mention it so the notification is more enticing to tap.
          let pushBody = "You've crossed paths with someone.";
          const otherInterests = (other.interests ?? []) as string[];
          if (otherInterests.length > 0) {
            const [callerRow] = await db
              .select({ interests: profilesTable.interests })
              .from(profilesTable)
              .where(eq(profilesTable.uid, uid))
              .limit(1);
            const callerInterests = (callerRow?.interests ?? []) as string[];
            const callerLower = new Set(callerInterests.map((i) => i.toLowerCase()));
            const shared = otherInterests.filter((i) =>
              callerLower.has(i.toLowerCase()),
            );
            if (shared.length > 0) {
              const label = localiseInterest(shared[0], other.preferredLocale);
              pushBody = `Someone nearby also likes ${label}!`;
            }
          }
          await sendPush(other.pushToken, {
            title: "Someone nearby is using Met!",
            body: pushBody,
            data: { type: "encounter", encounterId: uid },
          });
        }
      }
    }

    res.json(
      RecordEncounterResponse.parse({
        otherUid: result.otherUid,
        metCount: result.metCount,
        lastMet: result.lastMet.toISOString(),
      }),
    );
  } catch (err) {
    req.log?.error(
      { err: (err as Error)?.message, uidA: uid, uidB: body.otherUid },
      "Symmetric Firestore encounter write failed",
    );
    res.status(502).json({ message: "Encounter mirror failed" });
  }
});

export default router;
