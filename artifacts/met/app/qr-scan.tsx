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
import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api/client";
import { recordNativeError } from "@/lib/diagnostics";
import { markQrVerified } from "@/lib/qrVerificationState";
import { isStoreScreenshotDemo, STORE_DEMO_PLACE_NAME } from "@/lib/storeVenueDemo";

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

function StoreDemoCheckinScreen({
  venueName,
  topInset,
  bottomInset,
  onClose,
}: {
  venueName: string;
  topInset: number;
  bottomInset: number;
  onClose: () => void;
}) {
  const { isDark } = useTheme();
  const light = !isDark;
  return (
    <View style={[qrDemoStyles.page, light && qrLight.page]}>
      <View style={[qrDemoStyles.topBar, light && qrLight.topBar, { paddingTop: topInset + 12 }]}>
        <Pressable onPress={onClose} style={qrDemoStyles.closeButton} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={20} color={light ? "#252B36" : "#F8FAFC"} />
        </Pressable>
        <Text style={[qrDemoStyles.topTitle, light && qrLight.ink]}>Venue check-in</Text>
        <Feather name="map-pin" size={19} color={light ? "#6552AD" : "#A78BFA"} />
      </View>
      <View style={qrDemoStyles.content}>
        <Text style={[qrDemoStyles.headline, light && qrLight.headline]}>Check in where the moment happens.</Text>
        <Text style={[qrDemoStyles.subtitle, light && qrLight.muted]}>
          Scan a venue’s Met code to mark your visit and join its community rewards.
        </Text>

        <View style={[qrDemoStyles.scanCard, light && qrLight.scanCard]}>
          <View style={qrDemoStyles.venueRow}>
            <View style={[qrDemoStyles.venueIcon, light && qrLight.venueIcon]}>
              <Feather name="coffee" size={21} color={light ? "#6552AD" : "#A78BFA"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[qrDemoStyles.venueEyebrow, light && qrLight.accent]}>SAMPLE VENUE</Text>
              <Text style={[qrDemoStyles.venueName, light && qrLight.ink]}>{venueName}</Text>
              <Text style={[qrDemoStyles.venueArea, light && qrLight.muted]}>River District · local café</Text>
            </View>
          </View>
          <View style={qrDemoStyles.qrFrame}>
            <View style={qrDemoStyles.qrGrid}>
              {Array.from({ length: 11 * 11 }, (_, index) => {
                const row = Math.floor(index / 11);
                const column = index % 11;
                const finder =
                  (row < 3 && column < 3) ||
                  (row < 3 && column > 7) ||
                  (row > 7 && column < 3);
                const active =
                  finder ||
                  ((row * 7 + column * 11 + row * column) % 5 < 2) ||
                  (row === column && row % 2 === 0);
                return (
                  <View
                    key={`${row}-${column}`}
                    style={[
                      qrDemoStyles.qrCell,
                      active ? qrDemoStyles.qrCellOn : qrDemoStyles.qrCellOff,
                      finder && (row % 2 === 1 && column % 2 === 1) && qrDemoStyles.qrCellCenter,
                    ]}
                  />
                );
              })}
            </View>
            <View style={[qrDemoStyles.scanLine, light && qrLight.scanLine]} />
          </View>
          <View style={qrDemoStyles.scanCaptionRow}>
            <Feather name="camera" size={15} color={light ? "#6552AD" : "#A78BFA"} />
            <Text style={[qrDemoStyles.scanCaption, light && qrLight.ink]}>Point your camera at the in-store Met code</Text>
          </View>
          <Text style={[qrDemoStyles.notLiveCode, light && qrLight.muted]}>Illustrative code · no visit recorded</Text>
        </View>
        <View style={[qrDemoStyles.rewardNote, light && qrLight.rewardNote]}>
          <Feather name="award" size={17} color={light ? "#A26921" : "#F7C968"} />
          <Text style={[qrDemoStyles.rewardNoteText, light && qrLight.rewardText]}>
            A verified visit can count toward a venue’s leaderboard and rewards.
          </Text>
        </View>
      </View>
      <View style={[qrDemoStyles.footer, { paddingBottom: bottomInset + 18 }]}>
        <View style={[qrDemoStyles.footerDot, light && qrLight.scanLine]} />
        <Text style={[qrDemoStyles.footerText, light && qrLight.muted]}>Check in at the place — never from a distance.</Text>
      </View>
    </View>
  );
}

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
  const screenshotDemoCheckin =
    isStoreScreenshotDemo("checkin") && placeId === "met-sample-mira-house";

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

  if (screenshotDemoCheckin) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StoreDemoCheckinScreen
          venueName={typeof placeName === "string" ? placeName : STORE_DEMO_PLACE_NAME}
          topInset={insets.top}
          bottomInset={insets.bottom}
          onClose={() => router.back()}
        />
      </>
    );
  }

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

const qrDemoStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#080B14" },
  topBar: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.08)",
  },
  closeButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#F8FAFC", fontSize: 16, fontFamily: "Inter_700Bold" },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 22, paddingVertical: 12 },
  headline: { color: "#F8FAFC", fontSize: 23, lineHeight: 28, textAlign: "center", marginTop: 8, fontFamily: "Inter_700Bold" },
  subtitle: { maxWidth: 320, alignSelf: "center", color: "#99A3B5", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 5, marginBottom: 12, fontFamily: "Inter_400Regular" },
  scanCard: {
    alignItems: "center",
    padding: 13,
    borderRadius: 20,
    backgroundColor: "#111723",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.09)",
  },
  venueRow: { width: "100%", flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 12 },
  venueIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(167,139,250,.13)" },
  venueEyebrow: { color: "#A78BFA", fontSize: 8, letterSpacing: 1, fontFamily: "Inter_700Bold" },
  venueName: { color: "#F8FAFC", fontSize: 14, marginTop: 3, fontFamily: "Inter_700Bold" },
  venueArea: { color: "#8791A3", fontSize: 9, marginTop: 2, fontFamily: "Inter_400Regular" },
  qrFrame: {
    width: 204,
    height: 204,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
  },
  qrGrid: { width: 165, height: 165, flexDirection: "row", flexWrap: "wrap" },
  qrCell: { width: 15, height: 15 },
  qrCellOn: { backgroundColor: "#10151E" },
  qrCellOff: { backgroundColor: "#F8FAFC" },
  qrCellCenter: { backgroundColor: "#F8FAFC" },
  scanLine: {
    position: "absolute",
    left: 18,
    right: 18,
    height: 2,
    top: "50%",
    backgroundColor: "#A78BFA",
    opacity: 0.72,
  },
  scanCaptionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 10 },
  scanCaption: { color: "#D5DBE7", fontSize: 10, fontFamily: "Inter_500Medium" },
  notLiveCode: { color: "#737E90", fontSize: 8, marginTop: 5, textAlign: "center", fontFamily: "Inter_400Regular" },
  rewardNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    padding: 10,
    borderRadius: 13,
    backgroundColor: "rgba(247,201,104,.07)",
    borderWidth: 1,
    borderColor: "rgba(247,201,104,.16)",
  },
  rewardNoteText: { flex: 1, color: "#D1C7AE", fontSize: 9, lineHeight: 13, fontFamily: "Inter_400Regular" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingTop: 5, paddingHorizontal: 10 },
  footerDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: "#A78BFA" },
  footerText: { color: "#737E90", fontSize: 8, fontFamily: "Inter_400Regular" },
});

const qrLight = StyleSheet.create({
  page: { backgroundColor: "#F8F5EF" },
  topBar: { borderBottomColor: "#E8E3DA" },
  ink: { color: "#252B36" },
  headline: { color: "#252B36", fontSize: 25, lineHeight: 31 },
  muted: { color: "#6F7581" },
  accent: { color: "#6552AD" },
  scanCard: {
    backgroundColor: "#FFFEFB",
    borderColor: "#E9E3D9",
    shadowColor: "#716257",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 3,
  },
  venueIcon: { backgroundColor: "#EEE9F8" },
  scanLine: { backgroundColor: "#6552AD" },
  rewardNote: { backgroundColor: "#FFF3DD", borderColor: "#EEDDBB" },
  rewardText: { color: "#765127" },
});

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
