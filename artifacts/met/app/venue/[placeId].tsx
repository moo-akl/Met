/**
 * Public Venue Profile Screen — /venue/[placeId]
 *
 * Design: "Bright & Airy" — Airbnb-style warm white, coral-red accent (#FF385C),
 * white cards with soft shadows, section labels in grey uppercase.
 *
 * Layout (top → bottom, single scroll):
 *   1. Immersive hero (warm gradient, identity overlaid, dark text)
 *   2. About / description
 *   3. "Be the Winner" reward card (white card + coral stripe)
 *   4. Announcements
 *   5. Leaderboards (3-column white cards)
 *   6. Upcoming events (horizontal scroll)
 *   7. Info & Contact (unified white card)
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
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
import {
  api,
  type VenueOwnerProfile,
  type VenueEvent,
  type VenueReward,
  type VenueAnnouncement,
} from "@/lib/api/client";
import { VenueEventCard } from "@/components/VenueEventCard";

// ─── constants ────────────────────────────────────────────────────────────────

const CORAL  = "#FF385C";
const BG     = "#FAFAF8";
const TEXT   = "#222222";
const TEXT2  = "#484848";
const MUTED  = "#9CA3AF";
const CARD   = "#FFFFFF";
const BORDER = "#F0F0F0";
const DIVIDER = "#F3F3F3";

const DAYS = [
  "sunday","monday","tuesday","wednesday","thursday","friday","saturday",
] as const;

const REWARD_ICON: Record<string, string> = {
  free_drink: "🍹",
  discount:   "💸",
  experience: "✨",
  custom:     "🎁",
};

// Gradient avatar colours for leaderboard positions
const AVATAR_GRADIENTS: [string, string][] = [
  ["#FDE68A", "#FBBF24"], // gold
  ["#E5E7EB", "#9CA3AF"], // silver
  ["#FED7AA", "#D97706"], // bronze
];

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

// ─── shared shadow (iOS + Android) ───────────────────────────────────────────

const cardShadow = {
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

// ─── How-to-win modal ────────────────────────────────────────────────────────

function WinnerModal({
  reward,
  visible,
  onClose,
}: {
  reward: VenueReward;
  visible: boolean;
  onClose: () => void;
}) {
  const insets   = useSafeAreaInsets();
  const countdown = useCountdown(reward.endDate);
  const icon     = REWARD_ICON[reward.rewardType] ?? "🎁";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={wm.backdrop} onPress={onClose} />
      <View style={[wm.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={wm.handle} />

        {/* Prize card — coral accent */}
        <View style={wm.prizeCard}>
          <View style={wm.prizeStripe} />
          <View style={wm.prizeBody}>
            <Text style={wm.prizeIcon}>{icon}</Text>
            <Text style={wm.prizeTitle}>{reward.title}</Text>
            <Text style={wm.prizeDesc}>{reward.prizeDescription}</Text>
            <Text style={wm.prizeCountdown}>⏱ {countdown}</Text>
          </View>
        </View>

        <Text style={wm.howTitle}>How to win</Text>
        <View style={wm.steps}>
          {[
            "Check in at this venue as many times as you can this month.",
            "Rack up more check-ins than anyone else to reach #1 on the Leaderboard.",
            "Stay at the top when the reward ends and the prize is yours!",
          ].map((text, i) => (
            <View key={i} style={wm.step}>
              <View style={wm.stepNum}><Text style={wm.stepNumText}>{i + 1}</Text></View>
              <Text style={wm.stepText}>{text}</Text>
            </View>
          ))}
        </View>

        <Pressable style={wm.closeBtn} onPress={onClose} accessibilityRole="button">
          <Text style={wm.closeBtnText}>Got it!</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const wm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  handle: {
    alignSelf: "center", width: 40, height: 4,
    borderRadius: 2, backgroundColor: BORDER, marginBottom: 20,
  },
  prizeCard: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    marginBottom: 24,
    backgroundColor: CARD,
    ...cardShadow,
  },
  prizeStripe: { width: 5, backgroundColor: CORAL },
  prizeBody:   { flex: 1, padding: 16 },
  prizeIcon:   { fontSize: 36, marginBottom: 8 },
  prizeTitle:  { fontSize: 18, fontFamily: "Inter_700Bold", color: TEXT, marginBottom: 4 },
  prizeDesc:   { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT2, lineHeight: 21, marginBottom: 8 },
  prizeCountdown: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: CORAL },
  howTitle:    { fontSize: 17, fontFamily: "Inter_700Bold", color: TEXT, marginBottom: 16 },
  steps:       { gap: 14, marginBottom: 28 },
  step:        { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: CORAL, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepNumText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  stepText:    { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT2, lineHeight: 21 },
  closeBtn:    { backgroundColor: CORAL, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  closeBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});

