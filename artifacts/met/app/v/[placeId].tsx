/**
 * /v/[placeId]?t=<token> — dedicated venue QR check-in screen.
 *
 * Lightweight on purpose: it saves a durable pending intent, routes
 * unauthenticated visitors through QR-first sign-in, provisions a hidden
 * minimal profile if needed, then makes exactly one server verify call and
 * shows an explicit, server-confirmed result. The full venue page is an
 * option afterwards, never a prerequisite.
 */
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { getCurrentUserAccount, getCurrentUserId } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import {
  COMPLETE_PROFILE_HREF,
  isIncompleteProfile,
} from "@/lib/profileCompletion";
import {
  ensureMinimalProfile,
  QR_REQUEST_TIMEOUT_MS,
  verifyQr,
  type QrVerifyOutcome,
} from "@/lib/qrCheckin";
import {
  clearQrIntent,
  isValidQrParts,
  runQrVerifyOnce,
  saveQrIntent,
} from "@/lib/qrIntent";
import { markQrVerified } from "@/lib/qrVerificationState";

type ScreenState =
  | { kind: "working" }
  | { kind: "missingToken" }
  | QrVerifyOutcome;

export default function VenueQrCheckinScreen() {
  const params = useLocalSearchParams<{ placeId: string; t?: string }>();
  const placeId = typeof params.placeId === "string" ? params.placeId : "";
  const token = typeof params.t === "string" ? params.t : "";
  const valid = isValidQrParts(placeId, token);

  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { ready, authedUid, profile, setProfile } = useApp();

  const [state, setState] = useState<ScreenState>(
    valid ? { kind: "working" } : { kind: "missingToken" },
  );
  const [venueName, setVenueName] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ranForRef = useRef<string | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const setProfileRef = useRef(setProfile);
  setProfileRef.current = setProfile;

  // Set on explicit Cancel so this still-mounted route never re-saves the
  // intent the user just discarded.
  const userCancelledRef = useRef(false);

  useEffect(() => {
    if (!valid || !ready || userCancelledRef.current) return;
    const runKey = `${authedUid ?? "anon"}|${placeId}|${token}|${attempt}`;
    if (ranForRef.current === runKey) return;
    ranForRef.current = runKey;
    let cancelled = false;
    setState({ kind: "working" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QR_REQUEST_TIMEOUT_MS);
    (async () => {
      let outcome: QrVerifyOutcome;
      try {
        // Persist the intent BEFORE any redirect so it survives auth,
        // verification and cold starts.
        await saveQrIntent(placeId, token, authedUid ?? null);
        if (cancelled || userCancelledRef.current) return;
        // AppContext can report ready before the auth listener emits;
        // confirm directly before sending a signed-in user to auth.
        const uid = authedUid ?? (await getCurrentUserId());
        if (cancelled) return;
        if (!uid) {
          router.replace("/onboarding?qr=1" as never);
          return;
        }
        // Only password accounts need email verification; Apple/Google
        // keep their existing bypass.
        const account = await getCurrentUserAccount();
        if (cancelled) return;
        if (account?.provider === "password" && !account.emailVerified) {
          router.replace("/onboarding?qr=1" as never);
          return;
        }
        const local = await ensureMinimalProfile(uid, profileRef.current, controller.signal);
        if (!profileRef.current || profileRef.current.id !== uid) {
          await setProfileRef.current(local);
        }
        outcome = await runQrVerifyOnce(
          placeId,
          token,
          () => verifyQr(uid, placeId, token, controller.signal),
          uid,
        );
      } catch {
        outcome = { kind: "network" };
      } finally {
        clearTimeout(timer);
      }
      if (cancelled) return;
      if (outcome.kind === "success") {
        markQrVerified(placeId);
        await clearQrIntent();
      }
      setState(outcome);
    })();
    return () => {
      cancelled = true;
      // Not aborted on cleanup: a re-run (e.g. auth uid arriving) shares
      // the same deduped request. The timeout still bounds it.
    };
  }, [valid, ready, authedUid, placeId, token, attempt, router]);

  // Venue name is decoration only — never blocks the check-in.
  useEffect(() => {
    if (!authedUid || !placeId) return;
    let cancelled = false;
    api
      .getVenueOwnerProfile({ uid: authedUid }, placeId)
      .then((r) => {
        if (!cancelled) setVenueName(r.profile?.businessName || r.profile?.placeName || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authedUid, placeId]);

  const goHome = useCallback(() => router.replace("/(tabs)" as never), [router]);
  const goVenue = useCallback(
    () =>
      router.replace({ pathname: "/venue/[placeId]", params: { placeId } } as never),
    [router, placeId],
  );
  const cancelCheckin = useCallback(async () => {
    userCancelledRef.current = true;
    await clearQrIntent();
    goHome();
  }, [goHome]);

  const incomplete = isIncompleteProfile(profile);
  const topPad = (Platform.OS === "web" ? 67 : insets.top) + 16;
  const bottomPad = (Platform.OS === "web" ? 34 : insets.bottom) + 20;

  const view = describe(state, t);

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: bottomPad }]}
      testID="qr-checkin-screen"
    >
      <View style={styles.topRow}>
        <Pressable
          onPress={goHome}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t("qrCheckin.home")}
          testID="qr-checkin-close"
        >
          <Feather name="x" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
          {t("qrCheckin.eyebrow")}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.center}>
        <View
          style={[
            styles.badge,
            { backgroundColor: view.tone === "ok" ? colors.primary : colors.card, borderColor: colors.border },
          ]}
        >
          {state.kind === "working" ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Feather
              name={view.icon}
              size={34}
              color={view.tone === "ok" ? colors.primaryForeground : colors.foreground}
            />
          )}
        </View>
        {venueName ? (
          <Text style={[styles.venue, { color: colors.mutedForeground }]} numberOfLines={1}>
            {venueName}
          </Text>
        ) : null}
        <Text style={[styles.title, { color: colors.foreground }]} testID="qr-checkin-title">
          {view.title}
        </Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{view.body}</Text>

        {state.kind === "success" && (state.privateOnly || incomplete) ? (
          <View style={[styles.note, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="lock" size={16} color={colors.foreground} />
            <Text style={[styles.noteText, { color: colors.foreground }]}>
              {t("qrCheckin.privateNote")}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {state.kind === "success" ? (
          <>
            {/* Quick check-in first: Explore is primary; completion optional. */}
            <PrimaryButton label={t("qrCheckin.explore")} onPress={goHome} />
            <PrimaryButton label={t("qrCheckin.viewVenue")} variant="secondary" onPress={goVenue} />
            {incomplete ? (
              <PrimaryButton
                label={t("profileGate.ctaOptional")}
                variant="ghost"
                onPress={() => router.replace(COMPLETE_PROFILE_HREF as never)}
              />
            ) : null}
          </>
        ) : state.kind === "working" ? (
          <PrimaryButton label={t("qrCheckin.home")} variant="ghost" onPress={goHome} />
        ) : (
          <>
            {state.kind !== "missingToken" && state.kind !== "invalid" ? (
              <PrimaryButton
                label={t("qrCheckin.retry")}
                onPress={() => setAttempt((a) => a + 1)}
              />
            ) : null}
            {placeId ? (
              <PrimaryButton label={t("qrCheckin.viewVenue")} variant="secondary" onPress={goVenue} />
            ) : null}
            <PrimaryButton
              label={t("qrCheckin.cancel")}
              variant="ghost"
              onPress={() => void cancelCheckin()}
            />
          </>
        )}
      </View>
    </View>
  );
}

type FeatherName = React.ComponentProps<typeof Feather>["name"];

function describe(
  state: ScreenState,
  t: (k: string) => string,
): { icon: FeatherName; title: string; body: string; tone: "ok" | "warn" | "neutral" } {
  switch (state.kind) {
    case "working":
      return { icon: "loader", title: t("qrCheckin.workingTitle"), body: t("qrCheckin.workingBody"), tone: "neutral" };
    case "success":
      return { icon: "check", title: t("qrCheckin.successTitle"), body: t("qrCheckin.successBody"), tone: "ok" };
    case "missingToken":
    case "invalid":
      return { icon: "slash", title: t("qrCheckin.invalidTitle"), body: t("qrCheckin.invalidBody"), tone: "warn" };
    case "cooldown":
      return { icon: "clock", title: t("qrCheckin.cooldownTitle"), body: t("qrCheckin.cooldownBody"), tone: "warn" };
    case "network":
      return { icon: "wifi-off", title: t("qrCheckin.networkTitle"), body: t("qrCheckin.networkBody"), tone: "warn" };
    default:
      return { icon: "alert-circle", title: t("qrCheckin.errorTitle"), body: t("qrCheckin.errorBody"), tone: "warn" };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  badge: {
    width: 84, height: 84, borderRadius: 42, borderWidth: 1,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  venue: { fontFamily: "Inter_500Medium", fontSize: 14 },
  title: { fontFamily: "Inter_700Bold", fontSize: 26, textAlign: "center" },
  body: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 320 },
  note: {
    flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1,
    borderRadius: 14, padding: 14, marginTop: 8, maxWidth: 340,
  },
  noteText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  actions: { gap: 10 },
});
