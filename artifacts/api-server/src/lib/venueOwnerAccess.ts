import { and, eq } from "drizzle-orm";
import {
  db,
  venueBusinessesTable,
  venueMembershipsTable,
  venueOwnerProfilesTable,
} from "@workspace/db";

export const ACTIVE_VENUE_APPLICATION_STATUS = "approved";

export type VenueAccessRole = "owner" | "manager" | "editor";

export type VenueAccess = {
  businessId: number;
  profileId: number;
  placeId: string;
  ownerUid: string;
  role: VenueAccessRole;
  legacy: boolean;
};

/**
 * Parse the optional branch selector used by mobile owner requests.
 * `undefined` means use the caller's default branch; `null` means invalid.
 */
export function parseSelectedVenueBusinessId(
  rawBusinessId: string | undefined,
): number | undefined | null {
  if (rawBusinessId === undefined) return undefined;
  if (!/^(0|[1-9]\d{0,9})$/.test(rawBusinessId)) return null;
  const businessId = Number(rawBusinessId);
  return Number.isSafeInteger(businessId) ? businessId : null;
}

/**
 * Resolve an approved venue through the caller's active membership.
 * The legacy fallback is limited to the original approved owner identity.
 */
export async function loadVenueAccess(
  uid: string,
  allowedRoles: readonly VenueAccessRole[],
  selectedBusinessId?: number,
): Promise<VenueAccess | null> {
  const memberships = await db
    .select()
    .from(venueMembershipsTable)
    .where(
      and(
        eq(venueMembershipsTable.uid, uid),
        eq(venueMembershipsTable.status, "active"),
      ),
    );

  for (const membership of memberships) {
    if (
      selectedBusinessId === 0 ||
      (selectedBusinessId !== undefined &&
        membership.businessId !== selectedBusinessId)
    ) {
      continue;
    }
    if (!allowedRoles.includes(membership.role as VenueAccessRole)) continue;
    const [business] = await db
      .select()
      .from(venueBusinessesTable)
      .where(eq(venueBusinessesTable.id, membership.businessId))
      .limit(1);
    if (!business?.isActive) continue;
    const [profile] = await db
      .select()
      .from(venueOwnerProfilesTable)
      .where(
        and(
          eq(venueOwnerProfilesTable.id, business.venueOwnerProfileId),
          eq(venueOwnerProfilesTable.isApproved, true),
          eq(
            venueOwnerProfilesTable.applicationStatus,
            ACTIVE_VENUE_APPLICATION_STATUS,
          ),
        ),
      )
      .limit(1);
    if (!profile || profile.placeId !== business.placeId) continue;
    return {
      businessId: business.id,
      profileId: profile.id,
      placeId: business.placeId,
      ownerUid: profile.ownerUid,
      role: membership.role as VenueAccessRole,
      legacy: false,
    };
  }

  if (selectedBusinessId !== undefined && selectedBusinessId !== 0) return null;
  if (!allowedRoles.includes("owner")) return null;
  const [profile] = await db
    .select()
    .from(venueOwnerProfilesTable)
    .where(
      and(
        eq(venueOwnerProfilesTable.ownerUid, uid),
        eq(venueOwnerProfilesTable.isApproved, true),
        eq(
          venueOwnerProfilesTable.applicationStatus,
          ACTIVE_VENUE_APPLICATION_STATUS,
        ),
      ),
    )
    .limit(1);
  if (!profile) return null;
  return {
    businessId: 0,
    profileId: profile.id,
    placeId: profile.placeId,
    ownerUid: profile.ownerUid,
    role: "owner",
    legacy: true,
  };
}
