import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";

import {
  loadDisclosureAccepted,
  loadPermissionsCompleted,
} from "@/lib/storage";

import type { DisclosureKind } from "@/components/PermissionDisclosureDialog";
import { usePermissionStatus } from "./usePermissionStatus";

type ReminderState = {
  visible: boolean;
  kind: DisclosureKind;
};

// Minimum gap between two reminder pops, even across foreground
// transitions. Prevents spam when the user bounces in/out of Settings.
const REMINDER_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Drives the permission-reminder dialog shown on the Home tab.
 *
 * Logic:
 *   - Only kicks in once the user has finished onboarding
 *     (`permissionsCompleted` flag) — onboarding has its own
 *     disclosure flow.
 *   - On mount, checks Location and Bluetooth perms.
 *   - If a permission is currently denied AND the user previously
 *     accepted that permission's disclosure (i.e. they chose to
 *     enable it once and have since revoked it in Settings), shows
 *     the disclosure dialog in "reminder" mode.
 *   - Throttled to once per app launch + a 6h cooldown across
 *     foreground transitions, so the user isn't repeatedly nagged
 *     after dismissing or returning from Settings.
 */
export function usePermissionReminders(): {
  reminder: ReminderState | null;
  dismiss: () => void;
  openSettings: () => void;
} {
  const { locationOk, bluetoothOk, checked } = usePermissionStatus();
  const [reminder, setReminder] = useState<ReminderState | null>(null);
  const lastShownAtRef = useRef<number>(0);
  const shownThisLaunchRef = useRef<boolean>(false);

  const evaluate = useCallback(async () => {
    if (shownThisLaunchRef.current) return;
    if (Date.now() - lastShownAtRef.current < REMINDER_COOLDOWN_MS) return;
    if (!checked) return;
    const onboarded = await loadPermissionsCompleted();
    if (!onboarded) return;

    if (!locationOk) {
      const accepted = await loadDisclosureAccepted("location");
      if (accepted) {
        shownThisLaunchRef.current = true;
        lastShownAtRef.current = Date.now();
        setReminder({ visible: true, kind: "location" });
        return;
      }
    }
    if (!bluetoothOk) {
      const accepted = await loadDisclosureAccepted("bluetooth");
      if (accepted) {
        shownThisLaunchRef.current = true;
        lastShownAtRef.current = Date.now();
        setReminder({ visible: true, kind: "bluetooth" });
        return;
      }
    }
  }, [bluetoothOk, checked, locationOk]);

  useEffect(() => {
    void evaluate();
  }, [evaluate]);

  const dismiss = useCallback(() => {
    setReminder((cur) => (cur ? { ...cur, visible: false } : null));
  }, []);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
    setReminder((cur) => (cur ? { ...cur, visible: false } : null));
  }, []);

  return { reminder, dismiss, openSettings };
}
