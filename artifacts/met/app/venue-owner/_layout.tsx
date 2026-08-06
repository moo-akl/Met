/**
 * Venue Owner Layout — lifecycle redirect guard.
 *
 * Every screen under /venue-owner/ (except the terminal lifecycle screens
 * themselves) passes through this guard before rendering. A venue owner whose
 * application is revoked mid-session, or who navigates directly via deep link,
 * is redirected to the appropriate screen instead of seeing management UI and
 * getting opaque permission errors from the API.
 *
 * Screens exempted from guarding (they ARE the redirect destinations):
 *   /venue-owner          — loading entry point
 *   /venue-owner/setup    — no-application / draft / withdrawn
 *   /venue-owner/pending  — submitted / under_review / resubmitted
 *   /venue-owner/rejected — rejected / changes_requested
 */
import { useEffect } from "react";
import { Slot, usePathname, useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { resolveLifecycleRedirect } from "@/lib/venueOwnerLifecycle";

/**
 * Paths that must never be guarded — they are the redirect targets (or the
 * initial loading screen).  Guarding them would create redirect loops.
 */
const UNGUARDED_PATHS = new Set([
  "/venue-owner",
  "/venue-owner/setup",
  "/venue-owner/pending",
  "/venue-owner/rejected",
]);

export default function VenueOwnerLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { authedUid } = useApp();
  const { profile: application, isLoading, error } = useVenueOwner();

  useEffect(() => {
    // Let the terminal lifecycle screens render without interference.
    if (UNGUARDED_PATHS.has(pathname)) return;

    // All management screens (/dashboard, /events/*, /rewards/*, /announcements/*, /profile/edit)
    // are only reachable by approved owners.  Treat them as if the current
    // destination were /venue-owner/dashboard so any non-approved status
    // triggers the appropriate redirect.
    const redirect = resolveLifecycleRedirect({
      isLoading,
      error,
      authedUid,
      application,
      currentDestination: "/venue-owner/dashboard",
    });
    if (redirect) router.replace(redirect);
  }, [pathname, isLoading, error, authedUid, application, router]);

  return <Slot />;
}
