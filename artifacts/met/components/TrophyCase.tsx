/**
 * TrophyCase
 *
 * Displays a user's trophy collection in a responsive grid.
 * Gold trophies have a continuous "shine" shimmer animation to feel premium.
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Trophy {
  id: number;
  hubId: string;
  hubName: string | null;
  monthYear: string;
  rankAchieved: number;
  trophyType: string;
  awardedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TROPHY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  Gold: { bg: "#2A1F00", border: "#FFD700", text: "#FFD700", glow: "rgba(255,215,0,0.35)" },
  Silver: { bg: "#1A1A22", border: "#C0C0C0", text: "#D8D8D8", glow: "rgba(192,192,192,0.25)" },
  Bronze: { bg: "#1E1200", border: "#CD7F32", text: "#CD7F32", glow: "rgba(205,127,50,0.25)" },
};

// ---------------------------------------------------------------------------
// SVG Trophy Cup icon
// ---------------------------------------------------------------------------

function TrophyCupIcon({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Cup bowl */}
      <Path
        d="M6 2 H18 V10 C18 15.5 12 17 12 17 C12 17 6 15.5 6 10 Z"
        fill={color}
        opacity={0.95}
      />
      {/* Left handle */}
      <Path
        d="M6 5 C2.5 5 2.5 12 6 12"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      />
      {/* Right handle */}
      <Path
        d="M18 5 C21.5 5 21.5 12 18 12"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      />
      {/* Stem */}
      <Rect x="11" y="17" width="2" height="3" fill={color} opacity={0.85} />
      {/* Base */}
      <Path
        d="M8 20 H16 A1 1 0 0 1 16 22 H8 A1 1 0 0 1 8 20 Z"
        fill={color}
        opacity={0.85}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Gold Shine animation component
// ---------------------------------------------------------------------------

function GoldShine({ children }: { children: React.ReactNode }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.55, 0],
  });

  return (
    <View style={styles.shineContainer}>
      {children}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.shineOverlay,
          { opacity },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Trophy card
// ---------------------------------------------------------------------------

function TrophyCard({ trophy }: { trophy: Trophy }) {
  const colors = TROPHY_COLORS[trophy.trophyType] ?? TROPHY_COLORS.Bronze!;
  const [year, month] = trophy.monthYear.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  const monthLabel = date.toLocaleString("default", { month: "short", year: "2-digit" });

  const card = (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bg, borderColor: colors.border, shadowColor: colors.glow },
      ]}
    >
      <TrophyCupIcon color={colors.text} size={32} />
      <Text style={[styles.hubName, { color: colors.text }]} numberOfLines={2}>
        {trophy.hubName ?? trophy.hubId}
      </Text>
      <Text style={styles.monthLabel}>{monthLabel}</Text>
      <Text style={[styles.rankLabel, { color: colors.text }]}>
        #{trophy.rankAchieved} {trophy.trophyType}
      </Text>
    </View>
  );

  if (trophy.trophyType === "Gold") {
    return <GoldShine>{card}</GoldShine>;
  }
  return <View style={styles.shineContainer}>{card}</View>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  trophies: Trophy[];
  loading?: boolean;
}

export function TrophyCase({ trophies, loading }: Props) {
  const { t } = useT();
  const colors = useColors();

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          {t("trophies.loading")}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        {t("trophies.title")}
      </Text>

      {trophies.length === 0 && !loading && (
        <View style={[styles.howToCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.howToTitle, { color: colors.foreground }]}>
            {t("trophies.howToWinTitle")}
          </Text>
          <View style={styles.howToRow}>
            <TrophyCupIcon color={TROPHY_COLORS.Gold!.text} size={18} />
            <Text style={[styles.howToRowText, { color: colors.mutedForeground }]}>
              {t("trophies.howToWinGold")}
            </Text>
          </View>
          <View style={styles.howToRow}>
            <TrophyCupIcon color={TROPHY_COLORS.Silver!.text} size={18} />
            <Text style={[styles.howToRowText, { color: colors.mutedForeground }]}>
              {t("trophies.howToWinSilver")}
            </Text>
          </View>
          <View style={styles.howToRow}>
            <TrophyCupIcon color={TROPHY_COLORS.Bronze!.text} size={18} />
            <Text style={[styles.howToRowText, { color: colors.mutedForeground }]}>
              {t("trophies.howToWinBronze")}
            </Text>
          </View>
          <View style={[styles.howToDivider, { backgroundColor: colors.border }]} />
          <Text style={[styles.howToNote, { color: colors.mutedForeground }]}>
            {t("trophies.howToWinNote")}
          </Text>
        </View>
      )}
      <FlatList<Trophy>
        data={trophies}
        keyExtractor={(item) => String(item.id)}
        numColumns={3}
        scrollEnabled={false}
        renderItem={({ item }: ListRenderItemInfo<Trophy>) => (
          <TrophyCard trophy={item} />
        )}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  grid: {
    gap: 8,
  },
  row: {
    gap: 8,
    justifyContent: "flex-start",
  },
  shineContainer: {
    flex: 1,
    maxWidth: "33.33%",
    overflow: "hidden",
    borderRadius: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    alignItems: "center",
    gap: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  hubName: {
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 13,
  },
  monthLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
  },
  rankLabel: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  shineOverlay: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 12,
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  emptyEmoji: {
    fontSize: 32,
    opacity: 0.3,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  howToCard: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  howToTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  howToRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  howToRowText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  howToDivider: {
    height: 1,
    marginVertical: 2,
  },
  howToNote: {
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.7,
  },
});
