import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { useApp } from "@/contexts/AppContext";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";

function formatHistoryDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function VenueOwnerPendingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, history, isLoading, error, refetch } = useVenueOwner();
  const { authedUid } = useApp();
  const [withdrawing, setWithdrawing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  useEffect(() => {
    if (!profile) return;
    if (profile.isApproved || profile.applicationStatus === "approved") {
      router.replace("/venue-owner/dashboard");
    } else if (
      profile.applicationStatus === "rejected" ||
      profile.applicationStatus === "changes_requested"
    ) {
      router.replace("/venue-owner/rejected");
    } else if (
      profile.applicationStatus === "withdrawn" ||
      profile.applicationStatus === "expired"
    ) {
      router.replace("/venue-owner/setup");
    }
  }, [profile, router]);

  if (isLoading && !profile) {
    return (
      <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
        <VenueOwnerHeader title="Application status" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
        <VenueOwnerHeader title="Application status" />
        <View style={styles.center}>
          <Text style={styles.errorText}>We couldn’t refresh your application.</Text>
          <Pressable onPress={refetch}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const canWithdraw =
    profile?.applicationStatus === "submitted" ||
    profile?.applicationStatus === "under_review" ||
    profile?.applicationStatus === "resubmitted";
  const withdraw = () => {
    if (!authedUid || withdrawing) return;
    // Avoid an accidental terminal action while still giving the applicant a
    // clear way to regain control of an in-review application.
    Alert.alert(
      "Withdraw application?",
      "You can start a new application later, but this one will no longer be reviewed.",
      [
        { text: "Keep application", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: () => {
            setWithdrawing(true);
            import("@/lib/api/client")
              .then(({ api }) => api.withdrawMyVenueApplication({ uid: authedUid }))
              .then(() => refetch())
              .catch(() =>
                Alert.alert(
                  "Couldn’t withdraw",
                  "Your application is still active. Check your connection and try again.",
                ),
              )
              .finally(() => setWithdrawing(false));
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <VenueOwnerHeader title="Application status" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: 24, paddingBottom: insets.bottom + 24 },
        ]}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
      <View style={[styles.icon, { backgroundColor: colors.primary + "22" }]}>
        <Text style={[styles.iconText, { color: colors.primary }]}>✓</Text>
      </View>
      <Text style={styles.title}>Application submitted</Text>
      <Text style={styles.body}>
        Your venue application is now with our review team. We’ll notify you when a decision is ready.
      </Text>
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>STATUS</Text>
        <Text style={[styles.statusValue, { color: colors.primary }]}>
          {profile?.statusLabel ?? "Under review"}
        </Text>
      </View>
      {history.length > 0 ? (
        <View style={styles.timeline}>
          <Text style={styles.timelineTitle}>APPLICATION TIMELINE</Text>
          {history.map((entry) => (
            <View key={entry.id} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
              <View style={styles.timelineCopy}>
                <Text style={styles.timelineMessage}>
                  {entry.applicantMessage ?? entry.toStatus?.replaceAll("_", " ") ?? "Application updated"}
                </Text>
                <Text style={styles.timelineDate}>{formatHistoryDate(entry.createdAt)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {canWithdraw ? (
        <Pressable
          testID="withdraw-venue-application"
          style={styles.withdrawButton}
          disabled={withdrawing}
          onPress={withdraw}
        >
          <Text style={styles.withdrawText}>
            {withdrawing ? "Withdrawing…" : "Withdraw application"}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        testID="venue-application-done"
        style={[styles.doneButton, { backgroundColor: colors.primary }]}
        onPress={() => router.replace("/onboarding")}
      >
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0F0F12" },
  content: { paddingHorizontal: 24, alignItems: "center", justifyContent: "center", flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  iconText: { fontSize: 38, fontFamily: "Inter_700Bold" },
  title: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 12 },
  body: { color: "rgba(255,255,255,0.62)", fontSize: 16, fontFamily: "Inter_400Regular", lineHeight: 24, textAlign: "center", maxWidth: 340 },
  statusCard: { width: "100%", marginTop: 32, backgroundColor: "#1A1A1E", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16 },
  statusLabel: { color: "rgba(255,255,255,0.42)", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 6 },
  statusValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  timeline: { width: "100%", marginTop: 24, gap: 14 },
  timelineTitle: { color: "rgba(255,255,255,0.42)", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  timelineRow: { flexDirection: "row", gap: 10 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  timelineCopy: { flex: 1 },
  timelineMessage: { color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  timelineDate: { color: "rgba(255,255,255,0.42)", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 3 },
  doneButton: { width: "100%", borderRadius: 12, alignItems: "center", paddingVertical: 15, marginTop: 22 },
  doneText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  withdrawButton: { marginTop: 24, paddingVertical: 10, alignItems: "center" },
  withdrawText: { color: "#FCA5A5", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorText: { color: "rgba(255,255,255,0.7)", fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 12 },
  retryText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});