/**
 * LeaderboardScreen
 *
 * Premium dark redesign:
 *   - Metallic gradient MedalBadge for rank 1/2/3 (gold / silver / bronze)
 *   - Spring-animated sliding tab pill
 *   - Staggered spring entrance per row on load / tab switch
 *   - Current-user row glow (left accent bar + subtle gradient bg)
 *   - Champion crown shimmer pulse
 */

import { Feather } from "@expo/vector-icons";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MetGradient } from "@/components/MetGradient";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DARK_BG = "#0F0F12";
const CARD_BG = "#1A1A1E";
const CARD_ELEVATED = "#242428";

const MEDAL = {
  1: {
    colors: ["#FFD700", "#B8860B"] as const,
    glow: "#FFD700",
    text: "#7A5200",
  },
  2: {
    colors: ["#D8D8D8", "#909090"] as const,
    glow: "#C0C0C0",
    text: "#4A4A4A",
  },
  3: {
    colors: ["#CD7F32", "#8B4513"] as const,
    glow: "#CD7F32",
    text: "#4A1F00",
  },
};

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
// MedalBadge — metallic gradient circle for ranks 1–3
// ---------------------------------------------------------------------------

function MedalBadge({ rank }: { rank: 1 | 2 | 3 }) {
  const m = MEDAL[rank];
  return (
    <View
      style={[
        styles.medalWrapper,
        {
          shadowColor: m.glow,
          shadowOpacity: 0.7,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        },
      ]}
    >
      <MetGradient
        colors={m.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.medalBadge}
      >
        <Text style={[styles.medalText, { color: m.text }]}>{rank}</Text>
      </MetGradient>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ChampionPulse — gently pulsing scale wrapper for the crown icon
// ---------------------------------------------------------------------------

function ChampionPulse({ label }: { label: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.18,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  return (
    <Animated.Text
      style={[styles.championIcon, { transform: [{ scale }] }]}
      accessibilityLabel={label}
    >
      👑
    </Animated.Text>
  );
}

// ---------------------------------------------------------------------------
// AnimatedTabBar — spring-sliding pill selector
// ---------------------------------------------------------------------------

function AnimatedTabBar({
  period,
  onTabChange,
}: {
  period: Period;
  onTabChange: (p: Period) => void;
}) {
  const [barWidth, setBarWidth] = useState(
    Dimensions.get("window").width - 32,
  );
  const pillX = useRef(new Animated.Value(0)).current;
  const isFirst = period === "current_month";
  const { t } = useT();

  // Pill occupies half the bar (minus 4px inter-gap / inner padding)
  const tabW = (barWidth - 8) / 2;

  useLayoutEffect(() => {
    Animated.spring(pillX, {
      toValue: isFirst ? 0 : tabW + 4,
      useNativeDriver: true,
      tension: 160,
      friction: 11,
    }).start();
  }, [isFirst, tabW, pillX]);

  const handlePress = (p: Period) => {
    if (p === period) return;
    onTabChange(p);
  };

  return (
    <View
      style={styles.tabBar}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {/* Sliding pill background */}
      <Animated.View
        style={[
          styles.tabPillBg,
          { width: tabW, transform: [{ translateX: pillX }] },
        ]}
      />
      {/* Labels */}
      {(["current_month", "all_time"] as Period[]).map((p) => {
        const active = period === p;
        return (
          <Pressable
            key={p}
            onPress={() => handlePress(p)}
            style={[styles.tabLabel, { width: tabW }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.tabLabelText,
                { color: active ? "#fff" : "rgba(255,255,255,0.45)" },
              ]}
            >
              {p === "current_month"
                ? t("leaderboard.tabMonthly")
                : t("leaderboard.tabAllTime")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// LeaderboardRow
// ---------------------------------------------------------------------------

function LeaderboardRow({
  item,
  isCurrentUser,
  isChampion,
  animStyle,
}: {
  item: LeaderboardEntry;
  isCurrentUser: boolean;
  isChampion: boolean;
  animStyle: { opacity: Animated.Value; translateY: Animated.Value };
}) {
  const colors = useColors();
  const { t } = useT();
  const isTop3 = item.rank <= 3;

  const cardBg = isCurrentUser ? CARD_ELEVATED : CARD_BG;

  return (
    <Animated.View
      style={{
        opacity: animStyle.opacity,
        transform: [{ translateY: animStyle.translateY }],
      }}
    >
      <View
        style={[
          styles.row,
          {
            backgroundColor: cardBg,
            borderColor: isTop3
              ? MEDAL[item.rank as 1 | 2 | 3].glow + "30"
              : isCurrentUser
                ? colors.primary + "40"
                : "rgba(255,255,255,0.06)",
            shadowColor: isTop3
              ? MEDAL[item.rank as 1 | 2 | 3].glow
              : colors.primary,
            shadowOpacity: isTop3 ? 0.18 : isCurrentUser ? 0.12 : 0,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 2 },
            elevation: isTop3 ? 4 : isCurrentUser ? 2 : 0,
          },
        ]}
        accessibilityLabel={`${t("leaderboard.rankA11y", { rank: item.rank })} ${item.displayName} ${t("leaderboard.checkinCountA11y", { count: item.checkinCount })}`}
      >
        {/* Current-user accent bar */}
        {isCurrentUser && (
          <View
            style={[styles.accentBar, { backgroundColor: colors.primary }]}
          />
        )}

        {/* Rank */}
        <View style={styles.rankCol}>
          {isTop3 ? (
            <MedalBadge rank={item.rank as 1 | 2 | 3} />
          ) : (
            <Text style={[styles.rankNum, { color: "rgba(255,255,255,0.35)" }]}>
              {item.rank}
            </Text>
          )}
        </View>

        {/* Avatar */}
        {item.photoUrl ? (
          <Image
            source={{ uri: item.photoUrl }}
            style={[
              styles.avatar,
              isTop3 && {
                borderWidth: 2,
                borderColor: MEDAL[item.rank as 1 | 2 | 3].glow + "80",
              },
            ]}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: "#2C2C2E" }]}>
            <Feather name="user" size={16} color="rgba(255,255,255,0.4)" />
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
                  color: isCurrentUser
                    ? colors.primary
                    : "rgba(255,255,255,0.92)",
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
                <Text style={styles.youBadgeText}>
                  {t("leaderboard.youLabel")}
                </Text>
              </View>
            )}
            {isChampion && (
              <ChampionPulse label={t("leaderboard.championA11y")} />
            )}
          </View>
        </View>

        {/* Check-in count */}
        <View style={styles.countCol}>
          <Text
            style={[
              styles.countNum,
              {
                color: isTop3
                  ? MEDAL[item.rank as 1 | 2 | 3].glow
                  : "rgba(255,255,255,0.85)",
              },
            ]}
          >
            {item.checkinCount}
          </Text>
          <Text style={[styles.countLabel, { color: "rgba(255,255,255,0.35)" }]}>
            {t("leaderboard.checkinsLabel")}
          </Text>
        </View>
      </View>
    </Animated.View>
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

  const [period, setPeriod] = useState<Period>("current_month");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [championUids, setChampionUids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Per-row animation values keyed by uid
  const rowAnims = useRef(
    new Map<string, { opacity: Animated.Value; translateY: Animated.Value }>(),
  ).current;

  const getRowAnim = (uid: string) => {
    if (!rowAnims.has(uid)) {
      rowAnims.set(uid, {
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(24),
      });
    }
    return rowAnims.get(uid)!;
  };

  // Staggered spring entrance on entries change
  useEffect(() => {
    if (entries.length === 0) return;
    // Reset
    entries.forEach((e) => {
      const a = getRowAnim(e.uid);
      a.opacity.setValue(0);
      a.translateY.setValue(24);
    });
    // Stagger
    Animated.stagger(
      45,
      entries.map((e) => {
        const a = getRowAnim(e.uid);
        return Animated.parallel([
          Animated.spring(a.opacity, {
            toValue: 1,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }),
          Animated.spring(a.translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }),
        ]);
      }),
    ).start();
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch leaderboard
  const fetchLeaderboard = useCallback(
    async (p: Period) => {
      if (!authedUid) return;
      setLoading(true);
      setError(false);
      try {
        const data = await api.getLeaderboard({ uid: authedUid }, placeId, p);
        setEntries(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [authedUid, placeId],
  );

  // Champion badges
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
        setChampionUids(uids);
      })
      .catch(() => {});
  }, [authedUid, placeId]);

  useEffect(() => {
    void fetchLeaderboard(period);
  }, [period, fetchLeaderboard]);

  const renderItem = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <LeaderboardRow
        item={item}
        isCurrentUser={item.uid === authedUid}
        isChampion={championUids.has(item.uid)}
        animStyle={getRowAnim(item.uid)}
      />
    ),
    [authedUid, championUids], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isEmpty = !loading && !error && entries.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
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
            <Feather name="chevron-left" size={24} color="rgba(255,255,255,0.85)" />
          </Pressable>
        )}
        <View style={styles.headerText}>
          <Text style={styles.title}>{t("leaderboard.title")}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {placeName}
          </Text>
        </View>
      </View>

      {/* Animated tab bar */}
      <View style={styles.tabsContainer}>
        <AnimatedTabBar period={period} onTabChange={setPeriod} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={32} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>{t("common.error")}</Text>
          <Pressable
            onPress={() => fetchLeaderboard(period)}
            style={styles.retryBtn}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>
              {t("common.retry")}
            </Text>
          </Pressable>
        </View>
      ) : isEmpty ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🏁</Text>
          <Text style={styles.emptyText}>
            {period === "current_month"
              ? t("leaderboard.emptyMonthly")
              : t("leaderboard.emptyAllTime")}
          </Text>
        </View>
      ) : (
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
    backgroundColor: DARK_BG,
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
    letterSpacing: -0.4,
    color: "rgba(255,255,255,0.95)",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
    color: "rgba(255,255,255,0.4)",
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 4,
    position: "relative",
    overflow: "hidden",
  },
  tabPillBg: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 9,
    backgroundColor: "#3A3A3E",
    shadowColor: "#fff",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  tabLabel: {
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  tabLabelText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.1,
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
    color: "rgba(255,255,255,0.4)",
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginTop: 4,
  },
  retryText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
    overflow: "hidden",
    position: "relative",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
  rankCol: {
    width: 32,
    alignItems: "center",
  },
  medalWrapper: {
    borderRadius: 10,
  },
  medalBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  medalText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: -0.3,
  },
  rankNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
