import { Feather } from "@expo/vector-icons";
import { Image } from "@/components/MetImage";
import { LinearGradient } from "@/components/MetGradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { findBlockedTerm } from "@/lib/contentFilter";
import { useT } from "@/lib/i18n";
import { type ReportReason, submitReport } from "@/lib/reports";
import { useSubscription } from "@/lib/revenuecat";
import {
  FREE_REVEALS_PER_DAY,
  getRevealsRemaining,
  refundFreeReveal,
  tryConsumeFreeReveal,
} from "@/lib/usage";

function formatDate(ts: number, lang: string) {
  const d = new Date(ts);
  return d.toLocaleDateString(lang, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function EncounterDetail() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, lang } = useT();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const {
    allEncounters,
    updateEncounterStatus,
    removeEncounter,
    setBlocked,
    sendRevealRequest,
    acceptRevealRequest,
    declineRevealRequest,
    cancelRevealRequest,
    profile,
  } = useApp();
  const { isSubscribed, isSubscriptionReady } = useSubscription();

  const [menuOpen, setMenuOpen] = useState(false);
  const [revealsRemaining, setRevealsRemaining] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  // Reveal-request confirmation sheet — gives the sender one last chance to
  // attach a personal note before the request fires. Empty draft = no note.
  const [revealSheetOpen, setRevealSheetOpen] = useState(false);
  const [revealDraft, setRevealDraft] = useState("");
  // Report flow — opens a reasons sheet, then submits + auto-blocks.
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [reportConfirmation, setReportConfirmation] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRevealsRemaining().then((r) => {
      if (cancelled) return;
      setRevealsRemaining(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const encounter = useMemo(
    () => allEncounters.find((e) => e.id === id),
    [allEncounters, id],
  );

  // RevenueCat occasionally never resolves `customerInfo` on Android — most
  // commonly on ad-hoc / direct-install builds where Google Play Billing
  // isn't fully wired. When that happens `isSubscriptionReady` stays false
  // forever and the reveal-request button stays disabled, which strands the
  // user. After a 5-second grace period we fall back to treating the user
  // as free (the safe default) so the button becomes clickable again. The
  // downstream `confirmSend` flow still consults `isSubscribed`, so a paid
  // user is never accidentally pushed through the free-reveal path once
  // RevenueCat eventually does resolve.
  const [revenuecatTimedOut, setRevenuecatTimedOut] = useState(false);
  useEffect(() => {
    if (isSubscriptionReady) return;
    const timer = setTimeout(() => setRevenuecatTimedOut(true), 5000);
    return () => clearTimeout(timer);
  }, [isSubscriptionReady]);
  const effectivelyReady = isSubscriptionReady || revenuecatTimedOut;

  useEffect(() => {
    // Dev-only auto-accept: in production a real reveal request must be
    // accepted by the actual recipient via push / fetch, never fabricated
    // client-side. Auto-accepting in production would be misleading
    // (App Store 4.1 / Play "Deceptive Behavior") and would also break
    // the "100% mutual / 100% opt-in" promise in our App Store description.
    if (!__DEV__) return;
    if (encounter?.status === "request_sent") {
      const timer = setTimeout(() => {
        updateEncounterStatus(encounter.id, "connected");
      }, 3000);
      return () => clearTimeout(timer);
    }
    return;
  }, [encounter?.status, encounter?.id, updateEncounterStatus]);

  // Once a connection exists, the conversation lives in its own screen — bounce
  // there. Covers the auto-3s transition, accept-from-here, and any case where
  // the user lands on this route for an already-connected encounter.
  useEffect(() => {
    if (encounter?.status === "connected") {
      router.replace(`/connection/${encounter.id}`);
    }
  }, [encounter?.status, encounter?.id, router]);

  // IMPORTANT: this useState MUST stay above the early-return guards
  // below. Declaring it inline next to `handleCancel` (~line 252) means
  // the component renders a different number of hooks once the
  // encounter flips to "connected" (which short-circuits at line 147),
  // tripping React's hooks-order check with "rendered fewer hooks than
  // expected" and crashing the screen on accept. Build #48 shipped
  // with that bug; do not move this back down.
  const [cancelling, setCancelling] = useState(false);

  if (!encounter) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, padding: 24 }}>
          {t("encounter.gone")}
        </Text>
      </View>
    );
  }

  // Connected encounters are owned by the dedicated conversation screen — the
  // redirect above handles routing; render nothing here so we don't flash the
  // pre-connection lock UI mid-redirect.
  if (encounter.status === "connected") {
    return <View style={[styles.container, { backgroundColor: colors.card }]} />;
  }

  const isRequestSent = encounter.status === "request_sent";
  const isRequestReceived = encounter.status === "request_received";

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;

  // Open the confirmation sheet first — actual send happens in `confirmSend`
  // once the user (optionally) attaches a personal note. Note: we
  // intentionally do NOT block on RC readiness here — `confirmSend` already
  // routes paying users correctly when RC is still warming up (see comment
  // there). Blocking the open here just leaves the user staring at a
  // greyed-out button right after a fresh encounter, which they read as
  // "broken".
  const openRevealSheet = () => {
    if (sending) return;
    setRevealDraft("");
    setRevealSheetOpen(true);
  };

  const confirmSend = async () => {
    if (sending) return;
    if (!effectivelyReady) return;
    setSending(true);
    let consumedFreeReveal = false;
    try {
      // Free-quota / paywall gate.
      //
      // Treat any user we don't know is subscribed as free — including the
      // window where RevenueCat hasn't resolved yet but the 5-second
      // readiness fallback (`effectivelyReady`) has already enabled the
      // button. Previously this branch only ran when `isSubscriptionReady`
      // was true, which meant a free user could send unlimited reveals
      // during the RC-loading window without ever decrementing the bucket
      // — and on the next app launch the counter would appear "reset"
      // relative to how many requests they actually fired off. Using
      // `!isSubscribed` (which defaults to false until RC explicitly
      // confirms a paid entitlement) is the safe default: a paying user
      // is never charged a free reveal because their `isSubscribed` flips
      // true the moment RC resolves; a free user never bypasses the cap.
      if (!isSubscribed) {
        const consumed = await tryConsumeFreeReveal();
        if (consumed === null) {
          setRevealSheetOpen(false);
          router.push("/paywall");
          return;
        }
        consumedFreeReveal = true;
        setRevealsRemaining(await getRevealsRemaining());
      }
      const trimmed = revealDraft.trim();
      // Content filter (App Store Review Guideline 1.2) — refuse to
      // send a reveal request whose attached note contains a slur or
      // harassment phrase. We do the check AFTER the paywall gate so
      // we don't burn the user's free quota on a blocked draft.
      if (trimmed && findBlockedTerm(trimmed)) {
        if (consumedFreeReveal) {
          await refundFreeReveal();
          setRevealsRemaining(await getRevealsRemaining());
        }
        Alert.alert(
          "Please edit your message",
          "Your reveal note contains language that isn't allowed on Met. Please remove it and try again.",
        );
        return;
      }
      // Server-backed send. Throws on network/API failure so we can show
      // an alert and avoid a phantom "waiting" spinner the recipient will
      // never see.
      await sendRevealRequest(
        encounter.id,
        trimmed.length > 0 ? trimmed : undefined,
      );
      setRevealSheetOpen(false);
      setRevealDraft("");
    } catch (err) {
      // Refund the free reveal if the call failed — we charged the quota
      // assuming a successful send. `tryConsumeFreeReveal` actually wrote
      // the decremented count to AsyncStorage, so the refund must do the
      // inverse write through the same mutex (just re-reading would leave
      // the user permanently down a reveal on every network error).
      if (consumedFreeReveal) {
        await refundFreeReveal();
        setRevealsRemaining(await getRevealsRemaining());
      }
      const msg =
        err instanceof Error && err.message ? err.message : "Please try again.";
      Alert.alert(t("encounter.revealSheet.title"), msg);
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async () => {
    try {
      await acceptRevealRequest(encounter.id);
    } catch (err) {
      const msg =
        err instanceof Error && err.message ? err.message : "Please try again.";
      Alert.alert(t("encounter.acceptReveal"), msg);
    }
  };
  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await cancelRevealRequest(encounter.id);
    } catch (err) {
      const msg =
        err instanceof Error && err.message ? err.message : "Please try again.";
      Alert.alert(t("encounter.cancelRevealTitle"), msg);
    } finally {
      setCancelling(false);
    }
  };

  const handleDecline = async () => {
    try {
      await declineRevealRequest(encounter.id);
    } catch (err) {
      // Best-effort: even if the API fails, locally drop the request so
      // the user isn't stuck with a card they can't dismiss.
      await updateEncounterStatus(encounter.id, "encounter");
      console.warn("[encounter] decline reveal failed", err);
    }
    router.back();
  };

  const handleRemove = async () => {
    await removeEncounter(encounter.id);
    router.back();
  };
  const handleBlock = async () => {
    await setBlocked(encounter.id, true);
    router.back();
  };

  // Submit a report → store locally, auto-block, show inline confirmation.
  // Auto-blocking after a report follows the trust-and-safety pattern Apple
  // expects: a user who reports someone shouldn't keep getting their content.
  const handleReport = async (reason: ReportReason) => {
    setReportSheetOpen(false);
    // Pass the reporter's uid so the server-side mirror in
    // lib/reports.ts can authenticate against POST /api/reports.
    // Encounters don't carry a peer uid (BLE-only discovery), so
    // `reportedUid` stays null and the moderation team locates the
    // offending profile via `encounterId` in Firestore.
    await submitReport({
      encounterId: encounter.id,
      reason,
      revealMessage: encounter.revealMessage,
      reporterUid: profile?.id ?? null,
      reportedUid: null,
    });
    await setBlocked(encounter.id, true);
    setReportConfirmation(true);
    setTimeout(() => {
      router.back();
    }, 1500);
  };

  const openMap = () => {
    if (!encounter.lastLocation) return;
    const q = encodeURIComponent(encounter.lastLocation);
    const url = `https://www.google.com/maps/search/?api=1&query=${q}`;
    Linking.openURL(url).catch(() => {});
  };

  const metTimesText = t(
    encounter.encounterCount === 1
      ? "encounter.metTimes_one"
      : "encounter.metTimes_other",
    { count: encounter.encounterCount },
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBot + 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          {encounter.photoUri ? (
            <Image
              source={{ uri: encounter.photoUri }}
              style={styles.heroImg}
              contentFit="cover"
              transition={200}
            />
          ) : (
            // Peer hasn't uploaded a profile photo yet (or the backend
            // returned `photoUrl: null`). Render a branded placeholder
            // with their initial so the hero doesn't show a blank/black
            // rectangle. Without this fallback the gradient + name text
            // float over a void, which the user reads as "broken image".
            <View
              style={[
                styles.heroImg,
                styles.heroPlaceholder,
                { backgroundColor: colors.muted },
              ]}
            >
              <Text
                style={[
                  styles.heroPlaceholderInitial,
                  { color: colors.mutedForeground },
                ]}
              >
                {encounter.realName?.trim().charAt(0).toUpperCase() || "?"}
              </Text>
            </View>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "transparent", "rgba(0,0,0,0.65)"]}
            locations={[0, 0.4, 1]}
            style={styles.heroFade}
          />

          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityLabel={t("common.back")}
            style={[
              styles.iconBtn,
              {
                top: insets.top + webTop + 12,
                left: 16,
              },
            ]}
          >
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>

          <Pressable
            hitSlop={12}
            onPress={() => setMenuOpen(true)}
            accessibilityLabel={t("common.open")}
            style={[
              styles.iconBtn,
              {
                top: insets.top + webTop + 12,
                right: 16,
              },
            ]}
          >
            <Feather name="more-vertical" size={22} color="#fff" />
          </Pressable>

          <Text style={styles.heroName}>{encounter.realName}</Text>
        </View>

        <View
          style={[
            styles.body,
            {
              backgroundColor: colors.card,
            },
          ]}
        >
          <View style={styles.metaRow}>
            <Feather name="repeat" size={16} color={colors.primary} />
            <Text style={[styles.metaPrimary, { color: colors.primary }]}>
              {metTimesText}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Feather name="calendar" size={16} color={colors.mutedForeground} />
            <Text style={[styles.metaMuted, { color: colors.mutedForeground }]}>
              {t("encounter.firstMetOn", {
                date: formatDate(encounter.firstSeenAt, lang),
              })}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              {t("encounter.bioLabel")}
            </Text>
            <Text style={[styles.bioText, { color: colors.foreground }]}>
              {encounter.bio || t("encounter.bioEmpty")}
            </Text>
          </View>

          {encounter.lastLocation ? (
            <View style={styles.section}>
              <Text
                style={[styles.sectionLabel, { color: colors.mutedForeground }]}
              >
                {t("encounter.meetingSpot")}
              </Text>
              <Pressable
                onPress={openMap}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
              >
                <LinearGradient
                  colors={[colors.primary, "#2BA535"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.mapCard}
                >
                  <View style={styles.mapIconWrap}>
                    <Feather name="map-pin" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mapLocation} numberOfLines={1}>
                      {encounter.lastLocation}
                    </Text>
                    <Text style={styles.mapCta}>
                      {t("encounter.tapToViewOnMaps")}
                    </Text>
                  </View>
                  <Feather name="external-link" size={18} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            </View>
          ) : null}

          <View
            style={[
              styles.lockCard,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
              },
            ]}
          >
              {isRequestReceived ? (
                <>
                  <Feather name="bell" size={28} color={colors.primary} />
                  <Text style={[styles.lockTitle, { color: colors.foreground }]}>
                    {t("encounter.lockReceivedTitle")}
                  </Text>
                  <Text style={[styles.lockSub, { color: colors.mutedForeground }]}>
                    {t("encounter.lockReceivedSub", { name: encounter.realName })}
                  </Text>
                  {encounter.revealMessage ? (
                    <View
                      style={[
                        styles.revealNoteCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.revealNoteLabel,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {t("encounter.revealMessageLabel")}
                      </Text>
                      <Text
                        style={[
                          styles.revealNoteText,
                          { color: colors.foreground },
                        ]}
                      >
                        {`\u201C${encounter.revealMessage}\u201D`}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ width: "100%", gap: 10, marginTop: 6 }}>
                    <PrimaryButton
                      label={t("encounter.acceptReveal")}
                      onPress={handleAccept}
                    />
                    <PrimaryButton
                      label={t("encounter.notNow")}
                      variant="ghost"
                      onPress={handleDecline}
                    />
                  </View>
                </>
              ) : isRequestSent ? (
                <>
                  <Feather name="clock" size={28} color={colors.mutedForeground} />
                  <Text style={[styles.lockTitle, { color: colors.foreground }]}>
                    {t("encounter.requestSentTitle")}
                  </Text>
                  <Text style={[styles.lockSub, { color: colors.mutedForeground }]}>
                    {t("encounter.requestSentSub", { name: encounter.realName })}
                  </Text>
                  <View style={{ width: "100%", gap: 10, marginTop: 6 }}>
                    <PrimaryButton
                      label={t("encounter.waiting")}
                      onPress={() => {}}
                      loading
                      disabled
                    />
                    <PrimaryButton
                      label={t("encounter.cancelReveal")}
                      variant="ghost"
                      onPress={handleCancel}
                      disabled={cancelling}
                      loading={cancelling}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Feather name="lock" size={28} color={colors.mutedForeground} />
                  <Text style={[styles.lockTitle, { color: colors.foreground }]}>
                    {t("encounter.socialsHidden")}
                  </Text>
                  <View style={{ width: "100%", marginTop: 6 }}>
                    <PrimaryButton
                      label={t("encounter.sendRevealRequestBtn")}
                      onPress={openRevealSheet}
                      disabled={sending}
                      loading={sending}
                    />
                  </View>
                  {effectivelyReady && !isSubscribed && revealsRemaining !== null ? (
                    <Text
                      style={[
                        styles.lockSub,
                        { color: colors.mutedForeground, marginTop: 8 },
                      ]}
                    >
                      {revealsRemaining > 0
                        ? t("encounter.revealsLeftFree", {
                            n: revealsRemaining,
                            cap: FREE_REVEALS_PER_DAY,
                          })
                        : t("encounter.revealsLimitReached")}
                    </Text>
                  ) : null}
                </>
              )}
          </View>
        </View>
      </ScrollView>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={encounter.realName}
        actions={[
          {
            label: t("encounter.reportAction"),
            icon: "flag",
            destructive: true,
            onPress: () => {
              setMenuOpen(false);
              setTimeout(() => setReportSheetOpen(true), 250);
            },
          },
          {
            label: t("encounter.blockAction"),
            icon: "slash",
            destructive: true,
            onPress: handleBlock,
          },
          {
            label: t("encounter.removeEncounterAction"),
            icon: "trash-2",
            destructive: true,
            onPress: handleRemove,
          },
        ]}
      />

      <ActionSheet
        visible={reportSheetOpen}
        onClose={() => setReportSheetOpen(false)}
        title={t("encounter.reportSheet.title")}
        message={t("encounter.reportSheet.subtitle")}
        actions={[
          {
            label: t("encounter.reportSheet.reasonInappropriate"),
            icon: "alert-octagon",
            onPress: () => handleReport("inappropriate"),
          },
          {
            label: t("encounter.reportSheet.reasonHarassment"),
            icon: "user-x",
            onPress: () => handleReport("harassment"),
          },
          {
            label: t("encounter.reportSheet.reasonSpam"),
            icon: "shield-off",
            onPress: () => handleReport("spam"),
          },
          {
            label: t("encounter.reportSheet.reasonUnderage"),
            icon: "alert-triangle",
            onPress: () => handleReport("underage"),
          },
          {
            label: t("encounter.reportSheet.reasonOther"),
            icon: "more-horizontal",
            onPress: () => handleReport("other"),
          },
        ]}
      />

      {reportConfirmation ? (
        <View style={styles.reportToastWrap} pointerEvents="none">
          <View
            style={[
              styles.reportToast,
              { backgroundColor: colors.foreground },
            ]}
          >
            <Feather name="check-circle" size={18} color={colors.card} />
            <Text style={[styles.reportToastText, { color: colors.card }]}>
              {t("encounter.reported")}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Reveal-request confirmation sheet — slides up from the bottom with
          the advisory copy and an optional personal-note field. Cancelling
          backs out without consuming a reveal; sending fires the request. */}
      <Modal
        visible={revealSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!sending) setRevealSheetOpen(false);
        }}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!sending) setRevealSheetOpen(false);
            }}
            accessibilityLabel={t("encounter.revealSheet.cancel")}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetWrap}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.sheetCard,
                {
                  backgroundColor: colors.card,
                  paddingBottom: insets.bottom + webBot + 20,
                },
              ]}
            >
              <View
                style={[styles.sheetGrabber, { backgroundColor: colors.border }]}
              />
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                {t("encounter.revealSheet.title")}
              </Text>
              <Text
                style={[styles.sheetAdvisory, { color: colors.mutedForeground }]}
              >
                {t("encounter.revealSheet.advisory")}
              </Text>
              <TextInput
                value={revealDraft}
                onChangeText={setRevealDraft}
                placeholder={t("encounter.revealSheet.placeholder")}
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={240}
                editable={!sending}
                style={[
                  styles.sheetInput,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
              <View style={styles.sheetActions}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={t("encounter.revealSheet.cancel")}
                    variant="ghost"
                    onPress={() => {
                      if (!sending) setRevealSheetOpen(false);
                    }}
                    disabled={sending}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={t("encounter.revealSheet.send")}
                    onPress={confirmSend}
                    loading={sending}
                    disabled={sending || !effectivelyReady}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  reportToastWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 32,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  reportToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    maxWidth: 380,
  },
  reportToastText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    flexShrink: 1,
  },
  heroWrap: {
    width: "100%",
    height: 480,
    position: "relative",
  },
  heroImg: { width: "100%", height: "100%" },
  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroPlaceholderInitial: {
    fontFamily: "Inter_700Bold",
    fontSize: 160,
    lineHeight: 180,
  },
  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  iconBtn: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  heroName: {
    position: "absolute",
    left: 24,
    bottom: 24,
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 22,
    gap: 14,
    marginTop: -16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaPrimary: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  metaMuted: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  section: { gap: 8, marginTop: 8 },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  bioText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  lockCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  lockTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    marginTop: 4,
  },
  lockSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  revealNoteCard: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
    gap: 4,
  },
  revealNoteLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  revealNoteText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  mapCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  mapIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapLocation: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  mapCta: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheetWrap: {
    width: "100%",
  },
  sheetCard: {
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 14,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  sheetAdvisory: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  sheetInput: {
    minHeight: 90,
    maxHeight: 160,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
});
