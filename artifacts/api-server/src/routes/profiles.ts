import { Router, type IRouter } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { and, eq, or, inArray, sql } from "drizzle-orm";
import {
  db,
  profilesTable,
  encountersTable,
  presenceTable,
  revealRequestsTable,
  subscriptionsTable,
  venueOwnerProfilesTable,
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
import {
  clearEncounterMirrorsForHiddenUser,
  hideProfileFromFirestore,
  mirrorProfileToFirestore,
} from "../lib/firestoreMirror";
import {
  getExplicitlyKnownUids,
  withProfilePrivacyLocks,
  withProfilePrivacySessionLocks,
} from "../lib/profilePrivacy";
import { deleteUserData } from "../lib/deleteUserData";
import { deleteVenueOwnerProfile } from "../lib/deleteVenueOwnerProfile";
import { deleteVenueStorageFiles } from "../lib/deleteVenueStorageFiles";

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
    visibilityVersion: p.updatedAt.toISOString(),
    notificationPrefs: (p.notificationPrefs ?? null) as {
      notifyNewEncounters?: boolean;
      notifyReencounter?: boolean;
      notifyChat?: boolean;
    } | null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

type ProfilePrivacyTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

async function clearPostgresDiscoveryData(
  tx: ProfilePrivacyTransaction,
  uid: string,
): Promise<void> {
  await tx.delete(presenceTable).where(eq(presenceTable.uid, uid));
  await tx
    .delete(encountersTable)
    .where(
      or(
        eq(encountersTable.observerUid, uid),
        eq(encountersTable.observedUid, uid),
      ),
    );
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
  const [subRow] = await db
    .select({ tier: subscriptionsTable.tier, status: subscriptionsTable.status })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userUid, uid))
    .limit(1);
  const subscriptionTier = (subRow?.tier ?? "free") as "free" | "plus" | "pro";
  const isSubscribed =
    (subRow?.tier === "plus" || subRow?.tier === "pro") &&
    subRow?.status === "active";
  res.json({
    ...GetMyProfileResponse.parse(serialize(row)),
    isPioneer: row.isPioneer,
    referralCount: row.referralCount,
    subscriptionTier,
    isSubscribed,
  });
});

