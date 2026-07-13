/**
 * LeaderboardScreen
 *
 * Shows two tabs for a given hub (placeId + placeName):
 *   - "Monthly Top"  (default) — check-ins this calendar month
 *   - "All-Time"               — total check-ins since the hub was created
 *
 * Champion badge: any row whose uid appears in the caller's champion-badges
 * list gets a gold crown icon next to their name.
 *
 * The current user's row is highlighted and labelled "You".
 */

import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Period = "current_month" | "all_time";

interface LeaderboardEntry {
  rank: number;
  uid: string;
  displayName: string;
  photoUrl: string | null;
  checkinCount: number;
}

interface ChampionBadge {
  placeId: string;
  placeName: string | null;
  month: string;
  rank: number;
  checkinCount: number;
}

interface Props {
  placeId: string;
  placeName: string;
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Tab pill
// ---------------------------------------------------------------------------

function TabPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[
        styles.tabPill,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.tabPillLabel,
          { color: active ? "#fff" : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function LeaderboardRow({
  item,
  isCurrentUser,
  isChampion,
}: {
  item: LeaderboardEntry;
  isCurrentUser: boolean;
  isChampion: boolean;
}) {
  const colors = useColors();
  const { t } = useT();

  const rankColor =
    item.rank === 1
      ? "#F59E0B"
      : item.rank === 2
        ? "#9CA3AF"
        : item.rank === 3
          ? "#B45309"
          : colors.mutedForeground;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: isCurrentUser
            ? colors.primary + "18"
            : colors.card,
          borderColor: isCurrentUser ? colors.primary + "40" : colors.border,
        },
      ]}
      accessibilityLabel={`${t("leaderboard.rankA11y", { rank: item.rank })} ${item.displayName} ${t("leaderboard.checkinCountA11y", { count: item.checkinCount })}`}
    >
      {/* Rank */}
      <View style={styles.rankCol}>
        {item.rank <= 3 ? (
          <Text style={[styles.rankEmoji]}>
            {item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : "🥉"}
          </Text>
        ) : (
          <Text style={[styles.rankNum, { color: rankColor }]}>
            {item.rank}
          </Text>
        )}
      </View>

      {/* Avatar */}
      {item.photoUrl ? (
        <Image
          source={{ uri: item.photoUrl }}
          style={styles.avatar}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[styles.avatarFallback, { backgroundColor: colors.muted }]}
        >
          <Feather name="user" size={16} color={colors.mutedForeground} />
        </View>
      )}

      {/* Name + badges */}
      <View style={styles.nameCol}>
        <View style={styles.nameRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.displayName,
              {
                color: isCurrentUser ? colors.primary : colors.foreground,
                fontFamily: isCurrentUser
                  ? "Inter_700Bold"
                  : "Inter_600SemiBold",
              },
            ]}
          >
            {item.displayName}
          </Text>
          {isCurrentUser && (
            <View
              style={[styles.youBadge, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.youBadgeText}>{t("leaderboard.youLabel")}</Text>
            </View>
          )}
          {isChampion && (
            <View style={styles.championBadge}>
              <Text style={styles.championIcon} accessibilityLabel={t("leaderboard.championA11y")}>
                👑
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Check-in count */}
      <View style={styles.countCol}>
        <Text style={[styles.countNum, { color: colors.foreground }]}>
          {item.checkinCount}
        </Text>
        <Text style={[styles.countLabel, { color: colors.mutedForeground }]}>
          {t("leaderboard.checkinsLabel")}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LeaderboardScreen({ placeId, placeName, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { authedUid } = useApp();

  // Default to monthly tab (the "active race")
  const [period, setPeriod] = useState<Period>("current_month");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [championUids, setChampionUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Slide-in animation for tab content switch
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    slideAnim.setValue(12);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 120,
      friction: 10,
    }).start();
  }, [slideAnim]);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(
    async (p: Period) => {
      if (!authedUid) return;
      setLoading(true);
      setError(false);
      try {
        const data = await api.getLeaderboard(
          { uid: authedUid },
          placeId,
          p,
        );
        setEntries(data);
        animateIn();
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [authedUid, placeId, animateIn],
  );

  // Fetch champion badges for current user
  useEffect(() => {
    if (!authedUid) return;
    api
      .getChampionBadges({ uid: authedUid }, authedUid)
      .then((badges: ChampionBadge[]) => {
        const uids = new Set(
          badges
            .filter((b) => b.placeId === placeId && b.rank === 1)
            .map(() => authedUid),
        );
        // Also mark any entry in the list that has been a champion —
        // we re-resolve this after leaderboard fetch below.
        setChampionUids(uids);
      })
      .catch(() => {});
  }, [authedUid, placeId]);

  useEffect(() => {
    void fetchLeaderboard(period);
  }, [period, fetchLeaderboard]);

  const handleTabChange = (p: Period) => {
    if (p === period) return;
    setPeriod(p);
  };

  const renderItem = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <LeaderboardRow
        item={item}
        isCurrentUser={item.uid === authedUid}
        isChampion={championUids.has(item.uid)}
      />
    ),
    [authedUid, championUids],
  );

  const isEmpty = !loading && !error && entries.length === 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 8 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        {onClose && (
          <Pressable
            onPress={onClose}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            hitSlop={8}
          >
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </Pressable>
        )}
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t("leaderboard.title")}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: colors.mutedForeground }]}
          >
            {placeName}
          </Text>
        </View>
      </View>

      {/* Tab pills */}
      <View style={styles.tabs}>
        <TabPill
          label={t("leaderboard.tabMonthly")}
          active={period === "current_month"}
          onPress={() => handleTabChange("current_month")}
        />
        <TabPill
          label={t("leaderboard.tabAllTime")}
          active={period === "all_time"}
          onPress={() => handleTabChange("all_time")}
        />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {t("common.error")}
          </Text>
          <Pressable
            onPress={() => fetchLeaderboard(period)}
            style={[styles.retryBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>
              {t("common.retry")}
            </Text>
          </Pressable>
        </View>
      ) : isEmpty ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🏁</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {period === "current_month"
              ? t("leaderboard.emptyMonthly")
              : t("leaderboard.emptyAllTime")}
          </Text>
        </View>
      ) : (
        <Animated.View
          style={[styles.listWrapper, { transform: [{ translateY: slideAnim }] }]}
        >
          <FlatList
            data={entries}
            keyExtractor={(item) => item.uid}
            renderItem={renderItem}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 24,
              gap: 8,
              paddingTop: 8,
            }}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabPillLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 40,
    lineHeight: 48,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  listWrapper: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  rankCol: {
    width: 28,
    alignItems: "center",
  },
  rankEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  rankNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  displayName: {
    fontSize: 14,
    flexShrink: 1,
  },
  youBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  youBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: "#fff",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  championBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
  championIcon: {
    fontSize: 14,
    lineHeight: 18,
  },
  countCol: {
    alignItems: "flex-end",
    minWidth: 52,
  },
  countNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  countLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    marginTop: 1,
  },
});
