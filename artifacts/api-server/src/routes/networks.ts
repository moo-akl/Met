import { Router, type IRouter } from "express";
import { eq, and, sql, ilike, desc } from "drizzle-orm";
import {
  db,
  networksTable,
  networkMembersTable,
  profilesTable,
  type Network,
  type NetworkMember,
  type Profile,
} from "@workspace/db";
import {
  ResolveNeighborhoodQueryParams,
  CreateNetworkBody,
  ListNetworksQueryParams,
  GetNetworkParams,
  JoinNetworkParams,
  LeaveNetworkParams,
  ListNetworkMembersParams,
  InviteToNetworkParams,
  InviteToNetworkBody,
} from "@workspace/api-zod";
import { requireUid } from "../middlewares/requireUid";
import { createUserRateLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

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
    memberCount: n.memberCount,
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
    .where(sql`${networksTable.id} = ANY(${ids})`);
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
              sql`${networkMembersTable.networkId} = ANY(${ids})`,
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
    .where(sql`${profilesTable.uid} = ANY(${uids})`);
  const profileMap = new Map(profiles.map((p) => [p.uid, p]));

  const result = members
    .filter((m) => profileMap.has(m.uid))
    .map((m) => ({
      ...serializeMembership(m),
      profile: serializeProfile(profileMap.get(m.uid)!),
    }));

  res.json(result);
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

export default router;