// ─── "Be the Winner" card ────────────────────────────────────────────────────

function BeTheWinnerCard({
  reward,
  onPress,
}: {
  reward: VenueReward;
  onPress: () => void;
}) {
  const countdown = useCountdown(reward.endDate);
  const icon      = REWARD_ICON[reward.rewardType] ?? "🎁";

  return (
    <Pressable
      onPress={onPress}
      style={[bw.card, cardShadow]}
      accessibilityRole="button"
      accessibilityLabel="View how to win this reward"
    >
      {/* Coral left stripe */}
      <View style={bw.stripe} />
      <View style={bw.body}>
        {/* Icon circle */}
        <View style={bw.iconCircle}>
          <Text style={bw.iconEmoji}>{icon}</Text>
        </View>
        <View style={bw.text}>
          <Text style={bw.title}>{reward.title}</Text>
          <Text numberOfLines={2} style={bw.prize}>{reward.prizeDescription}</Text>
          <Text style={bw.countdown}>⏱ {countdown}</Text>
        </View>
        <Text style={bw.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const bw = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  stripe: { width: 5, backgroundColor: CORAL },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingLeft: 12,
    gap: 12,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: `${CORAL}18`,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  iconEmoji: { fontSize: 22 },
  text:      { flex: 1 },
  title:     { fontSize: 15, fontFamily: "Inter_700Bold", color: TEXT, marginBottom: 3 },
  prize:     { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT2, lineHeight: 19 },
  countdown: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: CORAL, marginTop: 4 },
  chevron:   { fontSize: 22, color: MUTED, lineHeight: 24 },
});

// ─── main screen ─────────────────────────────────────────────────────────────

