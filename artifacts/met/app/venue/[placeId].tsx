/**
 * Public Venue Profile Screen — /venue/[placeId]
 *
 * Canopy × Apple: logo-green actions, warm paper, a photographic place header,
 * and Today / Gather / Guestbook tabs. Existing verification and write guards
 * remain authoritative; visual navigation never proves physical presence.
 *
 * Layout (top → bottom, single scroll):
 *   1. Immersive hero (warm gradient, identity overlaid, dark text)
 *   2. About / description
 *   3. "Be the Winner" reward card (warm paper + forest accent)
 *   4. Announcements
 *   5. Visitors (a snapshot of the local community)
 *   6. Upcoming events (horizontal scroll)
 *   7. Info & Contact (unified white card)
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import themeColors from "@/constants/colors";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  api,
  type VenueOwnerProfile,
  type VenueEvent,
  type VenueReward,
  type VenueAnnouncement,
} from "@/lib/api/client";
import { SheetHandle } from "@/components/SheetHandle";
import { VenueEventCard } from "@/components/VenueEventCard";
import { VenueGuestbook } from "@/components/VenueGuestbook";
import { SavePlaceButton } from "@/components/SavePlaceButton";
import {
  getQrVerified,
  markQrVerified,
  subscribeQrVerification,
} from "@/lib/qrVerificationState";
import {
  isStoreScreenshotDemo,
  STORE_DEMO_ANNOUNCEMENTS,
  STORE_DEMO_EVENTS,
  STORE_DEMO_LEADERBOARD,
  STORE_DEMO_PLACE_ID,
  STORE_DEMO_PROFILE,
  STORE_DEMO_REWARDS,
  STORE_DEMO_REVIEWS,
} from "@/lib/storeVenueDemo";

// ─── constants ────────────────────────────────────────────────────────────────

// Keep reward/review components on the same semantic palette as the place page.
const CORAL = themeColors.light.brandPanel;
const BG = themeColors.light.background;
const TEXT = themeColors.light.text;
const TEXT2 = "#526557";
const MUTED = themeColors.light.mutedForeground;
const CARD = themeColors.light.card;
const BORDER = themeColors.light.border;
const DIVIDER = themeColors.light.border;

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

/** Returns a short relative-time string, e.g. "2h ago", "3d ago", "just now". */
function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60_000)  return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

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
  const { isDark } = useTheme();
  return (
    <View style={styles.sectionLabelRow}>
      <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={10}>
          <Text style={[styles.seeAllLink, isDark && styles.darkAccentText]}>See all →</Text>
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
  const { isDark } = useTheme();
  const countdown = useCountdown(reward.endDate);
  const icon     = REWARD_ICON[reward.rewardType] ?? "🎁";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={wm.backdrop} onPress={onClose} />
      <View style={[wm.sheet, isDark && wm.darkSheet, { paddingBottom: insets.bottom + 24 }]}>
        <SheetHandle style={{ marginBottom: 20 }} />

        {/* Prize card — soft canopy wash */}
        <View style={[wm.prizeCard, isDark && wm.darkPrizeCard]}>
          <View style={wm.prizeBody}>
            <Text style={wm.prizeIcon}>{icon}</Text>
            <Text style={[wm.prizeTitle, isDark && wm.darkTitle]}>{reward.title}</Text>
            <Text style={[wm.prizeDesc, isDark && wm.darkBody]}>{reward.prizeDescription}</Text>
            {reward.description ? (
              <Text style={[wm.prizeExtra, isDark && wm.darkBody]}>{reward.description}</Text>
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

        <Text style={[wm.howTitle, isDark && wm.darkTitle]}>How to win</Text>
        <View style={wm.steps}>
          {[
            "Check in at this venue as many times as you can this month.",
            "Rack up more check-ins than anyone else to reach #1 among this venue’s Visitors.",
            "Stay at the top when the reward ends and the prize is yours!",
          ].map((text, i) => (
            <View key={i} style={wm.step}>
              <View style={wm.stepNum}><Text style={wm.stepNumText}>{i + 1}</Text></View>
              <Text style={[wm.stepText, isDark && wm.darkBody]}>{text}</Text>
            </View>
          ))}
        </View>

        <Pressable style={[wm.closeBtn, isDark && { backgroundColor: "#3DCC44" }]} onPress={onClose} accessibilityRole="button">
          <Text style={[wm.closeBtnText, isDark && { color: "#19351F" }]}>Got it!</Text>
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
  darkSheet: { backgroundColor: themeColors.dark.card },
  prizeCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCE9D7",
    overflow: "hidden",
    marginBottom: 24,
    backgroundColor: "#F3F7EF",
    ...cardShadow,
  },
  darkPrizeCard: { backgroundColor: themeColors.dark.card, borderColor: themeColors.dark.border },
  darkTitle: { color: themeColors.dark.text },
  darkBody: { color: themeColors.dark.mutedForeground },
  prizeBody:   { padding: 18 },
  prizeIcon:   { fontSize: 34, marginBottom: 8 },
  prizeTitle:  { fontSize: 18, fontFamily: "Inter_700Bold", color: TEXT, marginBottom: 4 },
  prizeDesc:   { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT2, lineHeight: 21, marginBottom: 8 },
  prizeCountdown: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#276A34" },
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
    borderRadius: 999, backgroundColor: "#E4EDE0",
  },
  typePillText: {
    fontSize: 11, fontFamily: "Inter_500Medium", color: "#35563A",
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
  const { isDark } = useTheme();
  const countdown = useCountdown(reward.endDate);
  const icon      = REWARD_ICON[reward.rewardType] ?? "🎁";
  const badge     = STATUS_BADGE[statusLabel];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        bw.card,
        isDark && bw.darkCard,
        pressed && bw.pressed,
        cardShadow,
      ]}
      accessibilityRole="button"
      accessibilityLabel="View how to win this reward"
    >
      <View style={bw.body}>
        <View style={bw.topRow}>
          <View style={[bw.iconCircle, isDark && bw.iconCircleDark]}>
            <Text style={bw.iconEmoji}>{icon}</Text>
          </View>
          <View style={[bw.statusPill, { backgroundColor: badge.bg }]}>
            <Text style={[bw.statusPillText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>
        <Text style={[bw.title, isDark && bw.darkTitle]}>{reward.title}</Text>
        <Text numberOfLines={2} style={[bw.prize, isDark && bw.darkBody]}>{reward.prizeDescription}</Text>
        <View style={[bw.footer, isDark && bw.footerDark]}>
          <Text style={[bw.countdown, isDark && bw.countdownDark]}>◷  {countdown}</Text>
          <View style={bw.actionHint}>
            <Text style={[bw.actionHintText, isDark && bw.countdownDark]}>How to win</Text>
            <Text style={[bw.chevron, isDark && { color: themeColors.dark.mutedForeground }]}>›</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const bw = StyleSheet.create({
  card: {
    backgroundColor: "#F3F7EF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCE9D7",
    overflow: "hidden",
  },
  darkCard: { backgroundColor: themeColors.dark.card, borderColor: themeColors.dark.border },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  body: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconCircle: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: "#E2EFDC",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  iconCircleDark: { backgroundColor: "#193C24" },
  iconEmoji: { fontSize: 22 },
  title:     { fontSize: 17, fontFamily: "Inter_700Bold", color: TEXT, marginTop: 2, letterSpacing: -0.3 },
  darkTitle: { color: themeColors.dark.text },
  prize:     { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT2, lineHeight: 19 },
  darkBody: { color: themeColors.dark.mutedForeground },
  footer: {
    marginTop: 4,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: "#DCE9D7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerDark: { borderTopColor: themeColors.dark.border },
  countdown: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#276A34" },
  countdownDark: { color: "#8FD995" },
  actionHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionHintText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#276A34" },
  chevron:   { fontSize: 21, color: "#276A34", lineHeight: 22 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

// ─── main screen ─────────────────────────────────────────────────────────────

export default function VenueProfileScreen() {
  const { placeId, qrToken } = useLocalSearchParams<{ placeId: string; qrToken?: string }>();
  const { authedUid } = useApp();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isScreenshotDemoVenue =
    isStoreScreenshotDemo("venue") && placeId === STORE_DEMO_PLACE_ID;
  const isBrightDemo = isScreenshotDemoVenue && !isDark;

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
  const [activeTab, setActiveTab] = useState<"today" | "gather" | "guestbook">("today");

  // ── Content reporting (Apple §5.1.2) ────────────────────────────────────
  const showContentReportSheet = (
    entityType: "event" | "announcement" | "venue",
    entityId: number,
    targetPlaceId: string,
  ) => {
    if (isScreenshotDemoVenue) {
      Alert.alert("Sample venue", "This is an illustrative preview. No live venue content is shown.");
      return;
    }
    if (!authedUid) return;
    Alert.alert(
      "Report Content",
      "Why are you reporting this?",
      [
        { text: "Inappropriate", onPress: () => submitContentReport(entityType, entityId, targetPlaceId, "inappropriate") },
        { text: "Offensive image", onPress: () => submitContentReport(entityType, entityId, targetPlaceId, "offensive_image") },
        { text: "Spam", onPress: () => submitContentReport(entityType, entityId, targetPlaceId, "spam") },
        { text: "Harassment", onPress: () => submitContentReport(entityType, entityId, targetPlaceId, "harassment") },
        { text: "Other", onPress: () => submitContentReport(entityType, entityId, targetPlaceId, "other") },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const submitContentReport = async (
    entityType: "event" | "announcement" | "venue",
    entityId: number,
    targetPlaceId: string,
    reason: "inappropriate" | "harassment" | "spam" | "offensive_image" | "other",
  ) => {
    if (isScreenshotDemoVenue) return;
    if (!authedUid) return;
    try {
      await api.reportVenueContent(
        { uid: authedUid },
        { entityType, entityId, placeId: targetPlaceId, reason },
      );
      Alert.alert("Thanks", "Your report has been submitted. We review all flagged content within 24 hours.");
    } catch {
      Alert.alert("Couldn't submit report", "Please try again in a moment.");
    }
  };

  // ── Venue review state ───────────────────────────────────────────────────
  const [myReview, setMyReview]           = useState<{ starRating: number; comment: string | null } | null>(null);
  const [reviewStars, setReviewStars]     = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // ── Guest reviews (public) ───────────────────────────────────────────────
  const [venueReviews, setVenueReviews]       = useState<import("@/lib/api/client").VenueReview[]>([]);
  const [averageRating, setAverageRating]     = useState<number | null>(null);
  const [totalReviewCount, setTotalReviewCount] = useState(0);
  const [reviewsLoading, setReviewsLoading]   = useState(false);
  /** True when the most-recent filter fetch failed (shows retry UI). */
  const [reviewsError, setReviewsError]       = useState(false);
  /** Incremented on every filter change; lets the effect detect stale responses. */
  const reviewFetchGenRef                     = useRef(0);
  /** Incrementing this triggers a manual retry of the current filter. */
  const [reviewRetryKey, setReviewRetryKey]   = useState(0);
  /** Client-side sort order for the displayed reviews. */
  const [reviewSort, setReviewSort] = useState<"recent" | "highest" | "lowest">("recent");

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

  // Pre-populate the review form whenever the user proves presence via QR.
  useEffect(() => {
    if (isScreenshotDemoVenue || !isQrVerified || !authedUid || !placeId) return;
    api
      .getMyVenueReview({ uid: authedUid }, placeId)
      .then(({ review }) => {
        if (review) {
          setMyReview({ starRating: review.starRating, comment: review.comment });
          setReviewStars(review.starRating);
          setReviewComment(review.comment ?? "");
        }
      })
      .catch(() => { /* non-critical — form just starts empty */ });
  }, [isScreenshotDemoVenue, isQrVerified, authedUid, placeId]);

  const handleSubmitReview = useCallback(async () => {
    if (isScreenshotDemoVenue || !authedUid || !placeId || reviewStars === 0 || reviewSubmitting) return;
    setReviewSubmitting(true);
    try {
      const { review } = await api.submitVenueReview(
        { uid: authedUid },
        { placeId, starRating: reviewStars, comment: reviewComment.trim() || null },
      );
      setMyReview({ starRating: review.starRating, comment: review.comment });
      setReviewStars(0);   // collapse form back to summary row
      setReviewComment(""); // clear text field
      Alert.alert("Thanks!", "Your review has been saved.");
    } catch {
      Alert.alert("Couldn't save", "Please try again.");
    } finally {
      setReviewSubmitting(false);
    }
  }, [authedUid, placeId, reviewStars, reviewComment, reviewSubmitting, isScreenshotDemoVenue]);

  const fetchAll = useCallback(async () => {
    if (isScreenshotDemoVenue) {
      setLoading(true);
      setError(false);
      setProfile(STORE_DEMO_PROFILE);
      setEvents(STORE_DEMO_EVENTS);
      setRewards(STORE_DEMO_REWARDS);
      setAnnouncements(STORE_DEMO_ANNOUNCEMENTS);
      setTopVisitors(
        STORE_DEMO_LEADERBOARD.slice(0, 3).map((entry) => ({
          rank: entry.rank,
          uid: entry.uid,
          displayName: entry.displayName,
          photoUrl: entry.photoUrl,
          checkinCount: entry.checkinCount,
        })),
      );
      setMyLeaderboardEntry({ rank: 3, checkinCount: 7 });
      setVenueReviews(STORE_DEMO_REVIEWS);
      setAverageRating(4.9);
      setTotalReviewCount(128);
      setIsRegisteredVenue(true);
      setLoading(false);
      return;
    }
    if (!authedUid || !placeId) return;
    setLoading(true);
    setError(false);
    const opts = { uid: authedUid };
    // Secondary sections start immediately and fill in progressively; they
    // never hold the page behind the loading state.
    api.getVenueEvents(opts, placeId).then((d) => setEvents(d.events)).catch(() => {});
    api.getVenueRewards(opts, placeId).then((d) => setRewards(d.rewards)).catch(() => {});
    api
      .getVenueAnnouncements(opts, placeId)
      .then((d) => setAnnouncements(d.announcements))
      .catch(() => {});
    api
      .getLeaderboard(opts, placeId, "current_month")
      .then((leaderboardData) => {
        const myEntry = leaderboardData.find(
          (e: { uid: string; rank: number; checkinCount: number }) => e.uid === authedUid,
        );
        setMyLeaderboardEntry(myEntry ? { rank: myEntry.rank, checkinCount: myEntry.checkinCount } : null);
        setTopVisitors(leaderboardData.slice(0, 3));
      })
      .catch(() => {});
    // Primary: the page renders as soon as the venue profile resolves.
    // (Reviews are loaded by the dedicated reviews effect below.)
    try {
      const profileData = await api.getVenueOwnerProfile(opts, placeId);
      setProfile(profileData.profile);
      setIsRegisteredVenue(profileData.profile?.isApproved ?? false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [authedUid, isScreenshotDemoVenue, placeId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Re-fetch the reviews list whenever the star-rating filter changes.
  // Uses an AbortController so the previous in-flight request is cancelled
  // when a new filter is selected, and a generation counter so a response
  // that arrives after a later request has already started is discarded.
  useEffect(() => {
    if (isScreenshotDemoVenue) {
      setVenueReviews(STORE_DEMO_REVIEWS);
      setAverageRating(4.9);
      setTotalReviewCount(128);
      setReviewsLoading(false);
      setReviewsError(false);
      return;
    }
    if (!authedUid || !placeId) return;
    const gen = ++reviewFetchGenRef.current;
    const controller = new AbortController();
    setReviewsLoading(true);
    setReviewsError(false);
    api
      .getVenueReviews(
        { uid: authedUid, signal: controller.signal },
        placeId,
        undefined,
      )
      .then((data) => {
        // Discard the response if a newer request has already started.
        if (gen !== reviewFetchGenRef.current) return;
        setVenueReviews(data.reviews.slice(0, 20));
        // Always keep venue-wide aggregates (ratingCounts, total, average).
        setAverageRating(data.averageRating);
        setTotalReviewCount(data.total);
      })
      .catch((err: unknown) => {
        if (gen !== reviewFetchGenRef.current) return;
        // Don't show an error for intentional aborts (user changed filter quickly).
        if (err instanceof Error && err.name === "AbortError") return;
        setReviewsError(true);
        setVenueReviews([]);
      })
      .finally(() => {
        if (gen === reviewFetchGenRef.current) setReviewsLoading(false);
      });
    return () => { controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewRetryKey, authedUid, isScreenshotDemoVenue, placeId]);

  // Deep-link path: when the user arrives via /v/[placeId]?t=<token>, the
  // venue redirect screen passes qrToken here. Auto-verify on mount (once).
  useEffect(() => {
    if (isScreenshotDemoVenue || !qrToken || !placeId || !authedUid || qrAutoVerifiedRef.current) return;
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
  }, [qrToken, placeId, authedUid, isScreenshotDemoVenue]);

  // Back with a Home fallback: QR / deep-link entries may have no history.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const openCheckin = () => {
    if (!profile || !placeId) return;
    router.push({
      pathname: "/qr-scan",
      params: {
        placeId,
        placeName: profile.businessName,
        ...(isScreenshotDemoVenue ? { demo: "1", storeDemo: "checkin" } : {}),
      },
    } as never);
  };

  const openDirections = async () => {
    if (!profile) return;
    if (isScreenshotDemoVenue) {
      Alert.alert("Sample venue", "Directions are available for real venues. This is an illustrative sample.");
      return;
    }
    const lat = Number(profile.lat);
    const lng = Number(profile.lng);
    const hasCoordinates = profile.lat != null && profile.lng != null && Number.isFinite(lat) && Number.isFinite(lng);
    const destination = hasCoordinates ? `${lat},${lng}` : profile.placeName || profile.businessName;
    try {
      await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&destination_place_id=${encodeURIComponent(placeId ?? "")}`);
    } catch {
      Alert.alert("Couldn't open directions", "Please try again or open your maps app.");
    }
  };

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
        <Pressable onPress={goBack} style={{ marginTop: 16 }} accessibilityRole="button">
          <Text style={[styles.errorBack, { color: CORAL }]}>Back</Text>
        </Pressable>
      </View>
    );
  }
  if (error || !profile) {
    return (
      <View style={[styles.center, { backgroundColor: BG }]}>
        <Text style={styles.errorText}>Venue not found</Text>
        <Pressable onPress={() => void fetchAll()} style={{ marginTop: 12 }} accessibilityRole="button">
          <Text style={[styles.errorBack, { color: CORAL }]}>Try again</Text>
        </Pressable>
        <Pressable onPress={goBack} style={{ marginTop: 12 }}>
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
      <View style={[canopyVenue.header, { paddingTop: insets.top + 2 }]}>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={canopyVenue.iconButton}><Feather name="arrow-left" size={22} color={TEXT} /></Pressable>
        <Text style={canopyVenue.headerLabel}>{isScreenshotDemoVenue ? "SAMPLE PLACE" : "A PLACE TO CONNECT"}</Text>
        <SavePlaceButton placeId={placeId} placeName={profile?.businessName} disabled={isScreenshotDemoVenue} />
        <Pressable onPress={() => showContentReportSheet("venue", 0, placeId ?? "")} accessibilityRole="button" accessibilityLabel="Report this venue" style={canopyVenue.iconButton}><Feather name="more-horizontal" size={22} color={TEXT} /></Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {/* Warm gradient background */}
          {isScreenshotDemoVenue ? (
            <LinearGradient
              colors={isBrightDemo ? ["#D6E9D9", "#F5E5BC", "#DF9B78"] : ["#A8D8C8", "#E6D5A4", "#DE9A65"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCover}
            >
              <Svg
                viewBox="0 0 360 286"
                preserveAspectRatio="xMidYMid slice"
                style={StyleSheet.absoluteFillObject}
                accessibilityLabel="Illustration of a sample neighborhood café"
              >
                <Circle cx="292" cy="43" r="24" fill="#FFF4CD" opacity=".6" />
                <Path d="M0 177C37 153 71 160 108 177v109H0Z" fill="#617C5B" />
                <Path d="M0 189c30-31 48-53 60-83M21 168c-8-18-18-27-30-33m43 4c8-18 18-29 30-35m-37 70c17-8 30-8 44-4" fill="none" stroke="#395846" strokeWidth="8" strokeLinecap="round" />
                <Circle cx="20" cy="118" r="23" fill="#6F9364" />
                <Circle cx="58" cy="91" r="25" fill="#78996A" />
                <Circle cx="76" cy="145" r="21" fill="#527650" />
                <Path d="M0 225c67-28 123-15 188 12l-17 49H0Z" fill="#C5A875" />
                <Rect x="105" y="82" width="244" height="148" rx="5" fill="#B96243" />
                <Path d="m95 88 24-27h217l20 27Z" fill="#754337" />
                <Rect x="119" y="103" width="214" height="14" rx="3" fill="#D78A5E" />
                <Rect x="128" y="126" width="84" height="77" rx="3" fill="#223A3B" />
                <Rect x="134" y="132" width="72" height="64" rx="2" fill="#E4AE68" />
                <Rect x="137" y="136" width="66" height="55" fill="#75523E" />
                <Path d="M170 136v55M137 161h66" stroke="#253D3A" strokeWidth="4" />
                <Rect x="225" y="126" width="91" height="104" rx="3" fill="#21383A" />
                <Rect x="231" y="132" width="79" height="92" rx="2" fill="#D8995B" />
                <Rect x="263" y="132" width="5" height="92" fill="#283D3A" />
                <Circle cx="258" cy="183" r="3" fill="#F7E2A8" />
                <Path d="M110 121h230" stroke="#F0C17A" strokeWidth="4" />
                <Circle cx="135" cy="119" r="3.5" fill="#FFE6A6" />
                <Circle cx="160" cy="119" r="3.5" fill="#FFE6A6" />
                <Circle cx="185" cy="119" r="3.5" fill="#FFE6A6" />
                <Circle cx="210" cy="119" r="3.5" fill="#FFE6A6" />
                <Circle cx="235" cy="119" r="3.5" fill="#FFE6A6" />
                <Circle cx="260" cy="119" r="3.5" fill="#FFE6A6" />
                <Circle cx="285" cy="119" r="3.5" fill="#FFE6A6" />
                <Rect x="286" y="230" width="11" height="30" rx="3" fill="#544539" />
                <Circle cx="292" cy="223" r="19" fill="#476A4E" />
                <Circle cx="331" cy="241" r="23" fill="#57764F" />
                <Path d="M0 267c92-31 177-24 267 19H0Z" fill="#45624A" opacity=".9" />
              </Svg>
              <View style={styles.illustrationBadge}>
                <Text style={styles.illustrationBadgeText}>ILLUSTRATIVE SAMPLE VENUE</Text>
              </View>
            </LinearGradient>
          ) : profile.coverPhotoUrl ? (
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
            colors={["transparent", "rgba(20,40,24,0.3)", "rgba(20,40,24,0.86)"]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

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
                {isScreenshotDemoVenue && (
                  <View style={styles.verifiedPill}>
                    <Text style={styles.verifiedPillText}>Sample venue</Text>
                  </View>
                )}
                {profile.isVerified && (
                  <View style={styles.verifiedPill}>
                    <Text style={styles.verifiedPillText}>✓ Verified</Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={2} style={styles.heroName}>{profile.businessName}</Text>
              {profile.tagline ? (
                <Text numberOfLines={1} style={styles.heroTagline}>{profile.tagline}</Text>
              ) : null}
              {averageRating !== null && totalReviewCount > 0 && (
                <Text style={styles.heroRating}>
                  {"★".repeat(Math.round(averageRating))}{"☆".repeat(5 - Math.round(averageRating))}
                  {"  "}{averageRating.toFixed(1)} ({totalReviewCount} {totalReviewCount === 1 ? "review" : "reviews"})
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <View style={styles.body}>
          <View style={canopyVenue.statusRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
              <Feather name="clock" size={13} color={CORAL} />
              <Text style={canopyVenue.statusText}>{todayLabel ? (todayEntry ? `Today · ${todayLabel}` : "Closed today") : "A place in your community"}</Text>
            </View>
            {isQrVerified && <View style={canopyVenue.verified}><Feather name="check-circle" size={12} color={CORAL} /><Text style={canopyVenue.verifiedText}>Visit verified</Text></View>}
          </View>
          <View style={canopyVenue.actions}>
            <Pressable testID="venue-checkin" accessibilityRole="button" onPress={openCheckin} style={({ pressed }) => [canopyVenue.primaryButton, pressed && { opacity: 0.8 }]}>
              <Feather name="maximize" size={18} color={TEXT} /><Text style={canopyVenue.primaryButtonText}>Check in here</Text>
            </Pressable>
            <Pressable testID="venue-directions" accessibilityRole="button" onPress={() => void openDirections()} style={({ pressed }) => [canopyVenue.directionsButton, pressed && { opacity: 0.8 }]}>
              <Feather name="navigation" size={17} color={TEXT} /><Text style={canopyVenue.directionsText}>Directions</Text>
            </Pressable>
          </View>
          <View accessibilityRole="tablist" style={canopyVenue.tabs}>
            {(["today", "gather", "guestbook"] as const).map((tab) => (
              <Pressable key={tab} testID={`venue-tab-${tab}`} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }} onPress={() => setActiveTab(tab)} style={[canopyVenue.tab, activeTab === tab && canopyVenue.tabActive]}>
                <Text style={[canopyVenue.tabText, activeTab === tab && canopyVenue.tabTextActive]}>{tab === "today" ? "Today" : tab === "gather" ? "Gather" : "Guestbook"}</Text>
              </Pressable>
            ))}
          </View>
          {activeTab === "gather" && displayEvents.length === 0 && <View style={canopyVenue.empty}><Feather name="calendar" size={25} color={MUTED} /><Text style={canopyVenue.emptyTitle}>No gatherings announced yet</Text><Text style={canopyVenue.emptyText}>Check back for events from this venue.</Text></View>}

          {/* ── Welcome Back Banner ── */}
          {activeTab === "today" && myLeaderboardEntry && myLeaderboardEntry.checkinCount > 0 && (
            <View style={[{
              marginBottom: 8,
              padding: 14,
              borderRadius: 12,
              backgroundColor: themeColors.light.brandPanel,
              borderWidth: 1,
              borderColor: themeColors.light.brandPanel,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }]}>
              <Feather name="coffee" size={25} color={themeColors.light.brandPanelText} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: themeColors.light.brandPanelText }}>
                  {isScreenshotDemoVenue ? "Sample community preview" : "Welcome back!"}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: themeColors.light.brandPanelText, opacity: 0.85, marginTop: 2, lineHeight: 18 }}>
                  {isScreenshotDemoVenue
                    ? `Example activity: ${myLeaderboardEntry.checkinCount} visits · #${myLeaderboardEntry.rank} among sample Visitors`
                    : myLeaderboardEntry.checkinCount === 1
                    ? "Your first check-in here — you're among this venue’s Visitors"
                    : `You've checked in ${myLeaderboardEntry.checkinCount} times — you're #${myLeaderboardEntry.rank} among this venue’s Visitors`}
                </Text>
              </View>
            </View>
          )}

          {/* About */}
          {activeTab === "today" && profile.description ? (
            <View style={styles.section}>
              <SectionLabel title="About" />
              <Text style={styles.description}>{profile.description}</Text>
            </View>
          ) : null}

          {/* ── 1. Announcements ───────────────────────────────────────── */}
          {activeTab === "today" && announcements.length > 0 && (
            <View style={styles.section}>
              <SectionLabel title="Announcements" />
              {announcements.slice(0, 5).map((ann) => (
                <View key={ann.id} style={[styles.annCard, isDark && styles.annCardDark, cardShadow]}>
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
                      <View style={[styles.annPinnedPill, isDark && styles.annPinnedPillDark]}>
                        <Feather name="bookmark" size={11} color={isDark ? "#8FD995" : CORAL} />
                        <Text style={[styles.annPinned, isDark && styles.darkAccentText]}>Pinned note</Text>
                      </View>
                    )}
                    <Text style={[styles.annTitle, isDark && styles.darkTitle]}>{ann.title}</Text>
                    <Text numberOfLines={3} style={[styles.annText, isDark && styles.darkBody]}>{ann.body}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                      <Text style={styles.annDate}>
                        {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </Text>
                      <Pressable
                        onPress={() => showContentReportSheet("announcement", ann.id, placeId ?? "")}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel="Report this announcement"
                      >
                        <Text style={{ fontSize: 11, color: MUTED }}>Report</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── 2. Rewards ─────────────────────────────────────────────── */}
          {activeTab === "today" && displayRewards.length > 0 && (
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
                          style={[styles.rewardLockOverlay, isDark && styles.rewardLockOverlayDark]}
                          pointerEvents="box-none"
                        >
                          <Feather name="lock" size={22} color={CORAL} />
                          <Text style={styles.rewardLockTitle}>
                            Scan QR to Unlock Reward
                          </Text>
                          <Text style={styles.rewardLockSub}>
                            Find the QR code at the entrance and scan it to unlock today's reward.
                          </Text>
                          <Pressable
                            style={styles.rewardLockBtn}
                            onPress={openCheckin}
                            accessibilityRole="button"
                            accessibilityLabel="Open QR scanner"
                          >
                            <Text style={styles.rewardLockBtnText}>Open Scanner</Text>
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
          {activeTab === "today" && endedRewards.length > 0 && (
            <View style={{ marginTop: displayRewards.length > 0 ? 0 : undefined }}>
              <Pressable
                onPress={() => setShowEndedRewards((v) => !v)}
                style={styles.endedToggle}
                accessibilityRole="button"
              >
                <Text style={[styles.endedToggleText, isDark && styles.darkBody]}>
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
            <View style={[styles.section, activeTab === "guestbook" && { display: "none" }]}>
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
                    readOnly={isScreenshotDemoVenue}
                    onPress={() => setSelectedEvent(event)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── 4. Visitors ────────────────────────────────────────────── */}
          {activeTab === "today" && topVisitors.length > 0 && (
            <View style={styles.section}>
              <SectionLabel
                title="Visitors"
                onSeeAll={() => router.push(`/leaderboard/${placeId}`)}
              />
              <View style={styles.lbGrid}>
                {topVisitors.map((v, i) => (
                  <View key={v.uid} style={[styles.lbCard, isDark && styles.lbCardDark, cardShadow]}>
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
                    <Text numberOfLines={1} style={[styles.lbName, isDark && styles.darkTitle]}>{v.displayName}</Text>
                    <Text style={[styles.lbCount, i === 0 && styles.lbCountGold]}>
                      {v.checkinCount}
                    </Text>
                    <Text style={[styles.lbCountLabel, isDark && styles.darkBody]}>visits</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── 5. Review ──────────────────────────────────────────────── */}
          {activeTab === "guestbook" && isQrVerified && (
            <View style={styles.section}>
              <SectionLabel title="Rate This Venue" />
              <View style={[styles.reviewCard, cardShadow]}>
                <Text style={styles.reviewPrompt}>How was your experience?</Text>
                <View testID="review-stars-row" style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable key={star} testID={`review-star-${star}`} onPress={() => setReviewStars(star)} hitSlop={8}>
                      <Text style={[styles.starChar, reviewStars >= star && styles.starCharActive]}>★</Text>
                    </Pressable>
                  ))}
                </View>
                {reviewStars > 0 && (
                  <>
                    <TextInput
                      testID="review-comment-input"
                      style={styles.reviewInput}
                      placeholder="Add a comment (optional)"
                      placeholderTextColor={MUTED}
                      value={reviewComment}
                      onChangeText={setReviewComment}
                      maxLength={300}
                      multiline
                    />
                    <Pressable
                      testID="review-submit-btn"
                      style={[styles.reviewSubmitBtn, reviewSubmitting && { opacity: 0.6 }]}
                      onPress={() => void handleSubmitReview()}
                      disabled={reviewSubmitting}
                    >
                      <Text testID="review-submit-label" style={styles.reviewSubmitText}>
                        {reviewSubmitting ? "Saving…" : myReview ? "Update review" : "Submit review"}
                      </Text>
                    </Pressable>
                  </>
                )}
                {myReview && reviewStars === 0 && (
                  <Text testID="review-existing-summary" style={styles.reviewExisting}>
                    {"★".repeat(myReview.starRating)}{"☆".repeat(5 - myReview.starRating)}
                    {myReview.comment ? `  "${myReview.comment}"` : ""}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* ── 6. Guest Reviews ───────────────────────────────────────── */}
          {activeTab === "guestbook" && (totalReviewCount > 0) && (
            <View style={styles.section}>
              {/* Aggregate headline — always venue-wide */}
              <View style={styles.reviewsHeader}>
                <SectionLabel title="Guest Reviews" />
                {averageRating !== null && totalReviewCount > 0 && (
                  <View style={styles.reviewsAggregate}>
                    <Text style={styles.reviewsAggStar}>★</Text>
                    <Text style={styles.reviewsAggScore}>{averageRating.toFixed(1)}</Text>
                    <Text style={styles.reviewsAggCount}>
                      ({totalReviewCount} {totalReviewCount === 1 ? "review" : "reviews"})
                    </Text>
                  </View>
                )}
              </View>

              {/* ── Sort selector ── */}
              <View style={styles.reviewSortRow}>
                <Text style={styles.reviewSortLabel}>Sort:</Text>
                {(
                  [
                    { key: "recent",  label: "Most recent"  },
                    { key: "highest", label: "Highest rated" },
                    { key: "lowest",  label: "Lowest rated"  },
                  ] as const
                ).map(({ key, label }) => {
                  const active = reviewSort === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setReviewSort(key)}
                      style={[styles.reviewSortChip, active && styles.reviewSortChipActive]}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.reviewSortChipText, active && styles.reviewSortChipTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Reviews list or loading / error / empty state */}
              {reviewsLoading ? (
                <ActivityIndicator color={CORAL} style={{ marginVertical: 20 }} />
              ) : reviewsError ? (
                <View style={styles.reviewFilterEmpty}>
                  <Text style={styles.reviewFilterEmptyText}>
                    Couldn't load reviews — tap to retry
                  </Text>
                  <Pressable
                    onPress={() => setReviewRetryKey((k) => k + 1)}
                    style={{ marginTop: 8 }}
                    accessibilityRole="button"
                  >
                    <Text style={{ color: CORAL, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
                      Retry
                    </Text>
                  </Pressable>
                </View>
              ) : venueReviews.length > 0 ? (
                <View style={[styles.guestReviewsCard, cardShadow]}>
                  {[...venueReviews]
                    .sort((a, b) => {
                      if (reviewSort === "highest") return b.starRating - a.starRating;
                      if (reviewSort === "lowest")  return a.starRating - b.starRating;
                      // "recent" — newest first
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    })
                    .map((rv, index) => (
                    <View key={rv.id} style={[styles.guestReviewRow, index > 0 && styles.guestReviewDivider]}>
                      {/* Avatar */}
                      {rv.photoUrl ? (
                        <Image source={{ uri: rv.photoUrl }} style={styles.guestReviewAvatar} contentFit="cover" />
                      ) : (
                        <View style={styles.guestReviewAvatarFallback}>
                          <Text style={styles.guestReviewAvatarChar}>
                            {rv.displayName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.guestReviewContent}>
                        <View style={styles.guestReviewTopRow}>
                          <Text style={styles.guestReviewName} numberOfLines={1}>{rv.displayName}</Text>
                          <Text style={styles.guestReviewTime}>{relativeTime(rv.createdAt)}</Text>
                        </View>
                        <Text style={styles.guestReviewStars}>
                          {"★".repeat(rv.starRating)}{"☆".repeat(5 - rv.starRating)}
                        </Text>
                        {rv.comment ? (
                          <Text style={styles.guestReviewComment} numberOfLines={4}>{rv.comment}</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.reviewFilterEmpty}>
                  <Text style={styles.reviewFilterEmptyText}>No reviews yet</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Guestbook ─────────────────────────────────────────────── */}
          <View style={[styles.section, activeTab !== "guestbook" && { display: "none" }]}>
            <VenueGuestbook
              placeId={placeId ?? ""}
              placeName={profile.businessName}
              isDemo={isScreenshotDemoVenue}
              qrVerified={isQrVerified}
            />
          </View>

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

          {/* ── Report venue ───────────────────────────────────────────── */}
          {profile && (
            <Pressable
              onPress={() => showContentReportSheet("venue", 0, placeId ?? "")}
              style={{ alignItems: "center", paddingVertical: 20, paddingBottom: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Report this venue"
            >
              <Text style={{ fontSize: 12, color: MUTED }}>Report this venue</Text>
            </Pressable>
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
              style={[styles.eventDetailSheet, isDark && styles.eventDetailSheetDark, { paddingBottom: insets.bottom + 28 }]}
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
                  colors={isDark ? ["#28583B", "#8B7950"] : ["#B9D9B1", "#E8C98A"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.eventDetailHero, { alignItems: "center", justifyContent: "center" }]}
                >
                  <Text style={{ fontSize: 52 }}>🎉</Text>
                </LinearGradient>
              )}

              {/* content */}
              <View style={styles.eventDetailBody}>
                <Text style={[styles.eventDetailTitle, isDark && styles.darkTitle]}>{selectedEvent.title}</Text>
                <Text style={[styles.eventDetailDate, isDark && { color: "#8FD995" }]}>
                  {new Date(selectedEvent.startsAt).toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric",
                  })}
                  {"  ·  "}
                  {new Date(selectedEvent.startsAt).toLocaleTimeString("en-US", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </Text>
                {selectedEvent.description ? (
                  <Text style={[styles.eventDetailDesc, isDark && styles.darkBody]}>{selectedEvent.description}</Text>
                ) : null}
                <View style={styles.eventDetailMeta}>
                  <Text style={[styles.eventDetailMetaText, isDark && styles.darkBody]}>
                    {selectedEvent.rsvpCount} going
                  </Text>
                </View>
                <Pressable
                  onPress={() => showContentReportSheet("event", selectedEvent.id, placeId ?? "")}
                  style={{ marginTop: 16, alignSelf: "flex-start" }}
                  accessibilityRole="button"
                  accessibilityLabel="Report this event"
                >
                  <Text style={{ fontSize: 12, color: MUTED }}>Report this event</Text>
                </Pressable>
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

const canopyVenue = StyleSheet.create({
  // Keep the controls above the native sheet's scroll content and cover image.
  header: {
    flexShrink: 0,
    position: "relative",
    zIndex: 10,
    elevation: 4,
    backgroundColor: BG,
    paddingHorizontal: 12,
    paddingBottom: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLabel: { color: MUTED, fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 1.2 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 11 },
  statusText: { flex: 1, color: TEXT2, fontFamily: "Inter_400Regular", fontSize: 11 },
  verified: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { color: CORAL, fontSize: 10, fontFamily: "Inter_500Medium" },
  actions: { flexDirection: "row", gap: 8, marginBottom: 6 },
  primaryButton: { flex: 1.2, minHeight: 50, paddingHorizontal: 12, borderRadius: 15, backgroundColor: themeColors.light.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: TEXT },
  directionsButton: { flex: 1, minHeight: 50, paddingHorizontal: 12, borderRadius: 15, borderWidth: 1, borderColor: BORDER, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  directionsText: { fontFamily: "Inter_500Medium", fontSize: 12, color: TEXT },
  tabs: { flexDirection: "row", gap: 24, borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 16 },
  tab: { minHeight: 48, paddingHorizontal: 2, justifyContent: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: themeColors.light.primary },
  tabText: { color: MUTED, fontFamily: "Inter_500Medium", fontSize: 13 },
  tabTextActive: { color: CORAL, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", paddingVertical: 30, gap: 10 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", color: TEXT, fontSize: 15 },
  emptyText: { fontFamily: "Inter_400Regular", color: MUTED, fontSize: 13 },
});

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: MUTED, fontSize: 16 },
  errorBack: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: { height: 232, marginHorizontal: 16, borderRadius: 20, overflow: "hidden" },
  demoHero: { height: 286 },
  heroCover: { width: "100%", height: 232 },
  demoHeroCover: { height: 286 },
  illustrationBadge: {
    position: "absolute",
    top: 12,
    right: 16,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(31,41,36,.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.3)",
  },
  illustrationBadgeText: {
    color: "#FFFFFF",
    fontSize: 7,
    letterSpacing: 0.7,
    fontFamily: "Inter_700Bold",
  },

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
    backgroundColor: "rgba(232,245,229,0.18)",
    borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  verifiedPillText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#E8F5E5" },
  heroName:    { color: "#FFFFFF", fontSize: 26, lineHeight: 30, fontFamily: "Inter_600SemiBold", letterSpacing: -1 },
  heroTagline: { color: "#E8F5E5", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 5 },

  // ── Body ──────────────────────────────────────────────────────────────────
  body:        { paddingHorizontal: 18, paddingTop: 2 },
  section:     { marginBottom: 24 },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 18, fontFamily: "Inter_600SemiBold",
    color: TEXT, letterSpacing: -0.5,
  },
  sectionLabelDark: { color: themeColors.dark.text },
  seeAllLink: {
    fontSize: 13, fontFamily: "Inter_500Medium", color: CORAL,
  },
  description: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: TEXT2, lineHeight: 22,
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
  eventDetailSheetDark: { backgroundColor: themeColors.dark.card },
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
  rewardLockOverlayDark: { backgroundColor: "rgba(23,34,26,0.94)" },
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
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
    overflow: "hidden",
  },
  annCardDark: { backgroundColor: themeColors.dark.card, borderColor: themeColors.dark.border },
  darkTitle: { color: themeColors.dark.text },
  darkBody: { color: themeColors.dark.mutedForeground },
  darkAccentText: { color: "#8FD995" },
  annImage:  { width: "100%", height: 154 },
  annBody:   { padding: 16 },
  annPinnedPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#E8F5E5",
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 10,
  },
  annPinnedPillDark: { backgroundColor: "#193C24" },
  annPinned: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: CORAL, letterSpacing: 0.2 },
  annTitle:  { fontSize: 17, fontFamily: "Inter_700Bold", color: TEXT, marginBottom: 7, letterSpacing: -0.25 },
  annText:   { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT2, lineHeight: 21, marginBottom: 8 },
  annDate:   { fontSize: 11, fontFamily: "Inter_400Regular", color: MUTED },

  // ── Visitors ───────────────────────────────────────────────────────────────
  lbGrid:    { flexDirection: "row", gap: 10 },
  lbCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    paddingTop: 20,
    alignItems: "center",
    gap: 4,
  },
  lbCardDark: { backgroundColor: themeColors.dark.card, borderColor: themeColors.dark.border },
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

  // ── Review ────────────────────────────────────────────────────────────────
  reviewCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  reviewPrompt: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
  },
  starsRow: {
    flexDirection: "row",
    gap: 10,
  },
  starChar: {
    fontSize: 36,
    color: "#D1D5DB",
  },
  starCharActive: {
    color: "#FFC107",
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: TEXT,
    minHeight: 72,
    textAlignVertical: "top",
  },
  reviewSubmitBtn: {
    backgroundColor: CORAL,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  reviewSubmitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  reviewExisting: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: TEXT2,
    lineHeight: 22,
  },

  // ── Hero rating ───────────────────────────────────────────────────────────
  heroRating: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#FFC107",
    marginTop: 4,
    letterSpacing: 0.2,
  },

  // ── Guest Reviews ─────────────────────────────────────────────────────────
  reviewsHeader: {
    marginBottom: 12,
  },
  reviewsAggregate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -6,
    marginBottom: 4,
  },
  reviewsAggStar: {
    fontSize: 18,
    color: "#FFC107",
  },
  reviewsAggScore: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: TEXT,
  },
  reviewsAggCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: MUTED,
    marginLeft: 2,
  },
  guestReviewsCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  guestReviewRow: {
    flexDirection: "row",
    padding: 14,
    gap: 12,
    alignItems: "flex-start",
  },
  guestReviewDivider: {
    borderTopWidth: 1,
    borderTopColor: DIVIDER,
  },
  guestReviewAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    flexShrink: 0,
  },
  guestReviewAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${CORAL}18`,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  guestReviewAvatarChar: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: CORAL,
  },
  guestReviewContent: {
    flex: 1,
    gap: 3,
  },
  guestReviewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  guestReviewName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: TEXT,
    flex: 1,
  },
  guestReviewTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: MUTED,
    flexShrink: 0,
  },
  guestReviewStars: {
    fontSize: 13,
    color: "#FFC107",
    letterSpacing: 1,
  },
  guestReviewComment: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: TEXT2,
    lineHeight: 19,
    marginTop: 2,
  },

  reviewFilterEmpty: {
    paddingVertical: 24,
    alignItems: "center",
  },
  reviewFilterEmptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: MUTED,
  },
  reviewSortRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
    marginBottom: 4,
  },
  reviewSortLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: MUTED,
    marginRight: 2,
  },
  reviewSortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  reviewSortChipActive: {
    backgroundColor: TEXT,
    borderColor: TEXT,
  },
  reviewSortChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: TEXT2,
  },
  reviewSortChipTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
  },
});

// Screenshot-preview polish only. The original venue presentation remains
// untouched for dark mode and for every real venue.
const brightDemo = StyleSheet.create({
  root: { backgroundColor: "#F8F5EF" },
  hero: { backgroundColor: "#F8F5EF" },
  body: { paddingHorizontal: 18, paddingTop: 12 },
  welcome: { backgroundColor: "#FFF3DD", borderColor: "#EEDDBB", marginBottom: 18 },
  card: {
    backgroundColor: "#FFFEFB",
    borderColor: "#E9E3D9",
    shadowColor: "#716257",
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
});
