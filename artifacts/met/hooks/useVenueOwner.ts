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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "@/contexts/AppContext";
import {
  api,
  getActiveVenueBusinessId,
  setActiveVenueBusinessId,
  type VenueApplicationStatusResponse,
  type VenueOwnerBranch,
  type VenueOwnerBranchesResponse,
  type VenueOwnerProfile,
} from "@/lib/api/client";
export {
  getVenueOwnerDestination,
  type VenueOwnerDestination,
} from "@/lib/venueOwnerLifecycle";

export { type VenueOwnerProfile };

export interface UseVenueOwnerResult {
  profile: VenueOwnerProfile | null;
  history: VenueApplicationStatusResponse["history"];
  branches: VenueOwnerBranch[];
  branchApplications: VenueOwnerBranchesResponse["applications"];
  activeBusinessId: number | null;
  isApproved: boolean;
  isLoading: boolean;
  error: string | null;
  branchError: string | null;
  refetch: () => void;
  selectBranch: (businessId: number) => Promise<void>;
}

const activeBusinessStorageKey = (uid: string) =>
  `met:venue-owner:active-business:${uid}`;

function parseBusinessId(value: string | null): number | null {
  if (value === null || !/^(0|[1-9]\d{0,9})$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function useVenueOwner(): UseVenueOwnerResult {
  const { authedUid } = useApp();
  const [profile, setProfile] = useState<VenueOwnerProfile | null>(null);
  const [history, setHistory] = useState<VenueApplicationStatusResponse["history"]>([]);
  const [branches, setBranches] = useState<VenueOwnerBranch[]>([]);
  const [branchApplications, setBranchApplications] =
    useState<VenueOwnerBranchesResponse["applications"]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
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
    // Never render the previous account's application while a newly signed-in
    // account is loading. This also clears cached reviewer messages on sign-out.
    setProfile(null);
    setHistory([]);
    setBranches([]);
    setBranchApplications([]);
    setActiveBusinessId(null);
    setActiveVenueBusinessId(null);
    setError(null);
    setBranchError(null);
    setIsLoading(Boolean(authedUid));
  }, [authedUid]);

  const fetch = useCallback(async () => {
    if (!authedUid) {
      setProfile(null);
      setHistory([]);
      setBranches([]);
      setBranchApplications([]);
      setActiveBusinessId(null);
      setActiveVenueBusinessId(null);
      setError(null);
      setBranchError(null);
      setIsLoading(false);
      return;
    }
    const requestUid = authedUid;
    setIsLoading(true);
    setError(null);
    try {
      const [applicationResult, branchesResult] = await Promise.allSettled([
        api.getMyVenueApplication({ uid: requestUid }),
        api.getMyVenueBranches({ uid: requestUid }),
      ]);
      if (!mountedRef.current || requestUid !== currentUidRef.current) return;

      const applicationData =
        applicationResult.status === "fulfilled" ? applicationResult.value : null;
      const branchData =
        branchesResult.status === "fulfilled"
          ? branchesResult.value
          : { branches: [], applications: [] };
      const validBranches = branchData.branches.filter(
        (branch) =>
          Number.isSafeInteger(branch.businessId) &&
          branch.businessId >= 0 &&
          (branch.role === "owner" || branch.role === "manager"),
      );
      const savedId = parseBusinessId(
        await AsyncStorage.getItem(activeBusinessStorageKey(requestUid)).catch(() => null),
      );
      if (!mountedRef.current || requestUid !== currentUidRef.current) return;

      const currentId = getActiveVenueBusinessId();
      const containsId = (id: number | null) =>
        id !== null && validBranches.some((branch) => branch.businessId === id);
      const selectedId = containsId(currentId)
        ? currentId
        : containsId(savedId)
          ? savedId
          : validBranches[0]?.businessId ?? null;
      const selectedBranch =
        selectedId === null
          ? null
          : validBranches.find((branch) => branch.businessId === selectedId) ?? null;

      setBranches(validBranches);
      setBranchApplications(branchData.applications);
      setActiveBusinessId(selectedId);
      setActiveVenueBusinessId(selectedId);
      setProfile(selectedBranch?.profile ?? applicationData?.application ?? null);
      setHistory(applicationData?.history ?? []);

      const applicationFailed = applicationResult.status === "rejected";
      const branchesFailed = branchesResult.status === "rejected";
      const applicationWasNotFound =
        applicationFailed &&
        (applicationResult.reason as { status?: number })?.status === 404;
      const branchesWasNotFound =
        branchesFailed &&
        (branchesResult.reason as { status?: number })?.status === 404;
      setBranchError(
        branchesFailed && !branchesWasNotFound
          ? "Failed to load venue branches"
          : null,
      );
      setError(
        applicationFailed &&
          branchesFailed &&
          !applicationWasNotFound &&
          !branchesWasNotFound
          ? "Failed to load venue profile"
          : null,
      );
      if (selectedId !== null) {
        await AsyncStorage.setItem(
          activeBusinessStorageKey(requestUid),
          String(selectedId),
        ).catch(() => {});
      } else {
        setActiveVenueBusinessId(null);
      }
    } finally {
      if (mountedRef.current && requestUid === currentUidRef.current) setIsLoading(false);
    }
  }, [authedUid]);

  const selectBranch = useCallback(
    async (businessId: number) => {
      const selected = branches.find((branch) => branch.businessId === businessId);
      if (!selected || !authedUid) return;
      setActiveBusinessId(businessId);
      setActiveVenueBusinessId(businessId);
      setProfile(selected.profile);
      await AsyncStorage.setItem(
        activeBusinessStorageKey(authedUid),
        String(businessId),
      ).catch(() => {});
    },
    [authedUid, branches],
  );

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return {
    profile,
    history,
    branches,
    branchApplications,
    activeBusinessId,
    isApproved: profile?.isApproved === true,
    isLoading,
    error,
    branchError,
    refetch: () => { void fetch(); },
    selectBranch,
  };
}
