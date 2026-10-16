/**
 * MyRankings
 *
 * Gamified weekly rankings card that shows venues the user checked into
 * last week with their final rank and check-in count at each venue.
 * Tapping a row navigates to the live leaderboard for that venue.
 */

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

export interface WeeklyRanking {
  placeId: string;
  placeName: string | null;
  rank: number;
  checkinCount: number;
  weekStart: string;
}

interface Props {
  data: WeeklyRanking[];
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
}

export function MyRankings({ data, isLoading, error, onRetry }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { t } = useT();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primarySoft }]}>
            <Feather name="award" size={17} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>{t("home.myRankingsTitle")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("home.myRankingsSubtitle")}</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.skeletonList} accessibilityLabel="Loading your venue rankings">
          {[0, 1].map((row) => (
            <View key={row} style={styles.skeletonRow}>
              <View style={[styles.skeletonBadge, { backgroundColor: colors.primarySoft }]} />
              <View style={{ flex: 1, gap: 7 }}>
                <View style={[styles.skeletonLine, { backgroundColor: colors.primarySoft }]} />
                <View style={[styles.skeletonShortLine, { backgroundColor: colors.primarySoft }]} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.stateBlock}>
          <View style={[styles.stateIcon, { backgroundColor: colors.primarySoft }]}>
            <Feather name="wifi-off" size={17} color={colors.primary} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>Couldn't load your rankings</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Try loading your venue visits again.</Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.retry,
              { backgroundColor: colors.primarySoft, opacity: pressed ? 0.78 : 1 },
            ]}
          >
            <Feather name="refresh-cw" size={14} color={colors.primary} />
            <Text style={[styles.retryText, { color: colors.primary }]}>{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.stateBlock}>
          <View style={[styles.stateIcon, { backgroundColor: colors.primarySoft }]}>
            <Feather name="map-pin" size={17} color={colors.primary} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>{t("home.myRankingsEmpty")}</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>{t("home.myRankingsEmptySub")}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {data.map((item) => (
            <RankRow
              key={item.placeId}
              item={item}
              onPress={() =>
                router.push({
                  pathname: "/leaderboard/[placeId]",
                  params: {
                    placeId: item.placeId,
                    placeName: item.placeName ?? "Hub",
                  },
                })
              }
            />
          ))}
        </View>
      )}
    </View>
  );
}

function RankRow({
  item,
  onPress,
}: {
  item: WeeklyRanking;
  onPress: () => void;
}) {
  const colors = useColors();
  const { t } = useT();

  const rank = item.rank;
  const isTop3 = rank <= 3;
  const medal =
    rank === 1
      ? { bg: "#FEF3C7", text: "#B45309", border: "#FCD34D", icon: "crown", iconColor: "#F59E0B" }
      : rank === 2
        ? { bg: "#F3F4F6", text: "#4B5563", border: "#D1D5DB", icon: "award", iconColor: "#9CA3AF" }
        : rank === 3
          ? { bg: "#FFF7ED", text: "#7C2D12", border: "#FDBA74", icon: "award", iconColor: "#D97706" }
          : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.primarySoft : "transparent",
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      {/* Rank badge */}
      <View
        style={[
          styles.badge,
          isTop3
            ? {
                backgroundColor: medal!.bg,
                borderColor: medal!.border,
              }
            : {
                backgroundColor: colors.muted,
                borderColor: colors.border,
              },
        ]}
      >
        {isTop3 ? (
          <Feather
            name={medal!.icon as React.ComponentProps<typeof Feather>["name"]}
            size={rank === 1 ? 16 : 14}
            color={medal!.iconColor}
          />
        ) : (
          <Text
            style={[styles.badgeText, { color: colors.mutedForeground }]}
          >
            #{rank}
          </Text>
        )}
      </View>

      {/* Venue info */}
      <View style={styles.info}>
        <Text
          numberOfLines={1}
          style={[styles.venueName, { color: colors.foreground }]}
        >
          {item.placeName ?? "Unknown venue"}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {t("home.checkinCount", { count: item.checkinCount })}
        </Text>
      </View>

      {/* Chevron */}
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 22, borderWidth: 1, marginHorizontal: 16, marginTop: 15, overflow: "hidden" },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 13 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 11 },
  headerIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 21,
  },
  subtitle: {
    fontSize: 11, marginTop: 3,
    fontFamily: "Inter_400Regular",
  },
  skeletonList: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  skeletonBadge: { width: 38, height: 38, borderRadius: 14, opacity: 0.72 },
  skeletonLine: { height: 10, width: "58%", borderRadius: 5, opacity: 0.7 },
  skeletonShortLine: { height: 8, width: "34%", borderRadius: 4, opacity: 0.55 },
  stateBlock: { alignItems: "center", paddingHorizontal: 22, paddingTop: 2, paddingBottom: 20, gap: 8 },
  stateIcon: { width: 40, height: 40, borderRadius: 15, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  stateTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, textAlign: "center" },
  retry: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 38, paddingHorizontal: 14, borderRadius: 999, marginTop: 3 },
  retryText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 14 },
  list: { paddingHorizontal: 12, paddingBottom: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11, paddingHorizontal: 7, borderRadius: 15,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  venueName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  meta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
