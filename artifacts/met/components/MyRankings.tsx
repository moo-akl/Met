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
  ActivityIndicator,
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
          <Feather name="award" size={18} color="#F59E0B" />
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t("home.myRankingsTitle")}
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {t("home.myRankingsSubtitle")}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <Pressable onPress={onRetry} style={styles.retry}>
          <Feather name="refresh-cw" size={16} color={colors.primary} />
          <Text style={[styles.retryText, { color: colors.primary }]}>
            {t("common.retry")}
          </Text>
        </Pressable>
      ) : data.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="map-pin" size={24} color={colors.mutedForeground} />
          <Text
            style={[styles.emptyText, { color: colors.mutedForeground }]}
          >
            {t("home.myRankingsEmpty")}
          </Text>
          <Text
            style={[styles.emptySub, { color: colors.mutedForeground }]}
          >
            {t("home.myRankingsEmptySub")}
          </Text>
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
      style={({ pressed }) => [
        styles.row,
        {
          opacity: pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
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
  container: {
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  loader: {
    paddingVertical: 30,
    alignItems: "center",
  },
  retry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 24,
  },
  retryText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 28,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  venueName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  meta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
