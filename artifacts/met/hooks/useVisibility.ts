import { useCallback, useRef } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";
import { stopBleProximity } from "@/lib/ble";
import {
  stopFirestoreProximity,
  suppressFirestorePresence,
} from "@/lib/firestore/presence";
import { stopProximity } from "@/lib/proximity/presence";
import { t } from "@/lib/i18n";

/**
 * Persisted flag — `"1"` once the user has been shown (and accepted)
 * the first-time consent dialog before becoming discoverable. Required
 * by App Store Review Guideline 5.1.2(i): users must explicitly opt in
 * to having their presence broadcast to nearby strangers.
 */
const VISIBILITY_CONSENT_KEY = "met:visibilityConsentAccepted:v1";
const visibilityToggleLocks = new Set<string>();

/**
 * Single source of truth for the user's beacon visibility, used by every
 * tab's header pill so Visible/Hidden can be toggled from anywhere without
 * opening Settings.
 *
 * Hiding updates local state immediately and fails closed. Becoming
 * discoverable waits for the server and Firestore mirror before changing
 * local state, so a failed opt-in never starts a beacon.
 *
 * The first time a user turns visibility ON we present an explicit
 * consent dialog explaining that nearby phones will be able to detect
 * theirs over Bluetooth proximity. Subsequent toggles are silent.
 */
