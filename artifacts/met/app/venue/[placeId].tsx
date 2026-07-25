/**
 * Public Venue Profile Screen — /venue/[placeId]
 *
 * Scrollable modal-style sheet displaying:
 *   - Cover photo, logo, tagline, verified badge
 *   - Description
 *   - Active rewards banner
 *   - Upcoming events (horizontal scroll)
 *   - Announcements
 *   - Top 3 monthly leaderboard preview
 *   - Check-in button
 */
import React, { useCallback, useEffect, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, type VenueOwnerProfile, type VenueEvent, type VenueReward, type VenueAnnouncement } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { VenueEventCard } from "@/components/VenueEventCard";
import { VenueRewardBanner } from "@/components/VenueRewardBanner";
import { useHubCheckin } from "@/hooks/useHubCheckin";

export default function VenueProfileScreen() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { attemptCheckin, hubState } = useHubCheckin();

  const [profile, setProfile] = useState<VenueOwnerProfile | null>(null);
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [rewards, setRewards] = useState<VenueReward[]>([]);
  const [announcements, setAnnouncements] = useState<VenueAnnouncement[]>([]);
  const [topVisitors, setTopVisitors] = useState<Array<{ rank: number; uid: string; displayName: string; photoUrl: string | null; checkinCount: number; hasTrophy?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!authedUid || !placeId) return;
    setLoading(true);
    setError(false);
    try {
      const [profileData, eventsData, rewardsData, announcementsData, leaderboardData] =
        await Promise.all([
          api.getVenueOwnerProfile({ uid: authedUid }, placeId),
          api.getVenueEvents({ uid: authedUid }, placeId).catch(() => ({ events: [] })),
          api.getVenueRewards({ uid: authedUid }, placeId).catch(() => ({ rewards: [] })),
          api.getVenueAnnouncements({ uid: authedUid }, placeId).catch(() => ({ announcements: [] })),
          api.getLeaderboard({ uid: authedUid }, placeId, "current_month").catch(() => []),
        ]);

      setProfile(profileData.profile);
      setEvents(eventsData.events);
      setRewards(rewardsData.rewards);
      setAnnouncements(announcementsData.announcements);
      setTopVisitors(leaderboardData.slice(0, 3));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [authedUid, placeId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const now = new Date();
  const activeReward = rewards.find(
    (r) =>
      r.status === "active" &&
      new Date(r.startDate) <= now &&
      new Date(r.endDate) >= now,
  ) ?? null;

  const upcomingEvents = events.filter((e) => new Date(e.startsAt) >= now);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: "#0F0F12" }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: "#0F0F12" }]}>
        <Text style={styles.errorText}>Venue not found</Text>
        <Pressable onPress={() => router.back()} style={styles.retryBtn}>
          <Text style={[styles.retryText, { color: colors.primary }]}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
      {/* Close button */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.closeBtn, { top: insets.top + 12 }]}
        hitSlop={10}
      >
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
        {/* Cover photo */}
        {profile.coverPhotoUrl ? (
          <Image
            source={{ uri: profile.coverPhotoUrl }}
            style={styles.cover}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.coverFallback, { backgroundColor: "#1A1A1E" }]}>
            <Text style={styles.coverFallbackEmoji}>🏛️</Text>
          </View>
        )}

        {/* Logo + name row */}
        <View style={styles.identityRow}>
          {profile.logoUrl ? (
            <Image
              source={{ uri: profile.logoUrl }}
              style={styles.logo}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.logoFallback, { backgroundColor: "#2C2C2E" }]}>
              <Text style={styles.logoFallbackText}>
                {profile.businessName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.nameCol}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.businessName}>
                {profile.businessName}
              </Text>
              {profile.isVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "60" }]}>
                  <Text style={[styles.verifiedText, { color: colors.primary }]}>✓ Verified</Text>
                </View>
              )}
            </View>
            {profile.tagline && (
              <Text numberOfLines={2} style={styles.tagline}>
                {profile.tagline}
              </Text>
            )}
          </View>
        </View>

        {/* Description */}
        {profile.description && (
          <View style={styles.section}>
            <Text style={styles.descriptionText}>{profile.description}</Text>
          </View>
        )}

        {/* Active reward banner */}
        {activeReward && (
          <VenueRewardBanner
            reward={{
              id: activeReward.id,
              placeId: activeReward.placeId,
              title: activeReward.title,
              prizeDescription: activeReward.prizeDescription,
              rewardType: activeReward.rewardType,
              endDate: activeReward.endDate,
            }}
          />
        )}

        {/* Upcoming events */}
        {upcomingEvents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {upcomingEvents.map((event) => (
                <VenueEventCard key={event.id} event={event} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Announcements</Text>
            {announcements.slice(0, 5).map((ann) => (
              <View key={ann.id} style={[styles.announcementCard, { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.07)" }]}>
                {ann.isPinned && (
                  <Text style={[styles.pinnedLabel, { color: colors.primary }]}>📌 Pinned</Text>
                )}
                <Text style={styles.announcementTitle}>{ann.title}</Text>
                <Text numberOfLines={3} style={styles.announcementBody}>{ann.body}</Text>
                <Text style={styles.announcementDate}>
                  {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Monthly leaderboard top 3 */}
        {topVisitors.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Regulars This Month</Text>
            {topVisitors.map((v, i) => (
              <View key={v.uid} style={[styles.leaderRow, { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.07)" }]}>
                <Text style={[styles.leaderRank, { color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : "#CD7F32" }]}>
                  {["🥇", "🥈", "🥉"][i]}
                </Text>
                {v.photoUrl ? (
                  <Image source={{ uri: v.photoUrl }} style={styles.leaderAvatar} accessibilityIgnoresInvertColors />
                ) : (
                  <View style={[styles.leaderAvatarFallback, { backgroundColor: "#2C2C2E" }]}>
                    <Text style={styles.leaderAvatarFallbackText}>👤</Text>
                  </View>
                )}
                <Text numberOfLines={1} style={styles.leaderName}>{v.displayName}</Text>
                <Text style={styles.leaderCount}>{v.checkinCount} check-ins</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Check-in FAB */}
      <View style={[styles.checkinFab, { bottom: insets.bottom + 20 }]}>
        <Pressable
          onPress={attemptCheckin}
          style={[styles.checkinBtn, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Check in to this venue"
        >
          <Text style={styles.checkinBtnText}>
            {hubState?.placeId === placeId ? "✓ Checked In" : "Check In Here"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "rgba(255,255,255,0.5)", fontSize: 16 },
  retryBtn: { marginTop: 12 },
  retryText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#fff", fontSize: 16 },
  cover: { width: "100%", height: 200 },
  coverFallback: {
    width: "100%",
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  coverFallbackEmoji: { fontSize: 60 },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  logo: { width: 56, height: 56, borderRadius: 12 },
  logoFallback: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  logoFallbackText: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },
  nameCol: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  businessName: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    flexShrink: 1,
  },
  verifiedBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tagline: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  descriptionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  horizontalScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  announcementCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  pinnedLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  announcementTitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  announcementBody: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 6,
  },
  announcementDate: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  leaderRank: { fontSize: 22, width: 30, textAlign: "center" },
  leaderAvatar: { width: 36, height: 36, borderRadius: 18 },
  leaderAvatarFallback: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  leaderAvatarFallbackText: { fontSize: 18 },
  leaderName: { flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  leaderCount: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular" },
  checkinFab: { position: "absolute", left: 24, right: 24 },
  checkinBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  checkinBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
