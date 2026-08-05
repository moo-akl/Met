/**
 * useHubCheckin
 *
 * Periodically resolves the user's current GPS coordinates to nearby Google
 * Places venues (via GET /api/hubs/nearby) and manages the check-in flow.
 *
 * Single-venue path (common): if exactly one venue is found within 50 m the
 * hook auto-checks in via POST /api/hubs/checkin and returns hubState.
 *
 * Multi-venue path: if two or more venues are found within 50 m the hook sets
 * `pendingVenues` instead of auto-checking in.  The UI should render
 * SelectVenueModal when pendingVenues is non-null, call `confirmVenue(venue)`
 * when the user selects one, or `cancelVenueSelection()` to dismiss.
 *
 * Debounce: at most one /nearby call every 5 minutes per app session.
 *
 * Cooldown: if the server returns 403 { error: "cooldown", remainingMinutes }
 * the hook surfaces remainingMinutes so the UI can tell the user when they can
 * check in again.
 *
 * Mock fallback: in __DEV__ builds, any API error other than 404 or cooldown
 * will produce a fake hub state so the HubStatusBadge UI is always visible
 * for testing. The mock state carries `isMock: true` so the badge can label
 * itself.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError, type VenueResult } from "@/lib/api/client";

export type { VenueResult };

const CHECKIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CHECKIN_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours — matches server-side window
const CHECKIN_STORAGE_KEY = "@hub_checkin_state";

export interface HubState {
  placeId: string;
  placeName: string;
  streak: number;
  isMock: boolean;
}

const MOCK_HUB_STATE: HubState = {
  placeId: "mock-place-id",
  placeName: "Mock Check-in",
  streak: 3,
  isMock: true,
};

export function useHubCheckin(): {
  hubState: HubState | null;
  cooldownMinutes: number | null;
  pendingVenues: VenueResult[] | null;
  confirmVenue: (venue: VenueResult) => void;
  cancelVenueSelection: () => void;
  /** Bypass the 5-minute debounce and immediately run a location + nearby
   *  lookup.  Safe to call from UI (e.g. "Check in" CTA). */
  attemptCheckin: () => void;
} {
  const { authedUid } = useApp();
  const [hubState, setHubState] = useState<HubState | null>(null);
  const [cooldownMinutes, setCooldownMinutes] = useState<number | null>(null);
  const [pendingVenues, setPendingVenues] = useState<VenueResult[] | null>(null);

  // Tracks the timestamp of the last successfully fired API call so we can
  // debounce without relying on component lifecycle timing.
  const lastFiredAt = useRef<number>(0);
  const mountedRef = useRef(true);

  // The GPS position captured at the time of the /nearby call — stored so
  // the deferred confirmVenue path can pass valid coords to /checkin.
  const lastPositionRef = useRef<Location.LocationObject | null>(null);

  // Stores the current doCheckin fn so attemptCheckin can call it without
  // rebuilding a new callback every render.
  const doCheckinRef = useRef<(() => Promise<void>) | null>(null);

  // Keep a ref to authedUid so the stable performCheckin callback can read it.
  const authedUidRef = useRef<string | null | undefined>(authedUid);
  useEffect(() => {
    authedUidRef.current = authedUid;
  }, [authedUid]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Calls POST /api/hubs/checkin with the chosen venue and stored GPS position.
   * Stable (only uses refs) so it can be a dependency-free useCallback and used
   * safely in both the interval path and the confirmVenue callback.
   */
  const performCheckin = useCallback(
    async (venue: VenueResult, pos: Location.LocationObject) => {
      const uid = authedUidRef.current;
      if (!uid) return;

      try {
        const result = await api.hubCheckin(
          { uid },
          {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            placeId: venue.placeId,
            placeName: venue.displayName,
          },
        );
        if (mountedRef.current) {
          const newState: HubState = {
            placeId: result.placeId,
            placeName: result.placeName,
            streak: result.streak,
            isMock: false,
          };
          setHubState(newState);
          setCooldownMinutes(null);
          // Persist so the app doesn't re-prompt on the next cold start.
          void AsyncStorage.setItem(
            CHECKIN_STORAGE_KEY,
            JSON.stringify({ hubState: newState, checkedInAt: Date.now() }),
          );
        }
      } catch (err: unknown) {
        const apiErr = err instanceof ApiError ? err : null;

        if (apiErr?.status === 403) {
          const body = apiErr.body as Record<string, unknown> | null;
          if (
            body?.error === "cooldown" &&
            typeof body.remainingMinutes === "number"
          ) {
            if (mountedRef.current) setCooldownMinutes(body.remainingMinutes);
            return;
          }
        }

        if (apiErr?.status === 404) {
          if (mountedRef.current) {
            setHubState(null);
            setCooldownMinutes(null);
          }
        } else if (__DEV__) {
          if (mountedRef.current) setHubState(MOCK_HUB_STATE);
        }
      }
    },
    [],
  );

  /** Called when the user taps a venue row in SelectVenueModal. */
  const confirmVenue = useCallback(
    (venue: VenueResult) => {
      if (!mountedRef.current) return;
      setPendingVenues(null);
      const pos = lastPositionRef.current;
      if (!pos) return;
      void performCheckin(venue, pos);
    },
    [performCheckin],
  );

  /** Called when the user dismisses the SelectVenueModal without choosing. */
  const cancelVenueSelection = useCallback(() => {
    setPendingVenues(null);
  }, []);

  useEffect(() => {
    if (!authedUid) return;

    // Reset debounce when uid changes so a fresh checkin fires immediately.
    lastFiredAt.current = 0;

    const doCheckin = async () => {

      const now = Date.now();
      if (now - lastFiredAt.current < CHECKIN_INTERVAL_MS) return;

      // Check location permission before attempting a position read.
      let perm: Location.PermissionResponse;
      try {
        perm = await Location.getForegroundPermissionsAsync();
      } catch {
        return;
      }
      if (perm.status !== "granted") return;
      if (!mountedRef.current) return;

      // Get current position (same accuracy as the proximity service).
      let pos: Location.LocationObject | null = null;
      try {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch {
        return;
      }
      if (!pos || !mountedRef.current) return;

      // Mark fired *before* the await so a slow response doesn't let a
      // parallel interval tick slip through the debounce check.
      lastFiredAt.current = now;

      // Store position now — confirmVenue needs it if the modal is shown.
      lastPositionRef.current = pos;

      try {
        const { venues } = await api.hubNearby(
          { uid: authedUid },
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
        );

        if (!mountedRef.current) return;

        if (venues.length === 1) {
          // Only one venue — auto-checkin without prompting the user.
          await performCheckin(venues[0]!, pos);
        } else {
          // Multiple venues — surface the selection modal.
          setPendingVenues(venues);
        }
      } catch (err: unknown) {
        const apiErr = err instanceof ApiError ? err : null;

        if (apiErr?.status === 404) {
          // No venue found within 50 m — hide the badge and clear cooldown.
          if (mountedRef.current) {
            setHubState(null);
            setCooldownMinutes(null);
          }
        } else if (__DEV__) {
          // Any other error in dev (network down, server not started, etc.)
          // → show mock state so the badge UI is always visible for testing.
          if (mountedRef.current) setHubState(MOCK_HUB_STATE);
        }
        // In production non-404 errors are silently ignored (badge stays
        // hidden / in its previous state) to avoid noisy error UX.
      }
    };

    // Expose the current doCheckin so attemptCheckin can call it.
    doCheckinRef.current = doCheckin;

    // On cold start, restore a persisted check-in if still within the server's
    // 4-hour cooldown window.  This prevents the venue-selection popup from
    // appearing every time the user reopens the app after a recent check-in.
    const init = async () => {
      try {
        const stored = await AsyncStorage.getItem(CHECKIN_STORAGE_KEY);
        if (stored && mountedRef.current) {
          const parsed = JSON.parse(stored) as {
            hubState: HubState;
            checkedInAt: number;
          };
          if (Date.now() - parsed.checkedInAt < CHECKIN_COOLDOWN_MS) {
            // Still within cooldown — restore badge state and push the
            // debounce clock forward so the immediate doCheckin() is skipped.
            setHubState(parsed.hubState);
            lastFiredAt.current = Date.now();
          }
        }
      } catch {
        // Ignore storage errors — fall through to a fresh check-in attempt.
      }
      if (mountedRef.current) void doCheckin();
    };

    void init();
    const id = setInterval(() => void doCheckin(), CHECKIN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authedUid, performCheckin]);

  /** Resets the debounce timer and immediately runs a location + nearby
   *  lookup — intended for the manual "Check in" CTA. */
  const attemptCheckin = useCallback(() => {
    lastFiredAt.current = 0;
    void doCheckinRef.current?.();
  }, []);

  return { hubState, cooldownMinutes, pendingVenues, confirmVenue, cancelVenueSelection, attemptCheckin };
}
