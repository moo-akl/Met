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
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import {
  api,
  type VenueOwnerProfile,
  type VenueEvent,
  type VenueReward,
  type VenueAnnouncement,
} from "@/lib/api/client";
import { SheetHandle } from "@/components/SheetHandle";
import { VenueEventCard } from "@/components/VenueEventCard";
import {
  getQrVerified,
  markQrVerified,
  subscribeQrVerification,
} from "@/lib/qrVerificationState";

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

type RewardStatus = "Active" | "Upcoming" | "Ended";

function getRewardStatus(reward: { status: string; startDate: string; endDate: string }, now: Date): RewardStatus {
  if (reward.status === "completed" || new Date(reward.endDate) < now) return "Ended";
  if (new Date(reward.startDate) > now) return "Upcoming";
  return "Active";
}

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

function SectionLabel({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={10}>
          <Text style={styles.seeAllLink}>See all →</Text>
        </Pressable>
      )}
    </View>
  );
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
        <SheetHandle style={{ marginBottom: 20 }} />

        {/* Prize card — coral accent */}
        <View style={wm.prizeCard}>
          <View style={wm.prizeStripe} />
          <View style={wm.prizeBody}>
            <Text style={wm.prizeIcon}>{icon}</Text>
            <Text style={wm.prizeTitle}>{reward.title}</Text>
            <Text style={wm.prizeDesc}>{reward.prizeDescription}</Text>
            {reward.description ? (
              <Text style={wm.prizeExtra}>{reward.description}</Text>
            ) : null}
            <View style={wm.metaRow}>
              <Text style={wm.prizeCountdown}>⏱ {countdown}</Text>
              <View style={[wm.typePill]}>
                <Text style={wm.typePillText}>
                  {REWARD_ICON[reward.rewardType] ?? "🎁"} {reward.rewardType.replace("_", " ")}
                </Text>
              </View>
            </View>
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
  prizeExtra: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT2,
    lineHeight: 19, marginTop: 4, marginBottom: 6,
  },
  metaRow:  { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 },
  typePill: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, backgroundColor: "#F3F4F6",
  },
  typePillText: {
    fontSize: 11, fontFamily: "Inter_500Medium", color: "#374151",
    textTransform: "capitalize",
  },
  closeBtn:    { backgroundColor: CORAL, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  closeBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
});

// ─── "Be the Winner" card ────────────────────────────────────────────────────

const STATUS_BADGE: Record<RewardStatus, { label: string; bg: string; text: string }> = {
  Active:   { label: "🟢 Active",   bg: "#ECFDF5", text: "#065F46" },
  Upcoming: { label: "🟡 Upcoming", bg: "#FEFCE8", text: "#92400E" },
  Ended:    { label: "⬜ Ended",    bg: "#F3F4F6", text: "#6B7280" },
};

function BeTheWinnerCard({
  reward,
  statusLabel,
  onPress,
}: {
  reward: VenueReward;
  statusLabel: RewardStatus;
  onPress: () => void;
}) {
  const countdown = useCountdown(reward.endDate);
  const icon      = REWARD_ICON[reward.rewardType] ?? "🎁";
  const badge     = STATUS_BADGE[statusLabel];

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
          {/* Status badge */}
          <View style={[bw.statusPill, { backgroundColor: badge.bg }]}>
            <Text style={[bw.statusPillText, { color: badge.text }]}>{badge.label}</Text>
          </View>
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
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 5,
  },
  statusPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

// ─── main screen ─────────────────────────────────────────────────────────────

