/**
 * Centralized social-participation gate.
 *
 * QR-first arrivals get a private, hidden minimal profile so they can check
 * in without a photo. Those profiles are flagged `incomplete` and must not
 * reach people, chat, network or visibility surfaces until the user
 * completes onboarding at /onboarding?completeProfile=1.
 */
import type { Profile } from "@/lib/types";

export const NEUTRAL_DISPLAY_NAME = "Met visitor";

export function isProfileSocialReady(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.incomplete) return false;
  return !!profile.name?.trim() && !!profile.photoUri?.trim();
}

export function isIncompleteProfile(profile: Profile | null | undefined): boolean {
  return !!profile && !isProfileSocialReady(profile);
}

export function pickMinimalDisplayName(firebaseName: string | null | undefined): string {
  const n = (firebaseName ?? "").trim();
  if (!n || n === "Apple User") return NEUTRAL_DISPLAY_NAME;
  return n.slice(0, 60);
}

export function buildMinimalProfile(uid: string, displayName: string): Profile {
  return {
    id: uid,
    name: displayName,
    bio: "",
    photoUri: "",
    socials: {},
    interests: [],
    verified: false,
    isVisible: false,
    extraPhotos: [],
    incomplete: true,
  };
}

export const COMPLETE_PROFILE_HREF = "/onboarding?completeProfile=1";

/**
 * Decide where ProfileGate should send the user. Pure for testing.
 * Returns null to stay on the current route.
 */
export function decideProfileGateRoute(input: {
  root: string | undefined;
  authedUid: string | null;
  profile: Profile | null;
  permissionsCompleted: boolean;
}): string | null {
  const { root, authedUid, profile, permissionsCompleted } = input;
  // The QR check-in route owns its own auth/onboarding branching.
  if (root === "v") return null;
  if (!profile) {
    if (authedUid && root === "venue-owner") return null;
    return root === "onboarding" ? null : "/onboarding";
  }
  if (isIncompleteProfile(profile)) {
    // Private visitor: may browse; never force the permission flow.
    return null;
  }
  if (!permissionsCompleted) {
    if (root === "permissions" || root === "onboarding") return null;
    return "/permissions";
  }
  return null;
}
