import { useCallback } from "react";

import { useApp } from "@/contexts/AppContext";
import { api } from "@/lib/api/client";
import { isLegacyUserId } from "@/lib/auth";

/**
 * Single source of truth for the user's beacon visibility, used by every
 * tab's header pill so Visible/Hidden can be toggled from anywhere without
 * opening Settings.
 *
 * Toggling updates the local profile state immediately (optimistic) and
 * fires a best-effort upsert to /api/profiles/me so the Postgres row
 * AND its Firestore mirror reflect the new value. Other devices' nearby
 * queries filter on the Firestore mirror, so this is what makes Ghost
 * Mode actually hide the user from strangers.
 */
export function useVisibility() {
  const { profile, setProfile } = useApp();
  const isVisible = profile?.isVisible ?? true;

  const toggle = useCallback(() => {
    if (!profile) return;
    const next = !isVisible;
    // Optimistic local update — the Visible/Hidden pill should flip
    // instantly even on a slow network. Server failure rolls back.
    void setProfile({ ...profile, isVisible: next });

    // Server mirror is gated on the user having a real Firebase uid.
    // Local-only / legacy ids are dev artifacts that can't authenticate
    // against the api-server.
    if (!isLegacyUserId(profile.id)) {
      api
        .upsertMyProfile(
          { uid: profile.id },
          {
            displayName: profile.name,
            photoUrl: profile.photoUri ?? null,
            bio: profile.bio ?? null,
            socials: profile.socials ?? {},
            isVisible: next,
          },
        )
        .catch((err) => {
          console.warn(
            "[visibility] failed to mirror to server; reverting",
            err,
          );
          // Roll back the optimistic flip so the UI matches reality.
          void setProfile({ ...profile, isVisible });
        });
    }
  }, [profile, isVisible, setProfile]);

  return { isVisible, toggle, hasProfile: !!profile };
}
