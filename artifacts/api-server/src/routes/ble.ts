// Resolves BLE identity hashes (the first 8 bytes of SHA-256(uid),
// hex-encoded) to user profiles. Used by the mobile BLE scanner to
// translate detected advertisements into Met users.
//
// All hashes are precomputed and stored on the profiles row, so the
// resolve query is a single indexed SELECT regardless of caller batch
// size (the batch is bounded to 64 by the OpenAPI schema).

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
  // Dedupe and lowercase; the spec validates each entry is 16 lowercase
  // hex chars, but be defensive against future client drift.
  const hashes = Array.from(
    new Set(body.hashes.map((h) => h.toLowerCase())),
  );
  if (hashes.length === 0) {
    res.json(BleResolveResponse.parse([]));
    return;
  }
  const rows = await db
    .select()
    .from(profilesTable)
    .where(inArray(profilesTable.uidHash, hashes));

  const out = rows.map((row) => ({
    hash: row.uidHash,
    profile: serializeProfile(row),
  }));
  res.json(BleResolveResponse.parse(out));
});

export default router;
