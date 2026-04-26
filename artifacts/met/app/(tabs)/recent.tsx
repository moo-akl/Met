import React, { useMemo } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { EncounterRow } from "@/components/EncounterRow";
import { ScanFab } from "@/components/ScanFab";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function RecentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { encounters } = useApp();

  const sorted = useMemo(
    () => [...encounters].sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    [encounters],
  );

  const pendingRequests = useMemo(
    () => encounters.filter((e) => e.status === "request_received").length,
    [encounters],
  );

  const webBot = Platform.OS === "web" ? 34 : 0;

  const handleBell = () => {
    if (pendingRequests > 0) {
      Alert.alert(
        "Reveal requests",
        `You have ${pendingRequests} pending reveal ${pendingRequests === 1 ? "request" : "requests"}. Tap a person to view.`,
      );
    } else {
      Alert.alert("All caught up", "No new requests right now.");
    }
  };

  const handleScan = () => {
    Alert.alert(
      "Scan QR code",
      "Open the camera to scan another Met user's QR and add them as an instant encounter.",
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Recent Encounters"
        actions={[{ icon: "bell", onPress: handleBell, badge: pendingRequests }]}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + webBot + 160,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {sorted.length === 0 ? (
          <EmptyState
            icon="users"
            title="No encounters yet"
            description="Keep your beacon on. The next person you cross paths with will appear here."
          />
        ) : (
          <View style={styles.list}>
            {sorted.map((e, idx) => (
              <View key={e.id}>
                <EncounterRow encounter={e} />
                {idx < sorted.length - 1 ? (
                  <View
                    style={[
                      styles.separator,
                      { backgroundColor: colors.border },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <ScanFab onPress={handleScan} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 4 },
  separator: { height: 1, marginLeft: 70 },
});
