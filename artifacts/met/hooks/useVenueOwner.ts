/**
 * useVenueOwner
 *
 * Fetches the current user's venue owner profile. Returns:
 *   - profile: the full VenueOwnerProfile object (or null if not registered)
 *   - isApproved: shorthand boolean
 *   - isLoading: true while the initial fetch is in progress
 *   - refetch: callable to manually refresh
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { api, type VenueOwnerProfile } from "@/lib/api/client";

export { type VenueOwnerProfile };

export interface UseVenueOwnerResult {
  profile: VenueOwnerProfile | null;
  isApproved: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useVenueOwner(): UseVenueOwnerResult {
  const { authedUid } = useApp();
  const [profile, setProfile] = useState<VenueOwnerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    if (!authedUid) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getMyVenueOwnerProfile({ uid: authedUid });
      if (mountedRef.current) {
        setProfile(data.profile);
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      // 404 = not registered yet — that's not an error
      if ((err as { status?: number })?.status === 404) {
        setProfile(null);
      } else {
        setError("Failed to load venue profile");
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [authedUid]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return {
    profile,
    isApproved: profile?.isApproved === true,
    isLoading,
    error,
    refetch: () => { void fetch(); },
  };
}