export function useVisibility() {
  const { profile, setProfile, authedUid } = useApp();
  const router = useRouter();
  const isVisible = profile?.isVisible ?? false;
  const latestProfileRef = useRef(profile);
  latestProfileRef.current = profile;

  const performToggle = useCallback(
    async (next: boolean) => {
      if (!profile) return;
      const uid = authedUid;
      const current = latestProfileRef.current ?? profile;

      if (!next) {
        // Hiding is fail-closed: stop local discovery/advertising immediately
        // and never roll back to visible because a request failed. Clear the
        // public geohash as well as the Firestore visibility mirror.
        stopProximity();
        stopFirestoreProximity(uid);
        void stopBleProximity().catch((err) => {
          console.warn("[visibility] failed to stop BLE locally", err);
        });
        const configured = api.isConfigured();
        const localSave = setProfile({ ...current, isVisible: false }).catch((err) => {
          console.warn("[visibility] failed to persist hidden state locally", err);
        });
        const tasks: Promise<unknown>[] = [];
        if (uid && configured) {
          tasks.push(
            api.upsertMyProfile(
              { uid },
              {
                displayName: current.name,
                photoUrl: current.photoUri ?? null,
                bio: current.bio ?? null,
                socials: current.socials ?? {},
                interests: current.interests ?? null,
                isVisible: false,
              },
            ).then((acknowledged) => {
              if (acknowledged.isVisible !== false) {
                throw new Error("Server did not acknowledge hidden presence");
              }
            }),
          );
        }
        if (uid) {
          tasks.push(
            suppressFirestorePresence(uid).then((suppressed) => {
              if (!suppressed) {
                throw new Error("Firestore did not acknowledge hidden presence");
              }
            }),
          );
        }
        const results = await Promise.allSettled(tasks);
        await localSave;
        const failed =
          !uid || !configured || results.some((result) => result.status === "rejected");
        if (failed) {
          console.warn("[visibility] could not confirm hidden state remotely");
          Alert.alert(
            "You're hidden on this device",
            "Your device is hidden, but account-wide hiding is still pending because we couldn't confirm the change with every service. Check your connection before relying on it on another device.",
          );
        }
        return;
      }

      // Becoming discoverable is the opposite: don't start a beacon from an
      // optimistic local state. The API mirror must accept the opt-in first.
      if (!uid || !api.isConfigured()) {
        Alert.alert(
          "Couldn't update visibility",
          "We couldn't reach the server to save your visibility setting. Please check your connection and try again.",
        );
        return;
      }
      try {
        const latest = latestProfileRef.current ?? profile;
        const canonical = await api.getMyProfile({ uid });
        const visibilityVersion = canonical.visibilityVersion;
        if (
          typeof visibilityVersion !== "string" ||
          visibilityVersion.length === 0
        ) {
          throw new Error("Server profile is missing visibilityVersion");
        }
        // The server atomically clears stale location while acknowledging
        // this explicit opt-in. A phone-side Firestore write must not gate
        // the authoritative update (native SDK/rules/connectivity may differ).
        const acknowledged = await api.upsertMyProfile(
          { uid },
          {
            displayName: canonical.displayName || latest.name,
            photoUrl: canonical.photoUrl ?? latest.photoUri ?? null,
            bio: canonical.bio ?? latest.bio ?? null,
            socials: canonical.socials ?? latest.socials ?? {},
            interests: canonical.interests ?? latest.interests ?? null,
            isVisible: true,
            expectedVisibilityVersion: visibilityVersion,
          },
        );
        if (acknowledged.isVisible !== true) {
          throw new Error("Server did not acknowledge visible presence");
        }
        const afterSave = latestProfileRef.current ?? latest;
        await setProfile({ ...afterSave, isVisible: true });
      } catch (err) {
        console.warn("[visibility] failed to enable visibility", err);
        const latest = latestProfileRef.current;
        const restore =
          latest && latest.id === current.id ? latest : current;
        await setProfile({ ...restore, isVisible: false }).catch((persistErr) => {
          console.warn("[visibility] failed to persist hidden rollback", persistErr);
        });
        const staleOptInConflict =
          err instanceof ApiError && err.status === 409;
        let accountHidePending = staleOptInConflict;
        try {
          const firestoreHidden = await suppressFirestorePresence(uid);
          if (!firestoreHidden) accountHidePending = true;
        } catch {
          accountHidePending = true;
        }
        // A GET failure or missing version can still leave the canonical
        // account visible. Best-effort unconditional opt-out closes that
        // gap; never overwrite a known stale-version conflict.
        if (!staleOptInConflict) {
          try {
            const hidden = await api.upsertMyProfile(
              { uid },
              {
                displayName: restore.name,
                photoUrl: restore.photoUri ?? null,
                bio: restore.bio ?? null,
                socials: restore.socials ?? {},
                interests: restore.interests ?? null,
                isVisible: false,
              },
            );
            if (hidden.isVisible !== false) accountHidePending = true;
          } catch (hideErr) {
            console.warn("[visibility] failed to confirm hidden account state", hideErr);
            accountHidePending = true;
          }
        }
        stopProximity();
        stopFirestoreProximity(uid);
        void stopBleProximity().catch(() => {});
        Alert.alert(
          "Couldn't update visibility",
          accountHidePending
            ? "Your device is hidden, but account-wide hiding is still unconfirmed. Your remote profile may remain visible on another device. Check your connection before relying on this setting."
            : "We couldn't reach the server to save your visibility setting. Please check your connection and try again.",
        );
      }
    },
    [authedUid, profile, setProfile],
  );

  const toggle = useCallback(async () => {
    if (!profile) return;
    const lockKey = authedUid ?? profile.id;
    if (visibilityToggleLocks.has(lockKey)) return;
    visibilityToggleLocks.add(lockKey);
    let waitForConsent = false;
    const release = () => visibilityToggleLocks.delete(lockKey);
    try {
      const next = !isVisible;

      // Going FROM hidden TO visible requires explicit consent the first
      // time. Once accepted we never re-prompt.
      if (next) {
        if (!profile.verified) {
          Alert.alert(
            t("visibility.noPhotoTitle"),
            t("visibility.noPhotoBody"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("visibility.goToProfile"),
                onPress: () => router.push("/(tabs)/profile"),
              },
            ],
          );
          return;
        }

        const accepted = await AsyncStorage.getItem(VISIBILITY_CONSENT_KEY);
        if (accepted !== "1") {
          waitForConsent = true;
          let consentConfirmed = false;
          Alert.alert(
            "Become discoverable?",
            "When visibility is on, nearby Met users can detect your phone over Bluetooth and see your profile photo and name. No GPS coordinates are shared. You can turn this off any time from the header pill or Settings.",
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: release,
              },
              {
                text: "Make me discoverable",
                style: "default",
                onPress: () => {
                  consentConfirmed = true;
                  void AsyncStorage.setItem(VISIBILITY_CONSENT_KEY, "1").catch(
                    () => {},
                  );
                  void performToggle(true).finally(release);
                },
              },
            ],
            { onDismiss: () => {
              if (!consentConfirmed) release();
            } },
          );
          return;
        }
      }

      await performToggle(next);
    } finally {
      if (!waitForConsent) release();
    }
  }, [authedUid, profile, isVisible, performToggle, router]);

  return { isVisible, toggle, hasProfile: !!profile };
}
