import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { EncounterRow } from "@/components/EncounterRow";
import { PulseBeacon } from "@/components/PulseBeacon";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function EncountersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { encounters } = useApp();

  const visible = useMemo(
    () =>
      encounters
        .filter((e) => e.status !== "connected")
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    [encounters],
  );

  const within50m = useMemo(
    () => encounters.filter((e) => e.lastDistanceM <= 50).length,
    [encounters],
  );

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + webTop + 8,
          paddingBottom: insets.bottom + webBot + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.beaconWrap}>
            <PulseBeacon size={180} />
          </View>
          <Text style={[styles.beaconLabel, { color: colors.primary }]}>
            BEACON ACTIVE
          </Text>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            {within50m} {within50m === 1 ? "person" : "people"} within 50m today
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Met is quietly listening. Tap anyone to send a reveal request.
          </Text>
        </View>

        <View style={styles.list}>
          <View style={styles.sectionHeader}>
            <Feather name="radio" size={14} color={colors.mutedForeground} />
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              RECENT ENCOUNTERS
            </Text>
          </View>

          {visible.length === 0 ? (
            <EmptyState
              icon="radio"
              title="No encounters yet"
              description="Keep your beacon on. The next person you cross paths with will appear here."
            />
          ) : (
            <View style={{ gap: 10 }}>
              {visible.map((e) => (
                <EncounterRow key={e.id} encounter={e} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
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
  list: { paddingHorizontal: 20, gap: 14 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    marginLeft: 2,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.4,
  },
});
