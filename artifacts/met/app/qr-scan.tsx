/**
 * /qr-scan  — Venue QR code scanner (live camera auto-scan)
 *
 * Shows a live camera preview with a scan-frame overlay. As soon as the
 * native barcode detector sees a QR code it automatically calls
 * processQrData — no button press required. A "Choose from Photos" fallback
 * remains for cases where the camera cannot see the code directly.
 */
import { Feather } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "expo-camera";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
import { api } from "@/lib/api/client";
import { recordNativeError } from "@/lib/diagnostics";
import { markQrVerified } from "@/lib/qrVerificationState";

/** Parse a venue QR URL and extract placeId + token. */
function parseVenueQr(raw: string): { placeId: string; token: string } | null {
  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/v\/([^/?#]+)/);
    if (!match || !match[1]) return null;
    const placeId = decodeURIComponent(match[1]);
    const token = url.searchParams.get("t");
    if (!placeId || !token) return null;
    return { placeId, token };
  } catch {
    return null;
  }
}

type ScanStatus = "ok" | "wrong-venue" | "invalid" | "failed";

export default function VenueQrScanScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authedUid } = useApp();
  const { placeId, placeName } = useLocalSearchParams<{
    placeId: string;
    placeName?: string;
  }>();

  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);
  const inFlightRef = useRef(false);

  const processQrData = useCallback(
    async (data: string): Promise<ScanStatus> => {
      if (lockRef.current) return "failed";

      const parsed = parseVenueQr(data);
      if (!parsed) return "invalid";

      if (placeId && parsed.placeId !== placeId) return "wrong-venue";

      lockRef.current = true;
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }

      try {
        const result = await api.hubQrVerify(
          { uid: authedUid ?? "" },
          { placeId: parsed.placeId, token: parsed.token },
        );
        markQrVerified(parsed.placeId, result.streak);
        return "ok";
      } catch {
        lockRef.current = false;
        return "failed";
      }
    },
    [placeId, authedUid],
  );

  // Called automatically by CameraView when it detects a barcode.
  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (lockRef.current || busy || success) return;
      setBusy(true);
      setError(null);

      const status = await processQrData(data);

      if (status === "ok") {
        setSuccess(true);
        setTimeout(() => {
          if (router.canGoBack()) router.back();
        }, 1200);
      } else if (status === "wrong-venue") {
        setError("This QR code belongs to a different venue.");
        lockRef.current = false;
      } else if (status === "invalid") {
        // Ignore non-venue QR codes silently — don't show an error for
        // every random QR code the camera might see.
        lockRef.current = false;
      } else {
        setError("QR code is invalid or has been rotated. Ask venue staff for help.");
      }

      setBusy(false);
    },
    [busy, success, processQrData, router],
  );

  const processPhoto = useCallback(
    async (uri: string) => {
      setBusy(true);
      setError(null);
      try {
        const results = await Camera.scanFromURLAsync(uri, ["qr"]);
        if (!results || results.length === 0) {
          setError("No QR code found in this photo. Try again.");
          return;
        }
        for (const r of results) {
          const status = await processQrData(r.data);
          if (status === "ok") {
            setSuccess(true);
            setTimeout(() => {
              if (router.canGoBack()) router.back();
            }, 1200);
            return;
          }
          if (status === "wrong-venue") {
            setError("This QR code belongs to a different venue.");
            lockRef.current = false;
            return;
          }
          if (status === "failed") {
            setError("QR code is invalid or has been rotated. Ask venue staff for help.");
            return;
          }
        }
        setError("Not a valid venue QR code. Make sure you're scanning the entrance code.");
      } catch (e) {
        recordNativeError("venueQrScan.scanFromURL", "runtime", e);
        setError("Couldn't read the photo. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [processQrData, router],
  );

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
      recordNativeError("venueQrScan.launchLibrary", "runtime", e);
      setError("Couldn't open photo library. Please try again.");
    } finally {
      inFlightRef.current = false;
    }
  }, [processPhoto]);

  const webTop = Platform.OS === "web" ? 67 : 0;
  const topPad = insets.top + webTop;

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]} />
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.permWrap, { paddingTop: topPad + 32, paddingHorizontal: 28 }]}>
          <View style={[styles.iconCircle, { backgroundColor: "#FEF3C7" }]}>
            <Feather name="camera" size={36} color="#D97706" />
          </View>
          <Text style={[styles.permTitle, { color: colors.foreground }]}>
            Camera Access Needed
          </Text>
          <Text style={[styles.permSub, { color: colors.mutedForeground }]}>
            Allow camera access to scan the venue QR code and unlock your reward.
          </Text>
          <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
            <PrimaryButton
              label="Allow Camera"
              onPress={async () => { await requestPermission(); }}
            />
            <PrimaryButton
              label="Go Back"
              variant="secondary"
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

      {success ? (
        /* ── Success overlay ──────────────────────────────────────────────── */
        <View style={[styles.successOverlay, { paddingTop: topPad + 24, paddingBottom: insets.bottom + 32 }]}>
          <View style={[styles.iconCircle, { backgroundColor: "#DCFCE7" }]}>
            <Feather name="check-circle" size={64} color="#16A34A" />
          </View>
          <Text style={styles.successTitle}>Reward Unlocked! 🎉</Text>
          <Text style={styles.successSub}>
            You've verified your visit at{"\n"}
            <Text style={{ fontFamily: "Inter_600SemiBold" }}>
              {placeName ?? "this venue"}
            </Text>
            . Your reward is now available.
          </Text>
        </View>
      ) : (
        <>
          {/* ── Live camera ────────────────────────────────────────────────── */}
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcodeScanned}
          />

          {/* ── Dark overlay with transparent scan window ─────────────────── */}
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {/* Top dark band */}
            <View style={styles.darkBand} />
            {/* Middle row: dark | clear window | dark */}
            <View style={styles.middleRow}>
              <View style={styles.darkSide} />
              {/* Scan window */}
              <View style={styles.scanWindow}>
                {/* Corner brackets */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.darkSide} />
            </View>
            {/* Bottom dark band */}
            <View style={styles.darkBandBottom} />
          </View>

          {/* ── Top bar ──────────────────────────────────────────────────────── */}
          <View style={[styles.topBar, { paddingTop: topPad + 12 }]}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={styles.iconBtn}
            >
              <Feather name="x" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.topTitle}>Scan QR to Unlock Reward</Text>
            <View style={{ width: 38 }} />
          </View>

          {/* ── Hint + status below scan window ──────────────────────────────── */}
          <View style={[styles.hintArea, { paddingBottom: insets.bottom + 24 }]}>
            {busy ? (
              <View style={styles.busyRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.hintText}>Verifying…</Text>
              </View>
            ) : error ? (
              <View style={styles.errorPill}>
                <Feather name="alert-circle" size={14} color="#FCA5A5" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <Text style={styles.hintText}>
                Point your camera at the QR code — it will scan automatically
              </Text>
            )}

            <Pressable
              style={styles.galleryBtn}
              onPress={pickFromLibrary}
              disabled={busy}
            >
              <Feather name="image" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.galleryBtnText}>Choose from Photos</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const SCAN_SIZE = 260;
const CORNER_SIZE = 22;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Permission screen ──────────────────────────────────────────────────────
  permWrap: {
    flex: 1,
    alignItems: "center",
    gap: 10,
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
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  // ── Success ────────────────────────────────────────────────────────────────
  successOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    gap: 14,
    paddingHorizontal: 28,
  },
  successTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    textAlign: "center",
    color: "#111",
  },
  successSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    color: "#555",
    maxWidth: 320,
  },

  // ── Live camera layout ─────────────────────────────────────────────────────
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  topTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  // ── Dark overlay with transparent window ───────────────────────────────────
  darkBand: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  darkBandBottom: {
    flex: 1.2,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  middleRow: {
    flexDirection: "row",
    height: SCAN_SIZE,
  },
  darkSide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  scanWindow: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    backgroundColor: "transparent",
  },

  // ── Corner brackets ─────────────────────────────────────────────────────────
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: "#fff",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 4,
  },

  // ── Hint / status area below scan window ────────────────────────────────────
  hintArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  hintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  errorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(185,28,28,0.85)",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#FEE2E2",
    flexShrink: 1,
  },
  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  galleryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  galleryBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
  },
});