export default function VenueProfileScreen() {
  const { placeId, qrToken } = useLocalSearchParams<{ placeId: string; qrToken?: string }>();
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
  const [selectedReward, setSelectedReward] = useState<VenueReward | null>(null);
  const [selectedEvent, setSelectedEvent]   = useState<VenueEvent | null>(null);
  const [photoViewerUrl, setPhotoViewerUrl] = useState<string | null>(null);
  const [showEndedRewards, setShowEndedRewards] = useState(false);
  const [myLeaderboardEntry, setMyLeaderboardEntry] = useState<{ rank: number; checkinCount: number } | null>(null);

  // QR verification state — initialised from the in-session module cache so
  // navigating to the venue page after a successful qr-scan shows it unlocked.
  const [isQrVerified, setIsQrVerified] = useState<boolean>(() =>
    placeId ? getQrVerified(placeId) : false,
  );
  // Track whether this is a registered venue (set from the fetched profile).
  const [isRegisteredVenue, setIsRegisteredVenue] = useState(false);
  const qrAutoVerifiedRef = useRef(false);

  // Subscribe to real-time QR verification events (fired from qr-scan.tsx).
  useEffect(() => {
    if (!placeId) return;
    const unsub = subscribeQrVerification((verifiedPlaceId) => {
      if (verifiedPlaceId === placeId) setIsQrVerified(true);
    });
    return unsub;
  }, [placeId]);

  // Re-check the in-session QR state whenever the screen gains focus (e.g.
  // after the user returns from qr-scan.tsx).
  useFocusEffect(
    useCallback(() => {
      if (placeId && getQrVerified(placeId)) {
        setIsQrVerified(true);
      }
    }, [placeId]),
  );

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
      const myEntry = leaderboardData.find((e: { uid: string; rank: number; checkinCount: number }) => e.uid === authedUid);
      setMyLeaderboardEntry(myEntry ? { rank: myEntry.rank, checkinCount: myEntry.checkinCount } : null);
      setTopVisitors(leaderboardData.slice(0, 3));
      // Derive registered venue status from the profile.
      setIsRegisteredVenue(profileData.profile?.isApproved ?? false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [authedUid, placeId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Deep-link path: when the user arrives via /v/[placeId]?t=<token>, the
  // venue redirect screen passes qrToken here. Auto-verify on mount (once).
  useEffect(() => {
    if (!qrToken || !placeId || !authedUid || qrAutoVerifiedRef.current) return;
    qrAutoVerifiedRef.current = true;
    api
      .hubQrVerify({ uid: authedUid }, { placeId, token: qrToken })
      .then(() => {
        markQrVerified(placeId);
        setIsQrVerified(true);
      })
      .catch(() => {
        // Silent — invalid/expired token; user can still scan manually.
      });
  }, [qrToken, placeId, authedUid]);

  const now = new Date();
  // Active / Upcoming shown by default; Ended hidden behind a toggle.
  const endedRewards = rewards.filter((r) => getRewardStatus(r, now) === "Ended");
  const displayRewards = rewards
    .filter((r) => getRewardStatus(r, now) !== "Ended")
    .sort((a, b) => {
      const order: Record<RewardStatus, number> = { Active: 0, Upcoming: 1, Ended: 2 };
      return (order[getRewardStatus(a, now)] ?? 2) - (order[getRewardStatus(b, now)] ?? 2);
    });
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
      {/* Drag handle — visible when presented as a bottom sheet (containedModal) */}
      <SheetHandle style={{ marginTop: 10, marginBottom: 4 }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {/* Warm gradient background */}
          {profile.coverPhotoUrl ? (
            <Pressable
              onPress={() => setPhotoViewerUrl(profile.coverPhotoUrl!)}
              accessibilityRole="imagebutton"
              accessibilityLabel="View cover photo full screen"
            >
              <Image
                source={{ uri: profile.coverPhotoUrl }}
                style={styles.heroCover}
                contentFit="cover"
                transition={200}
              />
            </Pressable>
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
              <Pressable
                onPress={() => setPhotoViewerUrl(profile.logoUrl!)}
                accessibilityRole="imagebutton"
                accessibilityLabel="View logo full screen"
              >
                <Image
                  source={{ uri: profile.logoUrl }}
                  style={styles.heroLogo}
                  contentFit="cover"
                  transition={200}
                />
              </Pressable>
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

          {/* ── Welcome Back Banner ── */}
          {myLeaderboardEntry && myLeaderboardEntry.checkinCount > 0 && (
            <View style={{
              marginBottom: 8,
              padding: 14,
              borderRadius: 12,
              backgroundColor: "#FFF3E0",
              borderWidth: 1,
              borderColor: "#FFD0B0",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}>
              <Text style={{ fontSize: 20 }}>🏠</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#9A4A10" }}>
                  Welcome back!
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#9A4A10", marginTop: 2, lineHeight: 18 }}>
                  {myLeaderboardEntry.checkinCount === 1
                    ? "Your first check-in here — you're on the board 🎉"
                    : `You've checked in ${myLeaderboardEntry.checkinCount} times — you're #${myLeaderboardEntry.rank} here`}
                </Text>
              </View>
            </View>
          )}

          {/* About */}
          {profile.description ? (
            <View style={styles.section}>
              <SectionLabel title="About" />
              <Text style={styles.description}>{profile.description}</Text>
            </View>
          ) : null}

          {/* ── 1. Announcements ───────────────────────────────────────── */}
          {announcements.length > 0 && (
            <View style={styles.section}>
              <SectionLabel title="Announcements" />
              {announcements.slice(0, 5).map((ann) => (
                <View key={ann.id} style={[styles.annCard, cardShadow]}>
                  {"imageUrl" in ann && (ann as { imageUrl?: string | null }).imageUrl ? (
                    <Image
                      source={{ uri: (ann as { imageUrl: string }).imageUrl }}
                      style={styles.annImage}
                      contentFit="cover"
                      transition={200}
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

          {/* ── 2. Rewards ─────────────────────────────────────────────── */}
          {displayRewards.length > 0 && (
            <View style={styles.section}>
              <SectionLabel title={displayRewards.length === 1 ? "Active Reward" : "Active Rewards"} />
              {displayRewards.map((reward) => {
                const rewardStatus = getRewardStatus(reward, now);
                const showLock = isRegisteredVenue && !isQrVerified && rewardStatus === "Active";
                return (
                  <View key={reward.id}>
                    {/* Lock overlay — only shown on Active rewards when QR not yet scanned.
                        The overlay is box-none so taps on the card itself still open
                        the detail modal; only the CTA button navigates to the scanner. */}
                    {showLock ? (
                      <View>
                        <BeTheWinnerCard
                          reward={reward}
                          statusLabel={rewardStatus}
                          onPress={() => setSelectedReward(reward)}
                        />
                        <View
                          style={[styles.rewardLockOverlay]}
                          pointerEvents="box-none"
                        >
                          <Text style={styles.rewardLockIcon}>🔒</Text>
                          <Text style={styles.rewardLockTitle}>
                            Scan QR to Unlock Reward
                          </Text>
                          <Text style={styles.rewardLockSub}>
                            Find the QR code at the entrance and scan it to unlock today's reward.
                          </Text>
                          <Pressable
                            style={styles.rewardLockBtn}
                            onPress={() =>
                              router.push({
                                pathname: "/qr-scan",
                                params: {
                                  placeId: placeId ?? "",
                                  placeName: profile?.businessName ?? "",
                                },
                              } as never)
                            }
                            accessibilityRole="button"
                            accessibilityLabel="Open QR scanner"
                          >
                            <Text style={styles.rewardLockBtnText}>📷 Open Scanner</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <BeTheWinnerCard
                        reward={reward}
                        statusLabel={rewardStatus}
                        onPress={() => setSelectedReward(reward)}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Ended rewards (collapsed by default) ──────────────────── */}
          {endedRewards.length > 0 && (
            <View style={{ marginTop: displayRewards.length > 0 ? 0 : undefined }}>
              <Pressable
                onPress={() => setShowEndedRewards((v) => !v)}
                style={styles.endedToggle}
                accessibilityRole="button"
              >
                <Text style={styles.endedToggleText}>
                  {showEndedRewards ? "▾" : "▸"}{" "}
                  {endedRewards.length} ended reward{endedRewards.length !== 1 ? "s" : ""}
                </Text>
              </Pressable>
              {showEndedRewards && (
                <View style={[styles.section, { marginTop: 8 }]}>
                  {endedRewards.map((reward) => (
                    <BeTheWinnerCard
                      key={reward.id}
                      reward={reward}
                      statusLabel="Ended"
                      onPress={() => setSelectedReward(reward)}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ── 3. Events ──────────────────────────────────────────────── */}
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
                  <VenueEventCard
                    key={event.id}
                    event={event}
                    onPress={() => setSelectedEvent(event)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── 4. Leaderboards ────────────────────────────────────────── */}
          {topVisitors.length > 0 && (
            <View style={styles.section}>
              <SectionLabel
                title="Leaderboards"
                onSeeAll={() => router.push(`/leaderboard/${placeId}`)}
              />
              <View style={styles.lbGrid}>
                {topVisitors.map((v, i) => (
                  <View key={v.uid} style={[styles.lbCard, cardShadow]}>
                    <Text style={styles.lbMedal}>{["🥇","🥈","🥉"][i]}</Text>
                    {v.photoUrl ? (
                      <Image source={{ uri: v.photoUrl }} style={styles.lbAvatar} contentFit="cover" transition={150} />
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
      {selectedReward && (
        <WinnerModal
          reward={selectedReward}
          visible={true}
          onClose={() => setSelectedReward(null)}
        />
      )}

      {/* ── Event detail modal ────────────────────────────────────────── */}
      {selectedEvent && (
        <Modal
          visible
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedEvent(null)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSelectedEvent(null)}
          >
            <Pressable
              style={[styles.eventDetailSheet, { paddingBottom: insets.bottom + 28 }]}
              onPress={() => {/* prevent backdrop dismiss */}}
            >
              {/* drag pill */}
              <View style={styles.eventDetailHandle} />

              {/* hero image */}
              {selectedEvent.imageUrl ? (
                <Image
                  source={{ uri: selectedEvent.imageUrl }}
                  style={styles.eventDetailHero}
                  contentFit="cover"
                />
              ) : (
                <LinearGradient
                  colors={["#73C8A9", "#E1B866"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.eventDetailHero, { alignItems: "center", justifyContent: "center" }]}
                >
                  <Text style={{ fontSize: 52 }}>🎉</Text>
                </LinearGradient>
              )}

              {/* content */}
              <View style={styles.eventDetailBody}>
                <Text style={styles.eventDetailTitle}>{selectedEvent.title}</Text>
                <Text style={styles.eventDetailDate}>
                  {new Date(selectedEvent.startsAt).toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric",
                  })}
                  {"  ·  "}
                  {new Date(selectedEvent.startsAt).toLocaleTimeString("en-US", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </Text>
                {selectedEvent.description ? (
                  <Text style={styles.eventDetailDesc}>{selectedEvent.description}</Text>
                ) : null}
                <View style={styles.eventDetailMeta}>
                  <Text style={styles.eventDetailMetaText}>
                    👥  {selectedEvent.rsvpCount} going
                  </Text>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Full-screen photo viewer ───────────────────────────────────── */}
      <Modal
        visible={photoViewerUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoViewerUrl(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" }}
          onPress={() => setPhotoViewerUrl(null)}
        >
          {photoViewerUrl && (
            <Image
              source={{ uri: photoViewerUrl }}
              style={{ width: "100%", height: "80%" }}
              contentFit="contain"
            />
          )}
          <Text style={{ color: "#fff", opacity: 0.5, marginTop: 16, fontSize: 13 }}>
            Tap anywhere to close
          </Text>
        </Pressable>
      </Modal>
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
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    color: MUTED, textTransform: "uppercase", letterSpacing: 1.4,
  },
  seeAllLink: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: CORAL,
  },
  description: {
    fontSize: 15, fontFamily: "Inter_400Regular",
    color: TEXT2, lineHeight: 23,
  },
  hScroll:     { marginHorizontal: -16, paddingLeft: 16 },

  // ── Event detail modal ────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  eventDetailSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    marginTop: "auto",
  },
  eventDetailHandle: {
    alignSelf: "center",
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    marginTop: 10, marginBottom: 4,
  },
  eventDetailHero: {
    width: "100%",
    height: 180,
  },
  eventDetailBody: {
    padding: 18,
    gap: 8,
  },
  eventDetailTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: TEXT,
    lineHeight: 28,
  },
  eventDetailDate: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: CORAL,
  },
  eventDetailDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: TEXT2,
    lineHeight: 21,
    marginTop: 4,
  },
  eventDetailMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  eventDetailMetaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: MUTED,
  },

  // ── Ended rewards toggle ───────────────────────────────────────────────────
  endedToggle: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginTop: 4,
    marginBottom: 2,
  },
  endedToggleText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: MUTED,
  },

  // ── Reward lock overlay ───────────────────────────────────────────────────
  rewardLockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(250,250,248,0.92)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  rewardLockIcon: { fontSize: 28, marginBottom: 4 },
  rewardLockTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: TEXT,
    textAlign: "center",
  },
  rewardLockSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: TEXT2,
    textAlign: "center",
    lineHeight: 19,
  },
  rewardLockBtn: {
    marginTop: 8,
    backgroundColor: CORAL,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  rewardLockBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },

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
