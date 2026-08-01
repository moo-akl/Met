import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";

export default function VenueOwnerPendingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.icon, { backgroundColor: colors.primary + "22" }]}>
        <Text style={[styles.iconText, { color: colors.primary }]}>✓</Text>
      </View>
      <Text style={styles.title}>Application submitted</Text>
      <Text style={styles.body}>
        Your venue application is now with our review team. We’ll notify you when a decision is ready.
      </Text>
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>STATUS</Text>
        <Text style={[styles.statusValue, { color: colors.primary }]}>Under review</Text>
      </View>
      <Pressable
        testID="venue-application-done"
        style={[styles.doneButton, { backgroundColor: colors.primary }]}
        onPress={() => router.replace("/onboarding")}
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0F0F12", paddingHorizontal: 24, alignItems: "center", justifyContent: "center" },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  iconText: { fontSize: 38, fontFamily: "Inter_700Bold" },
  title: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 12 },
  body: { color: "rgba(255,255,255,0.62)", fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 24, textAlign: "center", maxWidth: 340 },
  statusCard: { width: "100%", marginTop: 32, backgroundColor: "#1A1A1E", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16 },
  statusLabel: { color: "rgba(255,255,255,0.42)", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 6 },
  statusValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  doneButton: { width: "100%", borderRadius: 12, alignItems: "center", paddingVertical: 15, marginTop: 22 },
  doneText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});