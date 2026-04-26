import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { EncounterRow } from "@/components/EncounterRow";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ConnectionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { encounters } = useApp();

  const requests = useMemo(
    () => encounters.filter((e) => e.status === "request_received"),
    [encounters],
  );
  const connections = useMemo(
    () =>
      encounters
        .filter((e) => e.status === "connected")
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    [encounters],
  );

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + webTop + 16,
          paddingBottom: insets.bottom + webBot + 120,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.foreground }]}>People</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Reveal requests and your connections.
          </Text>
        </View>

        {requests.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="bell" size={14} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                REVEAL REQUESTS · {requests.length}
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              {requests.map((e) => (
                <EncounterRow key={e.id} encounter={e} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="link-2" size={14} color={colors.mutedForeground} />
            <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
              CONNECTIONS · {connections.length}
            </Text>
          </View>

          {connections.length === 0 ? (
            <EmptyState
              icon="users"
              title="No connections yet"
              description="When you both accept a reveal, that encounter becomes a connection."
            />
          ) : (
            <View style={{ gap: 10 }}>
              {connections.map((e) => (
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
  head: { marginBottom: 18, gap: 4 },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  section: { marginBottom: 28, gap: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 2,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.4,
  },
});
