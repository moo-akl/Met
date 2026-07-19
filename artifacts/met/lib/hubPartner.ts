/**
 * Pure utilities for hub / business-partner logic.
 * No React Native imports — safe to unit-test in plain Node/Jest.
 */

/**
 * Returns true only when the businessProfile is present and its subscription
 * is explicitly active.  Used to decide whether to render the gold marker on
 * the map screen.
 */
export function resolveIsPartner(
  businessProfile: { isActiveSubscription: boolean } | null | undefined,
): boolean {
  return businessProfile?.isActiveSubscription === true;
}
