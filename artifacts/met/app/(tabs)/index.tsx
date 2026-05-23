import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "@/components/MetGradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { PermissionDisclosureDialog } from "@/components/PermissionDisclosureDialog";
import { PulseBeacon } from "@/components/PulseBeacon";
import { RequestsSheet } from "@/components/RequestsSheet";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useCountUp } from "@/hooks/useCountUp";
import { usePermissionReminders } from "@/hooks/usePermissionReminders";
import { usePermissionStatus } from "@/hooks/usePermissionStatus";
import { useVisibility } from "@/hooks/useVisibility";
import { useT } from "@/lib/i18n";
import { DISCOVERY_RANGE_METERS } from "@/lib/storage";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { encounters, preferences } = useApp();
  const { isVisible, toggle: toggleVisibility } = useVisibility();
  const [requestsOpen, setRequestsOpen] = useState(false);
  const rangeM = DISCOVERY_RANGE_METERS[preferences.discoveryRange];

  // Tick every 60 s so the "today" window slides forward without needing a
  // new encounter to trigger a useMemo re-run.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const { locationOk, bluetoothOk, checked } = usePermissionStatus();
  const permsMissing = checked && (!locationOk || !bluetoothOk);
  const {
    reminder,
    dismiss: dismissReminder,
    openSettings: openReminderSettings,
  } = usePermissionReminders();

  // Dev-only screenshot helper: open the Requests sheet on mount when the
  // web preview URL contains `?openSheet=requests`. Inert on native and in
  // production builds.
  useEffect(() => {
    if (Platform.OS !== "web" || !__DEV__) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openSheet") === "requests") {
      setRequestsOpen(true);
    }
  }, []);

  const incoming = useMemo(
    () => encounters.filter((e) => e.status === "request_received"),
    [encounters],
  );

  const stats = useMemo(() => {
    const todayCutoff = now - 24 * 60 * 60 * 1000;
    const cleanupCutoff =
      preferences.autoCleanupDays > 0
        ? now - preferences.autoCleanupDays * 24 * 60 * 60 * 1000
        : 0;
    // Mirror the same filter the Recent tab applies so tapping "today"
    // leads to a list whose length matches the displayed count.
    const todayEncounters = encounters.filter((e) => {
      if (e.status === "connected") return false;
      if (e.status === "encounter") {
        if (e.lastDistanceM > rangeM) return false;
        if (cleanupCutoff > 0 && e.lastSeenAt < cleanupCutoff) return false;
      }
      return e.lastSeenAt >= todayCutoff;
    });
    return {
      today: todayEncounters.length,
      connections: encounters.filter((e) => e.status === "connected").length,
      pending: encounters.filter(
        (e) => e.status === "request_sent" || e.status === "request_received",
      ).length,
    };
  }, [encounters, now, rangeM, preferences.autoCleanupDays]);

  // Lightweight weekly recap so the home screen reinforces the "people, not
  // followers" thesis. `newPeople` are first-seen this week; `repeats` are
  // anyone you've crossed paths with more than once whose latest sighting is
  // also within the week.
  const weekly = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newPeople = encounters.filter((e) => e.firstSeenAt >= weekAgo).length;
    const repeats = encounters.filter(
      (e) => e.encounterCount > 1 && e.lastSeenAt >= weekAgo,
    ).length;
    return { newPeople, repeats };
  }, [encounters]);

  const withinRange = useMemo(
    () => encounters.filter((e) => e.lastDistanceM <= rangeM).length,
    [encounters, rangeM],
  );

  // Recent encounters drive the rotating activity ticker beneath the hero.
  // Cap to the most-recent 5 so the cycle stays digestible.
  const recent = useMemo(
    () =>
      [...encounters]
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
        .slice(0, 5),
    [encounters],
  );

  // Animated count-ups for the hero number + each stat card.
  const animatedWithin = useCountUp(isVisible ? withinRange : 0, 700);
  const animatedToday = useCountUp(stats.today, 700);
  const animatedConn = useCountUp(stats.connections, 700);
  const animatedPending = useCountUp(stats.pending, 700);

  // "LIVE" pulse dot near BEACON ACTIVE — opacity loop.
  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isVisible) {
      livePulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 0.25,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isVisible, livePulse]);

  // Activity ticker: rotates through `recent` every 4s with a fade.
  const [tickerIdx, setTickerIdx] = useState(0);
  const tickerOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (recent.length <= 1) return;
    const id = setInterval(() => {
      Animated.timing(tickerOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setTickerIdx((i) => (i + 1) % recent.length);
        Animated.timing(tickerOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      });
    }, 4000);
    return () => clearInterval(id);
  }, [recent.length, tickerOpacity]);
  // Snap back to a valid index whenever the source list shrinks.
  useEffect(() => {
    if (tickerIdx >= recent.length && recent.length > 0) setTickerIdx(0);
  }, [recent.length, tickerIdx]);

  const vibe = isVisible ? deriveVibe(withinRange) : null;

  const webBot = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("appHeader.titleHome")}
        visibility={{ isVisible, onToggle: toggleVisibility }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBot + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {permsMissing ? (
          <Pressable
            onPress={() => router.push("/permissions")}
            accessibilityRole="button"
            accessibilityLabel="Bluetooth and Location permissions needed. Tap to open Settings."
            style={({ pressed }) => [
              styles.banner,
              {
                backgroundColor: "#FFF7ED",
                borderColor: "#F97316",
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.permAlertIcon,
                { backgroundColor: "#FFEDD5" },
              ]}
            >
              <Feather name="alert-triangle" size={18} color="#F97316" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.bannerTitle, { color: "#9A3412" }]}>
                {!locationOk && !bluetoothOk
                  ? "Location & Bluetooth off"
                  : !locationOk
                    ? "Location off"
                    : "Bluetooth off"}
              </Text>
              <Text style={[styles.bannerSub, { color: "#C2410C" }]}>
                Met can't detect nearby people without{" "}
                {!locationOk && !bluetoothOk
                  ? "Location & Bluetooth"
                  : !locationOk
                    ? "Location"
                    : "Bluetooth"}
                . Tap to open Settings.
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#F97316" />
          </Pressable>
        ) : null}

        <PermissionDisclosureDialog
          visible={reminder?.visible ?? false}
          kind={reminder?.kind ?? "location"}
          mode="reminder"
          onAccept={openReminderSettings}
          onDismiss={dismissReminder}
        />

        {incoming.length > 0 ? (
          <Pressable
            onPress={() => setRequestsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t(
              incoming.length === 1
                ? "home.bannerA11y_one"
                : "home.bannerA11y_other",
              { count: incoming.length },
            )}
            style={({ pressed }) => [
              styles.banner,
              {
                backgroundColor: "#DCFCE7",
                borderColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={styles.bannerAvatars}>
              {incoming.slice(0, 3).map((e, i) => (
                <View
                  key={e.id}
                  style={[
                    styles.avatarStack,
                    {
                      marginLeft: i === 0 ? 0 : -10,
                      borderColor: "#DCFCE7",
                      zIndex: 10 - i,
                    },
                  ]}
                >
                  <Avatar uri={e.photoUri} size={32} />
                </View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: "#14532D" }]}>
                {t(
                  incoming.length === 1
                    ? "home.peopleWantReveal_one"
                    : "home.peopleWantReveal_other",
                  { count: incoming.length },
                )}
              </Text>
              <Text style={[styles.bannerSub, { color: "#166534" }]}>
                {t("home.tapToReview")}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.primary} />
          </Pressable>
        ) : null}

        <View style={styles.heroSection}>
          {/* Soft radial-feeling glow behind the beacon — only when active. */}
          {isVisible ? (
            <LinearGradient
              colors={["rgba(61,204,68,0.18)", "rgba(61,204,68,0)"]}
              style={styles.heroGlow}
              pointerEvents="none"
            />
          ) : null}
          <View style={styles.beaconWrap}>
            <PulseBeacon size={180} active={isVisible} />
          </View>

          <View style={styles.beaconLabelRow}>
            {isVisible ? (
              <Animated.View
                style={[
                  styles.liveDot,
                  { backgroundColor: "#EF4444", opacity: livePulse },
                ]}
              />
            ) : null}
            <Text
              style={[
                styles.beaconLabel,
                { color: isVisible ? colors.primary : colors.mutedForeground },
              ]}
            >
              {isVisible ? t("home.beaconActive") : t("home.beaconOff")}
            </Text>
          </View>

          {isVisible ? (
            <>
              <Text style={[styles.headline, { color: colors.foreground }]}>
                <Text style={{ color: colors.primary }}>{animatedWithin}</Text>{" "}
                {t("home.peopleWithinSuffix", {
                  label: t(withinRange === 1 ? "home.person" : "home.people"),
                  m: rangeM,
                })}
              </Text>

              {vibe ? (
                <View
                  style={[
                    styles.vibePill,
                    {
                      backgroundColor: vibe.bg,
                      borderColor: vibe.border,
                    },
                  ]}
                >
                  <Feather name={vibe.icon} size={12} color={vibe.fg} />
                  <Text style={[styles.vibeText, { color: vibe.fg }]}>
                    {t(vibe.labelKey)}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                {t("home.metListening")}
              </Text>

              {recent.length > 0 ? (
                <Animated.View
                  style={[
                    styles.tickerRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: tickerOpacity,
                    },
                  ]}
                >
                  <Avatar
                    uri={recent[Math.min(tickerIdx, recent.length - 1)].photoUri}
                    size={26}
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.tickerText, { color: colors.foreground }]}
                  >
                    {tickerLine(recent[Math.min(tickerIdx, recent.length - 1)], t)}
                  </Text>
                </Animated.View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[styles.headline, { color: colors.foreground }]}>
                {t("home.invisibleHeadline")}
              </Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                {t("home.invisibleSub")}
              </Text>
            </>
          )}
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon="users"
            value={animatedToday}
            label={t("home.todayCard")}
            colors={colors}
            onPress={() => router.push("/(tabs)/recent")}
          />
          <StatCard
            icon="link-2"
            value={animatedConn}
            label={t("home.connectionsCard")}
            colors={colors}
            onPress={() => router.push("/(tabs)/connections")}
          />
          <StatCard
            icon="bell"
            value={animatedPending}
            label={t("home.pendingCard")}
            colors={colors}
            onPress={() => setRequestsOpen(true)}
          />
        </View>

        <View
          style={[
            styles.weeklyCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.weeklyHeader}>
            <Feather name="calendar" size={16} color={colors.primary} />
            <Text style={[styles.weeklyTitle, { color: colors.foreground }]}>
              {t("home.thisWeek")}
            </Text>
          </View>
          <View style={styles.weeklyRow}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/recent",
                  params: { filter: "new" },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t("home.newPeopleA11y", {
                count: weekly.newPeople,
              })}
              style={({ pressed }) => [
                styles.weeklyCell,
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text style={[styles.weeklyValue, { color: colors.foreground }]}>
                {weekly.newPeople}
              </Text>
              <Text style={[styles.weeklyLabel, { color: colors.mutedForeground }]}>
                {t(
                  weekly.newPeople === 1
                    ? "home.newPerson_one"
                    : "home.newPerson_other",
                )}
              </Text>
              <View style={styles.weeklyChev}>
                <Feather
                  name="chevron-right"
                  size={14}
                  color={colors.mutedForeground}
                />
              </View>
            </Pressable>
            <View
              style={[styles.weeklyDivider, { backgroundColor: colors.border }]}
            />
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/recent",
                  params: { filter: "repeats" },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t("home.crossedAgainA11y", {
                count: weekly.repeats,
              })}
              style={({ pressed }) => [
                styles.weeklyCell,
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <Text style={[styles.weeklyValue, { color: colors.foreground }]}>
                {weekly.repeats}
              </Text>
              <Text style={[styles.weeklyLabel, { color: colors.mutedForeground }]}>
                {t("home.crossedAgainLabel")}
              </Text>
              <View style={styles.weeklyChev}>
                <Feather
                  name="chevron-right"
                  size={14}
                  color={colors.mutedForeground}
                />
              </View>
            </Pressable>
          </View>
          <Text style={[styles.weeklyHint, { color: colors.mutedForeground }]}>
            {weekly.newPeople === 0 && weekly.repeats === 0
              ? t("home.weeklyHintQuiet")
              : t("home.weeklyHintActive")}
          </Text>
        </View>

        {permsMissing ? (
          <Pressable
            onPress={() => router.push("/permissions")}
            accessibilityRole="button"
            accessibilityLabel="Set up your beacon — tap to enable permissions"
            style={({ pressed }) => [
              styles.referralCard,
              {
                backgroundColor: colors.card,
                borderColor: "#F97316",
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
            ]}
          >
            <LinearGradient
              colors={["rgba(249,115,22,0.15)", "rgba(249,115,22,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.referralIconWrap, { backgroundColor: "#F97316" }]}>
              <Feather name="radio" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.referralTitle, { color: colors.foreground }]}>
                Set up your beacon
              </Text>
              <Text style={[styles.referralSub, { color: colors.mutedForeground }]}>
                Enable Bluetooth & Location so Met can detect nearby people.
              </Text>
              <Text style={[styles.referralCta, { color: "#F97316" }]}>
                Enable permissions{"  "}
                <Feather name="arrow-right" size={12} color="#F97316" />
              </Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push("/referrals")}
            accessibilityRole="button"
            accessibilityLabel={t("home.referralCtaTitle")}
            style={({ pressed }) => [
              styles.referralCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              },
            ]}
          >
            <LinearGradient
              colors={["rgba(61,204,68,0.18)", "rgba(61,204,68,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.referralIconWrap,
                { backgroundColor: colors.primary },
              ]}
            >
              <Feather name="gift" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.referralTitle, { color: colors.foreground }]}>
                {t("home.referralCtaTitle")}
              </Text>
              <Text
                style={[styles.referralSub, { color: colors.mutedForeground }]}
              >
                {t("home.referralCtaSub")}
              </Text>
              <Text style={[styles.referralCta, { color: colors.primary }]}>
                {t("home.referralCtaCta")}{"  "}
                <Feather name="arrow-right" size={12} color={colors.primary} />
              </Text>
            </View>
          </Pressable>
        )}
      </ScrollView>
      <RequestsSheet
        visible={requestsOpen}
        onClose={() => setRequestsOpen(false)}
      />
    </View>
  );
}

