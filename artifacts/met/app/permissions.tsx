import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Camera } from "expo-camera";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { loadPlx } from "@/lib/ble/plx";
import { isAdvertisingAvailable } from "@/lib/ble";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PermissionDisclosureDialog,
  type DisclosureKind,
} from "@/components/PermissionDisclosureDialog";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  registerAndUploadPushToken,
  requestNotificationPermission,
} from "@/lib/notifications";
import { saveDisclosureAccepted } from "@/lib/storage";

type Status = "idle" | "granted" | "denied";

type PermKey = "location" | "bluetooth" | "notifications" | "camera";

type RowProps = {
  icon: "map-pin" | "bell" | "bluetooth" | "camera";
  iconLib: "feather" | "mc";
  title: string;
  description: string;
  status: Status;
  onPress: () => void;
  t: (k: string, opts?: Record<string, unknown>) => string;
};

export default function PermissionsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { setPermissionsCompleted, permissionsCompleted, authedUid } = useApp();
  const { venueOwner } = useLocalSearchParams<{ venueOwner?: string }>();
  const continueToVenueOwner = venueOwner === "1";

  const [statuses, setStatuses] = useState<Record<PermKey, Status>>({
    location: "idle",
    bluetooth: "idle",
    notifications: "idle",
    camera: "idle",
  });
  const [busy, setBusy] = useState<PermKey | null>(null);

  // Mirror statuses in a ref so the AppState callback always reads the
  // latest values without needing to be re-registered on every change.
  const statusesRef = useRef(statuses);
  useEffect(() => { statusesRef.current = statuses; }, [statuses]);

  // Re-check every previously-denied permission when the user comes back
  // from the OS Settings app. Uses non-prompting "get" APIs so we never
  // fire the system dialog here — only check what the OS already decided.
  const recheckDenied = useCallback(async () => {
    const cur = statusesRef.current;
    const updates: Partial<Record<PermKey, Status>> = {};

    if (cur.location === "denied") {
      try {
        const res = await Location.getForegroundPermissionsAsync();
        if (res.granted) updates.location = "granted";
      } catch { /* noop */ }
    }

    if (cur.camera === "denied") {
      try {
        const res = await Camera.getCameraPermissionsAsync();
        if (res.granted) updates.camera = "granted";
      } catch { /* noop */ }
    }

    if (cur.notifications === "denied") {
      try {
        const res = await Notifications.getPermissionsAsync();
        if (res.granted) updates.notifications = "granted";
      } catch { /* noop */ }
    }

    if (cur.bluetooth === "denied") {
      if (Platform.OS === "android" && (Platform.Version as number) >= 31) {
        try {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          );
          if (granted) updates.bluetooth = "granted";
        } catch { /* noop */ }
      } else {
        // iOS: instantiate BleManager and read current state (no prompt).
        const plx = loadPlx();
        if (plx) {
          try {
            const manager = new plx.BleManager();
            const granted = await new Promise<boolean>((resolve) => {
              const timer = setTimeout(() => {
                try { sub.remove(); } catch { /* noop */ }
                resolve(false);
              }, 1500);
              const sub = manager.onStateChange((s) => {
                if (s === plx.State.PoweredOn || s === plx.State.PoweredOff) {
                  clearTimeout(timer); sub.remove(); resolve(true);
                } else if (
                  s === plx.State.Unauthorized ||
                  s === plx.State.Unsupported
                ) {
                  clearTimeout(timer); sub.remove(); resolve(false);
                }
              }, true);
            });
            try { manager.destroy(); } catch { /* noop */ }
            if (granted) updates.bluetooth = "granted";
          } catch { /* noop */ }
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      setStatuses((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  // On mount, silently query every permission status so rows that were
  // already granted (or denied) in a prior session open in the right state
  // immediately — no OS dialog is shown, only non-prompting "get" APIs.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const updates: Partial<Record<PermKey, Status>> = {};

      // Location
      try {
        const res = await Location.getForegroundPermissionsAsync();
        if (res.granted) updates.location = "granted";
        else if (res.status === "denied") updates.location = "denied";
      } catch { /* noop */ }

      // Camera
      try {
        const res = await Camera.getCameraPermissionsAsync();
        if (res.granted) updates.camera = "granted";
        else if (res.status === "denied") updates.camera = "denied";
      } catch { /* noop */ }

      // Notifications
      try {
        const res = await Notifications.getPermissionsAsync();
        if (res.granted) updates.notifications = "granted";
        else if (res.status === "denied") updates.notifications = "denied";
      } catch { /* noop */ }

      // Bluetooth
      if (Platform.OS === "android" && (Platform.Version as number) >= 31) {
        try {
          const granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          );
          // On Android we can only detect "granted"; "denied" vs "never_asked"
          // are indistinguishable via .check() so we leave it idle if not granted.
          if (granted) updates.bluetooth = "granted";
        } catch { /* noop */ }
      } else if (Platform.OS !== "web") {
        // iOS: read BleManager state without prompting.
        const plx = loadPlx();
        if (plx) {
          try {
            const manager = new plx.BleManager();
            const result = await new Promise<"granted" | "denied" | "idle">(
              (resolve) => {
                const timer = setTimeout(() => {
                  try { sub.remove(); } catch { /* noop */ }
                  resolve("idle");
                }, 1500);
                const sub = manager.onStateChange((s) => {
                  if (s === plx.State.PoweredOn || s === plx.State.PoweredOff) {
                    clearTimeout(timer); sub.remove(); resolve("granted");
                  } else if (
                    s === plx.State.Unauthorized ||
                    s === plx.State.Unsupported
                  ) {
                    clearTimeout(timer); sub.remove(); resolve("denied");
                  }
                }, true);
              },
            );
            try { manager.destroy(); } catch { /* noop */ }
            if (result !== "idle") updates.bluetooth = result;
          } catch { /* noop */ }
        }
      }

      if (!cancelled && Object.keys(updates).length > 0) {
        setStatuses((prev) => ({ ...prev, ...updates }));
      }
    };

    void run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for the app returning to the foreground after the user visited
  // the OS Settings app. We track the previous state to distinguish a
  // Settings round-trip (background → active) from a fresh launch.
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (
        nextState === "active" &&
        (prev === "background" || prev === "inactive")
      ) {
        void recheckDenied();
      }
    });
    return () => sub.remove();
  }, [recheckDenied]);
  // Which disclosure dialog (if any) is currently shown. The actual OS
  // permission prompt only fires when the user accepts the disclosure.
  const [disclosure, setDisclosure] = useState<DisclosureKind | null>(null);

  const setOne = (k: PermKey, s: Status) =>
    setStatuses((prev) => ({ ...prev, [k]: s }));

  // Real OS prompt — only called once the user has accepted the
  // prominent disclosure (Play Store / App Store policy).
  const doRequestLocation = async () => {
    setBusy("location");
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      setOne("location", res.granted ? "granted" : "denied");
    } catch {
      setOne("location", "denied");
    } finally {
      setBusy(null);
    }
  };

  const requestLocation = () => {
    // Show prominent disclosure first. The dialog calls the real OS
    // prompt from its onAccept handler.
    setDisclosure("location");
  };

  const requestCamera = async () => {
    setBusy("camera");
    try {
      const res = await Camera.requestCameraPermissionsAsync();
      setOne("camera", res.granted ? "granted" : "denied");
    } catch {
      setOne("camera", "denied");
    } finally {
      setBusy(null);
    }
  };

  const requestBluetooth = () => {
    setDisclosure("bluetooth");
  };

  const doRequestBluetooth = async () => {
    setBusy("bluetooth");
    try {
      // Android 12+: explicit runtime grants for the new BLE perms.
      if (Platform.OS === "android" && (Platform.Version as number) >= 31) {
        const res = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        ]);
        const allGranted = Object.values(res).every(
          (v) => v === PermissionsAndroid.RESULTS.GRANTED,
        );
        setOne("bluetooth", allGranted ? "granted" : "denied");
        return;
      }

      // iOS: simply *constructing* a BleManager triggers the system
      // prompt. We don't need the manager itself here, just the side
      // effect of asking the user. Falls back to the advertiser
      // availability check if scanning isn't linked.
      const plx = loadPlx();
      if (plx) {
        try {
          const manager = new plx.BleManager();
          // Wait for the radio to settle so we can read the user's
          // decision. iOS reports `Unauthorized` if denied, `PoweredOn`
          // if allowed (and BT is on), `PoweredOff` if allowed but BT
          // is off (which is still a successful permission grant).
          const granted = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => {
              try { sub.remove(); } catch { /* noop */ }
              resolve(false);
            }, 4_000);
            const sub = manager.onStateChange((s) => {
              if (s === plx.State.PoweredOn || s === plx.State.PoweredOff) {
                clearTimeout(timer);
                sub.remove();
                resolve(true);
              } else if (
                s === plx.State.Unauthorized ||
                s === plx.State.Unsupported
              ) {
                clearTimeout(timer);
                sub.remove();
                resolve(false);
              }
            }, true);
          });
          try { manager.destroy(); } catch { /* noop */ }
          setOne("bluetooth", granted ? "granted" : "denied");
          return;
        } catch (err) {
          console.warn("[permissions] BLE probe failed", err);
        }
      }

      // Fall back to the advertiser availability check (Expo Go safe).
      const available = await isAdvertisingAvailable();
      setOne("bluetooth", available ? "granted" : "denied");
    } catch (err) {
      console.warn("[permissions] requestBluetooth failed", err);
      setOne("bluetooth", "denied");
    } finally {
      setBusy(null);
    }
  };

  const requestNotifications = async () => {
    setBusy("notifications");
    try {
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        "Notification" in window
      ) {
        const res = await Notification.requestPermission();
        setOne("notifications", res === "granted" ? "granted" : "denied");
      } else {
        const granted = await requestNotificationPermission();
        setOne("notifications", granted ? "granted" : "denied");
        // Fetch Expo push token, save locally, and upload to api-server
        // so the backend can send remote push notifications.
        // No-op on simulator / Expo Go.
        if (granted && authedUid) {
          void registerAndUploadPushToken(authedUid);
        }
      }
    } catch {
      setOne("notifications", "denied");
    } finally {
      setBusy(null);
    }
  };

  const handleContinue = async () => {
    await setPermissionsCompleted(true);
    if (permissionsCompleted) router.back();
    else router.replace(continueToVenueOwner ? "/venue-owner/setup" : "/(tabs)");
  };

  const handleSkip = async () => {
    await setPermissionsCompleted(true);
    if (permissionsCompleted) router.back();
    else router.replace(continueToVenueOwner ? "/venue-owner/setup" : "/(tabs)");
  };

  const allDecided = (Object.values(statuses) as Status[]).every(
    (s) => s !== "idle",
  );

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + webTop + 28,
          paddingBottom: insets.bottom + webBot + 32,
          paddingHorizontal: 24,
          gap: 22,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.iconHero,
              { backgroundColor: "#DCFCE7" },
            ]}
          >
            <Feather name="shield" size={42} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t("permissions.titleScreen")}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {t("permissions.subtitleScreen")}
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {/* Notifications first — lowest friction, easiest to understand */}
          <PermRow
            icon="bell"
            iconLib="feather"
            title={t("permissions.notificationsTitle")}
            description="We'll let you know when someone wants to connect."
            status={statuses.notifications}
            onPress={requestNotifications}
            busy={busy === "notifications"}
            colors={colors}
            t={t}
          />
          {/* Bluetooth second — core to the BLE encounter loop */}
          <PermRow
            icon="bluetooth"
            iconLib="mc"
            title={t("permissions.bluetoothTitle")}
            description="This is how Met detects people near you — works indoors where GPS can't."
            status={statuses.bluetooth}
            onPress={requestBluetooth}
            busy={busy === "bluetooth"}
            colors={colors}
            t={t}
          />
          {/* Location third — for heatmap & venue check-ins */}
          <PermRow
            icon="map-pin"
            iconLib="feather"
            title={t("permissions.locationTitle")}
            description="Used for the heatmap and venue check-ins near you."
            status={statuses.location}
            onPress={requestLocation}
            busy={busy === "location"}
            colors={colors}
            t={t}
          />
          {/* Camera last — QR scanning, lowest urgency */}
          <PermRow
            icon="camera"
            iconLib="feather"
            title={t("permissions.cameraTitle")}
            description={t("permissions.cameraDesc")}
            status={statuses.camera}
            onPress={requestCamera}
            busy={busy === "camera"}
            colors={colors}
            t={t}
          />
        </View>

        <View
          style={[
            styles.disclosure,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Feather name="lock" size={16} color={colors.primary} />
          <Text style={[styles.disclosureText, { color: colors.mutedForeground }]}>
            {t("permissions.disclosure")}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <PrimaryButton
            label={permissionsCompleted ? t("common.done") : t("permissions.continue")}
            onPress={handleContinue}
          />
        </View>
      </ScrollView>

      <PermissionDisclosureDialog
        visible={disclosure !== null}
        kind={disclosure ?? "location"}
        mode="prompt"
        onAccept={async () => {
          const kind = disclosure;
          setDisclosure(null);
          if (!kind) return;
          await saveDisclosureAccepted(kind, true);
          if (kind === "location") {
            await doRequestLocation();
          } else if (kind === "bluetooth") {
            await doRequestBluetooth();
          }
        }}
        onDismiss={() => setDisclosure(null)}
      />
    </View>
  );
}

