import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
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
import { PulseBeacon } from "@/components/PulseBeacon";
import { RequestsSheet } from "@/components/RequestsSheet";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useCountUp } from "@/hooks/useCountUp";
import { useVisibility } from "@/hooks/useVisibility";
import { DISCOVERY_RANGE_METERS } from "@/lib/storage";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { encounters, preferences } = useApp();
  const { isVisible, toggle: toggleVisibility } = useVisibility();
  const [requestsOpen, setRequestsOpen] = useState(false);
  const rangeM = DISCOVERY_RANGE_METERS[preferences.discoveryRange];

  const incoming = useMemo(
    () => encounters.filter((e) => e.status === "request_received"),
    [encounters],
  );

  const stats = useMemo(() => {
    const today = Date.now() - 24 * 60 * 60 * 1000;
    return {
      today: encounters.filter((e) => e.lastSeenAt >= today).length,
      connections: encounters.filter((e) => e.status === "connected").length,
      pending: encounters.filter(
        (e) => e.status === "request_sent" || e.status === "request_received",
      ).length,
    };
  }, [encounters]);

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
        title="Home"
        visibility={{ isVisible, onToggle: toggleVisibility }}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + webBot + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {incoming.length > 0 ? (
          <Pressable
            onPress={() => setRequestsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${incoming.length} ${incoming.length === 1 ? "person wants" : "people want"} to reveal their socials. Tap to review.`}
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
                {incoming.length}{" "}
                {incoming.length === 1 ? "person wants" : "people want"} to reveal
              </Text>
              <Text style={[styles.bannerSub, { color: "#166534" }]}>
                Tap to review &amp; accept
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
              {isVisible ? "BEACON ACTIVE" : "BEACON OFF"}
            </Text>
          </View>

          {isVisible ? (
            <>
              <Text style={[styles.headline, { color: colors.foreground }]}>
                <Text style={{ color: colors.primary }}>{animatedWithin}</Text>{" "}
                {withinRange === 1 ? "person" : "people"} within {rangeM}m
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
                    {vibe.label}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                Met is quietly listening. Anyone you cross paths with shows up under Recent.
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
                    {tickerLine(recent[Math.min(tickerIdx, recent.length - 1)])}
                  </Text>
                </Animated.View>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[styles.headline, { color: colors.foreground }]}>
                You&rsquo;re invisible to others
              </Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                Turn &ldquo;Visible on Radar&rdquo; back on in Settings to start
                discovering people again.
              </Text>
            </>
          )}
        </View>

        <View style={styles.statsRow}>
          <StatCard
            icon="users"
            value={animatedToday}
            label="Today"
            colors={colors}
          />
          <StatCard
            icon="link-2"
            value={animatedConn}
            label="Connections"
            colors={colors}
          />
          <StatCard
            icon="bell"
            value={animatedPending}
            label="Pending"
            colors={colors}
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
              This week
            </Text>
          </View>
          <View style={styles.weeklyRow}>
            <View style={styles.weeklyCell}>
              <Text style={[styles.weeklyValue, { color: colors.foreground }]}>
                {weekly.newPeople}
              </Text>
              <Text style={[styles.weeklyLabel, { color: colors.mutedForeground }]}>
                new {weekly.newPeople === 1 ? "person" : "people"}
              </Text>
            </View>
            <View
              style={[styles.weeklyDivider, { backgroundColor: colors.border }]}
            />
            <View style={styles.weeklyCell}>
              <Text style={[styles.weeklyValue, { color: colors.foreground }]}>
                {weekly.repeats}
              </Text>
              <Text style={[styles.weeklyLabel, { color: colors.mutedForeground }]}>
                crossed paths again
              </Text>
            </View>
          </View>
          <Text style={[styles.weeklyHint, { color: colors.mutedForeground }]}>
            {weekly.newPeople === 0 && weekly.repeats === 0
              ? "Quiet week. Step outside — Met is listening."
              : "Remember the human, not the follower count."}
          </Text>
        </View>
      </ScrollView>
      <RequestsSheet
        visible={requestsOpen}
        onClose={() => setRequestsOpen(false)}
      />
    </View>
  );
}

function deriveVibe(count: number): {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  fg: string;
  bg: string;
  border: string;
} {
  if (count === 0) {
    return {
      label: "Quiet zone",
      icon: "moon",
      fg: "#475569",
      bg: "#F1F5F9",
      border: "#CBD5E1",
    };
  }
  if (count <= 3) {
    return {
      label: "A few souls nearby",
      icon: "user",
      fg: "#1D4ED8",
      bg: "#DBEAFE",
      border: "#93C5FD",
    };
  }
  return {
    label: "Lively here",
    icon: "zap",
    fg: "#B45309",
    bg: "#FEF3C7",
    border: "#FCD34D",
  };
}

function tickerLine(e: {
  realName: string;
  lastSeenAt: number;
  status: string;
  encounterCount: number;
}): string {
  const minsAgo = Math.max(1, Math.round((Date.now() - e.lastSeenAt) / 60000));
  const when =
    minsAgo < 60
      ? `${minsAgo}m ago`
      : minsAgo < 60 * 24
        ? `${Math.round(minsAgo / 60)}h ago`
        : `${Math.round(minsAgo / (60 * 24))}d ago`;
  if (e.status === "connected") {
    return `Reconnected with ${e.realName} — ${when}`;
  }
  if (e.encounterCount > 1) {
    return `${e.realName} crossed your path again — ${when}`;
  }
  return `Just crossed paths with ${e.realName} — ${when}`;
}

function StatCard({
  icon,
  value,
  label,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  value: number;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Feather name={icon} size={18} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
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
});
