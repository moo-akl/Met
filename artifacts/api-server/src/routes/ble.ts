// Resolves BLE identifiers (either 8-byte SHA-256 hashes from the
// legacy GATT pipeline OR 16-bit iBeacon majors from the current
// iBeacon pipeline) to user profiles. Used by the mobile BLE scanner
// to translate detected advertisements into Met users.
//
// Both lookups are precomputed at profile-upsert time and stored as
// indexed columns on the profiles row, so each resolve is one or two
// indexed SELECTs regardless of caller batch size (each batch is
// bounded to 64 by the OpenAPI schema).
//
// At least one of `hashes` or `majors` must be present and non-empty.
// The two lookups are independent; the response unions matches from
// both. iBeacon majors are only 16-bit so multiple profiles may share
// the same major — every match is returned, the client de-duplicates.

import { Router, type IRouter } from "express";
import { inArray } from "drizzle-orm";
import { db, profilesTable, type Profile } from "@workspace/db";
import { BleResolveBody, BleResolveResponse } from "@workspace/api-zod";
import { requireUid } from "../middlewares/requireUid";

const router: IRouter = Router();

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

router.post("/ble/resolve", requireUid, async (req, res) => {
  const body = BleResolveBody.parse(req.body);

  // Dedupe both inputs. Hashes are lower-cased defensively even though
  // the spec validates the pattern. Majors are coerced to ints.
  const hashes = Array.from(
    new Set((body.hashes ?? []).map((h) => h.toLowerCase())),
  );
  const majors = Array.from(
    new Set((body.majors ?? []).map((m) => m | 0)),
  );

  if (hashes.length === 0 && majors.length === 0) {
    res.status(400).json({
      message: "At least one of `hashes` or `majors` must be non-empty",
    });
    return;
  }

  // Run the two lookups in parallel. Each is a single indexed SELECT.
  const [hashRows, majorRows] = await Promise.all([
    hashes.length > 0
      ? db
          .select()
          .from(profilesTable)
          .where(inArray(profilesTable.uidHash, hashes))
      : Promise.resolve([] as Profile[]),
    majors.length > 0
      ? db
          .select()
          .from(profilesTable)
          .where(inArray(profilesTable.uidMajor, majors))
      : Promise.resolve([] as Profile[]),
  ]);

  // Build the response. A single profile may legitimately match both
  // a hash and a major in the same call (the client sent both for the
  // same user). We collapse those into one entry with both fields set
  // so the client doesn't double-process the same uid.
  const byUid = new Map<
    string,
    { hash?: string; major?: number; profile: Profile }
  >();

  for (const row of hashRows) {
    byUid.set(row.uid, { hash: row.uidHash, profile: row });
  }
  for (const row of majorRows) {
    const existing = byUid.get(row.uid);
    if (existing) {
      existing.major = row.uidMajor;
    } else {
      byUid.set(row.uid, { major: row.uidMajor, profile: row });
    }
  }

  const out = Array.from(byUid.values()).map((entry) => ({
    hash: entry.hash ?? null,
    major: entry.major ?? null,
    profile: serializeProfile(entry.profile),
  }));

  res.json(BleResolveResponse.parse(out));
});

export default router;