function deriveVibe(count: number): {
  labelKey: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  fg: string;
  bg: string;
  border: string;
} {
  if (count === 0) {
    return {
      labelKey: "home.quietZone",
      icon: "moon",
      fg: "#475569",
      bg: "#F1F5F9",
      border: "#CBD5E1",
    };
  }
  if (count <= 3) {
    return {
      labelKey: "home.fewSouls",
      icon: "user",
      fg: "#1D4ED8",
      bg: "#DBEAFE",
      border: "#93C5FD",
    };
  }
  return {
    labelKey: "home.livelyHere",
    icon: "zap",
    fg: "#B45309",
    bg: "#FEF3C7",
    border: "#FCD34D",
  };
}

function tickerLine(
  e: {
    realName: string;
    lastSeenAt: number;
    status: string;
    encounterCount: number;
  },
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const minsAgo = Math.max(1, Math.round((Date.now() - e.lastSeenAt) / 60000));
  const when =
    minsAgo < 60
      ? t("home.minAgo", { count: minsAgo })
      : minsAgo < 60 * 24
        ? t("home.hourAgo", { count: Math.round(minsAgo / 60) })
        : t("home.dayAgo", { count: Math.round(minsAgo / (60 * 24)) });
  if (e.status === "connected") {
    return t("home.tickerReconnected", { name: e.realName, when });
  }
  if (e.encounterCount > 1) {
    return t("home.tickerCrossedAgain", { name: e.realName, when });
  }
  return t("home.tickerJustCrossed", { name: e.realName, when });
}

