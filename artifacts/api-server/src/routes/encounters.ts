import { Router, type IRouter } from "express";
import { and, eq, desc, inArray, or } from "drizzle-orm";
import {
  db,
  encountersTable,
  profilesTable,
  revealRequestsTable,
  subscriptionsTable,
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
import {
  getExplicitlyKnownUids,
  withProfilePrivacyLocks,
} from "../lib/profilePrivacy";

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
    visibilityVersion: p.updatedAt.toISOString(),
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

  const outcome = await withProfilePrivacyLocks(
    [uid, body.observedUid],
    async (tx) => {
      const visibleProfiles = await tx
        .select({ uid: profilesTable.uid, isVisible: profilesTable.isVisible })
        .from(profilesTable)
        .where(inArray(profilesTable.uid, [uid, body.observedUid]));
      const visibleUidSet = new Set(
        (Array.isArray(visibleProfiles) ? visibleProfiles : [])
          .filter((profile) => profile.isVisible)
          .map((profile) => profile.uid),
      );
      if (!visibleUidSet.has(uid) || !visibleUidSet.has(body.observedUid)) {
        return { status: 404 as const, message: "Other user not found" };
      }

      const now = new Date();
      const existingRows = await tx
        .select()
        .from(encountersTable)
        .where(
          and(
            eq(encountersTable.observerUid, uid),
            eq(encountersTable.observedUid, body.observedUid),
          ),
        )
        .limit(1);
      const existing = Array.isArray(existingRows)
        ? existingRows[0]
        : undefined;

      let row: Encounter;
      if (!existing) {
        const [inserted] = await tx
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
        const [updated] = await tx
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

      // Keep the advisory locks through the push side effect: Hide must not
      // finish while a delayed discovery notification is still in flight.
      const otherRows = await tx
        .select({
          pushToken: profilesTable.pushToken,
          isVisible: profilesTable.isVisible,
          interests: profilesTable.interests,
          preferredLocale: profilesTable.preferredLocale,
        })
        .from(profilesTable)
        .where(eq(profilesTable.uid, body.observedUid))
        .limit(1);
      const other = Array.isArray(otherRows) ? otherRows[0] : undefined;

      if (other?.pushToken && other.isVisible && checkNearbyPushAllowed(uid, body.observedUid)) {
        let pushBody = "You've crossed paths with someone.";
        const otherInterests = (other.interests ?? []) as string[];
        if (otherInterests.length > 0) {
          const callerRows = await tx
            .select({ interests: profilesTable.interests })
            .from(profilesTable)
            .where(eq(profilesTable.uid, uid))
            .limit(1);
          const callerRow = Array.isArray(callerRows) ? callerRows[0] : undefined;
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

      return {
        status: 200 as const,
        body: LogEncounterResponse.parse(serializeEncounter(row)),
      };
    },
  );

  if (outcome.status !== 200) {
    res.status(outcome.status).json({ message: outcome.message });
    return;
  }
  res.json(outcome.body);
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

  // Hidden users disappear from stale proximity history. Preserve identity
  // already disclosed by an explicit reveal or shared active membership.
  const candidateUids = rows
    .filter((r) => r.profile !== null && !r.profile.isVisible)
    .map((r) => r.profile!.uid);
  const explicitlyKnown = await getExplicitlyKnownUids(uid, candidateUids);
  const items = rows
    .filter(
      (r) =>
        r.profile !== null &&
        (r.profile.isVisible || explicitlyKnown.has(r.profile.uid)),
    )
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

  try {
    const outcome = await withProfilePrivacyLocks(
      [uid, body.otherUid],
      async (tx) => {
        // Reject encounters with non-existent profiles so a stray uid from a
        // BLE resolve cache miss never poisons the met_people subcollection
        // with an unresolvable doc id.
        const profileRows = await tx
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
          .where(inArray(profilesTable.uid, [uid, body.otherUid]));
        const profiles = Array.isArray(profileRows) ? profileRows : [];
        const other = profiles.find((profile) => profile.uid === body.otherUid);
        const observer = profiles.find((profile) => profile.uid === uid);
        if (!other || !observer || !other.isVisible || !observer.isVisible) {
          // Don't expose Hidden mode as a distinct state.
          return { status: 404 as const, message: "Other user not found" };
        }

        // Look up both users' active subscription tiers so the encounter doc
        // carries the subscriber ring data the client needs for encounter cards.
        const tierRows = await tx
          .select({
            userUid: subscriptionsTable.userUid,
            tier: subscriptionsTable.tier,
            status: subscriptionsTable.status,
          })
          .from(subscriptionsTable)
          .where(
            or(
              eq(subscriptionsTable.userUid, uid),
              eq(subscriptionsTable.userUid, body.otherUid),
            ),
          )
          .limit(2);
        const subscriptions = Array.isArray(tierRows) ? tierRows : [];
        const getTier = (userUid: string): "free" | "plus" | "pro" => {
          const row = subscriptions.find(
            (subscription) => subscription.userUid === userUid,
          );
          if (
            row &&
            row.status === "active" &&
            (row.tier === "plus" || row.tier === "pro")
          ) {
            return row.tier as "plus" | "pro";
          }
          return "free";
        };

        // Hold the cross-process locks through the Firestore write and push so
        // neither can recreate discovery data after Hide finishes.
        const result = await recordSymmetricEncounter({
          uidA: uid,
          uidB: body.otherUid,
          location: body.location ?? null,
          tierA: getTier(uid),
          tierB: getTier(body.otherUid),
        });

        // Check whether these users have an accepted reveal (an existing
        // connection may continue to receive re-encounter notifications).
        const existingRevealRows = await tx
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
        const isConnected = Array.isArray(existingRevealRows) &&
          existingRevealRows.length > 0;

        // Best-effort push to the other user — rate-limited to once per 15 min
        // per pair. Existing accepted connections remain intact in Hidden mode.
        if (other.pushToken && checkNearbyPushAllowed(uid, body.otherUid)) {
          const notifPrefs = other.notificationPrefs as {
            notifyNewEncounters?: boolean;
            notifyReencounter?: boolean;
            notifyChat?: boolean;
          } | null | undefined;

          if (isConnected) {
            if (notifPrefs?.notifyReencounter !== false) {
              const callerRows = await tx
                .select({ displayName: profilesTable.displayName })
                .from(profilesTable)
                .where(eq(profilesTable.uid, uid))
                .limit(1);
              const callerRow = Array.isArray(callerRows) ? callerRows[0] : undefined;
              const callerName = callerRow?.displayName ?? "Someone you know";
              await sendPush(other.pushToken, {
                title: "You've crossed paths again! 👋",
                body: `${callerName} is nearby.`,
                data: { type: "reencounter", encounterId: uid },
              });
            }
          } else if (notifPrefs?.notifyNewEncounters !== false) {
            let pushBody = "You've crossed paths with someone.";
            const otherInterests = (other.interests ?? []) as string[];
            if (otherInterests.length > 0) {
              const callerRows = await tx
                .select({ interests: profilesTable.interests })
                .from(profilesTable)
                .where(eq(profilesTable.uid, uid))
                .limit(1);
              const callerRow = Array.isArray(callerRows) ? callerRows[0] : undefined;
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

        return {
          status: 200 as const,
          body: RecordEncounterResponse.parse({
            otherUid: result.otherUid,
            metCount: result.metCount,
            lastMet: result.lastMet.toISOString(),
          }),
        };
      },
    );

    if (outcome.status !== 200) {
      res.status(outcome.status).json({ message: outcome.message });
      return;
    }
    res.json(outcome.body);
  } catch (err) {
    req.log?.error(
      { err: (err as Error)?.message, uidA: uid, uidB: body.otherUid },
      "Symmetric Firestore encounter write failed",
    );
    res.status(502).json({ message: "Encounter mirror failed" });
  }
});

export default router;