function PermRow({
  icon,
  iconLib,
  title,
  description,
  status,
  onPress,
  busy,
  colors,
  t,
}: RowProps & { busy: boolean; colors: ReturnType<typeof useColors> }) {
  const granted = status === "granted";
  const denied = status === "denied";

  const statusBg = granted ? colors.primary : colors.actionButton;
  const statusColor = granted
    ? "#FFFFFF"
    : "#FFFFFF";
  const statusLabel = granted
    ? t("permissions.statusGranted")
    : denied
      ? t("permissions.statusOpenSettings")
      : busy
        ? "…"
        : t("permissions.statusAllow");

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: granted ? "#DCFCE7" : colors.muted },
        ]}
      >
        {iconLib === "feather" ? (
          <Feather
            name={icon as React.ComponentProps<typeof Feather>["name"]}
            size={20}
            color={granted ? colors.primary : colors.foreground}
          />
        ) : (
          <MaterialCommunityIcons
            name={icon as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
            size={20}
            color={granted ? colors.primary : colors.foreground}
          />
        )}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]}>
          {title}
        </Text>
        <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      </View>
      <Pressable
        onPress={denied ? () => Linking.openSettings() : onPress}
        disabled={busy || granted}
        hitSlop={6}
        style={({ pressed }) => [
          styles.statusBtn,
          {
            backgroundColor: statusBg,
            opacity: pressed && !granted ? 0.85 : granted ? 1 : 1,
          },
        ]}
      >
        {granted ? (
          <Feather name="check" size={14} color="#FFFFFF" />
        ) : null}
        <Text style={[styles.statusText, { color: statusColor }]}>
          {statusLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: "center", gap: 10, paddingTop: 4 },
  iconHero: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  row: {
    flexDirection: "row",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  rowDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 78,
    justifyContent: "center",
  },
  statusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  disclosure: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  disclosureText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  skipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
