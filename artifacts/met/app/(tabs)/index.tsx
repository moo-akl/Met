import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { PulseBeacon } from "@/components/PulseBeacon";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { encounters } = useApp();

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
        <View style={styles.heroSection}>
          <View style={styles.beaconWrap}>
            <PulseBeacon size={180} />
          </View>
          <Text style={[styles.beaconLabel, { color: colors.primary }]}>
            BEACON ACTIVE
          </Text>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            {within50m} {within50m === 1 ? "person" : "people"} within 50m
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Met is quietly listening. Anyone you cross paths with shows up under Recent.
          </Text>
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
