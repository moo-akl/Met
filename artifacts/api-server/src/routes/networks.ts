import { Router, type IRouter } from "express";
import { eq, and, sql, ilike, desc, inArray } from "drizzle-orm";
import {
  db,
  networksTable,
  networkMembersTable,
  profilesTable,
  networkAnnouncementsTable,
  networkPollOptionsTable,
  networkPollVotesTable,
  networkQuestionnaireQuestionsTable,
  networkQuestionnaireAnswersTable,
  type Network,
  type NetworkMember,
  type Profile,
} from "@workspace/db";
import {
  ResolveNeighborhoodQueryParams,
  CreateNetworkBody,
  UpdateNetworkBody,
  ListNetworksQueryParams,
  GetNetworkParams,
  JoinNetworkParams,
  LeaveNetworkParams,
  ListNetworkMembersParams,
  ListPendingMembersParams,
  ApproveNetworkMemberParams,
  ApproveNetworkMemberBody,
  RemoveNetworkMemberParams,
  UpdateNetworkMemberRoleParams,
  UpdateNetworkMemberRoleBody,
  InviteToNetworkParams,
  InviteToNetworkBody,
  ListAnnouncementsParams,
  CreateAnnouncementParams,
  CreateAnnouncementBody,
  DeleteAnnouncementParams,
  UpdateAnnouncementParams,
  UpdateAnnouncementBody,
  GetAnnouncementAnswersParams,
  CastAnnouncementVoteParams,
  CastAnnouncementVoteBody,
  SubmitAnnouncementAnswersParams,
  SubmitAnnouncementAnswersBody,
} from "@workspace/api-zod";
import { z } from "zod/v4";
import { adminStorage } from "../lib/firebaseAdmin";
import { requireUid } from "../middlewares/requireUid";
import { createUserRateLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

const NetworkByCodeParams = z.object({ code: z.string().min(8).max(8) });

const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

async function ensureUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode();
    const [existing] = await db
      .select({ id: networksTable.id })
      .from(networksTable)
      .where(eq(networksTable.inviteCode, code))
      .limit(1);
    if (!existing) return code;
  }
  throw new Error("Could not generate unique invite code");
}

const networkWriteLimit = createUserRateLimiter({
  windowMs: 60_000,
  max: 20,
  name: "user-network-write",
});

// ── Serializers ──────────────────────────────────────────────────────────────

function serializeMembership(m: NetworkMember) {
  return {
    networkId: m.networkId,
    uid: m.uid,
    role: m.role,
    status: m.status,
    joinedAt: m.joinedAt.toISOString(),
    invitedByUid: m.invitedByUid ?? null,
  };
}

