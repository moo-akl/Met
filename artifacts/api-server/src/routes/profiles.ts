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
import { uidToHash } from "../lib/uidHash";
import { mirrorProfileToFirestore } from "../lib/firestoreMirror";

const router: IRouter = Router();

function serialize(p: Profile) {
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
  // Recompute on every upsert so the column self-heals if the hashing
  // scheme is ever migrated (or the column was added after the row).
  const uidHash = uidToHash(uid);

  // isVisible is optional on upsert: if the client omits it we want to
  // PRESERVE the existing value (and default to true on create), not
  // silently flip the user out of Ghost Mode.
  const insertValues: typeof profilesTable.$inferInsert = {
    uid,
    uidHash,
    displayName: body.displayName,
    photoUrl: body.photoUrl ?? null,
    bio: body.bio ?? null,
    socials: body.socials ?? {},
    isVisible: body.isVisible ?? true,
  };
  const updateValues: Partial<typeof profilesTable.$inferInsert> = {
    uidHash,
    displayName: body.displayName,
    photoUrl: body.photoUrl ?? null,
    bio: body.bio ?? null,
    socials: body.socials ?? {},
    updatedAt: now,
  };
  if (body.isVisible !== undefined) updateValues.isVisible = body.isVisible;

  const [row] = await db
    .insert(profilesTable)
    .values(insertValues)
    .onConflictDoUpdate({
      target: profilesTable.uid,
      set: updateValues,
    })
    .returning();

  // Best-effort Firestore mirror so other clients can read this profile
  // for nearby/encounter rendering without going through the api-server.
  // Failures are logged inside the helper and do not affect the response —
  // Postgres is the source of truth for profile data.
  await mirrorProfileToFirestore({
    uid: row!.uid,
    uidHash: row!.uidHash,
    displayName: row!.displayName,
    photoUrl: row!.photoUrl ?? null,
    bio: row!.bio ?? null,
    socials: (row!.socials ?? {}) as Record<string, string>,
    isVisible: row!.isVisible,
  });

  res.json(UpsertMyProfileResponse.parse(serialize(row!)));
});

// POST /api/profiles/me/push-token — store (or refresh) the caller's Expo
// push token so the server can target this device with remote notifications.
// Silently overwrites any previously stored token — the client always sends
// the freshest token it receives from Expo.
router.post("/profiles/me/push-token", requireUid, async (req, res) => {
  const uid = req.uid!;
  const token =
    typeof req.body?.token === "string" ? req.body.token.trim() : null;
  if (!token || token.length > 1024) {
    res.status(400).json({ message: "token must be a non-empty string" });
    return;
  }
  await db
    .update(profilesTable)
    .set({ pushToken: token, updatedAt: new Date() })
    .where(eq(profilesTable.uid, uid));
  res.json({ success: true });
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
