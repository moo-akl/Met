/**
 * TrustScoreBadge
 *
 * Displays a color-coded pill showing a user's trust score.
 *
 * Tiers:
 *   Green  (150+) — Trusted
 *   Yellow (100–149) — Neutral (default)
 *   Red    (<100)  — Flagged
 *
 * Pass size="sm" for inline use next to a name, size="md" for profile hero.
 */

import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Tier = "trusted" | "neutral" | "flagged";

function getTier(score: number): Tier {
  if (score >= 150) return "trusted";
  if (score >= 100) return "neutral";
  return "flagged";
}

const TIER_CONFIG: Record<
  Tier,
  { bg: string; text: string; icon: "shield" | "shield-off"; label: string }
> = {
  trusted: { bg: "#DCFCE7", text: "#15803D", icon: "shield", label: "Trusted" },
  neutral: { bg: "#FEF9C3", text: "#92400E", icon: "shield", label: "Neutral" },
  flagged: { bg: "#FEE2E2", text: "#B91C1C", icon: "shield-off", label: "Flagged" },
};

interface Props {
  score: number;
  size?: "sm" | "md";
  showScore?: boolean;
}

export function TrustScoreBadge({ score, size = "sm", showScore = false }: Props) {
  const tier = getTier(score);
  const cfg = TIER_CONFIG[tier];
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: cfg.bg,
          paddingHorizontal: isSmall ? 7 : 10,
          paddingVertical: isSmall ? 3 : 5,
          gap: isSmall ? 4 : 5,
        },
      ]}
      accessibilityLabel={`Trust score: ${score} — ${cfg.label}`}
      accessibilityRole="text"
    >
      <Feather
        name={cfg.icon}
        size={isSmall ? 11 : 14}
        color={cfg.text}
      />
      {showScore ? (
        <Text style={[styles.label, { color: cfg.text, fontSize: isSmall ? 11 : 13 }]}>
          {score}
        </Text>
      ) : null}
      <Text
        style={[
          styles.label,
          { color: cfg.text, fontSize: isSmall ? 11 : 13 },
        ]}
      >
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  label: {
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
