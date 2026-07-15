/**
 * Shared star-rating color utilities.
 *
 * Gradient color constants and getStarColor are kept here so that any
 * component can import them without creating circular dependencies between
 * component files.
 */

/** Mid-point color for the gold tier (4.5 – 5 stars). */
export const STAR_COLOR_GOLD = "#DAA520";

/** Mid-point color for the emerald tier (3.5 – 4.4 stars). */
export const STAR_COLOR_EMERALD = "#3DAA68";

/** Mid-point color for the amber tier (< 3.5 stars). */
export const STAR_COLOR_AMBER = "#CD853F";

/**
 * Maps a numeric star rating to a gradient-coded solid color:
 *   4.5–5   → Gold    (#DAA520 — mid of #FFD700–#DAA520)
 *   3.5–4.4 → Emerald (#3DAA68 — mid of #50C878–#2E8B57)
 *   < 3.5   → Amber   (#CD853F — mid of #FFBF00–#CD853F)
 */
export function getStarColor(rating: number): string {
  if (rating >= 4.5) return STAR_COLOR_GOLD;
  if (rating >= 3.5) return STAR_COLOR_EMERALD;
  return STAR_COLOR_AMBER;
}
