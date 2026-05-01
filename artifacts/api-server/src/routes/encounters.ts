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
} from "@workspace/api-zod";
import { requireUid } from "../middlewares/requireUid";

const router: IRouter = Router();

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
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// Encounter dedup window: if we already saw this person in the last 10
// minutes, just bump lastSeenAt without incrementing the count. Anything
// older counts as a new encounter session.
const ENCOUNTER_WINDOW_MS = 10 * 60 * 1000;

router.post("/encounters", requireUid, async (req, res) => {
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

export default router;