router.put("/profiles/me", requireUid, async (req, res) => {
  const uid = req.uid!;
  const body = UpsertMyProfileBody.parse(req.body);
  const uidHash = uidToHash(uid);
  const outcome = await withProfilePrivacySessionLocks([uid], async (sessionDb) => {
    const committed = await sessionDb.transaction(async (tx) => {
      const existingRows = await tx
        .select({
          isVisible: profilesTable.isVisible,
          updatedAt: profilesTable.updatedAt,
        })
        .from(profilesTable)
        .where(eq(profilesTable.uid, uid))
        .limit(1);
      const existingProfile = Array.isArray(existingRows)
        ? existingRows[0]
        : undefined;

      if (body.isVisible === true) {
        if (typeof body.expectedVisibilityVersion !== "string") {
          return {
            status: 400 as const,
            message: "expectedVisibilityVersion is required to enable visibility",
          };
        }
        if (
          !existingProfile ||
          body.expectedVisibilityVersion !== existingProfile.updatedAt.toISOString()
        ) {
          return {
            status: 409 as const,
            message: "Profile visibility changed. Refresh the profile and retry.",
          };
        }
      }

      // New profiles start Hidden. Omitting isVisible on an existing profile
      // preserves its current state.
      const targetIsVisible =
        body.isVisible ?? existingProfile?.isVisible ?? false;

      // Hide Firestore before committing Hidden. Visible is never mirrored
      // until after the canonical Postgres transaction has committed.
      const hiddenBarrier = targetIsVisible
        ? { ok: true as const }
        : await hideProfileFromFirestore(uid);

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
      // Defensive: the mock chain in tests resolves to a non-array, so guard with Array.isArray.
      let grantPioneer = false;
      const countRows = await tx
        .select({ pioneerCount: sql<number>`cast(count(*) as int)` })
        .from(profilesTable)
        .where(eq(profilesTable.isPioneer, true));
      if (Array.isArray(countRows)) {
        grantPioneer = Number(countRows[0]?.pioneerCount ?? 500) < 500;
      }

      const insertValues: typeof profilesTable.$inferInsert = {
        uid,
        uidHash,
        displayName: body.displayName,
        photoUrl: body.photoUrl ?? null,
        bio: body.bio ?? null,
        socials: body.socials ?? {},
        interests: cleanInterests ?? [],
        isVisible: targetIsVisible,
        preferredLocale: cleanLocale ?? null,
        isPioneer: grantPioneer,
      };
      const updateValues: Partial<typeof profilesTable.$inferInsert> = {
        uidHash,
        displayName: body.displayName,
        photoUrl: body.photoUrl ?? null,
        bio: body.bio ?? null,
        socials: body.socials ?? {},
        // Using a database-side monotonic clock gives the existing updatedAt
        // column enough precision to serve as a stale-write token.
        updatedAt: sql`GREATEST(now(), ${profilesTable.updatedAt} + INTERVAL '1 millisecond')` as unknown as Date,
      };
      if (body.isVisible !== undefined) updateValues.isVisible = body.isVisible;
      if (cleanInterests !== undefined) updateValues.interests = cleanInterests;
      if (cleanLocale !== undefined) updateValues.preferredLocale = cleanLocale;
      if (cleanNotifPrefs !== undefined) updateValues.notificationPrefs = cleanNotifPrefs;

      const [row] = await tx
        .insert(profilesTable)
        .values(insertValues)
        .onConflictDoUpdate({
          target: profilesTable.uid,
          set: updateValues,
        })
        .returning();
      if (!row) throw new Error("Profile upsert did not return a row");

      return { status: 200 as const, row, targetIsVisible, hiddenBarrier };
    });

    if (committed.status !== 200) return committed;

    if (committed.targetIsVisible) {
      const mirror = await mirrorProfileToFirestore({
        uid,
        isVisible: true,
      });
      if (mirror.ok) return { status: 200 as const, row: committed.row };

      // A failed Visible mirror is ambiguous: Firestore may have applied the
      // write before the error. Re-hide Firestore, commit canonical Hidden on
      // this same locked client, then clean stale discovery mirrors.
      const compensationBarrier = await hideProfileFromFirestore(uid);
      const hiddenRow = await sessionDb.transaction(async (tx) => {
        const [row] = await tx
          .update(profilesTable)
          .set({
            isVisible: false,
            updatedAt: sql`GREATEST(now(), ${profilesTable.updatedAt} + INTERVAL '1 millisecond')`,
          })
          .where(eq(profilesTable.uid, uid))
          .returning();
        return row;
      });
      if (!hiddenRow) {
        return {
          status: 503 as const,
          message:
            "Visibility could not be confirmed. Retry this update; the profile must remain hidden until synchronization succeeds.",
        };
      }

      let postgresCleanupOk = true;
      try {
        await sessionDb.transaction((tx) => clearPostgresDiscoveryData(tx, uid));
      } catch (err) {
        postgresCleanupOk = false;
        req.log?.error({ err, uid }, "Failed to clear Postgres discovery data after opt-in mirror failure");
      }
      const hiddenMirror = await mirrorProfileToFirestore({ uid, isVisible: false });
      const firestoreCleanup = await clearEncounterMirrorsForHiddenUser(uid);
      if (
        !compensationBarrier.ok ||
        !hiddenMirror.ok ||
        !postgresCleanupOk ||
        !firestoreCleanup.ok
      ) {
        return {
          status: 503 as const,
          message:
            "Visibility could not be synchronized. The canonical profile is Hidden; retry this update.",
        };
      }
      return {
        status: 503 as const,
        message:
          "The profile remains Hidden because its Visible mirror could not be confirmed. Retry this update.",
      };
    }

    const mirror = await mirrorProfileToFirestore({ uid, isVisible: false });
    let postgresCleanupOk = true;
    try {
      await sessionDb.transaction((tx) => clearPostgresDiscoveryData(tx, uid));
    } catch (err) {
      postgresCleanupOk = false;
      req.log?.error({ err, uid }, "Failed to clear Postgres discovery data for Hidden profile");
    }
    const firestoreCleanup = await clearEncounterMirrorsForHiddenUser(uid);

    if (!committed.hiddenBarrier.ok) {
      return {
        status: 503 as const,
        message:
          "Privacy settings were saved and your profile remains hidden, but Firestore could not confirm the privacy barrier. Retry this update.",
      };
    }
    if (!mirror.ok) {
      return {
        status: 503 as const,
        message:
          "Privacy settings were saved, but the profile mirror could not be confirmed. Your profile remains hidden; retry this update.",
      };
    }
    if (!postgresCleanupOk || !firestoreCleanup.ok) {
      return {
        status: 503 as const,
        message:
          "Privacy settings were saved, but stale encounter data could not be cleared. Retry this update.",
      };
    }
    return { status: 200 as const, row: committed.row };
  });

  if (outcome.status !== 200) {
    res.status(outcome.status).json({ message: outcome.message });
    return;
  }
  res.json(UpsertMyProfileResponse.parse(serialize(outcome.row)));
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
  const updated = await withProfilePrivacyLocks([uid], async (tx) =>
    tx
      .update(profilesTable)
      .set({
        pushToken: token,
        updatedAt: sql`GREATEST(now(), ${profilesTable.updatedAt} + INTERVAL '1 millisecond')`,
      })
      .where(eq(profilesTable.uid, uid))
      .returning({ uid: profilesTable.uid }),
  );
  if (updated.length === 0) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  try {
    const { adminDb } = await import("../lib/firebaseAdmin");
    await adminDb()
      .collection("users")
      .doc(uid)
      .update({ pushToken: FieldValue.delete() });
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
  const [otherProfile] = await db
    .select({ uid: profilesTable.uid, isVisible: profilesTable.isVisible })
    .from(profilesTable)
    .where(eq(profilesTable.uid, otherUid))
    .limit(1);
  if (!otherProfile) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }
  if (!otherProfile.isVisible) {
    const known = await getExplicitlyKnownUids(uid, [otherUid]);
    if (!known.has(otherUid)) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }
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

  const outcome = await withProfilePrivacyLocks([uid], async (tx) => {
    const existingRows = await tx
      .select({ notificationPrefs: profilesTable.notificationPrefs })
      .from(profilesTable)
      .where(eq(profilesTable.uid, uid))
      .limit(1);
    const existing = Array.isArray(existingRows) ? existingRows[0] : undefined;
    if (!existing) return { status: 404 as const };

    const merged = { ...(existing.notificationPrefs ?? {}), ...prefs };
    await tx
      .update(profilesTable)
      .set({
        notificationPrefs: merged,
        updatedAt: sql`GREATEST(now(), ${profilesTable.updatedAt} + INTERVAL '1 millisecond')`,
      })
      .where(eq(profilesTable.uid, uid));
    return { status: 200 as const };
  });

  if (outcome.status === 404) {
    res.status(404).json({ message: "Profile not found" });
    return;
  }

  res.json({ success: true });
});

