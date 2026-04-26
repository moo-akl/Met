import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

type ParsedQr = { id: string; name: string };

function parseQr(raw: string): ParsedQr | null {
  try {
    const obj = JSON.parse(raw);
    if (
      obj &&
      typeof obj === "object" &&
      obj.type === "met.user" &&
      typeof obj.id === "string" &&
      typeof obj.name === "string"
    ) {
      return { id: obj.id, name: obj.name };
    }
    return null;
  } catch {
    return null;
  }
}

export default function ScanScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { upsertEncounterFromQr } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const handleScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (lockRef.current) return;
      const parsed = parseQr(data);
      if (!parsed) {
        setError("That doesn't look like a Met QR code.");
        return;
      }
      lockRef.current = true;
      setError(null);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
      try {
        const id = await upsertEncounterFromQr(parsed);
        router.replace(`/encounter/${id}`);
      } catch {
        lockRef.current = false;
        setError("Couldn't add that encounter. Try again.");
      }
    },
    [router, upsertEncounterFromQr],
  );

  const handleSimulate = async () => {
    const fake: ParsedQr = {
      id: `qr-${Date.now()}`,
      name: "Sam from the cafe",
    };
    const id = await upsertEncounterFromQr(fake);
    router.replace(`/encounter/${id}`);
  };

  const webTop = Platform.OS === "web" ? 67 : 0;
  const topPad = insets.top + webTop;

  if (!permission) {
    return (
      <View
        style={[styles.container, { backgroundColor: "#000" }]}
      />
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={[
            styles.permWrap,
            { paddingTop: topPad + 32, paddingHorizontal: 28 },
          ]}
        >
          <View style={[styles.permIcon, { backgroundColor: "#DCFCE7" }]}>
            <Feather name="camera" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.permTitle, { color: colors.foreground }]}>
            Camera access needed
          </Text>
          <Text style={[styles.permSub, { color: colors.mutedForeground }]}>
            Met needs your camera so you can scan another person&rsquo;s QR
            code and add them as an instant encounter.
          </Text>
          <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
            <PrimaryButton
              label="Allow camera"
              onPress={async () => {
                await requestPermission();
              }}
            />
            <PrimaryButton
              label="Use a demo QR instead"
              variant="secondary"
              onPress={handleSimulate}
            />
            <PrimaryButton
              label="Close"
              variant="ghost"
              onPress={() => router.back()}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={handleScanned}
      />
      <View style={[styles.overlay]} pointerEvents="box-none">
        <View
          style={[
            styles.topBar,
            { paddingTop: topPad + 12 },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.iconBtn}
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.topTitle}>Scan a Met QR</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.frameWrap} pointerEvents="none">
          <View
            style={[styles.frame, { borderColor: colors.primary }]}
          />
        </View>

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: insets.bottom + 28 },
          ]}
        >
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={styles.hintText}>
              Point at another Met user&rsquo;s QR code to instantly add them
              as an encounter and send a reveal request.
            </Text>
          )}
          <Pressable
            onPress={handleSimulate}
            hitSlop={10}
            style={({ pressed }) => [
              styles.simBtn,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="play-circle" size={16} color="#FFFFFF" />
            <Text style={styles.simText}>Simulate a scan</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  topTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  frameWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 3,
    backgroundColor: "transparent",
  },
  bottomBar: {
    paddingHorizontal: 26,
    paddingTop: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    gap: 14,
    alignItems: "center",
  },
  hintText: {
    color: "#FFFFFF",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 320,
  },
  errorText: {
    color: "#FCA5A5",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    textAlign: "center",
  },
  simBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  simText: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  permWrap: {
    flex: 1,
    alignItems: "center",
    gap: 10,
  },
  permIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  permTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  permSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 320,
  },
});
