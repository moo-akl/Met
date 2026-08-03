/**
 * Venue Owner — Rejected Screen
 *
 * Displayed when the user's venue owner application was rejected.
 * Shows the rejection reason from the admin and offers a re-apply button
 * that takes them back through the setup flow with their existing data
 * pre-filled where possible.
 */
import React, { useCallback, useEffect } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";

export default function VenueOwnerRejectedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, history, isLoading, error, refetch } = useVenueOwner();

  // Empty deps: refetch from React Query is not referentially stable — including it
  // would cause useFocusEffect to re-register on every render, creating an infinite
  // refetch loop.
  useFocusEffect(
    useCallback(() => {
      void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Omit `router` from deps — see pending.tsx for explanation.
  useEffect(() => {
    if (!profile) return;
    if (profile.isApproved || profile.applicationStatus === "approved") {
      router.replace("/venue-owner/dashboard");
    } else if (
      profile.applicationStatus === "submitted" ||
      profile.applicationStatus === "under_review" ||
      profile.applicationStatus === "resubmitted"
    ) {
      router.replace("/venue-owner/pending");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const isChangesRequested = profile?.applicationStatus === "changes_requested";
  const rejectionReason =
    profile?.rejectionReason ??
    history
      .slice()
      .reverse()
      .find((entry) => entry.applicantMessage)?.applicantMessage ??
    null;

  return (
    <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
      <VenueOwnerHeader title="Venue Owner Portal" onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {/* Status badge */}
        <View style={styles.badgeRow}>
          <View style={styles.rejectedBadge}>
            <Text style={styles.rejectedBadgeText}>
              {isChangesRequested ? "Changes Requested" : "Application Not Approved"}
            </Text>
          </View>
        </View>

        <Text style={styles.heading}>
          {isChangesRequested ? "Your application needs an update" : "We couldn't approve your venue"}
        </Text>
        <Text style={styles.body}>
          {isChangesRequested
            ? "Our team needs a little more information before they can continue reviewing your venue."
            : "Our team reviewed your application and was unable to approve it at this time. Please see the reason below, address any issues, then submit a new application."}
        </Text>

        {/* Rejection reason box */}
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>REASON FROM OUR TEAM</Text>
          <Text style={styles.reasonText}>
            {error
              ? "We couldn’t refresh the latest decision. Pull down to try again."
              : rejectionReason ?? "No specific reason was provided."}
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
          onPress={() => router.replace("/venue-owner/setup?reapply=true")}
        >
          <Text style={styles.primaryBtnText}>
            {isChangesRequested ? "Update Application →" : "Re-apply Now →"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
