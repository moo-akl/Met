import { Router, type IRouter } from "express";
import { and, eq, or, inArray, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  revealRequestsTable,
  type Profile,
} from "@workspace/db";
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
    interests: (p.interests ?? []) as string[],
    isVisible: p.isVisible,
    notificationPrefs: (p.notificationPrefs ?? null) as {
      notifyNewEncounters?: boolean;
      notifyReencounter?: boolean;
      notifyChat?: boolean;
    } | null,
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
  res.json({
    ...GetMyProfileResponse.parse(serialize(row)),
    isPioneer: row.isPioneer,
    referralCount: row.referralCount,
  });
});

router.put("/profiles/me", requireUid, async (req, res) => {
  const uid = req.uid!;
  const body = UpsertMyProfileBody.parse(req.body);
  const now = new Date();
  const uidHash = uidToHash(uid);

  const ALLOWED_INTERESTS = new Set([
    "Sport", "Music", "Art", "Travel", "Food",
    "Gaming", "Tech", "Fitness", "Photography",
    "Reading", "Film", "Nature", "Cooking", "Fashion",
    "Hiking", "Yoga", "Dancing", "Coffee", "Dogs", "Cats",
    "Movies", "Cycling", "Wine", "Volunteering",
    "Podcasts", "Wellness", "Running", "Board Games",
  ]);
  const ALLOWED_LOCALES = new Set([
    "en", "es", "ar", "zh", "ru", "fr", "vi", "pt", "nl",
  ]);
  const MAX_INTERESTS = 10;
  const cleanInterests =
    body.interests != null
      ? Array.from(
          new Set(
            (body.interests as string[])
              .map((s) => s.trim())
              .filter((s) => ALLOWED_INTERESTS.has(s)),
          ),
        ).slice(0, MAX_INTERESTS)
      : undefined;

  const cleanLocale =
    typeof body.preferredLocale === "string" && ALLOWED_LOCALES.has(body.preferredLocale)
      ? body.preferredLocale
      : undefined;

  // Accept notification preferences from the client. Validate only known keys
  // to prevent arbitrary data from being stored.
  const rawNotifPrefs = (body as Record<string, unknown>)["notificationPrefs"];
  const cleanNotifPrefs =
    rawNotifPrefs && typeof rawNotifPrefs === "object" && !Array.isArray(rawNotifPrefs)
      ? {
          ...(typeof (rawNotifPrefs as Record<string, unknown>)["notifyNewEncounters"] === "boolean"
            ? { notifyNewEncounters: (rawNotifPrefs as Record<string, unknown>)["notifyNewEncounters"] as boolean }
            : {}),
          ...(typeof (rawNotifPrefs as Record<string, unknown>)["notifyReencounter"] === "boolean"
            ? { notifyReencounter: (rawNotifPrefs as Record<string, unknown>)["notifyReencounter"] as boolean }
            : {}),
          ...(typeof (rawNotifPrefs as Record<string, unknown>)["notifyChat"] === "boolean"
            ? { notifyChat: (rawNotifPrefs as Record<string, unknown>)["notifyChat"] as boolean }
            : {}),
        }
      : undefined;

  // Pioneer assignment — grant pioneer status to the first 500 new users.
  // Check count before the upsert so we can decide if this new row qualifies.
  const [{ pioneerCount }] = await db
    .select({ pioneerCount: sql<number>`cast(count(*) as int)` })
    .from(profilesTable)
    .where(eq(profilesTable.isPioneer, true));

  // Only assign on a new row (handled by default(false) + this pre-check).
  const grantPioneer = Number(pioneerCount) < 500;

  const insertValues: typeof profilesTable.$inferInsert = {
    uid,
    uidHash,
    displayName: body.displayName,
    photoUrl: body.photoUrl ?? null,
    bio: body.bio ?? null,
    socials: body.socials ?? {},
    interests: cleanInterests ?? [],
    isVisible: body.isVisible ?? true,
    preferredLocale: cleanLocale ?? null,
    isPioneer: grantPioneer,
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
  if (cleanInterests !== undefined) updateValues.interests = cleanInterests;
  if (cleanLocale !== undefined) updateValues.preferredLocale = cleanLocale;
  if (cleanNotifPrefs !== undefined) updateValues.notificationPrefs = cleanNotifPrefs;

  const [row] = await db
    .insert(profilesTable)
    .values(insertValues)
    .onConflictDoUpdate({
      target: profilesTable.uid,
      set: updateValues,
    })
    .returning();

  await mirrorProfileToFirestore({
    uid: row!.uid,
    uidHash: row!.uidHash,
    displayName: row!.displayName,
    photoUrl: row!.photoUrl ?? null,
    bio: row!.bio ?? null,
    socials: (row!.socials ?? {}) as Record<string, string>,
    interests: (row!.interests ?? []) as string[],
    isVisible: row!.isVisible,
  });

  res.json(UpsertMyProfileResponse.parse(serialize(row!)));
});

// POST /api/profiles/me/push-token
router.post("/profiles/me/push-token", requireUid, async (req, res) => {
  const uid = req.uid!;
  const token =
    typeof req.body?.token === "string" ? req.body.token.trim() : null;
  if (!token || token.length > 1024) {
    res.status(400).json({ message: "token must be a non-empty string" });
    return;
  }
  const updated = await db
    .update(profilesTable)
    .set({ pushToken: token, updatedAt: new Date() })
    .where(eq(profilesTable.uid, uid))
    .returning({ uid: profilesTable.uid });
  if (updated.length === 0) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  try {
    const { adminDb } = await import("../lib/firebaseAdmin");
    await adminDb()
      .collection("users")
      .doc(uid)
      .set({ pushToken: token }, { merge: true });
  } catch (err) {
    req.log.warn({ err }, "push-token: Firestore mirror failed (non-fatal)");
  }

  res.json({ success: true });
});

// GET /api/profiles/me/mutual?with=otherUid
// Returns users who are connected (accepted reveal) with BOTH the caller and otherUid.
router.get("/profiles/me/mutual", requireUid, async (req, res) => {
  const uid = req.uid!;
  const otherUid = typeof req.query["with"] === "string" ? req.query["with"] : null;
  if (!otherUid) {
    res.status(400).json({ message: "with query param required" });
    return;
  }

  // Fetch all accepted reveal pairs that include me
  const myRevs = await db
    .select({
      senderUid: revealRequestsTable.senderUid,
      recipientUid: revealRequestsTable.recipientUid,
    })
    .from(revealRequestsTable)
    .where(
      and(
        eq(revealRequestsTable.status, "accepted"),
        or(
          eq(revealRequestsTable.senderUid, uid),
          eq(revealRequestsTable.recipientUid, uid),
        ),
      ),
    );

  const myConnectionUids = new Set<string>();
  for (const r of myRevs) {
    const peer = r.senderUid === uid ? r.recipientUid : r.senderUid;
    myConnectionUids.add(peer);
  }

  if (myConnectionUids.size === 0) {
    res.json({ count: 0, names: [] });
    return;
  }

  // Fetch all accepted reveal pairs that include otherUid
  const otherRevs = await db
    .select({
      senderUid: revealRequestsTable.senderUid,
      recipientUid: revealRequestsTable.recipientUid,
    })
    .from(revealRequestsTable)
    .where(
      and(
        eq(revealRequestsTable.status, "accepted"),
        or(
          eq(revealRequestsTable.senderUid, otherUid),
          eq(revealRequestsTable.recipientUid, otherUid),
        ),
      ),
    );

  const mutualUids: string[] = [];
  for (const r of otherRevs) {
    const peer: string = r.senderUid === otherUid ? r.recipientUid : r.senderUid;
    if (myConnectionUids.has(peer) && peer !== uid && peer !== otherUid) {
      mutualUids.push(peer);
    }
  }

  if (mutualUids.length === 0) {
    res.json({ count: 0, names: [] });
    return;
  }

  // Fetch display names for up to first 3 mutuals
  const sample = mutualUids.slice(0, 3);
  const profiles = await db
    .select({ uid: profilesTable.uid, displayName: profilesTable.displayName })
    .from(profilesTable)
    .where(inArray(profilesTable.uid, sample));

  const names = profiles.map((p) => p.displayName);
  res.json({ count: mutualUids.length, names });
});

// GET /api/profiles/me/streak
// Computes how many consecutive days (ending today) the user made a new connection.
router.get("/profiles/me/streak", requireUid, async (req, res) => {
  const uid = req.uid!;

  const rows = await db
    .select({ respondedAt: revealRequestsTable.respondedAt })
    .from(revealRequestsTable)
    .where(
      and(
        eq(revealRequestsTable.status, "accepted"),
        or(
          eq(revealRequestsTable.senderUid, uid),
          eq(revealRequestsTable.recipientUid, uid),
        ),
      ),
    );

  const totalConnections = rows.length;

  // Group into unique calendar days (UTC date string YYYY-MM-DD)
  const daySet = new Set<string>();
  for (const r of rows) {
    if (r.respondedAt) {
      daySet.add(r.respondedAt.toISOString().slice(0, 10));
    }
  }

  // Sort days descending (most recent first)
  const days = Array.from(daySet).sort().reverse();

  if (days.length === 0) {
    res.json({ currentStreak: 0, longestStreak: 0, totalConnections: 0 });
    return;
  }

  // Current streak: consecutive days going back from today or yesterday
  const todayStr = new Date().toISOString().slice(0, 10);
  const yest = new Date();
  yest.setUTCDate(yest.getUTCDate() - 1);
  const yesterdayStr = yest.toISOString().slice(0, 10);

  let currentStreak = 0;
  if (days[0] === todayStr || days[0] === yesterdayStr) {
    const startDate = new Date(days[0]);
    startDate.setUTCHours(0, 0, 0, 0);
    let checkDate = startDate;
    currentStreak = 1;
    for (let i = 1; i < days.length; i++) {
      const d = new Date(days[i]);
      d.setUTCHours(0, 0, 0, 0);
      const diffDays = Math.round(
        (checkDate.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays === 1) {
        currentStreak++;
        checkDate = d;
      } else {
        break;
      }
    }
  }

  // Longest streak: scan all days
  let longestStreak = 1;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diffDays = Math.round(
      (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays === 1) {
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 1;
    }
  }

  res.json({ currentStreak, longestStreak, totalConnections });
});

// PATCH /api/profiles/me/notification-prefs
// Lightweight endpoint that only updates the notification_prefs JSONB column.
// Accepts any subset of the known keys; unknown keys are ignored.
router.patch("/profiles/me/notification-prefs", requireUid, async (req, res) => {
  const uid = req.uid!;
  const body = req.body as Record<string, unknown>;
  const prefs: Record<string, boolean> = {};
  const knownKeys = ["notifyNewEncounters", "notifyReencounter", "notifyChat"] as const;
  for (const key of knownKeys) {
    if (typeof body[key] === "boolean") prefs[key] = body[key] as boolean;
  }

  const [existing] = await db
    .select({ notificationPrefs: profilesTable.notificationPrefs })
    .from(profilesTable)
    .where(eq(profilesTable.uid, uid))
    .limit(1);

  if (!existing) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  const merged = { ...(existing.notificationPrefs ?? {}), ...prefs };
  await db
    .update(profilesTable)
    .set({ notificationPrefs: merged, updatedAt: new Date() })
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
