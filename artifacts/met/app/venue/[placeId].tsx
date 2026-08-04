/**
 * Public Venue Profile Screen — /venue/[placeId]
 *
 * Layout (top → bottom):
 *   1. Immersive hero (320 px cover photo, gradient, identity overlay)
 *   2. Description
 *   3. "Be the Winner" — active reward card (tappable → how-to-win modal)
 *   4. Announcements (with image when present)
 *   5. Leaderboards (top-3 monthly check-ins)
 *   6. Upcoming events
 *   7. Contact info
 *   8. Today's hours (1 line)
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
import { useColors } from "@/hooks/useColors";
import { VenueEventCard } from "@/components/VenueEventCard";

// ─── constants ────────────────────────────────────────────────────────────────

const DAYS = [
  "sunday","monday","tuesday","wednesday","thursday","friday","saturday",
] as const;

const REWARD_ICON: Record<string, string> = {
  free_drink: "🍹",
  discount:   "💸",
  experience: "✨",
  custom:     "🎁",
};

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

// ─── sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon?: string }) {
  return (
    <View style={sh.row}>
      {icon ? <Text style={sh.icon}>{icon}</Text> : null}
      <Text style={sh.label}>{title}</Text>
    </View>
  );
}
const sh = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  icon:  { fontSize: 18 },
  label: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
});

// ── How-to-win modal ─────────────────────────────────────────────────────────

function WinnerModal({
  reward,
  visible,
  onClose,
}: {
  reward: VenueReward;
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const countdown = useCountdown(reward.endDate);
  const icon = REWARD_ICON[reward.rewardType] ?? "🎁";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={wm.backdrop} onPress={onClose} />
      <View style={[wm.sheet, { paddingBottom: insets.bottom + 24 }]}>
        {/* Handle */}
        <View style={wm.handle} />

        {/* Prize */}
        <LinearGradient
          colors={["#7C3AED", "#4F46E5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={wm.prizeCard}
        >
          <Text style={wm.prizeIcon}>{icon}</Text>
          <Text style={wm.prizeTitle}>{reward.title}</Text>
          <Text style={wm.prizeDesc}>{reward.prizeDescription}</Text>
          <View style={wm.countdownRow}>
            <Text style={wm.countdownLabel}>Ends in</Text>
            <Text style={wm.countdown}>{countdown}</Text>
          </View>
        </LinearGradient>

        {/* How to win */}
        <Text style={wm.howTitle}>How to win</Text>

        <View style={wm.stepList}>
          {[
            { n: "1", text: "Check in at this venue as many times as you can this month." },
            { n: "2", text: "Rack up more check-ins than anyone else to claim the #1 spot on the Leaderboard." },
            { n: "3", text: "Stay at the top when the reward ends and the prize is yours!" },
          ].map((s) => (
            <View key={s.n} style={wm.step}>
              <View style={[wm.stepNum, { backgroundColor: colors.primary }]}>
                <Text style={wm.stepNumText}>{s.n}</Text>
              </View>
              <Text style={wm.stepText}>{s.text}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={[wm.closeBtn, { backgroundColor: colors.primary }]}
          onPress={onClose}
          accessibilityRole="button"
        >
          <Text style={wm.closeBtnText}>Got it!</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const wm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: "#18181C",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 20,
  },
  prizeCard:    { borderRadius: 16, padding: 20, marginBottom: 24, alignItems: "center" },
  prizeIcon:    { fontSize: 52, marginBottom: 10 },
  prizeTitle:   { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 6, textAlign: "center" },
  prizeDesc:    { fontSize: 15, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 22 },
  countdownRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  countdownLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  countdown:    { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  howTitle:     { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 16 },
  stepList:     { gap: 14, marginBottom: 28 },
  step:         { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  stepNumText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  stepText:    { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)", lineHeight: 21 },
  closeBtn:    { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  closeBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
});

// ── "Be the Winner" reward card ──────────────────────────────────────────────

function BeTheWinnerCard({
  reward,
  onPress,
}: {
  reward: VenueReward;
  onPress: () => void;
}) {
  const countdown = useCountdown(reward.endDate);
  const icon = REWARD_ICON[reward.rewardType] ?? "🎁";

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="View how to win this reward">
      <LinearGradient
        colors={["#7C3AED", "#4F46E5"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={bw.card}
      >
        <View style={bw.topRow}>
          <Text style={bw.eyebrow}>🏆  Active Reward</Text>
          <Text style={bw.countdown}>{countdown}</Text>
        </View>
        <Text style={bw.icon}>{icon}</Text>
        <Text style={bw.title}>{reward.title}</Text>
        <Text style={bw.prize}>{reward.prizeDescription}</Text>
        <View style={bw.cta}>
          <Text style={bw.ctaText}>Tap to see how to win  →</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const bw = StyleSheet.create({
  card:     { borderRadius: 16, padding: 20 },
  topRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  eyebrow:  { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 0.8 },
  countdown: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  icon:     { fontSize: 44, marginBottom: 8 },
  title:    { fontSize: 21, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 6 },
  prize:    { fontSize: 15, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)", lineHeight: 22, marginBottom: 14 },
  cta:      { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 22, paddingVertical: 8, alignItems: "center" },
  ctaText:  { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
});

// ─── main screen ─────────────────────────────────────────────────────────────

export default function VenueProfileScreen() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { authedUid } = useApp();
  const colors = useColors();
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
  const activeReward = rewards.find(
    (r) => r.status === "active" &&
      new Date(r.startDate) <= now &&
      new Date(r.endDate) >= now,
  ) ?? null;
  const upcomingEvents = events.filter((e) => new Date(e.startsAt) >= now);

  // Today's hours — single line
  const todayKey      = DAYS[now.getDay()];
  const todayEntry    = profile?.openingHours?.[todayKey];
  const hasTodayEntry = profile?.openingHours != null && todayKey in profile.openingHours;
  const todayLabel    = hasTodayEntry
    ? (todayEntry ? `Open today: ${todayEntry.open} – ${todayEntry.close}` : "Closed today")
    : null;

  // ── loading / error ──────────────────────────────────────────────────────────
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

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <View style={styles.heroWrap}>
        {/* Cover photo — explicit dimensions so it always renders */}
        {profile.coverPhotoUrl ? (
          <Image
            source={{ uri: profile.coverPhotoUrl }}
            style={styles.heroCover}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.heroCover, styles.heroCoverFallback]}>
            <Text style={styles.heroCoverEmoji}>🏛️</Text>
          </View>
        )}

        {/* Gradient overlaid on top of image */}
        <LinearGradient
          colors={["transparent", "rgba(15,15,18,0.55)", "#0F0F12"]}
          locations={[0.35, 0.72, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Close button */}
        <Pressable
          onPress={() => router.back()}
          style={[styles.closeBtn, { top: insets.top + 12 }]}
          hitSlop={10}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>

        {/* Identity row — bottom of hero */}
        <View style={styles.heroIdentity}>
          {profile.logoUrl ? (
            <Image
              source={{ uri: profile.logoUrl }}
              style={styles.heroLogo}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={styles.heroLogoFallback}>
              <Text style={styles.heroLogoChar}>
                {profile.businessName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.heroNameCol}>
            <View style={styles.heroNameRow}>
              <Text numberOfLines={1} style={styles.heroName}>
                {profile.businessName}
              </Text>
              {profile.isVerified && (
                <View
                  style={[
                    styles.verifiedBadge,
                    { backgroundColor: colors.primary + "25", borderColor: colors.primary + "70" },
                  ]}
                >
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

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        {profile.description ? (
          <View style={styles.section}>
            <Text style={styles.description}>{profile.description}</Text>
          </View>
        ) : null}

        {/* ── 1. Be the Winner ─────────────────────────────────────────────── */}
        {activeReward && (
          <View style={styles.section}>
            <SectionHeader title="Be the Winner" icon="🏆" />
            <BeTheWinnerCard reward={activeReward} onPress={() => setWinnerModal(true)} />
          </View>
        )}

        {/* ── 2. Announcements ─────────────────────────────────────────────── */}
        {announcements.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Announcements" icon="📢" />
            {announcements.slice(0, 5).map((ann) => (
              <View
                key={ann.id}
                style={[styles.annCard, { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.07)" }]}
              >
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

        {/* ── 3. Leaderboards ──────────────────────────────────────────────── */}
        {topVisitors.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Leaderboards" icon="🏅" />
            <View style={styles.lbRow}>
              {topVisitors.map((v, i) => (
                <View
                  key={v.uid}
                  style={[
                    styles.lbCard,
                    {
                      backgroundColor: "#1A1A1E",
                      borderColor: i === 0 ? "#FFD70040" : "rgba(255,255,255,0.06)",
                    },
                  ]}
                >
                  <Text style={styles.lbMedal}>{["🥇", "🥈", "🥉"][i]}</Text>
                  {v.photoUrl ? (
                    <Image
                      source={{ uri: v.photoUrl }}
                      style={styles.lbAvatar}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View style={[styles.lbAvatar, styles.lbAvatarFallback]}>
                      <Text style={styles.lbAvatarChar}>
                        {v.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text numberOfLines={1} style={styles.lbName}>{v.displayName}</Text>
                  <Text style={[styles.lbCount, { color: i === 0 ? "#FFD700" : "rgba(255,255,255,0.4)" }]}>
                    {v.checkinCount}
                  </Text>
                  <Text style={styles.lbCountLabel}>check-ins</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Upcoming Events ───────────────────────────────────────────────── */}
        {upcomingEvents.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Upcoming Events" icon="🎉" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hScroll}>
              {upcomingEvents.map((event) => (
                <VenueEventCard key={event.id} event={event} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Contact ──────────────────────────────────────────────────────── */}
        {(profile.phone || profile.websiteUrl || profile.publicEmail) && (
          <View style={styles.section}>
            <SectionHeader title="Contact" icon="📬" />
            <View style={[styles.contactCard, { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.07)" }]}>
              {profile.phone && (
                <Pressable
                  style={styles.contactRow}
                  onPress={() => void Linking.openURL(`tel:${profile.phone}`)}
                  accessibilityRole="link"
                >
                  <Text style={styles.contactIcon}>📞</Text>
                  <Text style={[styles.contactLink, { color: colors.primary }]}>{profile.phone}</Text>
                </Pressable>
              )}
              {profile.websiteUrl && (
                <Pressable
                  style={styles.contactRow}
                  onPress={() =>
                    void Linking.openURL(
                      profile.websiteUrl!.startsWith("http")
                        ? profile.websiteUrl!
                        : `https://${profile.websiteUrl}`,
                    )
                  }
                  accessibilityRole="link"
                >
                  <Text style={styles.contactIcon}>🌐</Text>
                  <Text style={[styles.contactLink, { color: colors.primary }]} numberOfLines={1}>
                    {profile.websiteUrl}
                  </Text>
                </Pressable>
              )}
              {profile.publicEmail && (
                <Pressable
                  style={styles.contactRow}
                  onPress={() => void Linking.openURL(`mailto:${profile.publicEmail}`)}
                  accessibilityRole="link"
                >
                  <Text style={styles.contactIcon}>✉️</Text>
                  <Text style={[styles.contactLink, { color: colors.primary }]} numberOfLines={1}>
                    {profile.publicEmail}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── Today's hours ─────────────────────────────────────────────────── */}
        {todayLabel && (
          <View style={styles.hoursLine}>
            <Text style={styles.hoursIcon}>🕐</Text>
            <Text
              style={[
                styles.hoursText,
                { color: todayEntry ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.35)" },
              ]}
            >
              {todayLabel}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── How-to-win modal ─────────────────────────────────────────────── */}
      {activeReward && (
        <WinnerModal
          reward={activeReward}
          visible={winnerModal}
          onClose={() => setWinnerModal(false)}
        />
      )}
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:      { flex: 1 },
  center:    { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "rgba(255,255,255,0.5)", fontSize: 16 },
  retryBtn:  { marginTop: 12 },
  retryText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // Hero — image rendered as first child so it has proper dimensions,
  // gradient and overlays are absolutely positioned on top.
  heroWrap: { width: "100%", height: 320, overflow: "hidden" },
  heroCover: { width: "100%", height: 320 },
  heroCoverFallback: { backgroundColor: "#1A1A1E", alignItems: "center", justifyContent: "center" },
  heroCoverEmoji: { fontSize: 64 },

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
  heroLogo: {
    width: 60, height: 60, borderRadius: 14,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.2)",
  },
  heroLogoFallback: {
    width: 60, height: 60, borderRadius: 14,
    backgroundColor: "#2C2C2E",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  heroLogoChar: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#fff" },
  heroNameCol:  { flex: 1 },
  heroNameRow:  { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  heroName: {
    color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold",
    flexShrink: 1,
    textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4,
  },
  verifiedBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  verifiedText:  { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  heroTagline: {
    color: "rgba(255,255,255,0.65)", fontSize: 13,
    fontFamily: "Inter_400Regular", marginTop: 3,
  },

  // Scroll
  scroll:   { flex: 1 },
  section:  { paddingHorizontal: 16, marginBottom: 28 },
  hScroll:  { marginHorizontal: -16, paddingHorizontal: 16 },

  description: {
    color: "rgba(255,255,255,0.7)", fontSize: 14,
    fontFamily: "Inter_400Regular", lineHeight: 22, marginTop: 16,
  },

  // Announcements
  annCard:   { borderRadius: 12, borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  annImage:  { width: "100%", height: 130 },
  annBody:   { padding: 14 },
  annPinned: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  annTitle:  { color: "rgba(255,255,255,0.92)", fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  annText:   { color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 6 },
  annDate:   { color: "rgba(255,255,255,0.3)", fontSize: 11, fontFamily: "Inter_400Regular" },

  // Leaderboards
  lbRow:  { flexDirection: "row", gap: 10 },
  lbCard: {
    flex: 1, borderRadius: 14, borderWidth: 1,
    padding: 12, alignItems: "center", gap: 4,
  },
  lbMedal:        { fontSize: 22 },
  lbAvatar:       { width: 44, height: 44, borderRadius: 22 },
  lbAvatarFallback: { backgroundColor: "#2C2C2E", alignItems: "center", justifyContent: "center" },
  lbAvatarChar:   { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  lbName:         { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)", textAlign: "center" },
  lbCount:        { fontSize: 18, fontFamily: "Inter_700Bold" },
  lbCountLabel:   { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.35)" },

  // Contact
  contactCard: { borderRadius: 12, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 14 },
  contactRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 11, gap: 10 },
  contactIcon: { fontSize: 16, width: 22, textAlign: "center" },
  contactLink: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },

  // Today's hours
  hoursLine: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  hoursIcon: { fontSize: 14 },
  hoursText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
