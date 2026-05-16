import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  encountersTable,
  profilesTable,
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
    .select({ uid: profilesTable.uid, isVisible: profilesTable.isVisible })
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
