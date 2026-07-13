/**
 * useHubCheckin
 *
 * Periodically resolves the user's current GPS coordinates to a Google Places
 * venue (via POST /api/hubs/checkin) and returns the hub state.
 *
 * Debounce: at most one API call every 5 minutes per app session.
 *
 * Cooldown: if the server returns 403 { error: "cooldown", remainingMinutes }
 * the hook surfaces remainingMinutes so the UI can tell the user when they can
 * check in again. The cooldown is per (user, place_id) — different venues are
 * not affected.
 *
 * Mock fallback: in __DEV__ builds, any API error other than 404 or cooldown
 * will produce a fake hub state so the HubStatusBadge UI is always visible for
 * testing. The mock state carries `isMock: true` so the badge can label itself.
 */

import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";

const CHECKIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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
} {
  const { authedUid } = useApp();
  const [hubState, setHubState] = useState<HubState | null>(null);
  const [cooldownMinutes, setCooldownMinutes] = useState<number | null>(null);

  // Tracks the timestamp of the last successfully fired API call so we can
  // debounce without relying on component lifecycle timing.
  const lastFiredAt = useRef<number>(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
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

      try {
        const result = await api.hubCheckin(
          { uid: authedUid },
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
        );
        if (mountedRef.current) {
          setHubState({
            placeId: result.placeId,
            placeName: result.placeName,
            streak: result.streak,
            isMock: false,
          });
          // Successful check-in clears any previous cooldown.
          setCooldownMinutes(null);
        }
      } catch (err: unknown) {
        const apiErr = err instanceof ApiError ? err : null;

        if (apiErr?.status === 403) {
          // Cooldown response: { error: "cooldown", remainingMinutes: N }
          const body = apiErr.body as Record<string, unknown> | null;
          if (body?.error === "cooldown" && typeof body.remainingMinutes === "number") {
            if (mountedRef.current) {
              setCooldownMinutes(body.remainingMinutes);
            }
            return;
          }
        }

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
        // In production non-404/non-cooldown errors are silently ignored (badge
        // stays hidden / in its previous state) to avoid noisy error UX.
      }
    };

    // Fire immediately on mount / uid change, then every 5 minutes.
    void doCheckin();
    const id = setInterval(() => void doCheckin(), CHECKIN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [authedUid]);

  return { hubState, cooldownMinutes };
}
