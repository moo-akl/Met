/**
 * Pure functions that decide where the profile-completion banner scrolls to
 * and which field to highlight when the user taps it.
 *
 * Extracted from profile.tsx so the mapping can be unit-tested without
 * rendering the full screen component.
 *
 * profileSteps index → field semantics
 *   0 = name       (text, inside "photo" scroll section)
 *   1 = photo      (camera, inside "photo" scroll section)
 *   2 = bio        (text, inside "photo" scroll section)
 *   3 = socials    (links, own scroll section)
 *   4 = interests  (tags,  own scroll section)
 */

export type ScrollSection = "photo" | "socials" | "interests";
export type HighlightField = "name" | "photo" | "bio" | "socials" | "interests";

/**
 * Build the array of completion booleans for a profile.
 * The returned array has exactly 5 entries (steps 0-4).
 */
export function getProfileSteps(profile: {
  name?: string | null;
  verified?: boolean | null;
  bio?: string | null;
  socials?: Record<string, unknown> | null;
  interests?: unknown[] | null;
}): [boolean, boolean, boolean, boolean, boolean] {
  return [
    !!(profile.name ?? "").trim(),
    !!profile.verified,
    (profile.bio ?? "").trim().length > 0,
    Object.keys(profile.socials ?? {}).length > 0,
    (profile.interests ?? []).length > 0,
  ];
}

/**
 * Given the index of the first incomplete step (0-4), return the scroll
 * section the banner should navigate to.
 *
 *   steps 0, 1, 2  →  "photo"     (name/photo/bio all live in the photo area)
 *   step  3        →  "socials"
 *   step  4        →  "interests"
 */
export function getBannerScrollTarget(firstIncomplete: number): ScrollSection {
  if (firstIncomplete === 3) return "socials";
  if (firstIncomplete === 4) return "interests";
  return "photo";
}

/**
 * Given the index of the first incomplete step (0-4), return the field that
 * should receive the post-scroll highlight animation.
 */
export function getBannerHighlightField(firstIncomplete: number): HighlightField {
  switch (firstIncomplete) {
    case 0: return "name";
    case 1: return "photo";
    case 2: return "bio";
    case 3: return "socials";
    default: return "interests";
  }
}

/**
 * The TextInput ref to call .focus() on after the banner scroll settles.
 *
 *   "name"        → nameInputRef
 *   "bio"         → bioInputRef
 *   "firstSocial" → firstSocialInputRef
 *   null          → no TextInput to focus (photo = step 1, interests = step 4)
 *
 * The focus target is derived from field-level emptiness independently of
 * firstIncomplete so that, for example, a user who has a name but no verified
 * photo still gets the bio focused if it is the first empty text field.
 */
export type FocusTarget = "name" | "bio" | "firstSocial" | null;

export function getBannerFocusTarget(profile: {
  name?: string | null;
  bio?: string | null;
  socials?: Record<string, unknown> | null;
}): FocusTarget {
  if (!(profile.name ?? "").trim()) return "name";
  if (!(profile.bio ?? "").trim()) return "bio";
  if (Object.keys(profile.socials ?? {}).length === 0) return "firstSocial";
  return null;
}
