import { useCallback } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useApp } from "@/contexts/AppContext";
import { api } from "@/lib/api/client";
import { isLegacyUserId } from "@/lib/auth";

/**
 * Persisted flag — `"1"` once the user has been shown (and accepted)
 * the first-time consent dialog before becoming discoverable. Required
 * by App Store Review Guideline 5.1.2(i): users must explicitly opt in
 * to having their presence broadcast to nearby strangers.
 */
const VISIBILITY_CONSENT_KEY = "met:visibilityConsentAccepted:v1";

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
 *
 * The first time a user turns visibility ON we present an explicit
 * consent dialog explaining that nearby phones will be able to detect
 * theirs over Bluetooth proximity. Subsequent toggles are silent.
 */
export function useVisibility() {
  const { profile, setProfile } = useApp();
  const isVisible = profile?.isVisible ?? false;

  const performToggle = useCallback(
    (next: boolean) => {
      if (!profile) return;
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
            void setProfile({ ...profile, isVisible: !next });
          });
      }
    },
    [profile, setProfile],
  );

  const toggle = useCallback(async () => {
    if (!profile) return;
    const next = !isVisible;

    // Going FROM hidden TO visible requires explicit consent the first
    // time. Once accepted we never re-prompt (toggling off and on
    // repeatedly is a normal usage pattern, not a re-consent event).
    if (next) {
      const accepted = await AsyncStorage.getItem(VISIBILITY_CONSENT_KEY);
      if (accepted !== "1") {
        Alert.alert(
          "Become discoverable?",
          "When visibility is on, nearby Met users can detect your phone over Bluetooth and see your profile photo and name. No GPS coordinates are shared. You can turn this off any time from the header pill or Settings.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Make me discoverable",
              style: "default",
              onPress: () => {
                void AsyncStorage.setItem(VISIBILITY_CONSENT_KEY, "1");
                performToggle(true);
              },
            },
          ],
        );
        return;
      }
    }

    performToggle(next);
  }, [profile, isVisible, performToggle]);

  return { isVisible, toggle, hasProfile: !!profile };
}
