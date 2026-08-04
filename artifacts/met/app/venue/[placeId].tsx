/**
 * Public Venue Profile Screen — /venue/[placeId]
 *
 * Redesigned layout (top → bottom):
 *   1. Immersive hero (320 px, gradient overlay, identity on photo)
 *   2. Description
 *   3. Kings & Queens 👑  (top-3 monthly leaderboard)
 *   4. Active reward card  (colourful full card)
 *   5. Announcements  (with images when present)
 *   6. Upcoming events  (redesigned cards)
 *   7. Contact info
 *   8. Today's hours  (single line at the bottom)
 *   9. Check-in FAB  (fixed)
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, type VenueOwnerProfile, type VenueEvent, type VenueReward, type VenueAnnouncement } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { VenueEventCard } from "@/components/VenueEventCard";
import { useHubCheckin } from "@/hooks/useHubCheckin";

// ─── helpers ─────────────────────────────────────────────────────────────────

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const REWARD_ICON: Record<string, string> = {
  free_drink: "🍹",
  discount:   "💸",
  experience: "✨",
  custom:     "🎁",
};

function useCountdown(endDateIso: string): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endDateIso).getTime() - Date.now();
      if (diff <= 0) { setLabel("Ended"); return; }
      const days  = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      const mins  = Math.floor((diff % 3_600_000)  / 60_000);
      if (days  > 0) setLabel(`${days}d ${hours}h left`);
      else if (hours > 0) setLabel(`${hours}h ${mins}m left`);
      else setLabel(`${mins}m left`);
    };
    calc();
    const id = setInterval(calc, 30_000);
    return () => clearInterval(id);
  }, [endDateIso]);
  return label;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon?: string }) {
  return (
    <View style={sh.row}>
      {icon && <Text style={sh.icon}>{icon}</Text>}
      <Text style={sh.text}>{title}</Text>
    </View>
  );
}
const sh = StyleSheet.create({
  row:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  icon: { fontSize: 18 },
  text: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
});

// Reward full card (used only on the venue page; the slim banner is kept for leaderboard)
function RewardCard({ reward }: { reward: VenueReward & { countdown?: string } }) {
  const countdown = useCountdown(reward.endDate);
  const icon = REWARD_ICON[reward.rewardType] ?? "🎁";
  return (
    <LinearGradient
      colors={["#7C3AED", "#4F46E5"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={rc.card}
    >
      <View style={rc.topRow}>
        <Text style={rc.badge}>🏆 Active Reward</Text>
        <Text style={rc.countdown}>{countdown}</Text>
      </View>
      <Text style={rc.icon}>{icon}</Text>
      <Text style={rc.title}>{reward.title}</Text>
      <Text style={rc.prize}>{reward.prizeDescription}</Text>
    </LinearGradient>
  );
}
const rc = StyleSheet.create({
  card:      { borderRadius: 16, padding: 20, marginBottom: 8 },
  topRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  badge:     { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 0.8 },
  countdown: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  icon:      { fontSize: 44, marginBottom: 8 },
  title:     { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 6 },
  prize:     { fontSize: 15, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)", lineHeight: 22 },
});

// ─── main screen ─────────────────────────────────────────────────────────────

export default function VenueProfileScreen() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { attemptCheckin, hubState } = useHubCheckin();

  const [profile, setProfile]             = useState<VenueOwnerProfile | null>(null);
  const [events, setEvents]               = useState<VenueEvent[]>([]);
  const [rewards, setRewards]             = useState<VenueReward[]>([]);
  const [announcements, setAnnouncements] = useState<VenueAnnouncement[]>([]);
  const [topVisitors, setTopVisitors]     = useState<Array<{ rank: number; uid: string; displayName: string; photoUrl: string | null; checkinCount: number }>>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(false);

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

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const now         = new Date();
  const activeReward = rewards.find(
    (r) => r.status === "active" && new Date(r.startDate) <= now && new Date(r.endDate) >= now,
  ) ?? null;
  const upcomingEvents = events.filter((e) => new Date(e.startsAt) >= now);

  // Today's opening hours (single line)
  const todayKey   = DAYS[now.getDay()];
  const todayEntry = profile?.openingHours?.[todayKey];
  const hasTodayEntry = profile?.openingHours != null && todayKey in profile.openingHours;
  const todayLabel = hasTodayEntry
    ? (todayEntry ? `Open today: ${todayEntry.open} – ${todayEntry.close}` : "Closed today")
    : null;

  // ── loading / error ─────────────────────────────────────────────────────────
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

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <View style={styles.heroContainer}>
        {profile.coverPhotoUrl ? (
          <Image
            source={{ uri: profile.coverPhotoUrl }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.heroFallback]}>
            <Text style={styles.heroFallbackEmoji}>🏛️</Text>
          </View>
        )}

        {/* Gradient — transparent top → solid bottom */}
        <LinearGradient
          colors={["transparent", "rgba(15,15,18,0.55)", "#0F0F12"]}
          locations={[0.35, 0.72, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Close button */}
        <Pressable
          onPress={() => router.back()}
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          hitSlop={10}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>

        {/* Identity overlaid at the bottom of the hero */}
        <View style={styles.heroIdentity}>
          {profile.logoUrl ? (
            <Image source={{ uri: profile.logoUrl }} style={styles.heroLogo} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.heroLogoFallback]}>
              <Text style={styles.heroLogoChar}>{profile.businessName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.heroNameCol}>
            <View style={styles.heroNameRow}>
              <Text numberOfLines={1} style={styles.heroName}>{profile.businessName}</Text>
              {profile.isVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: colors.primary + "25", borderColor: colors.primary + "70" }]}>
                  <Text style={[styles.verifiedText, { color: colors.primary }]}>✓ Verified</Text>
                </View>
              )}
            </View>
            {profile.tagline ? (
              <Text numberOfLines={2} style={styles.heroTagline}>{profile.tagline}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >

        {/* Description */}
        {profile.description ? (
          <View style={styles.section}>
            <Text style={styles.descriptionText}>{profile.description}</Text>
          </View>
        ) : null}

        {/* ── Kings & Queens ───────────────────────────────────────────────── */}
        {topVisitors.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Kings & Queens" icon="👑" />
            <View style={styles.kqRow}>
              {topVisitors.map((v, i) => (
                <View key={v.uid} style={[styles.kqCard, { backgroundColor: "#1A1A1E", borderColor: i === 0 ? "#FFD70040" : "rgba(255,255,255,0.06)" }]}>
                  <Text style={styles.kqMedal}>{["🥇","🥈","🥉"][i]}</Text>
                  {v.photoUrl ? (
                    <Image source={{ uri: v.photoUrl }} style={styles.kqAvatar} accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={[styles.kqAvatar, styles.kqAvatarFallback]}>
                      <Text style={styles.kqAvatarChar}>{v.displayName.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text numberOfLines={1} style={styles.kqName}>{v.displayName}</Text>
                  <Text style={[styles.kqCount, { color: i === 0 ? "#FFD700" : "rgba(255,255,255,0.4)" }]}>{v.checkinCount}</Text>
                  <Text style={styles.kqCountLabel}>check-ins</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Active reward ────────────────────────────────────────────────── */}
        {activeReward && (
          <View style={styles.section}>
            <RewardCard reward={activeReward} />
          </View>
        )}

        {/* ── Announcements ────────────────────────────────────────────────── */}
        {announcements.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Announcements" icon="📢" />
            {announcements.slice(0, 5).map((ann) => (
              <View key={ann.id} style={[styles.annCard, { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.07)" }]}>
                {/* Announcement image */}
                {"imageUrl" in ann && (ann as { imageUrl?: string | null }).imageUrl ? (
                  <Image
                    source={{ uri: (ann as { imageUrl: string }).imageUrl }}
                    style={styles.annImage}
                    resizeMode="cover"
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
                <View style={styles.annBody}>
                  {ann.isPinned && (
                    <Text style={[styles.annPinned, { color: colors.primary }]}>📌 Pinned</Text>
                  )}
                  <Text style={styles.annTitle}>{ann.title}</Text>
                  <Text numberOfLines={3} style={styles.annText}>{ann.body}</Text>
                  <Text style={styles.annDate}>
                    {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Upcoming events ──────────────────────────────────────────────── */}
        {upcomingEvents.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Upcoming Events" icon="🎉" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
              {upcomingEvents.map((event) => (
                <VenueEventCard key={event.id} event={event} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ── Contact ─────────────────────────────────────────────────────── */}
        {(profile.phone || profile.websiteUrl || profile.publicEmail) && (
          <View style={styles.section}>
            <SectionHeader title="Contact" icon="📬" />
            <View style={[styles.contactCard, { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.07)" }]}>
              {profile.phone && (
                <Pressable style={styles.contactRow} onPress={() => void Linking.openURL(`tel:${profile.phone}`)} accessibilityRole="link">
                  <Text style={styles.contactIcon}>📞</Text>
                  <Text style={[styles.contactLink, { color: colors.primary }]}>{profile.phone}</Text>
                </Pressable>
              )}
              {profile.websiteUrl && (
                <Pressable
                  style={styles.contactRow}
                  onPress={() => void Linking.openURL(profile.websiteUrl!.startsWith("http") ? profile.websiteUrl! : `https://${profile.websiteUrl}`)}
                  accessibilityRole="link"
                >
                  <Text style={styles.contactIcon}>🌐</Text>
                  <Text style={[styles.contactLink, { color: colors.primary }]} numberOfLines={1}>{profile.websiteUrl}</Text>
                </Pressable>
              )}
              {profile.publicEmail && (
                <Pressable style={styles.contactRow} onPress={() => void Linking.openURL(`mailto:${profile.publicEmail}`)} accessibilityRole="link">
                  <Text style={styles.contactIcon}>✉️</Text>
                  <Text style={[styles.contactLink, { color: colors.primary }]} numberOfLines={1}>{profile.publicEmail}</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── Today's hours (1 line) ───────────────────────────────────────── */}
        {todayLabel && (
          <View style={styles.hoursLine}>
            <Text style={styles.hoursIcon}>🕐</Text>
            <Text style={[styles.hoursText, { color: todayEntry ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.35)" }]}>
              {todayLabel}
            </Text>
          </View>
        )}

      </ScrollView>

      {/* ── Check-in FAB ─────────────────────────────────────────────────── */}
      <View style={[styles.fab, { bottom: insets.bottom + 20 }]}>
        <Pressable
          onPress={attemptCheckin}
          style={[styles.fabBtn, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Check in to this venue"
        >
          <Text style={styles.fabBtnText}>
            {hubState?.placeId === placeId ? "✓ Checked In" : "Check In Here"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "rgba(255,255,255,0.5)", fontSize: 16 },
  retryBtn:  { marginTop: 12 },
  retryText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Hero
  heroContainer: { width: "100%", height: 320, position: "relative" },
  heroFallback:  { backgroundColor: "#1A1A1E", alignItems: "center", justifyContent: "center" },
  heroFallbackEmoji: { fontSize: 64 },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#fff", fontSize: 14 },
  heroIdentity: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  heroLogo: { width: 60, height: 60, borderRadius: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)" },
  heroLogoFallback: {
    width: 60, height: 60, borderRadius: 14,
    backgroundColor: "#2C2C2E",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  heroLogoChar: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#fff" },
  heroNameCol:  { flex: 1 },
  heroNameRow:  { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  heroName:     { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", flexShrink: 1, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
  verifiedBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText:  { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  heroTagline:   { color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 3 },

  // Scroll
  scroll:   { flex: 1 },
  section:  { paddingHorizontal: 16, marginBottom: 28 },
  hScroll:  { marginHorizontal: -16, paddingHorizontal: 16 },

  // Description
  descriptionText: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, marginTop: 16 },

  // Kings & Queens
  kqRow:  { flexDirection: "row", gap: 10 },
  kqCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  kqMedal:        { fontSize: 22 },
  kqAvatar:       { width: 44, height: 44, borderRadius: 22 },
  kqAvatarFallback: { backgroundColor: "#2C2C2E", alignItems: "center", justifyContent: "center" },
  kqAvatarChar:   { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  kqName:         { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)", textAlign: "center" },
  kqCount:        { fontSize: 18, fontFamily: "Inter_700Bold" },
  kqCountLabel:   { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.35)" },

  // Announcements
  annCard:  { borderRadius: 12, borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  annImage: { width: "100%", height: 130 },
  annBody:  { padding: 14 },
  annPinned: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  annTitle:  { color: "rgba(255,255,255,0.92)", fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  annText:   { color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 6 },
  annDate:   { color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "Inter_400Regular" },

  // Contact
  contactCard: { borderRadius: 12, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 14 },
  contactRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 11, gap: 10 },
  contactIcon: { fontSize: 16, width: 22, textAlign: "center" },
  contactLink: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },

  // Today's hours
  hoursLine: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  hoursIcon: { fontSize: 14 },
  hoursText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  // FAB
  fab: { position: "absolute", left: 24, right: 24 },
  fabBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