router.get("/profiles/:uid", requireUid, async (req, res) => {
  const callerUid = req.uid!;
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
  if (!row.isVisible && callerUid !== row.uid) {
    const known = await getExplicitlyKnownUids(callerUid, [row.uid]);
    if (!known.has(row.uid)) {
      // Use the same response as a nonexistent UID to avoid hidden-profile
      // enumeration through the authenticated profile endpoint.
      res.status(404).json({ message: "Profile not found" });
      return;
    }
  }
  res.json(GetProfileResponse.parse(serialize(row)));
});

// DELETE /api/profiles/me
// Permanently deletes the authenticated user's account and all associated data
// from Postgres, Firestore, and Firebase Auth. Irreversible.
// Body: { deleteVenueProfile?: boolean } — when true, also removes the venue
// owner profile and all its events, rewards, and announcements.
router.delete("/profiles/me", requireUid, async (req, res) => {
  const uid = req.uid!;
  if (req.body?.deleteVenueProfile === true) {
    // Look up the owner profile so we have both id and ownerUid for the cascade.
    const [ownerProfile] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(eq(venueOwnerProfilesTable.ownerUid, uid))
      .limit(1);

    if (ownerProfile) {
      // Full 13-table cascade: business, manager accounts, memberships, events,
      // RSVPs, rewards, announcements, application history, and the profile row.
      // deleteVenueOwnerProfile returns event image URLs collected before deletion.
      let eventImageUrls: string[] = [];
      await db.transaction(async (tx) => {
        eventImageUrls = await deleteVenueOwnerProfile(tx, ownerProfile);
      });

      // Best-effort: delete Storage files for venue cover photo, logo, and event
      // images. Only URLs that target the configured default bucket and begin
      // with a known venue-generated prefix are acted on; others are skipped.
      await deleteVenueStorageFiles(
        [ownerProfile.coverPhotoUrl, ownerProfile.logoUrl, ...eventImageUrls],
        { uid },
      );
    }
  }
  await deleteUserData(uid);
  req.log.info({ uid, deletedVenueProfile: !!req.body?.deleteVenueProfile }, "User account fully deleted");
  res.status(204).send();
});

export default router;
