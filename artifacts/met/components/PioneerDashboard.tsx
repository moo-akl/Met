/**
 * PioneerDashboard
 *
 * Full-screen leaderboard for the top 50 Pioneers, ranked by pioneer_score.
 * Formula displayed: Referrals ×20 · Check-ins ×2 · Chats ×5
 * The #1 user gets a "Top Contributor" badge.
 */

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { api } from "@/lib/api/client";
import { useT } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ReferralShareIcon({ size = 20, color = "rgba(255,215,0,0.85)" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Arrow pointing up */}
      <Path
        d="M12 3 L7.5 7.5 M12 3 L16.5 7.5 M12 3 V15"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Open-top box */}
      <Path
        d="M7 10 H5 A1 1 0 0 0 4 11 V19 A1 1 0 0 0 5 20 H19 A1 1 0 0 0 20 19 V11 A1 1 0 0 0 19 10 H17"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PioneerEntry {
  rank: number;
  uid: string;
  displayName: string;
  photoUrl: string | null;
  pioneerScore: number;
  referralCount: number;
  chatConnections: number;
  isTopContributor: boolean;
  random_prize_eligibility: boolean;
  prize_label: string | null;
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function PioneerRow({
  item,
  isCurrentUser,
  animStyle,
}: {
  item: PioneerEntry;
  isCurrentUser: boolean;
  animStyle: { opacity: Animated.Value; translateY: Animated.Value };
}) {
  const { t } = useT();
  const colors = useColors();

  return (
    <Animated.View
      style={[
        styles.row,
        { backgroundColor: colors.card },
        isCurrentUser && [styles.rowCurrentUser, { backgroundColor: colors.secondary }],
        {
          opacity: animStyle.opacity,
          transform: [{ translateY: animStyle.translateY }],
        },
      ]}
    >
      {isCurrentUser && <View style={styles.currentUserAccent} />}

      {/* Rank */}
      <Text style={[styles.rank, { color: colors.mutedForeground }, isCurrentUser && styles.rankHighlight]}>
        {item.rank <= 3
          ? ["🥇", "🥈", "🥉"][item.rank - 1]
          : `#${item.rank}`}
      </Text>

      {/* Avatar */}
      <View style={styles.avatarWrapper}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.muted }]}>
            <Text style={[styles.avatarInitial, { color: colors.mutedForeground }]}>
              {(item.displayName[0] ?? "?").toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Name & badges */}
      <View style={styles.nameBlock}>
        <View style={styles.nameRow}>
          <Text style={[styles.displayName, { color: colors.foreground }]} numberOfLines={1}>
            {item.displayName}
          </Text>
          {item.isTopContributor && (
            <View style={styles.topBadge}>
              <Feather name="star" size={9} color="#FFD700" />
              <Text style={styles.topBadgeText}>{t("pioneer.topContributor")}</Text>
            </View>
          )}
          {item.random_prize_eligibility && !item.isTopContributor && (
            <View style={styles.prizeBadge}>
              <Feather name="gift" size={9} color="#F5B700" />
            </View>
          )}
        </View>
        <Text style={[styles.subtext, { color: colors.mutedForeground }]}>
          {t("pioneer.scoreBreakdown", {
            referrals: item.referralCount,
            chats: item.chatConnections,
          })}
        </Text>
      </View>

      {/* Score */}
      <Text style={[styles.score, { color: colors.mutedForeground }, isCurrentUser && styles.scoreHighlight]}>
        {item.pioneerScore.toLocaleString()}
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function PioneerDashboard({ visible, onClose }: Props) {
  const { t } = useT();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { authedUid } = useApp();

  const [entries, setEntries] = useState<PioneerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const rowAnims = useRef(
    new Map<string, { opacity: Animated.Value; translateY: Animated.Value }>(),
  ).current;

  const getRowAnim = (uid: string) => {
    if (!rowAnims.has(uid)) {
      rowAnims.set(uid, {
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(20),
      });
    }
    return rowAnims.get(uid)!;
  };

  const fetchLeaderboard = useCallback(async () => {
    if (!authedUid) return;
    setLoading(true);
    setError(false);
    try {
      const data = await api.getPioneerLeaderboard({ uid: authedUid });
      setEntries(data.leaderboard);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [authedUid]);

  useEffect(() => {
    if (visible) void fetchLeaderboard();
  }, [visible, fetchLeaderboard]);

  useEffect(() => {
    if (entries.length === 0) return;
    entries.forEach((e) => {
      const a = getRowAnim(e.uid);
      a.opacity.setValue(0);
      a.translateY.setValue(20);
    });
    Animated.stagger(
      40,
      entries.map((e) => {
        const a = getRowAnim(e.uid);
        return Animated.parallel([
          Animated.spring(a.opacity, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
          Animated.spring(a.translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        ]);
      }),
    ).start();
  }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PioneerEntry>) => (
      <PioneerRow
        item={item}
        isCurrentUser={item.uid === authedUid}
        animStyle={getRowAnim(item.uid)}
      />
    ),
    [authedUid], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <LinearGradient
          colors={["rgba(212,175,55,0.18)", colors.background] as [string, string]}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t("pioneer.dashboardTitle")}</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{t("pioneer.dashboardSub")}</Text>
          </View>
          <View style={{ width: 44 }} />
        </LinearGradient>

        {/* Score formula pill */}
        <View style={styles.formulaPill}>
          <Text style={styles.formulaText}>{t("pioneer.formula")}</Text>
        </View>

        {/* How score works */}
        <View style={styles.howScoreCard}>
          <Text style={styles.howScoreTitle}>{t("pioneer.howScoreTitle")}</Text>
          <View style={styles.howScoreRows}>
            <View style={styles.howScoreRow}>
              <View style={styles.howScoreIconWrap}>
                <ReferralShareIcon size={18} color="rgba(255,215,0,0.85)" />
              </View>
              <Text style={[styles.howScoreText, { color: colors.foreground }]}>{t("pioneer.howScoreReferrals")}</Text>
            </View>
            <View style={styles.howScoreRow}>
              <Text style={styles.howScoreEmoji}>📍</Text>
              <Text style={[styles.howScoreText, { color: colors.foreground }]}>{t("pioneer.howScoreCheckins")}</Text>
            </View>
            <View style={styles.howScoreRow}>
              <Text style={styles.howScoreEmoji}>💬</Text>
              <Text style={[styles.howScoreText, { color: colors.foreground }]}>{t("pioneer.howScoreChats")}</Text>
            </View>
          </View>
          <Text style={styles.howScoreNote}>{t("pioneer.howScoreNote")}</Text>
        </View>

        {/* Content */}
        {loading ? (
          <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
        ) : error ? (
          <Pressable style={styles.errorBox} onPress={fetchLeaderboard}>
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{t("pioneer.loadError")}</Text>
          </Pressable>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(item) => item.uid}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
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
    paddingBottom: 20,
    gap: 8,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 2,
  },
  formulaPill: {
    alignSelf: "center",
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.2)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 12,
  },
  formulaText: {
    color: "rgba(255,215,0,0.7)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  list: {
    paddingHorizontal: 12,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1E",
    borderRadius: 14,
    padding: 12,
    gap: 10,
    overflow: "hidden",
  },
  rowCurrentUser: {
    backgroundColor: "#1E1E28",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
  },
  currentUserAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: "#FFD700",
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  rank: {
    width: 32,
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  rankHighlight: {
    color: "#FFD700",
  },
  avatarWrapper: {
    width: 38,
    height: 38,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    backgroundColor: "#2A2A2E",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    fontWeight: "600",
  },
  nameBlock: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  displayName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  topBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,215,0,0.15)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  topBadgeText: {
    color: "#FFD700",
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  prizeBadge: {
    backgroundColor: "rgba(245,183,0,0.12)",
    borderRadius: 8,
    padding: 3,
  },
  subtext: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
  },
  score: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 48,
    textAlign: "right",
  },
  scoreHighlight: {
    color: "#FFD700",
  },
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
  howScoreCard: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "rgba(255,215,0,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.12)",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  howScoreTitle: {
    color: "rgba(255,215,0,0.85)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  howScoreRows: {
    gap: 8,
  },
  howScoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  howScoreEmoji: {
    fontSize: 16,
    width: 24,
    textAlign: "center",
  },
  howScoreIconWrap: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  howScoreText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    flex: 1,
  },
  howScoreNote: {
    color: "rgba(255,215,0,0.45)",
    fontSize: 11,
    lineHeight: 16,
  },
});