function serializeNetwork(n: Network, membership?: NetworkMember | null) {
  return {
    id: n.id,
    name: n.name,
    description: n.description ?? null,
    category: n.category,
    createdByUid: n.createdByUid,
    isPublic: n.isPublic,
    requiresApproval: n.requiresApproval,
    locationLat: n.locationLat ?? null,
    locationLng: n.locationLng ?? null,
    locationRadiusKm: n.locationRadiusKm ?? null,
    neighborhoodName: n.neighborhoodName ?? null,
    inviteCode: n.inviteCode ?? null,
    memberCount: n.memberCount,
    photoUrl: n.photoUrl ?? null,
    coverPhotoUrl: n.coverPhotoUrl ?? null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    myMembership: membership !== undefined ? (membership ? serializeMembership(membership) : null) : null,
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
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// ── Haversine distance (km) ──────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Nominatim reverse geocoding ──────────────────────────────────────────────

async function nominatimReverse(lat: number, lng: number): Promise<{
  name: string;
  city: string | null;
  country: string | null;
}> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "MetApp/1.0 (met-proximity-app)" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const data = (await res.json()) as { address?: Record<string, string> };
  const addr = data.address ?? {};
  const name =
    addr.neighbourhood ??
    addr.suburb ??
    addr.quarter ??
    addr.city_district ??
    addr.borough ??
    addr.city ??
    addr.town ??
    addr.village ??
    "Unknown Area";
  const city = addr.city ?? addr.town ?? addr.village ?? null;
  const country = addr.country ?? null;
  return { name, city, country };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getMembership(
  networkId: number,
  uid: string,
): Promise<NetworkMember | null> {
  const [row] = await db
    .select()
    .from(networkMembersTable)
    .where(
      and(
        eq(networkMembersTable.networkId, networkId),
        eq(networkMembersTable.uid, uid),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ── GET /networks/resolve-neighborhood ───────────────────────────────────────

router.get("/networks/resolve-neighborhood", requireUid, async (req, res) => {
  const query = ResolveNeighborhoodQueryParams.parse({
    lat: req.query.lat,
    lng: req.query.lng,
  });
  try {
    const result = await nominatimReverse(query.lat, query.lng);
    res.json({ ...result, lat: query.lat, lng: query.lng });
  } catch {
    res.status(502).json({ message: "Could not resolve neighborhood" });
  }
});

// ── GET /networks/mine ────────────────────────────────────────────────────────

router.get("/networks/mine", requireUid, async (req, res) => {
  const uid = req.uid!;
  const memberships = await db
    .select()
    .from(networkMembersTable)
    .where(
      and(
        eq(networkMembersTable.uid, uid),
        eq(networkMembersTable.status, "active"),
      ),
    );
  if (memberships.length === 0) {
    res.json([]);
    return;
  }
  const ids = memberships.map((m) => m.networkId);
  const networks = await db
    .select()
    .from(networksTable)
    .where(inArray(networksTable.id, ids));
  const membershipByNetworkId = new Map(memberships.map((m) => [m.networkId, m]));
  res.json(networks.map((n) => serializeNetwork(n, membershipByNetworkId.get(n.id) ?? null)));
});

// ── POST /networks ────────────────────────────────────────────────────────────

router.post("/networks", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const body = CreateNetworkBody.parse(req.body);

  let neighborhoodName: string | null = null;
  if (body.category === "neighborhood" && body.locationLat != null && body.locationLng != null) {
    try {
      const geo = await nominatimReverse(body.locationLat, body.locationLng);
      neighborhoodName = geo.name;
    } catch {
      // Non-fatal: store coordinates without resolved name
    }
  }

  const inviteCode = await ensureUniqueInviteCode();

  const [network] = await db
    .insert(networksTable)
    .values({
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      category: body.category,
      createdByUid: uid,
      isPublic: body.isPublic ?? true,
      requiresApproval: body.requiresApproval ?? false,
      locationLat: body.locationLat ?? null,
      locationLng: body.locationLng ?? null,
      locationRadiusKm: body.locationRadiusKm ?? 2,
      neighborhoodName,
      inviteCode,
      memberCount: 1,
    })
    .returning();

  // Creator auto-joins as admin
  await db.insert(networkMembersTable).values({
    networkId: network!.id,
    uid,
    role: "admin",
    status: "active",
  });

  const membership = await getMembership(network!.id, uid);
  res.status(201).json(serializeNetwork(network!, membership));
});

// ── GET /networks ─────────────────────────────────────────────────────────────

router.get("/networks", requireUid, async (req, res) => {
  const uid = req.uid!;
  const query = ListNetworksQueryParams.parse({
    category: req.query.category,
    q: req.query.q,
    lat: req.query.lat,
    lng: req.query.lng,
    limit: req.query.limit,
    offset: req.query.offset,
  });

  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  let rows = await db
    .select()
    .from(networksTable)
    .where(
      and(
        eq(networksTable.isPublic, true),
        query.category ? eq(networksTable.category, query.category as "university" | "work" | "neighborhood" | "custom") : undefined,
        query.q ? ilike(networksTable.name, `%${query.q}%`) : undefined,
      ),
    )
    .orderBy(desc(networksTable.memberCount))
    .limit(limit + 10) // fetch a few extra for distance filtering
    .offset(offset);

  // For neighborhood category with location, filter by proximity
  if (query.category === "neighborhood" && query.lat != null && query.lng != null) {
    rows = rows.filter((n) => {
      if (n.locationLat == null || n.locationLng == null) return true;
      const dist = haversineKm(query.lat!, query.lng!, n.locationLat, n.locationLng);
      const radius = n.locationRadiusKm ?? 10;
      return dist <= radius;
    });
  }

  rows = rows.slice(0, limit);

  // Get caller's membership for each network
  const ids = rows.map((n) => n.id);
  const memberships =
    ids.length > 0
      ? await db
          .select()
          .from(networkMembersTable)
          .where(
            and(
              eq(networkMembersTable.uid, uid),
              inArray(networkMembersTable.networkId, ids),
            ),
          )
      : [];
  const membershipMap = new Map(memberships.map((m) => [m.networkId, m]));

  res.json(rows.map((n) => serializeNetwork(n, membershipMap.get(n.id) ?? null)));
});

// ── GET /networks/:id ─────────────────────────────────────────────────────────

router.get("/networks/:id", requireUid, async (req, res) => {
  const uid = req.uid!;
  const { id } = GetNetworkParams.parse({ id: req.params.id });
  const [network] = await db
    .select()
    .from(networksTable)
    .where(eq(networksTable.id, id))
    .limit(1);
  if (!network) {
    res.status(404).json({ message: "Network not found" });
    return;
  }
  const membership = await getMembership(id, uid);
  res.json(serializeNetwork(network, membership));
});

// ── POST /networks/:id/join ───────────────────────────────────────────────────

router.post("/networks/:id/join", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const { id } = JoinNetworkParams.parse({ id: req.params.id });

  const [network] = await db
    .select()
    .from(networksTable)
    .where(eq(networksTable.id, id))
    .limit(1);
  if (!network) {
    res.status(404).json({ message: "Network not found" });
    return;
  }

  const existing = await getMembership(id, uid);
  if (existing && (existing.status === "active" || existing.status === "pending")) {
    res.status(409).json({ message: "Already a member" });
    return;
  }

  const status = network.requiresApproval ? "pending" : "active";

  await db
    .insert(networkMembersTable)
    .values({ networkId: id, uid, role: "member", status })
    .onConflictDoUpdate({
      target: [networkMembersTable.networkId, networkMembersTable.uid],
      set: { status, role: "member" },
    });

  if (status === "active") {
    await db
      .update(networksTable)
      .set({ memberCount: sql`${networksTable.memberCount} + 1`, updatedAt: new Date() })
      .where(eq(networksTable.id, id));
  }

  res.json({ status });
});

// ── DELETE /networks/:id/members/me ──────────────────────────────────────────

router.delete("/networks/:id/members/me", requireUid, async (req, res) => {
  const uid = req.uid!;
  const { id } = LeaveNetworkParams.parse({ id: req.params.id });

  const existing = await getMembership(id, uid);
  if (!existing) {
    res.status(404).json({ message: "Not a member" });
    return;
  }

  await db
    .delete(networkMembersTable)
    .where(
      and(
        eq(networkMembersTable.networkId, id),
        eq(networkMembersTable.uid, uid),
      ),
    );

  if (existing.status === "active") {
    await db
      .update(networksTable)
      .set({
        memberCount: sql`GREATEST(${networksTable.memberCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(networksTable.id, id));
  }

  res.json({ success: true });
});

// ── GET /networks/:id/members ─────────────────────────────────────────────────

router.get("/networks/:id/members", requireUid, async (req, res) => {
  const { id } = ListNetworkMembersParams.parse({ id: req.params.id });

  const [network] = await db
    .select({ id: networksTable.id })
    .from(networksTable)
    .where(eq(networksTable.id, id))
    .limit(1);
  if (!network) {
    res.status(404).json({ message: "Network not found" });
    return;
  }

  const members = await db
    .select()
    .from(networkMembersTable)
    .where(
      and(
        eq(networkMembersTable.networkId, id),
        eq(networkMembersTable.status, "active"),
      ),
    )
    .limit(100);

  if (members.length === 0) {
    res.json([]);
    return;
  }

  const uids = members.map((m) => m.uid);
  const profiles = await db
    .select()
    .from(profilesTable)
    .where(inArray(profilesTable.uid, uids));
  const profileMap = new Map(profiles.map((p) => [p.uid, p]));

  const result = members
    .filter((m) => profileMap.has(m.uid))
    .map((m) => ({
      ...serializeMembership(m),
      profile: serializeProfile(profileMap.get(m.uid)!),
    }));

  res.json(result);
});

// ── PATCH /networks/:id ───────────────────────────────────────────────────────

router.patch("/networks/:id", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const { id } = GetNetworkParams.parse({ id: req.params.id });

  const [network] = await db
    .select()
    .from(networksTable)
    .where(eq(networksTable.id, id))
    .limit(1);
  if (!network) {
    res.status(404).json({ message: "Network not found" });
    return;
  }

  const membership = await getMembership(id, uid);
  if (!membership || membership.role !== "admin" || membership.status !== "active") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  const body = UpdateNetworkBody.parse(req.body);

  let neighborhoodName = network.neighborhoodName;
  if (
    (body.category === "neighborhood" || network.category === "neighborhood") &&
    body.locationLat != null && body.locationLng != null &&
    (body.locationLat !== network.locationLat || body.locationLng !== network.locationLng)
  ) {
    try {
      const geo = await nominatimReverse(body.locationLat, body.locationLng);
      neighborhoodName = geo.name;
    } catch { /* non-fatal */ }
  }

  const [updated] = await db
    .update(networksTable)
    .set({
      ...(body.name != null && { name: body.name.trim() }),
      ...(body.description !== undefined && {
        description: body.description?.trim() ?? null,
      }),
      ...(body.category != null && { category: body.category }),
      ...(body.isPublic != null && { isPublic: body.isPublic }),
      ...(body.requiresApproval != null && {
        requiresApproval: body.requiresApproval,
      }),
      ...(body.locationLat !== undefined && {
        locationLat: body.locationLat ?? null,
      }),
      ...(body.locationLng !== undefined && {
        locationLng: body.locationLng ?? null,
      }),
      ...(body.locationRadiusKm !== undefined && {
        locationRadiusKm: body.locationRadiusKm ?? null,
      }),
      ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl ?? null }),
      ...(body.coverPhotoUrl !== undefined && { coverPhotoUrl: body.coverPhotoUrl ?? null }),
      ...((body.category === "neighborhood" ||
        (body.locationLat != null && body.locationLng != null)) && {
        neighborhoodName,
      }),
      updatedAt: new Date(),
    })
    .where(eq(networksTable.id, id))
    .returning();

  res.json(serializeNetwork(updated!, membership));
});

// ── DELETE /networks/:id ──────────────────────────────────────────────────────

router.delete("/networks/:id", requireUid, async (req, res) => {
  const uid = req.uid!;
  const { id } = GetNetworkParams.parse({ id: req.params.id });

  const [network] = await db
    .select()
    .from(networksTable)
    .where(eq(networksTable.id, id))
    .limit(1);
  if (!network) {
    res.status(404).json({ message: "Network not found" });
    return;
  }

  const membership = await getMembership(id, uid);
  if (!membership || membership.role !== "admin" || membership.status !== "active") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  await db.delete(networkMembersTable).where(eq(networkMembersTable.networkId, id));
  await db.delete(networksTable).where(eq(networksTable.id, id));

  res.json({ success: true });
});

// ── GET /networks/:id/pending ─────────────────────────────────────────────────

router.get("/networks/:id/pending", requireUid, async (req, res) => {
  const uid = req.uid!;
  const { id } = ListPendingMembersParams.parse({ id: req.params.id });

  const [network] = await db
    .select({ id: networksTable.id })
    .from(networksTable)
    .where(eq(networksTable.id, id))
    .limit(1);
  if (!network) {
    res.status(404).json({ message: "Network not found" });
    return;
  }

  const membership = await getMembership(id, uid);
  if (!membership || membership.role !== "admin" || membership.status !== "active") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  const pending = await db
    .select()
    .from(networkMembersTable)
    .where(
      and(
        eq(networkMembersTable.networkId, id),
        eq(networkMembersTable.status, "pending"),
      ),
    )
    .limit(100);

  if (pending.length === 0) {
    res.json([]);
    return;
  }

  const uids = pending.map((m) => m.uid);
  const profiles = await db
    .select()
    .from(profilesTable)
    .where(inArray(profilesTable.uid, uids));
  const profileMap = new Map(profiles.map((p) => [p.uid, p]));

  const result = pending
    .filter((m) => profileMap.has(m.uid))
    .map((m) => ({
      ...serializeMembership(m),
      profile: serializeProfile(profileMap.get(m.uid)!),
    }));

  res.json(result);
});

// ── POST /networks/:id/members/:uid/approve ───────────────────────────────────

router.post("/networks/:id/members/:uid/approve", requireUid, async (req, res) => {
  const callerUid = req.uid!;
  const { id, uid: targetUid } = ApproveNetworkMemberParams.parse({ id: req.params.id, uid: req.params.uid });
  const body = ApproveNetworkMemberBody.parse(req.body);

  const callerMembership = await getMembership(id, callerUid);
  if (!callerMembership || callerMembership.role !== "admin" || callerMembership.status !== "active") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  const targetMembership = await getMembership(id, targetUid);
  if (!targetMembership || targetMembership.status !== "pending") {
    res.status(404).json({ message: "Pending request not found" });
    return;
  }

  if (body.approve) {
    await db
      .update(networkMembersTable)
      .set({ status: "active" })
      .where(
        and(
          eq(networkMembersTable.networkId, id),
          eq(networkMembersTable.uid, targetUid),
        ),
      );
    await db
      .update(networksTable)
      .set({
        memberCount: sql`${networksTable.memberCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(networksTable.id, id));
  } else {
    await db
      .delete(networkMembersTable)
      .where(
        and(
          eq(networkMembersTable.networkId, id),
          eq(networkMembersTable.uid, targetUid),
        ),
      );
  }

  res.json({ approved: body.approve });
});

// ── DELETE /networks/:id/members/:uid ────────────────────────────────────────

router.delete("/networks/:id/members/:uid", requireUid, async (req, res) => {
  const callerUid = req.uid!;
  const { id, uid: targetUid } = RemoveNetworkMemberParams.parse({ id: req.params.id, uid: req.params.uid });

  if (targetUid === callerUid) {
    res.status(400).json({ message: "Use leave to remove yourself" });
    return;
  }

  const callerMembership = await getMembership(id, callerUid);
  if (!callerMembership || callerMembership.role !== "admin" || callerMembership.status !== "active") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  const targetMembership = await getMembership(id, targetUid);
  if (!targetMembership) {
    res.status(404).json({ message: "Member not found" });
    return;
  }

  await db
    .delete(networkMembersTable)
    .where(
      and(
        eq(networkMembersTable.networkId, id),
        eq(networkMembersTable.uid, targetUid),
      ),
    );

  if (targetMembership.status === "active") {
    await db
      .update(networksTable)
      .set({
        memberCount: sql`GREATEST(${networksTable.memberCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(networksTable.id, id));
  }

  res.json({ success: true });
});

// ── PATCH /networks/:id/members/:uid ─────────────────────────────────────────

router.patch("/networks/:id/members/:uid", requireUid, async (req, res) => {
  const callerUid = req.uid!;
  const { id, uid: targetUid } = UpdateNetworkMemberRoleParams.parse({ id: req.params.id, uid: req.params.uid });
  const body = UpdateNetworkMemberRoleBody.parse(req.body);

  const callerMembership = await getMembership(id, callerUid);
  if (!callerMembership || callerMembership.role !== "admin" || callerMembership.status !== "active") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }

  const targetMembership = await getMembership(id, targetUid);
  if (!targetMembership || targetMembership.status !== "active") {
    res.status(404).json({ message: "Active member not found" });
    return;
  }

  await db
    .update(networkMembersTable)
    .set({ role: body.role })
    .where(
      and(
        eq(networkMembersTable.networkId, id),
        eq(networkMembersTable.uid, targetUid),
      ),
    );

  res.json({ success: true });
});

// ── POST /networks/:id/invite ─────────────────────────────────────────────────

router.post("/networks/:id/invite", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const { id } = InviteToNetworkParams.parse({ id: req.params.id });
  const body = InviteToNetworkBody.parse(req.body);

  const [network] = await db
    .select()
    .from(networksTable)
    .where(eq(networksTable.id, id))
    .limit(1);
  if (!network) {
    res.status(404).json({ message: "Network not found" });
    return;
  }

  // Inviter must be an active member
  const inviterMembership = await getMembership(id, uid);
  if (!inviterMembership || inviterMembership.status !== "active") {
    res.status(403).json({ message: "Must be a member to invite" });
    return;
  }

  const existing = await getMembership(id, body.uid);
  if (existing && (existing.status === "active" || existing.status === "pending")) {
    res.status(409).json({ message: "Already a member" });
    return;
  }

  await db
    .insert(networkMembersTable)
    .values({
      networkId: id,
      uid: body.uid,
      role: "member",
      status: "active",
      invitedByUid: uid,
    })
    .onConflictDoUpdate({
      target: [networkMembersTable.networkId, networkMembersTable.uid],
      set: { status: "active", invitedByUid: uid },
    });

  await db
    .update(networksTable)
    .set({ memberCount: sql`${networksTable.memberCount} + 1`, updatedAt: new Date() })
    .where(eq(networksTable.id, id));

  res.json({ success: true });
});

// ── Announcement photo upload helpers ────────────────────────────────────────

const ALLOWED_ANN_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AnnPhotoContentType = (typeof ALLOWED_ANN_PHOTO_TYPES)[number];

function extForAnnPhoto(ct: AnnPhotoContentType): string {
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  return "jpg";
}

// ── POST /networks/:id/announcements/photo ────────────────────────────────────

router.post("/networks/:id/announcements/photo", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const networkId = parseInt(String(req.params.id), 10);
  if (isNaN(networkId)) {
    res.status(404).json({ message: "Network not found" });
    return;
  }
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ message: "Only admins can upload announcement photos" });
    return;
  }
  const { base64, contentType = "image/jpeg" } = req.body as { base64?: string; contentType?: string };
  if (!base64 || typeof base64 !== "string") {
    res.status(400).json({ message: "base64 image data required" });
    return;
  }
  if (!ALLOWED_ANN_PHOTO_TYPES.includes(contentType as AnnPhotoContentType)) {
    res.status(400).json({ message: "Unsupported image type" });
    return;
  }
  const ct = contentType as AnnPhotoContentType;
  const ext = extForAnnPhoto(ct);
  const buf = Buffer.from(base64, "base64");
  const objectPath = `network-announcement-photos/${networkId}/${Date.now()}-${uid.slice(0, 8)}.${ext}`;
  const bucket = adminStorage().bucket();
  const file = bucket.file(objectPath);
  try {
    await file.save(buf, { contentType: ct, resumable: false });
  } catch (err) {
    req.log?.error?.({ err }, "announcement photo upload failed");
    res.status(500).json({ message: "Photo upload failed" });
    return;
  }
  try {
    await file.makePublic();
    res.json({ photoUrl: `https://storage.googleapis.com/${bucket.name}/${objectPath}?v=${Date.now()}` });
    return;
  } catch { /* fall through to token path */ }
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
  } catch (err) {
    req.log?.error?.({ err }, "setMetadata failed for announcement photo");
    res.status(500).json({ message: "Photo upload failed" });
    return;
  }
  res.json({
    photoUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`,
  });
});

// ── POST /networks/:id/photo ──────────────────────────────────────────────────

router.post("/networks/:id/photo", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const networkId = parseInt(String(req.params.id), 10);
  if (isNaN(networkId)) { res.status(404).json({ message: "Network not found" }); return; }
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ message: "Only admins can upload network photos" });
    return;
  }
  const { base64, contentType = "image/jpeg" } = req.body as { base64?: string; contentType?: string };
  if (!base64 || typeof base64 !== "string") { res.status(400).json({ message: "base64 image data required" }); return; }
  if (!ALLOWED_ANN_PHOTO_TYPES.includes(contentType as AnnPhotoContentType)) { res.status(400).json({ message: "Unsupported image type" }); return; }
  const ct = contentType as AnnPhotoContentType;
  const ext = extForAnnPhoto(ct);
  const buf = Buffer.from(base64, "base64");
  const objectPath = `network-photos/${networkId}/profile-${Date.now()}.${ext}`;
  const bucket = adminStorage().bucket();
  const file = bucket.file(objectPath);
  try { await file.save(buf, { contentType: ct, resumable: false }); }
  catch (err) { req.log?.error?.({ err }, "network photo upload failed"); res.status(500).json({ message: "Photo upload failed" }); return; }
  try {
    await file.makePublic();
    const photoUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}?v=${Date.now()}`;
    await db.update(networksTable).set({ photoUrl }).where(eq(networksTable.id, networkId));
    res.json({ photoUrl });
    return;
  } catch { /* fall through to token path */ }
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try { await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } }); }
  catch (err) { req.log?.error?.({ err }, "setMetadata failed for network photo"); res.status(500).json({ message: "Photo upload failed" }); return; }
  const photoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
  await db.update(networksTable).set({ photoUrl }).where(eq(networksTable.id, networkId));
  res.json({ photoUrl });
});

// ── POST /networks/:id/cover-photo ────────────────────────────────────────────

router.post("/networks/:id/cover-photo", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const networkId = parseInt(String(req.params.id), 10);
  if (isNaN(networkId)) { res.status(404).json({ message: "Network not found" }); return; }
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ message: "Only admins can upload network cover photos" });
    return;
  }
  const { base64, contentType = "image/jpeg" } = req.body as { base64?: string; contentType?: string };
  if (!base64 || typeof base64 !== "string") { res.status(400).json({ message: "base64 image data required" }); return; }
  if (!ALLOWED_ANN_PHOTO_TYPES.includes(contentType as AnnPhotoContentType)) { res.status(400).json({ message: "Unsupported image type" }); return; }
  const ct = contentType as AnnPhotoContentType;
  const ext = extForAnnPhoto(ct);
  const buf = Buffer.from(base64, "base64");
  const objectPath = `network-photos/${networkId}/cover-${Date.now()}.${ext}`;
  const bucket = adminStorage().bucket();
  const file = bucket.file(objectPath);
  try { await file.save(buf, { contentType: ct, resumable: false }); }
  catch (err) { req.log?.error?.({ err }, "network cover photo upload failed"); res.status(500).json({ message: "Photo upload failed" }); return; }
  try {
    await file.makePublic();
    const coverPhotoUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}?v=${Date.now()}`;
    await db.update(networksTable).set({ coverPhotoUrl }).where(eq(networksTable.id, networkId));
    res.json({ coverPhotoUrl });
    return;
  } catch { /* fall through to token path */ }
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try { await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } }); }
  catch (err) { req.log?.error?.({ err }, "setMetadata failed for network cover photo"); res.status(500).json({ message: "Photo upload failed" }); return; }
  const coverPhotoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
  await db.update(networksTable).set({ coverPhotoUrl }).where(eq(networksTable.id, networkId));
  res.json({ coverPhotoUrl });
});

// ── Announcement response builder ─────────────────────────────────────────────
// Fetches all related data for a single announcement and returns a shaped object
// that matches the Announcement OpenAPI schema.

async function buildAnnouncementResponse(annId: number, uid: string) {
  const [ann] = await db
    .select()
    .from(networkAnnouncementsTable)
    .where(eq(networkAnnouncementsTable.id, annId))
    .limit(1);
  if (!ann) return null;
  const [options, votes, questions, authorProfiles] = await Promise.all([
    db
      .select()
      .from(networkPollOptionsTable)
      .where(eq(networkPollOptionsTable.announcementId, annId))
      .orderBy(networkPollOptionsTable.displayOrder),
    db
      .select()
      .from(networkPollVotesTable)
      .where(eq(networkPollVotesTable.announcementId, annId)),
    db
      .select()
      .from(networkQuestionnaireQuestionsTable)
      .where(eq(networkQuestionnaireQuestionsTable.announcementId, annId))
      .orderBy(networkQuestionnaireQuestionsTable.displayOrder),
    db
      .select({ displayName: profilesTable.displayName, photoUrl: profilesTable.photoUrl })
      .from(profilesTable)
      .where(eq(profilesTable.uid, ann.authorUid))
      .limit(1),
  ]);
  const authorProfile = authorProfiles[0];
  const qIds = questions.map((q) => q.id);
  const answers =
    qIds.length > 0
      ? await db
          .select()
          .from(networkQuestionnaireAnswersTable)
          .where(inArray(networkQuestionnaireAnswersTable.questionId, qIds))
      : [];
  const myVote = votes.find((v) => v.uid === uid);
  const myAnsweredQIds = new Set(
    answers
      .filter((a) => a.uid === uid && questions.some((q) => q.id === a.questionId))
      .map((a) => a.questionId),
  );
  return {
    id: ann.id,
    networkId: ann.networkId,
    authorUid: ann.authorUid,
    authorDisplayName: authorProfile?.displayName ?? null,
    authorPhotoUrl: authorProfile?.photoUrl ?? null,
    body: ann.body,
    photoUrl: ann.photoUrl ?? null,
    type: ann.type,
    isPinned: ann.isPinned,
    createdAt: ann.createdAt.toISOString(),
    options:
      ann.type === "poll"
        ? options.map((o) => ({
            id: o.id,
            label: o.label,
            displayOrder: o.displayOrder,
            voteCount: votes.filter((v) => v.optionId === o.id).length,
          }))
        : null,
    myVoteOptionId: myVote?.optionId ?? null,
    questions:
      ann.type === "questionnaire"
        ? questions.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            displayOrder: q.displayOrder,
            myAnswer: answers.find((a) => a.questionId === q.id && a.uid === uid)?.answerText ?? null,
          }))
        : null,
    hasAnswered:
      ann.type === "questionnaire"
        ? questions.length > 0 && questions.every((q) => myAnsweredQIds.has(q.id))
        : null,
  };
}

// ── GET /networks/:id/announcements ──────────────────────────────────────────

router.get("/networks/:id/announcements", requireUid, async (req, res) => {
  const uid = req.uid!;
  const { id: networkId } = ListAnnouncementsParams.parse({ id: parseInt(String(req.params.id), 10) });
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.status !== "active") {
    res.status(403).json({ message: "Not a member" });
    return;
  }
  const announcements = await db
    .select()
    .from(networkAnnouncementsTable)
    .where(eq(networkAnnouncementsTable.networkId, networkId))
    .orderBy(desc(networkAnnouncementsTable.isPinned), desc(networkAnnouncementsTable.createdAt))
    .limit(50);
  if (announcements.length === 0) {
    res.json([]);
    return;
  }
  const annIds = announcements.map((a) => a.id);
  const authorUids = [...new Set(announcements.map((a) => a.authorUid))];
  const [options, votes, questions, authorProfileRows] = await Promise.all([
    db
      .select()
      .from(networkPollOptionsTable)
      .where(inArray(networkPollOptionsTable.announcementId, annIds))
      .orderBy(networkPollOptionsTable.displayOrder),
    db
      .select()
      .from(networkPollVotesTable)
      .where(inArray(networkPollVotesTable.announcementId, annIds)),
    db
      .select()
      .from(networkQuestionnaireQuestionsTable)
      .where(inArray(networkQuestionnaireQuestionsTable.announcementId, annIds))
      .orderBy(networkQuestionnaireQuestionsTable.displayOrder),
    db
      .select({ uid: profilesTable.uid, displayName: profilesTable.displayName, photoUrl: profilesTable.photoUrl })
      .from(profilesTable)
      .where(inArray(profilesTable.uid, authorUids)),
  ]);
  const profileMap = new Map(authorProfileRows.map((p) => [p.uid, p]));
  const qIds = questions.map((q) => q.id);
  const answers =
    qIds.length > 0
      ? await db
          .select()
          .from(networkQuestionnaireAnswersTable)
          .where(inArray(networkQuestionnaireAnswersTable.questionId, qIds))
      : [];
  const result = announcements.map((ann) => {
    const annOptions = options.filter((o) => o.announcementId === ann.id);
    const annVotes = votes.filter((v) => v.announcementId === ann.id);
    const annQuestions = questions.filter((q) => q.announcementId === ann.id);
    const myVote = annVotes.find((v) => v.uid === uid);
    const myAnsweredQIds = new Set(
      answers.filter((a) => a.uid === uid && annQuestions.some((q) => q.id === a.questionId)).map((a) => a.questionId),
    );
    const authorProfile = profileMap.get(ann.authorUid);
    return {
      id: ann.id,
      networkId: ann.networkId,
      authorUid: ann.authorUid,
      authorDisplayName: authorProfile?.displayName ?? null,
      authorPhotoUrl: authorProfile?.photoUrl ?? null,
      body: ann.body,
      photoUrl: ann.photoUrl ?? null,
      type: ann.type,
      isPinned: ann.isPinned,
      createdAt: ann.createdAt.toISOString(),
      options:
        ann.type === "poll"
          ? annOptions.map((o) => ({
              id: o.id,
              label: o.label,
              displayOrder: o.displayOrder,
              voteCount: annVotes.filter((v) => v.optionId === o.id).length,
            }))
          : null,
      myVoteOptionId: myVote?.optionId ?? null,
      questions:
        ann.type === "questionnaire"
          ? annQuestions.map((q) => ({
              id: q.id,
              prompt: q.prompt,
              displayOrder: q.displayOrder,
              myAnswer: answers.find((a) => a.questionId === q.id && a.uid === uid)?.answerText ?? null,
            }))
          : null,
      hasAnswered:
        ann.type === "questionnaire"
          ? annQuestions.length > 0 && annQuestions.every((q) => myAnsweredQIds.has(q.id))
          : null,
    };
  });
  res.json(result);
});

// ── POST /networks/:id/announcements ─────────────────────────────────────────

router.post("/networks/:id/announcements", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const { id: networkId } = CreateAnnouncementParams.parse({ id: parseInt(String(req.params.id), 10) });
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ message: "Only admins can post announcements" });
    return;
  }
  const body = CreateAnnouncementBody.parse(req.body);
  if (body.type === "poll" && (!body.options || body.options.length < 2)) {
    res.status(400).json({ message: "Polls require at least 2 options" });
    return;
  }
  if (body.type === "questionnaire" && (!body.questions || body.questions.length < 1)) {
    res.status(400).json({ message: "Questionnaires require at least 1 question" });
    return;
  }
  const [announcement] = await db
    .insert(networkAnnouncementsTable)
    .values({ networkId, authorUid: uid, body: body.body, photoUrl: body.photoUrl ?? null, type: body.type })
    .returning();
  if (body.type === "poll" && body.options && body.options.length > 0) {
    await db.insert(networkPollOptionsTable).values(
      body.options.map((label, i) => ({ announcementId: announcement.id, label, displayOrder: i })),
    );
  }
  if (body.type === "questionnaire" && body.questions && body.questions.length > 0) {
    await db.insert(networkQuestionnaireQuestionsTable).values(
      body.questions.map((prompt, i) => ({ announcementId: announcement.id, prompt, displayOrder: i })),
    );
  }
  const response = await buildAnnouncementResponse(announcement.id, uid);
  res.status(201).json(response);
});

// ── PATCH /networks/:id/announcements/:annId ──────────────────────────────────

router.patch("/networks/:id/announcements/:annId", requireUid, async (req, res) => {
  const uid = req.uid!;
  const { id: networkId, annId } = UpdateAnnouncementParams.parse({
    id: parseInt(String(req.params.id), 10),
    annId: parseInt(String(req.params.annId), 10),
  });
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ message: "Only admins can edit announcements" });
    return;
  }
  const [ann] = await db
    .select()
    .from(networkAnnouncementsTable)
    .where(and(eq(networkAnnouncementsTable.id, annId), eq(networkAnnouncementsTable.networkId, networkId)))
    .limit(1);
  if (!ann) {
    res.status(404).json({ message: "Announcement not found" });
    return;
  }
  const body = UpdateAnnouncementBody.parse(req.body);
  await db
    .update(networkAnnouncementsTable)
    .set({
      ...(body.body != null && { body: body.body }),
      ...(body.photoUrl !== undefined && { photoUrl: body.photoUrl ?? null }),
    })
    .where(eq(networkAnnouncementsTable.id, annId));
  const response = await buildAnnouncementResponse(annId, uid);
  res.json(response);
});

// ── DELETE /networks/:id/announcements/:annId ─────────────────────────────────

router.delete("/networks/:id/announcements/:annId", requireUid, async (req, res) => {
  const uid = req.uid!;
  const { id: networkId, annId } = DeleteAnnouncementParams.parse({
    id: parseInt(String(req.params.id), 10),
    annId: parseInt(String(req.params.annId), 10),
  });
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ message: "Only admins can delete announcements" });
    return;
  }
  const [ann] = await db
    .select()
    .from(networkAnnouncementsTable)
    .where(and(eq(networkAnnouncementsTable.id, annId), eq(networkAnnouncementsTable.networkId, networkId)))
    .limit(1);
  if (!ann) {
    res.status(404).json({ message: "Announcement not found" });
    return;
  }
  if (ann.type === "questionnaire") {
    const qs = await db
      .select({ id: networkQuestionnaireQuestionsTable.id })
      .from(networkQuestionnaireQuestionsTable)
      .where(eq(networkQuestionnaireQuestionsTable.announcementId, annId));
    if (qs.length > 0) {
      await db
        .delete(networkQuestionnaireAnswersTable)
        .where(inArray(networkQuestionnaireAnswersTable.questionId, qs.map((q) => q.id)));
    }
    await db.delete(networkQuestionnaireQuestionsTable).where(eq(networkQuestionnaireQuestionsTable.announcementId, annId));
  }
  if (ann.type === "poll") {
    await db.delete(networkPollVotesTable).where(eq(networkPollVotesTable.announcementId, annId));
    await db.delete(networkPollOptionsTable).where(eq(networkPollOptionsTable.announcementId, annId));
  }
  await db.delete(networkAnnouncementsTable).where(eq(networkAnnouncementsTable.id, annId));
  res.json({ success: true });
});

// ── POST /networks/:id/announcements/:annId/pin ───────────────────────────────

router.post("/networks/:id/announcements/:annId/pin", requireUid, async (req, res) => {
  const uid = req.uid!;
  const { id: networkId, annId } = DeleteAnnouncementParams.parse({
    id: parseInt(String(req.params.id), 10),
    annId: parseInt(String(req.params.annId), 10),
  });
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ message: "Only admins can pin announcements" });
    return;
  }
  const [ann] = await db
    .select()
    .from(networkAnnouncementsTable)
    .where(and(eq(networkAnnouncementsTable.id, annId), eq(networkAnnouncementsTable.networkId, networkId)))
    .limit(1);
  if (!ann) {
    res.status(404).json({ message: "Announcement not found" });
    return;
  }
  await db
    .update(networkAnnouncementsTable)
    .set({ isPinned: true })
    .where(eq(networkAnnouncementsTable.id, annId));
  const response = await buildAnnouncementResponse(annId, uid);
  res.json(response);
});

// ── DELETE /networks/:id/announcements/:annId/pin ─────────────────────────────

router.delete("/networks/:id/announcements/:annId/pin", requireUid, async (req, res) => {
  const uid = req.uid!;
  const { id: networkId, annId } = DeleteAnnouncementParams.parse({
    id: parseInt(String(req.params.id), 10),
    annId: parseInt(String(req.params.annId), 10),
  });
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ message: "Only admins can unpin announcements" });
    return;
  }
  const [ann] = await db
    .select()
    .from(networkAnnouncementsTable)
    .where(and(eq(networkAnnouncementsTable.id, annId), eq(networkAnnouncementsTable.networkId, networkId)))
    .limit(1);
  if (!ann) {
    res.status(404).json({ message: "Announcement not found" });
    return;
  }
  await db
    .update(networkAnnouncementsTable)
    .set({ isPinned: false })
    .where(eq(networkAnnouncementsTable.id, annId));
  const response = await buildAnnouncementResponse(annId, uid);
  res.json(response);
});

// ── POST /networks/:id/announcements/:annId/vote ──────────────────────────────

router.post("/networks/:id/announcements/:annId/vote", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const { id: networkId, annId } = CastAnnouncementVoteParams.parse({
    id: parseInt(String(req.params.id), 10),
    annId: parseInt(String(req.params.annId), 10),
  });
  const { optionId } = CastAnnouncementVoteBody.parse(req.body);
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.status !== "active") {
    res.status(403).json({ message: "Not a member" });
    return;
  }
  const [ann] = await db
    .select()
    .from(networkAnnouncementsTable)
    .where(and(eq(networkAnnouncementsTable.id, annId), eq(networkAnnouncementsTable.networkId, networkId)))
    .limit(1);
  if (!ann || ann.type !== "poll") {
    res.status(404).json({ message: "Poll not found" });
    return;
  }
  const [option] = await db
    .select()
    .from(networkPollOptionsTable)
    .where(and(eq(networkPollOptionsTable.id, optionId), eq(networkPollOptionsTable.announcementId, annId)))
    .limit(1);
  if (!option) {
    res.status(400).json({ message: "Invalid option" });
    return;
  }
  await db
    .insert(networkPollVotesTable)
    .values({ announcementId: annId, optionId, uid })
    .onConflictDoUpdate({
      target: [networkPollVotesTable.announcementId, networkPollVotesTable.uid],
      set: { optionId },
    });
  const response = await buildAnnouncementResponse(annId, uid);
  res.json(response);
});

// ── GET /networks/:id/announcements/:annId/answers ────────────────────────────

router.get("/networks/:id/announcements/:annId/answers", requireUid, async (req, res) => {
  const uid = req.uid!;
  const { id: networkId, annId } = GetAnnouncementAnswersParams.parse({
    id: parseInt(String(req.params.id), 10),
    annId: parseInt(String(req.params.annId), 10),
  });
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ message: "Only admins can view all answers" });
    return;
  }
  const [ann] = await db
    .select()
    .from(networkAnnouncementsTable)
    .where(and(eq(networkAnnouncementsTable.id, annId), eq(networkAnnouncementsTable.networkId, networkId)))
    .limit(1);
  if (!ann) { res.status(404).json({ message: "Announcement not found" }); return; }
  const questions = await db
    .select()
    .from(networkQuestionnaireQuestionsTable)
    .where(eq(networkQuestionnaireQuestionsTable.announcementId, annId))
    .orderBy(networkQuestionnaireQuestionsTable.displayOrder);
  if (questions.length === 0) { res.json([]); return; }
  const qIds = questions.map((q) => q.id);
  const answers = await db
    .select()
    .from(networkQuestionnaireAnswersTable)
    .where(inArray(networkQuestionnaireAnswersTable.questionId, qIds));
  const uids = [...new Set(answers.map((a) => a.uid))];
  const profiles = uids.length > 0
    ? await db
        .select({ uid: profilesTable.uid, displayName: profilesTable.displayName, photoUrl: profilesTable.photoUrl })
        .from(profilesTable)
        .where(inArray(profilesTable.uid, uids))
    : [];
  const profileMap = new Map(profiles.map((p) => [p.uid, p]));
  res.json(
    questions.map((q) => ({
      questionId: q.id,
      prompt: q.prompt,
      answers: answers
        .filter((a) => a.questionId === q.id)
        .map((a) => {
          const p = profileMap.get(a.uid);
          return { uid: a.uid, displayName: p?.displayName ?? null, photoUrl: p?.photoUrl ?? null, answerText: a.answerText };
        }),
    })),
  );
});

// ── POST /networks/:id/announcements/:annId/answers ───────────────────────────

router.post("/networks/:id/announcements/:annId/answers", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const { id: networkId, annId } = SubmitAnnouncementAnswersParams.parse({
    id: parseInt(String(req.params.id), 10),
    annId: parseInt(String(req.params.annId), 10),
  });
  const { answers } = SubmitAnnouncementAnswersBody.parse(req.body);
  const membership = await getMembership(networkId, uid);
  if (!membership || membership.status !== "active") {
    res.status(403).json({ message: "Not a member" });
    return;
  }
  const [ann] = await db
    .select()
    .from(networkAnnouncementsTable)
    .where(and(eq(networkAnnouncementsTable.id, annId), eq(networkAnnouncementsTable.networkId, networkId)))
    .limit(1);
  if (!ann || ann.type !== "questionnaire") {
    res.status(404).json({ message: "Questionnaire not found" });
    return;
  }
  const questions = await db
    .select()
    .from(networkQuestionnaireQuestionsTable)
    .where(eq(networkQuestionnaireQuestionsTable.announcementId, annId));
  const validQIds = new Set(questions.map((q) => q.id));
  for (const ans of answers) {
    if (!validQIds.has(ans.questionId)) {
      res.status(400).json({ message: "Invalid question ID" });
      return;
    }
  }
  if (answers.length > 0) {
    await db
      .insert(networkQuestionnaireAnswersTable)
      .values(answers.map((a) => ({ questionId: a.questionId, uid, answerText: a.text })))
      .onConflictDoUpdate({
        target: [networkQuestionnaireAnswersTable.questionId, networkQuestionnaireAnswersTable.uid],
        set: { answerText: sql`excluded.answer_text` },
      });
  }
  const response = await buildAnnouncementResponse(annId, uid);
  res.json(response);
});

// ── GET /networks/join/:code (public preview) ────────────────────────────────

router.get("/networks/join/:code", async (req, res) => {
  const { code } = NetworkByCodeParams.parse({ code: req.params.code });

  const [network] = await db
    .select()
    .from(networksTable)
    .where(eq(networksTable.inviteCode, code))
    .limit(1);
  if (!network) {
    res.status(404).json({ message: "No network with that invite code" });
    return;
  }
  // Return public view — no membership context needed
  res.json(serializeNetwork(network, null));
});

// ── POST /networks/join/:code (auth-required join) ───────────────────────────

router.post("/networks/join/:code", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const { code } = NetworkByCodeParams.parse({ code: req.params.code });

  const [network] = await db
    .select()
    .from(networksTable)
    .where(eq(networksTable.inviteCode, code))
    .limit(1);
  if (!network) {
    res.status(404).json({ message: "No network with that invite code" });
    return;
  }

  const existing = await getMembership(network.id, uid);
  if (existing && (existing.status === "active" || existing.status === "pending")) {
    res.status(409).json({ message: "Already a member" });
    return;
  }

  const status = network.requiresApproval ? "pending" : "active";

  await db
    .insert(networkMembersTable)
    .values({ networkId: network.id, uid, role: "member", status })
    .onConflictDoUpdate({
      target: [networkMembersTable.networkId, networkMembersTable.uid],
      set: { status, role: "member" },
    });

  if (status === "active") {
    await db
      .update(networksTable)
      .set({ memberCount: sql`${networksTable.memberCount} + 1`, updatedAt: new Date() })
      .where(eq(networksTable.id, network.id));
  }

  res.json({ status });
});

// ── POST /networks/:id/regenerate-code (admin only) ──────────────────────────

router.post("/networks/:id/regenerate-code", requireUid, networkWriteLimit, async (req, res) => {
  const uid = req.uid!;
  const networkId = parseInt(String(req.params.id), 10);
  if (isNaN(networkId)) {
    res.status(404).json({ message: "Network not found" });
    return;
  }

  const [network] = await db
    .select()
    .from(networksTable)
    .where(eq(networksTable.id, networkId))
    .limit(1);
  if (!network) {
    res.status(404).json({ message: "Network not found" });
    return;
  }

  const membership = await getMembership(networkId, uid);
  if (!membership || membership.role !== "admin") {
    res.status(403).json({ message: "Only admins can regenerate the invite code" });
    return;
  }

  const newCode = await ensureUniqueInviteCode();
  await db
    .update(networksTable)
    .set({ inviteCode: newCode, updatedAt: new Date() })
    .where(eq(networksTable.id, networkId));

  res.json({ inviteCode: newCode });
});

export default router;
