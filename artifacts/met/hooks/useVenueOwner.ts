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
import {
  api,
  type VenueApplicationStatusResponse,
  type VenueOwnerProfile,
} from "@/lib/api/client";

export { type VenueOwnerProfile };

export interface UseVenueOwnerResult {
  profile: VenueOwnerProfile | null;
  history: VenueApplicationStatusResponse["history"];
  isApproved: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useVenueOwner(): UseVenueOwnerResult {
  const { authedUid } = useApp();
  const [profile, setProfile] = useState<VenueOwnerProfile | null>(null);
  const [history, setHistory] = useState<VenueApplicationStatusResponse["history"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const currentUidRef = useRef<string | null>(authedUid);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    currentUidRef.current = authedUid;
  }, [authedUid]);

  const fetch = useCallback(async () => {
    if (!authedUid) {
      setProfile(null);
      setHistory([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    const requestUid = authedUid;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getMyVenueApplication({ uid: requestUid });
      if (mountedRef.current && requestUid === currentUidRef.current) {
        setProfile(data.application);
        setHistory(data.history);
      }
    } catch (err: unknown) {
      if (!mountedRef.current || requestUid !== currentUidRef.current) return;
      // 404 = not registered yet — that's not an error
      if ((err as { status?: number })?.status === 404) {
        setProfile(null);
        setHistory([]);
      } else {
        setError("Failed to load venue profile");
      }
    } finally {
      if (mountedRef.current && requestUid === currentUidRef.current) setIsLoading(false);
    }
  }, [authedUid]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return {
    profile,
    history,
    isApproved: profile?.isApproved === true,
    isLoading,
    error,
    refetch: () => { void fetch(); },
  };
}
