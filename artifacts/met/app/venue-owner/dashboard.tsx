/**
 * Venue Owner Dashboard
 *
 * Shows:
 *   - Check-in trend (last 30 days) — simple bar chart
 *   - Top 5 visitors this month
 *   - Upcoming event RSVP counts
 *   - Active reward status
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, type VenueOwnerDashboard } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";

export default function VenueOwnerDashboardScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<VenueOwnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!authedUid) return;
    setLoading(true);
    setError(false);
    api
      .getVenueOwnerDashboard({ uid: authedUid })
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [authedUid]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: "#0F0F12", paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: "#0F0F12", paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Failed to load dashboard</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.link, { color: colors.primary }]}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  const maxCount = Math.max(...data.checkInTrend.map((d) => d.count), 1);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: "#0F0F12" }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
    >
      {/* Nav row */}
      <View style={styles.navRow}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.navTitle}>Dashboard</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Venue identity */}
      <View style={styles.venueHeader}>
        <Text style={styles.businessName}>{data.businessName}</Text>
        <Text style={styles.placeName}>{data.placeName}</Text>
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        {[
          { label: "Events", icon: "📅", route: "/venue-owner/events/index" as const },
          { label: "Rewards", icon: "🎁", route: "/venue-owner/rewards/index" as const },
          { label: "Announce", icon: "📢", route: "/venue-owner/announcements/new" as const },
        ].map((a) => (
          <Pressable
            key={a.label}
            style={[styles.quickBtn, { borderColor: colors.primary + "40" }]}
            onPress={() => router.push(a.route as never)}
          >
            <Text style={styles.quickBtnIcon}>{a.icon}</Text>
            <Text style={[styles.quickBtnLabel, { color: colors.primary }]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Active reward chip */}
      {data.activeReward && (
        <View style={[styles.activeRewardChip, { backgroundColor: "#FFD70015", borderColor: "#FFD70040" }]}>
          <Text style={styles.activeRewardIcon}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.activeRewardLabel}>Active Reward</Text>
            <Text numberOfLines={1} style={styles.activeRewardTitle}>{data.activeReward.title}</Text>
          </View>
          <Text style={styles.activeRewardEnds}>
            Ends {new Date(data.activeReward.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </Text>
        </View>
      )}

      {/* Check-in trend */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Check-in Trend — Last 30 Days</Text>
        {data.checkInTrend.length === 0 ? (
          <Text style={styles.emptyText}>No check-ins recorded yet</Text>
        ) : (
          <View style={styles.barChart}>
            {data.checkInTrend.map((d, i) => (
              <View key={i} style={styles.barItem}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(4, (d.count / maxCount) * 80),
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
                {i % 7 === 0 && (
                  <Text style={styles.barLabel}>
                    {new Date(d.day).getDate()}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Top visitors */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Top Visitors This Month</Text>
        {data.topVisitors.length === 0 ? (
          <Text style={styles.emptyText}>No visitors yet this month</Text>
        ) : (
          data.topVisitors.map((v, i) => (
            <View key={v.userUid} style={styles.visitorRow}>
              <Text style={styles.visitorRank}>{i + 1}</Text>
              {v.photoUrl ? (
                <Image source={{ uri: v.photoUrl }} style={styles.visitorAvatar} accessibilityIgnoresInvertColors />
              ) : (
                <View style={[styles.visitorAvatarFallback, { backgroundColor: "#2C2C2E" }]}>
                  <Text style={{ fontSize: 16 }}>👤</Text>
                </View>
              )}
              <Text numberOfLines={1} style={styles.visitorName}>{v.displayName}</Text>
              <Text style={[styles.visitorCount, { color: colors.primary }]}>{v.checkinCount} check-ins</Text>
            </View>
          ))
        )}
      </View>

      {/* Event RSVPs */}
      {data.eventRsvpCounts.length > 0 && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Upcoming Event RSVPs</Text>
          {data.eventRsvpCounts.map((e) => (
            <View key={e.eventId} style={styles.eventRsvpRow}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.eventRsvpTitle}>{e.title}</Text>
                <Text style={styles.eventRsvpDate}>
                  {new Date(e.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <View style={styles.rsvpBadges}>
                <View style={[styles.rsvpBadge, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.rsvpBadgeText, { color: colors.primary }]}>✓ {e.going}</Text>
                </View>
                <View style={[styles.rsvpBadge, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                  <Text style={styles.rsvpBadgeTextMuted}>? {e.maybe}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "rgba(255,255,255,0.5)", fontSize: 15, marginBottom: 12 },
  link: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backText: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
  navTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  venueHeader: { marginBottom: 20 },
  businessName: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  placeName: { color: "rgba(255,255,255,0.45)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  quickActions: { flexDirection: "row", gap: 10, marginBottom: 20 },
  quickBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#1A1A1E",
    gap: 4,
  },
  quickBtnIcon: { fontSize: 22 },
  quickBtnLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  activeRewardChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 20,
    gap: 10,
  },
  activeRewardIcon: { fontSize: 24 },
  activeRewardLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  activeRewardTitle: { color: "#FFD700", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  activeRewardEnds: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionCard: {
    backgroundColor: "#1A1A1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  emptyText: { color: "rgba(255,255,255,0.3)", fontSize: 13, fontFamily: "Inter_400Regular" },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 90,
    gap: 2,
  },
  barItem: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 2 },
  barLabel: { color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 3 },
  visitorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  visitorRank: { color: "rgba(255,255,255,0.4)", fontSize: 14, width: 18, textAlign: "center" },
  visitorAvatar: { width: 32, height: 32, borderRadius: 16 },
  visitorAvatarFallback: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  visitorName: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Inter_500Medium" },
  visitorCount: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  eventRsvpRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
    gap: 10,
  },
  eventRsvpTitle: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  eventRsvpDate: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  rsvpBadges: { flexDirection: "row", gap: 6 },
  rsvpBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  rsvpBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  rsvpBadgeTextMuted: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
