import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, profilesTable, type Profile } from "@workspace/db";
import {
  GetMyProfileResponse,
  UpsertMyProfileBody,
  UpsertMyProfileResponse,
  GetProfileParams,
  GetProfileResponse,
} from "@workspace/api-zod";
import { requireUid } from "../middlewares/requireUid";
import { uidToHash, uidToMajor } from "../lib/uidHash";

const router: IRouter = Router();

function serialize(p: Profile) {
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

router.get("/profiles/me", requireUid, async (req, res) => {
  const uid = req.uid!;
  const [row] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.uid, uid))
    .limit(1);
  if (!row) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }
  res.json(GetMyProfileResponse.parse(serialize(row)));
});

router.put("/profiles/me", requireUid, async (req, res) => {
  const uid = req.uid!;
  const body = UpsertMyProfileBody.parse(req.body);
  const now = new Date();
  // Recompute on every upsert so the columns self-heal if the hashing
  // scheme is ever migrated (or the columns were added after the row).
  // Both BLE identifiers are stored: `uidHash` (legacy GATT pipeline)
  // and `uidMajor` (current iBeacon pipeline).
  const uidHash = uidToHash(uid);
  const uidMajor = uidToMajor(uid);
  const [row] = await db
    .insert(profilesTable)
    .values({
      uid,
      uidHash,
      uidMajor,
      displayName: body.displayName,
      photoUrl: body.photoUrl ?? null,
      bio: body.bio ?? null,
      socials: body.socials ?? {},
    })
    .onConflictDoUpdate({
      target: profilesTable.uid,
      set: {
        uidHash,
        uidMajor,
        displayName: body.displayName,
        photoUrl: body.photoUrl ?? null,
        bio: body.bio ?? null,
        socials: body.socials ?? {},
        updatedAt: now,
      },
    })
    .returning();
  res.json(UpsertMyProfileResponse.parse(serialize(row!)));
});

router.get("/profiles/:uid", requireUid, async (req, res) => {
  const params = GetProfileParams.parse({ uid: req.params.uid });
  const [row] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.uid, params.uid))
    .limit(1);
  if (!row) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }
  res.json(GetProfileResponse.parse(serialize(row)));
});

export default router;
