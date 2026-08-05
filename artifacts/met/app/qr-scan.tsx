/**
 * /qr-scan  — Venue QR code scanner
 *
 * Opened from the HubStatusBadge "Scan QR → Unlock Reward" CTA when the user
 * is physically at a registered venue. Scans the venue's printed QR code,
 * validates the token via POST /api/hubs/qr-verify, and marks the user as
 * QR-verified for their current check-in session so the reward card unlocks.
 *
 * Route params:
 *   placeId  — the current check-in venue's placeId (used to validate that
 *              the scanned QR belongs to the right venue and to direct the
 *              verify request to the correct place).
 *   placeName — human-readable venue name (shown in the UI).
 *
 * Like scan.tsx, uses Camera.scanFromURLAsync (a static native method) instead
 * of a live <CameraView> because the ViewManager interop is broken on some
 * production builds.
 */
import { Feather } from "@expo/vector-icons";
import { Camera, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
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
function parseVenueQr(
  raw: string,
): { placeId: string; token: string } | null {
  try {
    const url = new URL(raw);
    // Shape: https://<host>/v/<placeId>?t=<token>
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

      // Validate the scanned QR belongs to the expected venue.
      if (placeId && parsed.placeId !== placeId) return "wrong-venue";

      lockRef.current = true;
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }

      try {
        await api.hubQrVerify(
          { uid: authedUid ?? "" },
          { placeId: parsed.placeId, token: parsed.token },
        );
        // Notify all subscribers (e.g. useHubCheckin) that this place is verified.
        markQrVerified(parsed.placeId);
        return "ok";
      } catch {
        lockRef.current = false;
        return "failed";
      }
    },
    [placeId, authedUid],
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
            // Navigate back after a short delay so the user sees the success state.
            setTimeout(() => {
              if (router.canGoBack()) {
                router.back();
              }
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
      recordNativeError("venueQrScan.launchCamera", "runtime", e);
      setError("Couldn't open camera. Please try again.");
    } finally {
      inFlightRef.current = false;
    }
  }, [processPhoto]);

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <View
        style={[
          styles.topBar,
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
        <Text style={[styles.topTitle, { color: colors.foreground }]}>
          Scan QR to Unlock Reward
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <View style={styles.body}>
        {success ? (
          <>
            <View style={[styles.iconCircle, { backgroundColor: "#DCFCE7" }]}>
              <Feather name="check-circle" size={64} color="#16A34A" />
            </View>
            <Text style={[styles.headline, { color: colors.foreground }]}>
              Reward Unlocked! 🎉
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              You've verified your visit at{"\n"}
              <Text style={{ fontFamily: "Inter_600SemiBold" }}>
                {placeName ?? "this venue"}
              </Text>
              . Your reward is now available.
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.iconCircle, { backgroundColor: "#FEF3C7" }]}>
              <Feather name="maximize" size={64} color="#D97706" />
            </View>
            <Text style={[styles.headline, { color: colors.foreground }]}>
              Scan the Entrance Code
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Find the QR code posted at the entrance of{" "}
              <Text style={{ fontFamily: "Inter_600SemiBold" }}>
                {placeName ?? "the venue"}
              </Text>{" "}
              and scan it to unlock today's reward.
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
                  Verifying…
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      {!success && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <PrimaryButton
            label="Open Camera"
            onPress={openCamera}
            disabled={busy}
          />
          <PrimaryButton
            label="Choose from Photos"
            variant="secondary"
            onPress={pickFromLibrary}
            disabled={busy}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 320,
  },
  errorPill: {
    marginTop: 4,
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
    flexShrink: 1,
  },
  busyRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  busyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
  },
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
});
