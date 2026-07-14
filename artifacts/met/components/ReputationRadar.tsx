/**
 * ReputationRadar (v2 — Community Impact Score)
 *
 * Displays a user's average star rating (1–5) plus a frequency breakdown
 * of their received Vibe Tags (Kind, Reliable, Open, Funny, Professional).
 * Replaces the old three-axis SVG radar chart.
 */
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

const VIBE_TAG_KEYS = ["kind", "reliable", "open", "funny", "professional"] as const;
type VibeTagKey = (typeof VIBE_TAG_KEYS)[number];

export interface ReviewSummary {
  count: number;
  hasEnough: boolean;
  averageRating?: number;
  vibeTags?: Partial<Record<VibeTagKey, number>>;
  communityStanding?: number;
}

interface Props {
  summary: ReviewSummary | null;
  loading?: boolean;
}

/**
 * Maps a numeric star rating to a gradient-coded solid color:
 *   4.5–5   → Gold    (#DAA520 — mid of #FFD700–#DAA520)
 *   3.5–4.4 → Emerald (#3DAA68 — mid of #50C878–#2E8B57)
 *   < 3.5   → Amber   (#CD853F — mid of #FFBF00–#CD853F)
 */
export function getStarColor(rating: number): string {
  if (rating >= 4.5) return "#DAA520";
  if (rating >= 3.5) return "#3DAA68";
  return "#CD853F";
}

export function StarDisplay({ rating, size = 20 }: { rating: number; size?: number }) {
  const colors = useColors();
  const fillColor = getStarColor(rating);
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = rating >= star;
        const half = !filled && rating >= star - 0.5;
        if (half) {
          return (
            <View
              key={star}
              style={{ width: size + 2, height: size, marginHorizontal: 1 }}
            >
              {/* Grey background star */}
              <Feather name="star" size={size} color={colors.border} />
              {/* Gradient-colored left half clipped over the grey star */}
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: (size + 2) / 2,
                  overflow: "hidden",
                }}
              >
                <Feather name="star" size={size} color={fillColor} />
              </View>
            </View>
          );
        }
        return (
          <Feather
            key={star}
            name="star"
            size={size}
            color={filled ? fillColor : colors.border}
            style={{ marginHorizontal: 1 }}
          />
        );
      })}
    </View>
  );
}

export function ReputationRadar({ summary, loading }: Props) {
  const colors = useColors();
  const { t } = useT();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  if (loading) return null;

  if (!summary || !summary.hasEnough) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          {t("review.communityStanding")}
        </Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          {t("review.notEnoughReviews")}
        </Text>
      </View>
    );
  }

  const avgRating = summary.averageRating ?? 0;
  const vibeTags = summary.vibeTags ?? {};
  const maxTagCount = Math.max(1, ...Object.values(vibeTags).map((v) => v ?? 0));
  const ratingColor = getStarColor(avgRating);

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: fadeAnim },
      ]}
    >
      {/* Heading row */}
      <View style={styles.headingRow}>
        <Text style={[styles.heading, { color: colors.foreground }]}>
          {t("review.communityStanding")}
        </Text>
        {summary.communityStanding !== undefined && (
          <View style={[styles.standingBadge, { backgroundColor: colors.primary + "18" }]}>
            <Text style={[styles.standingPct, { color: colors.primary }]}>
              {Math.round(summary.communityStanding)}%
            </Text>
          </View>
        )}
      </View>

      {/* Star rating display */}
      <View style={styles.ratingRow}>
        <Text style={[styles.ratingNumber, { color: ratingColor }]}>
          {avgRating.toFixed(1)}
        </Text>
        <View style={styles.ratingRight}>
          <StarDisplay rating={avgRating} />
          <Text style={[styles.reviewCount, { color: colors.mutedForeground }]}>
            {summary.count} {summary.count === 1 ? t("review.reviewSingular") : t("review.reviewPlural")}
          </Text>
        </View>
      </View>

      {/* Vibe tag bars */}
      {VIBE_TAG_KEYS.some((key) => (vibeTags[key] ?? 0) > 0) && (
        <View style={styles.tagsSection}>
          {VIBE_TAG_KEYS.filter((key) => (vibeTags[key] ?? 0) > 0).map((key) => {
            const count = vibeTags[key] ?? 0;
            const frac = count / maxTagCount;
            return (
              <View key={key} style={styles.tagRow}>
                <Text style={[styles.tagLabel, { color: colors.foreground }]}>
                  {t(`review.vibeTags.${key}`)}
                </Text>
                <View style={[styles.barBg, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.barFill,
                      { backgroundColor: colors.primary, width: `${Math.round(frac * 100)}%` as `${number}%` },
                    ]}
                  />
                </View>
                <Text style={[styles.tagCount, { color: colors.mutedForeground }]}>
                  {count}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  standingBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  standingPct: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  ratingNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
  },
  ratingRight: {
    gap: 4,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  tagsSection: {
    gap: 8,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tagLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    width: 80,
  },
  barBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  tagCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    width: 20,
    textAlign: "right",
  },
});
