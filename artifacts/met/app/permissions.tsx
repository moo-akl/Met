import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Camera } from "expo-camera";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type Status = "idle" | "granted" | "denied";

type PermKey = "location" | "bluetooth" | "notifications" | "camera";

type RowProps = {
  icon: "map-pin" | "bell" | "bluetooth" | "camera";
  iconLib: "feather" | "mc";
  title: string;
  description: string;
  status: Status;
  onPress: () => void;
};

export default function PermissionsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setPermissionsCompleted } = useApp();

  const [statuses, setStatuses] = useState<Record<PermKey, Status>>({
    location: "idle",
    bluetooth: "idle",
    notifications: "idle",
    camera: "idle",
  });
  const [busy, setBusy] = useState<PermKey | null>(null);

  const setOne = (k: PermKey, s: Status) =>
    setStatuses((prev) => ({ ...prev, [k]: s }));

  const requestLocation = async () => {
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

  const requestBluetooth = async () => {
    setBusy("bluetooth");
    await new Promise((r) => setTimeout(r, 350));
    setOne("bluetooth", "granted");
    setBusy(null);
  };

  const requestNotifications = async () => {
    setBusy("notifications");
    if (Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window) {
      try {
        const res = await Notification.requestPermission();
        setOne("notifications", res === "granted" ? "granted" : "denied");
      } catch {
        setOne("notifications", "denied");
      }
    } else {
      await new Promise((r) => setTimeout(r, 350));
      setOne("notifications", "granted");
    }
    setBusy(null);
  };

  const handleContinue = async () => {
    await setPermissionsCompleted(true);
    router.replace("/(tabs)");
  };

  const handleSkip = async () => {
    await setPermissionsCompleted(true);
    router.replace("/(tabs)");
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
            Set up your beacon
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Met needs a few permissions so it can quietly find people you
            cross paths with.
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <PermRow
            icon="map-pin"
            iconLib="feather"
            title="Location"
            description="Used to detect when another Met user is within 50 meters. Your exact location is never shared."
            status={statuses.location}
            onPress={requestLocation}
            busy={busy === "location"}
            colors={colors}
          />
          <PermRow
            icon="bluetooth"
            iconLib="mc"
            title="Bluetooth"
            description="Your phone broadcasts a tiny beacon over BLE so other Met users nearby can spot you."
            status={statuses.bluetooth}
            onPress={requestBluetooth}
            busy={busy === "bluetooth"}
            colors={colors}
          />
          <PermRow
            icon="camera"
            iconLib="feather"
            title="Camera"
            description="So you can scan another person's QR code to instantly add them as an encounter."
            status={statuses.camera}
            onPress={requestCamera}
            busy={busy === "camera"}
            colors={colors}
          />
          <PermRow
            icon="bell"
            iconLib="feather"
            title="Notifications"
            description="We'll let you know when you cross paths with someone new and when reveal requests arrive."
            status={statuses.notifications}
            onPress={requestNotifications}
            busy={busy === "notifications"}
            colors={colors}
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
            Your name, photo and exact location are never shared with anyone
            until you both reveal. You can change any of this later in
            Settings.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <PrimaryButton
            label={allDecided ? "Continue" : "Continue anyway"}
            onPress={handleContinue}
          />
          {!allDecided ? (
            <Pressable
              onPress={handleSkip}
              hitSlop={10}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
                alignSelf: "center",
                paddingVertical: 6,
              })}
            >
              <Text
                style={[styles.skipText, { color: colors.mutedForeground }]}
              >
                Skip for now
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
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
}: RowProps & { busy: boolean; colors: ReturnType<typeof useColors> }) {
  const granted = status === "granted";
  const denied = status === "denied";

  const statusBg = granted
    ? colors.primary
    : denied
      ? "#F3F4F6"
      : "#F3F4F6";
  const statusColor = granted
    ? "#FFFFFF"
    : denied
      ? colors.destructive
      : colors.foreground;
  const statusLabel = granted
    ? "Granted"
    : denied
      ? "Try again"
      : busy
        ? "…"
        : "Allow";

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
        onPress={onPress}
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
