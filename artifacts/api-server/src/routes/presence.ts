import { Router, type IRouter } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import { db, presenceTable, profilesTable, type Presence } from "@workspace/db";
import {
  UpdatePresenceBody,
  UpdatePresenceResponse,
  NearbyPresenceQueryParams,
  NearbyPresenceResponse,
} from "@workspace/api-zod";
import { requireUid } from "../middlewares/requireUid";
import { withProfilePrivacyLocks } from "../lib/profilePrivacy";

const router: IRouter = Router();

function serializePresence(p: Presence) {
  return {
    uid: p.uid,
    lat: p.lat,
    lng: p.lng,
    accuracyM: p.accuracyM ?? null,
    updatedAt: p.updatedAt.toISOString(),
  };
}

router.put("/presence", requireUid, async (req, res) => {
  const uid = req.uid!;
  const body = UpdatePresenceBody.parse(req.body);
  const outcome = await withProfilePrivacyLocks([uid], async (tx) => {
    const profileRows = await tx
      .select({ isVisible: profilesTable.isVisible })
      .from(profilesTable)
      .where(eq(profilesTable.uid, uid))
      .limit(1);
    const profile = Array.isArray(profileRows) ? profileRows[0] : undefined;
    if (!profile) {
      await tx.delete(presenceTable).where(eq(presenceTable.uid, uid));
      return { status: 404 as const };
    }
    if (!profile.isVisible) {
      // Hidden users do not refresh GPS presence; also clear any stale row left
      // by an earlier visible session. 204 keeps the periodic writer successful
      // without returning or persisting the submitted coordinates.
      await tx.delete(presenceTable).where(eq(presenceTable.uid, uid));
      return { status: 204 as const };
    }
    const now = new Date();
    const [row] = await tx
      .insert(presenceTable)
      .values({
        uid,
        lat: body.lat,
        lng: body.lng,
        accuracyM: body.accuracyM ?? null,
      })
      .onConflictDoUpdate({
        target: presenceTable.uid,
        set: {
          lat: body.lat,
          lng: body.lng,
          accuracyM: body.accuracyM ?? null,
          updatedAt: now,
        },
      })
      .returning();
    return {
      status: 200 as const,
      body: UpdatePresenceResponse.parse(serializePresence(row!)),
    };
  });

  if (outcome.status === 404) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }
  if (outcome.status === 204) {
    res.status(204).send();
    return;
  }
  res.json(outcome.body);
});

router.get("/presence/nearby", requireUid, async (req, res) => {
  const uid = req.uid!;
  const params = NearbyPresenceQueryParams.parse({
    lat: Number(req.query.lat),
    lng: Number(req.query.lng),
    radiusM:
      req.query.radiusM !== undefined ? Number(req.query.radiusM) : undefined,
    maxAgeMin:
      req.query.maxAgeMin !== undefined
        ? Number(req.query.maxAgeMin)
        : undefined,
  });
  const radiusM = params.radiusM ?? 200;
  const maxAgeMin = params.maxAgeMin ?? 15;

  // Haversine in SQL. Using earth's mean radius 6371000 m.
  // Filters by max age first (uses presence_updated_at_idx) then by distance.
  const rows = await db.execute<{
    uid: string;
    distance_m: number;
    updated_at: string;
  }>(sql`
    SELECT
      p.uid,
      6371000 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians(${params.lat})) * cos(radians(p.lat)) *
          cos(radians(p.lng) - radians(${params.lng})) +
          sin(radians(${params.lat})) * sin(radians(p.lat))
        ))
      ) AS distance_m,
      p.updated_at
    FROM presence p
    JOIN profiles profile ON profile.uid = p.uid
    WHERE p.uid <> ${uid}
      AND profile.is_visible = true
      AND p.updated_at > now() - (${maxAgeMin} || ' minutes')::interval
      AND 6371000 * acos(
        LEAST(1, GREATEST(-1,
          cos(radians(${params.lat})) * cos(radians(p.lat)) *
          cos(radians(p.lng) - radians(${params.lng})) +
          sin(radians(${params.lat})) * sin(radians(p.lat))
        ))
      ) <= ${radiusM}
    ORDER BY distance_m ASC
    LIMIT 100
  `);

  const rawItems = rows.rows.map((r) => ({
    uid: r.uid,
    distanceM: Number(r.distance_m),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));

  // Batch-lookup pioneer status so we can tag and sort pioneers to the top.
  let pioneerUids = new Set<string>();
  if (rawItems.length > 0) {
    const uids = rawItems.map((r) => r.uid);
    const nearbySet = new Set(uids);
    // Fetch all pioneers and intersect with the nearby uid set.
    const pioneerRows = await db
      .select({ uid: profilesTable.uid })
      .from(profilesTable)
      .where(inArray(profilesTable.uid, [...nearbySet]));
    for (const p of pioneerRows) {
      if (p.uid && nearbySet.has(p.uid)) pioneerUids.add(p.uid);
    }
    // Re-filter to only actual pioneers (isPioneer=true).
    const allPioneers = await db
      .select({ uid: profilesTable.uid })
      .from(profilesTable)
      .where(eq(profilesTable.isPioneer, true));
    const allPioneerSet = new Set(allPioneers.map((p) => p.uid));
    pioneerUids = new Set([...pioneerUids].filter((uid) => allPioneerSet.has(uid)));
  }

  // Sort: pioneers first (lowest distanceM within each group).
  const enriched = rawItems
    .map((r) => ({ ...r, priority_radar: pioneerUids.has(r.uid) }))
    .sort((a, b) => {
      if (a.priority_radar && !b.priority_radar) return -1;
      if (!a.priority_radar && b.priority_radar) return 1;
      return a.distanceM - b.distanceM;
    });

  res.json(enriched);
});

export default router;
