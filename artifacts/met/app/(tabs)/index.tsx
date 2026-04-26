import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
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

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { encounters, profile } = useApp();
  const isVisible = profile?.isVisible ?? true;
  const [requestsOpen, setRequestsOpen] = useState(false);

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

  const within50m = useMemo(
    () => encounters.filter((e) => e.lastDistanceM <= 50).length,
    [encounters],
  );

  const webBot = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Home" />
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
          <View style={styles.beaconWrap}>
            <PulseBeacon size={180} active={isVisible} />
          </View>
          <Text
            style={[
              styles.beaconLabel,
              { color: isVisible ? colors.primary : colors.mutedForeground },
            ]}
          >
            {isVisible ? "BEACON ACTIVE" : "BEACON OFF"}
          </Text>
          {isVisible ? (
            <>
              <Text style={[styles.headline, { color: colors.foreground }]}>
                {within50m} {within50m === 1 ? "person" : "people"} within 50m
              </Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                Met is quietly listening. Anyone you cross paths with shows up under Recent.
              </Text>
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
            value={stats.today}
            label="Today"
            colors={colors}
          />
          <StatCard
            icon="link-2"
            value={stats.connections}
            label="Connections"
            colors={colors}
          />
          <StatCard
            icon="bell"
            value={stats.pending}
            label="Pending"
            colors={colors}
          />
        </View>
      </ScrollView>
      <RequestsSheet
        visible={requestsOpen}
        onClose={() => setRequestsOpen(false)}
      />
    </View>
  );
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
  },
  beaconWrap: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  beaconLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 4,
    marginBottom: 12,
  },
  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
    lineHeight: 28,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 320,
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
});
