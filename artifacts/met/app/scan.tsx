import { Feather } from "@expo/vector-icons";
import { Camera, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { recordNativeError } from "@/lib/diagnostics";
import { useT } from "@/lib/i18n";

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

// Production iOS builds (#14 onwards) hit a broken
// `ViewManagerAdapter_Expo*` registration in ExpoModulesCore — confirmed
// in #18 by the in-app Diagnostics screen, which is why MetGradient,
// MetImage and MetCameraView all show flat fallbacks. For QR scanning
// that previously meant "Camera unavailable" because we relied on the
// live `<CameraView>` view manager.
//
// Workaround: capture a still photo via the system camera UI
// (`expo-image-picker.launchCameraAsync` opens a UIImagePickerController
// — no view manager involved) and then decode the QR from the resulting
// image with `Camera.scanFromURLAsync` (a pure static native function on
// the expo-camera module — no view manager involved either).
//
// This costs the user one extra tap and removes the live auto-detect
// scanline animation, but works on production binaries where the live
// camera view fails to render. We keep the existing camera-permission
// gate because `launchCameraAsync` requires it.

type ScanStatus = "ok" | "not-met" | "failed";

export default function ScanScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { upsertEncounterFromQr } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);
  // Synchronous in-flight guard so a fast double-tap on Open Camera or
  // Choose from Photos cannot launch two system pickers stacked on top
  // of each other (the `busy` state guard is async — there's a window
  // between the tap and the setState propagating where the button is
  // still tappable).
  const inFlightRef = useRef(false);

  const processQrData = useCallback(
    async (data: string): Promise<ScanStatus> => {
      if (lockRef.current) return "failed";
      const parsed = parseQr(data);
      if (!parsed) return "not-met";
      lockRef.current = true;
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
      try {
        const id = await upsertEncounterFromQr(parsed);
        router.replace(`/encounter/${id}`);
        return "ok";
      } catch {
        lockRef.current = false;
        return "failed";
      }
    },
    [router, upsertEncounterFromQr],
  );

  const processPhoto = useCallback(
    async (uri: string) => {
      setBusy(true);
      setError(null);
      try {
        // `Camera.scanFromURLAsync` is a pure static native method
        // (iOS Vision framework / Android ML Kit). It does not go
        // through the broken view-manager interop, so this still works
        // even when `<CameraView>` does not render.
        const results = await Camera.scanFromURLAsync(uri, ["qr"]);
        if (!results || results.length === 0) {
          setError(t("scan.noQrFound"));
          return;
        }
        let sawNonMet = false;
        for (const r of results) {
          const status = await processQrData(r.data);
          if (status === "ok") return;
          if (status === "failed") {
            setError(t("scan.couldntAddError"));
            return;
          }
          if (status === "not-met") sawNonMet = true;
        }
        setError(sawNonMet ? t("scan.notMetQRError") : t("scan.noQrFound"));
      } catch (e) {
        recordNativeError("scan.scanFromURL", "runtime", e);
        setError(t("scan.couldntAddError"));
      } finally {
        setBusy(false);
      }
    },
    [t, processQrData],
  );

  const openCamera = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets[0]) {
        await processPhoto(res.assets[0].uri);
      }
    } catch (e) {
      recordNativeError("scan.launchCamera", "runtime", e);
      setError(t("scan.couldntAddError"));
    } finally {
      inFlightRef.current = false;
    }
  }, [processPhoto, t]);

  const pickFromLibrary = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: false,
      });
      if (!res.canceled && res.assets[0]) {
        await processPhoto(res.assets[0].uri);
      }
    } catch (e) {
      recordNativeError("scan.launchLibrary", "runtime", e);
      setError(t("scan.couldntAddError"));
    } finally {
      inFlightRef.current = false;
    }
  }, [processPhoto, t]);

  // Dev-only QR simulator: lets us walk through the post-scan flow
  // without a real QR code. Production builds must NOT expose this —
  // fabricating an encounter from a tap is misleading (App Store 4.1 /
  // Play "Deceptive Behavior") and the corresponding UI entry points
  // are gated below.
  const handleSimulate = async () => {
    if (!__DEV__) return;
    const fake: ParsedQr = {
      id: `qr-${Date.now()}`,
      name: t("scan.defaultPersonName"),
    };
    const id = await upsertEncounterFromQr(fake);
    router.replace(`/encounter/${id}`);
  };

  const webTop = Platform.OS === "web" ? 67 : 0;
  const topPad = insets.top + webTop;

  if (!permission) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.background }]}
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
            {t("scan.cameraNeededTitle")}
          </Text>
          <Text style={[styles.permSub, { color: colors.mutedForeground }]}>
            {t("scan.cameraNeededSub")}
          </Text>
          <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
            <PrimaryButton
              label={t("scan.allowCameraBtn")}
              onPress={async () => {
                await requestPermission();
              }}
            />
            {__DEV__ ? (
              <PrimaryButton
                label={t("scan.useDemoQRBtn")}
                variant="secondary"
                onPress={handleSimulate}
              />
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[
          styles.scanTopBar,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.iconBtn, { backgroundColor: colors.muted }]}
        >
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.scanTopTitle, { color: colors.foreground }]}>
          {t("scan.titleScreen")}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.scanBody}>
        <View
          style={[
            styles.scanIllustration,
            { backgroundColor: "#DCFCE7" },
          ]}
        >
          <Feather name="maximize" size={64} color={colors.primary} />
        </View>

        <Text style={[styles.scanHeadline, { color: colors.foreground }]}>
          {t("scan.captureHint")}
        </Text>
        <Text style={[styles.scanSub, { color: colors.mutedForeground }]}>
          {t("scan.hintMain")}
        </Text>

        {error ? (
          <View
            style={[
              styles.errorPill,
              { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
            ]}
          >
            <Feather name="alert-circle" size={14} color="#B91C1C" />
            <Text style={styles.errorPillText}>{error}</Text>
          </View>
        ) : null}

        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.busyText, { color: colors.mutedForeground }]}>
              {t("scan.scanningPhoto")}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.scanFooter,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <PrimaryButton
          label={t("scan.captureBtn")}
          onPress={openCamera}
          disabled={busy}
        />
        <PrimaryButton
          label={t("scan.libraryBtn")}
          variant="secondary"
          onPress={pickFromLibrary}
          disabled={busy}
        />
        {__DEV__ ? (
          <PrimaryButton
            label={t("scan.simulateScan")}
            variant="ghost"
            onPress={handleSimulate}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scanTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scanTopTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  scanBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  scanIllustration: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  scanHeadline: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  scanSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 320,
  },
  errorPill: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  errorPillText: {
    color: "#B91C1C",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  busyRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  busyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  scanFooter: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
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