export default function VenueProfileScreen() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { authedUid } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [profile, setProfile]             = useState<VenueOwnerProfile | null>(null);
  const [events, setEvents]               = useState<VenueEvent[]>([]);
  const [rewards, setRewards]             = useState<VenueReward[]>([]);
  const [announcements, setAnnouncements] = useState<VenueAnnouncement[]>([]);
  const [topVisitors, setTopVisitors]     = useState<Array<{
    rank: number; uid: string; displayName: string;
    photoUrl: string | null; checkinCount: number;
  }>>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [winnerModal, setWinnerModal] = useState(false);

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

  const now = new Date();
  const activeRewards = rewards.filter(
    (r) => r.status === "active" &&
      new Date(r.startDate) <= now &&
      new Date(r.endDate) >= now,
  );
  // Show all published events — past events remain visible so guests can see
  // what the venue has hosted, ordered newest-first by the API.
  const displayEvents = events;

  // Today's hours
  const todayKey      = DAYS[now.getDay()];
  const todayEntry    = profile?.openingHours?.[todayKey];
  const hasTodayEntry = profile?.openingHours != null && todayKey in profile.openingHours;
  const todayLabel    = hasTodayEntry
    ? (todayEntry ? `${todayEntry.open} – ${todayEntry.close}` : "Closed today")
    : null;

  // ── loading / error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: BG }]}>
        <ActivityIndicator color={CORAL} />
      </View>
    );
  }
  if (error || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: BG }]}>
        <Text style={styles.errorText}>Venue not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={[styles.errorBack, { color: CORAL }]}>← Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {/* Warm gradient background */}
          {profile.coverPhotoUrl ? (
            <Image
              source={{ uri: profile.coverPhotoUrl }}
              style={styles.heroCover}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <LinearGradient
              colors={["#73C8A9", "#DEE1B6", "#E1B866"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCover}
            />
          )}

          {/* Bottom fade to page background */}
          <LinearGradient
            colors={["transparent", "rgba(250,250,248,0.65)", BG]}
            locations={[0.45, 0.75, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + 12 }]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backBtnText}>‹</Text>
          </Pressable>

          {/* Identity — bottom of hero */}
          <View style={styles.heroIdentity}>
            {/* Logo */}
            {profile.logoUrl ? (
              <Image
                source={{ uri: profile.logoUrl }}
                style={styles.heroLogo}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <LinearGradient
                colors={["#FDE68A", "#FBBF24"]}
                style={styles.heroLogoFallback}
              >
                <Text style={styles.heroLogoChar}>
                  {profile.businessName.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}

            {/* Name + badges */}
            <View style={styles.heroNameCol}>
              {/* Category + verified pills */}
              <View style={styles.heroPillRow}>
                {profile.isVerified && (
                  <View style={styles.verifiedPill}>
                    <Text style={styles.verifiedPillText}>✓ Verified</Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={styles.heroName}>{profile.businessName}</Text>
              {profile.tagline ? (
                <Text numberOfLines={1} style={styles.heroTagline}>{profile.tagline}</Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <View style={styles.body}>

          {/* About */}
          {profile.description ? (
            <View style={styles.section}>
              <SectionLabel title="About" />
              <Text style={styles.description}>{profile.description}</Text>
            </View>
          ) : null}

          {/* ── 1. Be the Winner ───────────────────────────────────────── */}
          {activeRewards.length > 0 && (
            <View style={styles.section}>
              <SectionLabel title={activeRewards.length === 1 ? "Active Reward" : "Active Rewards"} />
              {activeRewards.map((reward) => (
                <BeTheWinnerCard
                  key={reward.id}
                  reward={reward}
                  onPress={() => setWinnerModal(true)}
                />
              ))}
            </View>
          )}

          {/* ── 2. Announcements ───────────────────────────────────────── */}
          {announcements.length > 0 && (
            <View style={styles.section}>
              <SectionLabel title="Announcements" />
              {announcements.slice(0, 5).map((ann) => (
                <View key={ann.id} style={[styles.annCard, cardShadow]}>
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
                      <Text style={styles.annPinned}>📌 Pinned</Text>
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

          {/* ── 3. Leaderboards ────────────────────────────────────────── */}
          {topVisitors.length > 0 && (
            <View style={styles.section}>
              <SectionLabel title="Leaderboards" />
              <View style={styles.lbGrid}>
                {topVisitors.map((v, i) => (
                  <View key={v.uid} style={[styles.lbCard, cardShadow]}>
                    <Text style={styles.lbMedal}>{["🥇","🥈","🥉"][i]}</Text>
                    {v.photoUrl ? (
                      <Image source={{ uri: v.photoUrl }} style={styles.lbAvatar} accessibilityIgnoresInvertColors />
                    ) : (
                      <LinearGradient
                        colors={AVATAR_GRADIENTS[i] ?? ["#E5E7EB", "#9CA3AF"]}
                        style={styles.lbAvatarFallback}
                      >
                        <Text style={styles.lbAvatarChar}>
                          {v.displayName.slice(0, 2).toUpperCase()}
                        </Text>
                      </LinearGradient>
                    )}
                    <Text numberOfLines={1} style={styles.lbName}>{v.displayName}</Text>
                    <Text style={[styles.lbCount, i === 0 && styles.lbCountGold]}>
                      {v.checkinCount}
                    </Text>
                    <Text style={styles.lbCountLabel}>visits</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Events ─────────────────────────────────────────────────── */}
          {displayEvents.length > 0 && (
            <View style={styles.section}>
              <SectionLabel title="Events" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.hScroll}
                contentContainerStyle={{ paddingRight: 16 }}
              >
                {displayEvents.map((event) => (
                  <VenueEventCard key={event.id} event={event} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Info & Contact ─────────────────────────────────────────── */}
          {(profile.phone || profile.websiteUrl || profile.publicEmail || todayLabel) && (
            <View style={styles.section}>
              <SectionLabel title="Info & Contact" />
              <View style={[styles.infoCard, cardShadow]}>
                {todayLabel && (
                  <View style={[styles.infoRow, { borderTopWidth: 0 }]}>
                    <Text style={styles.infoIcon}>🕐</Text>
                    <Text style={styles.infoText}>
                      {todayEntry
                        ? <><Text style={{ fontFamily: "Inter_600SemiBold" }}>Open today</Text>: {todayLabel}</>
                        : "Closed today"
                      }
                    </Text>
                  </View>
                )}
                {profile.phone && (
                  <Pressable
                    style={styles.infoRow}
                    onPress={() => void Linking.openURL(`tel:${profile.phone}`)}
                    accessibilityRole="link"
                  >
                    <Text style={styles.infoIcon}>📞</Text>
                    <Text style={[styles.infoText, styles.infoLink]}>{profile.phone}</Text>
                  </Pressable>
                )}
                {profile.websiteUrl && (
                  <Pressable
                    style={styles.infoRow}
                    onPress={() => void Linking.openURL(
                      profile.websiteUrl!.startsWith("http") ? profile.websiteUrl! : `https://${profile.websiteUrl}`
                    )}
                    accessibilityRole="link"
                  >
                    <Text style={styles.infoIcon}>🌐</Text>
                    <Text style={[styles.infoText, styles.infoLink]} numberOfLines={1}>
                      {profile.websiteUrl}
                    </Text>
                  </Pressable>
                )}
                {profile.publicEmail && (
                  <Pressable
                    style={styles.infoRow}
                    onPress={() => void Linking.openURL(`mailto:${profile.publicEmail}`)}
                    accessibilityRole="link"
                  >
                    <Text style={styles.infoIcon}>✉️</Text>
                    <Text style={[styles.infoText, styles.infoLink]} numberOfLines={1}>
                      {profile.publicEmail}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

        </View>
      </ScrollView>

      {/* ── How-to-win modal ──────────────────────────────────────────── */}
      {activeRewards[0] && (
        <WinnerModal
          reward={activeRewards[0]}
          visible={winnerModal}
          onClose={() => setWinnerModal(false)}
        />
      )}
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: MUTED, fontSize: 16 },
  errorBack: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: { width: "100%", height: 380, overflow: "hidden" },
  heroCover: { width: "100%", height: 380 },

  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.85)",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  backBtnText: { color: TEXT, fontSize: 24, lineHeight: 30, marginTop: -2 },

  heroIdentity: {
    position: "absolute",
    bottom: 18,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  heroLogo: {
    width: 58, height: 58, borderRadius: 14,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  heroLogoFallback: {
    width: 58, height: 58, borderRadius: 14,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
  },
  heroLogoChar: { fontSize: 24, fontFamily: "Inter_700Bold", color: TEXT },
  heroNameCol:  { flex: 1 },
  heroPillRow:  { flexDirection: "row", gap: 6, marginBottom: 5 },
  verifiedPill: {
    backgroundColor: `${CORAL}18`,
    borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  verifiedPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: CORAL },
  heroName:    { color: TEXT, fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  heroTagline: { color: TEXT2, fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 3 },

  // ── Body ──────────────────────────────────────────────────────────────────
  body:        { paddingHorizontal: 16, paddingTop: 8 },
  section:     { marginBottom: 28 },
  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    color: MUTED, textTransform: "uppercase", letterSpacing: 1.4,
    marginBottom: 12,
  },
  description: {
    fontSize: 15, fontFamily: "Inter_400Regular",
    color: TEXT2, lineHeight: 23,
  },
  hScroll:     { marginHorizontal: -16, paddingLeft: 16 },

  // ── Announcements ─────────────────────────────────────────────────────────
  annCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
    overflow: "hidden",
  },
  annImage:  { width: "100%", height: 130 },
  annBody:   { padding: 14 },
  annPinned: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: CORAL, marginBottom: 4 },
  annTitle:  { fontSize: 16, fontFamily: "Inter_700Bold", color: TEXT, marginBottom: 6 },
  annText:   { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT2, lineHeight: 21, marginBottom: 6 },
  annDate:   { fontSize: 11, fontFamily: "Inter_400Regular", color: MUTED },

  // ── Leaderboards ──────────────────────────────────────────────────────────
  lbGrid:    { flexDirection: "row", gap: 10 },
  lbCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    paddingTop: 18,
    alignItems: "center",
    gap: 3,
  },
  lbMedal:         { position: "absolute", top: -12, fontSize: 24 },
  lbAvatar:        { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "#fff" },
  lbAvatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  lbAvatarChar:    { fontSize: 16, fontFamily: "Inter_700Bold", color: TEXT },
  lbName:          { fontSize: 12, fontFamily: "Inter_600SemiBold", color: TEXT, textAlign: "center", marginTop: 2 },
  lbCount:         { fontSize: 20, fontFamily: "Inter_700Bold", color: MUTED },
  lbCountGold:     { color: "#D97706" },
  lbCountLabel:    { fontSize: 10, fontFamily: "Inter_400Regular", color: MUTED },

  // ── Info & Contact ────────────────────────────────────────────────────────
  infoCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
  },
  infoIcon: { fontSize: 16, width: 24, textAlign: "center" },
  infoText: { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT, flex: 1 },
  infoLink: { color: CORAL, fontFamily: "Inter_500Medium" },
});