function StatCard({
  icon,
  value,
  label,
  colors,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  value: number;
  label: string;
  colors: ReturnType<typeof useColors>;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        styles.stat,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Feather name={icon} size={18} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  permAlertIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerAvatars: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarStack: {
    borderRadius: 20,
    borderWidth: 2,
  },
  bannerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  bannerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  heroSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 4,
    position: "relative",
  },
  heroGlow: {
    position: "absolute",
    top: 24,
    left: "50%",
    width: 320,
    height: 320,
    marginLeft: -160,
    borderRadius: 160,
  },
  beaconWrap: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  beaconLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  beaconLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 4,
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
    lineHeight: 28,
  },
  vibePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 10,
  },
  vibeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
  },
  tickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 320,
  },
  tickerText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
  },
  stat: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    alignItems: "flex-start",
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    marginTop: 2,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  weeklyCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  weeklyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weeklyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  weeklyRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  weeklyCell: {
    flex: 1,
    alignItems: "flex-start",
    gap: 2,
    paddingVertical: 4,
    paddingRight: 4,
    position: "relative",
  },
  weeklyChev: {
    position: "absolute",
    top: 6,
    right: 0,
    opacity: 0.6,
  },
  weeklyDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  weeklyValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
  },
  weeklyLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  weeklyHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    fontStyle: "italic",
  },
  referralCard: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
  },
  referralIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  referralTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  referralSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
  },
  referralCta: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 2,
  },
});
