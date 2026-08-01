/**
 * Venue Owner — Rejected Screen
 *
 * Displayed when the user's venue owner application was rejected.
 * Shows the rejection reason from the admin and offers a re-apply button
 * that takes them back through the setup flow with their existing data
 * pre-filled where possible.
 */
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";

export default function VenueOwnerRejectedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useVenueOwner();

  const rejectionReason = profile?.rejectionReason ?? null;

  return (
    <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.screenTitle}>Venue Owner Portal</Text>
        <View style={styles.closeBtnPlaceholder} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Status badge */}
        <View style={styles.badgeRow}>
          <View style={styles.rejectedBadge}>
            <Text style={styles.rejectedBadgeText}>Application Not Approved</Text>
          </View>
        </View>

        <Text style={styles.heading}>We couldn't approve your venue</Text>
        <Text style={styles.body}>
          Our team reviewed your application and was unable to approve it at this time.
          Please see the reason below, address any issues, then submit a new application.
        </Text>

        {/* Rejection reason box */}
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>REASON FROM OUR TEAM</Text>
          <Text style={styles.reasonText}>
            {rejectionReason ?? "No specific reason was provided."}
          </Text>
        </View>

        <Text style={styles.hint}>
          Once you've addressed the issue above, you can re-submit your application.
          Our team will review the updated information within a few days.
        </Text>
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/venue-owner/setup?reapply=true")}
        >
          <Text style={styles.primaryBtnText}>Re-apply Now →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeBtn: { padding: 4 },
  closeBtnText: { color: "rgba(255,255,255,0.4)", fontSize: 18 },
  closeBtnPlaceholder: { width: 26 },
  screenTitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  scroll: { flex: 1 },
  content: { padding: 24 },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  rejectedBadge: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  rejectedBadgeText: {
    color: "#EF4444",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  heading: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
    lineHeight: 30,
  },
  body: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    marginBottom: 28,
  },
  reasonBox: {
    backgroundColor: "rgba(239,68,68,0.07)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  reasonLabel: {
    color: "rgba(239,68,68,0.7)",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  reasonText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  hint: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
