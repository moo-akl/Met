import type { VenueApplicationStatus, VenueOwnerProfile } from "@/lib/api/client";

export type VenueOwnerDestination =
  | "/venue-owner/setup"
  | "/venue-owner/pending"
  | "/venue-owner/rejected"
  | "/venue-owner/dashboard";

/**
 * Maps only the server's canonical lifecycle state to an applicant screen.
 * Notifications and direct URLs must resolve through this mapping rather than
 * trusting an old status encoded in their payload.
 */
export function getVenueOwnerDestination(
  profile: Pick<
    VenueOwnerProfile,
    "applicationStatus" | "isApproved"
  > | null,
): VenueOwnerDestination {
  if (!profile) return "/venue-owner/setup";
  if (profile.isApproved || profile.applicationStatus === "approved") {
    return "/venue-owner/dashboard";
  }
  if (
    profile.applicationStatus === "rejected" ||
    profile.applicationStatus === "changes_requested"
  ) {
    return "/venue-owner/rejected";
  }
  if (
    profile.applicationStatus === "withdrawn" ||
    profile.applicationStatus === "expired" ||
    profile.applicationStatus === "draft"
  ) {
    return "/venue-owner/setup";
  }
  return "/venue-owner/pending";
}

/**
 * Decides where a lifecycle-guarded screen should redirect, given the current
 * auth + application-load state. Returns `null` when the screen must stay put:
 * while loading, and crucially when the status fetch FAILED — a failed load
 * must never be interpreted as "no application".
 */
export function resolveLifecycleRedirect(args: {
  isLoading: boolean;
  error: unknown;
  authedUid: string | null | undefined;
  application: Pick<VenueOwnerProfile, "applicationStatus" | "isApproved"> | null;
  /** The screen doing the guarding — no redirect if already correct. */
  currentDestination: VenueOwnerDestination;
}): VenueOwnerDestination | "/onboarding?venueOwner=1" | null {
  if (args.isLoading || args.error) return null;
  if (!args.authedUid) return "/onboarding?venueOwner=1";
  const destination = getVenueOwnerDestination(args.application);
  return destination === args.currentDestination ? null : destination;
}

export function isVenueOwnerApplicationStatus(
  status: string | undefined,
): status is VenueApplicationStatus {
  return [
    "draft",
    "submitted",
    "under_review",
    "changes_requested",
    "rejected",
    "resubmitted",
    "approved",
    "withdrawn",
    "expired",
  ].includes(status ?? "");
}