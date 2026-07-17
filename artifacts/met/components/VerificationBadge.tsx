/**
 * VerificationBadge
 *
 * Universal single-glyph verification mark shown inline next to user names.
 * Three tiers (highest wins):
 *
 *   ★ Gold  — Met Pioneer (isPioneer = true)
 *   ✓ Green — Highly Trusted (pioneerScore ≥ 250 — grows via referrals, check-ins, chats)
 *   ✓ Blue  — Active subscriber (Plus / Pro)
 *
 * Returns null when none of the conditions are met.
 */

import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export interface VerificationBadgeProps {
  isPioneer?: boolean;
  /** Activity score from server: referrals×20 + check-ins×2 + chat connections×5. */
  pioneerScore?: number;
  isSubscriber?: boolean;
  size?: "sm" | "md";
}

export function VerificationBadge({
  isPioneer = false,
  pioneerScore = 0,
  isSubscriber = false,
  size = "sm",
}: VerificationBadgeProps) {
  const iconSize = size === "sm" ? 12 : 15;

  if (isPioneer) {
    return (
      <View
        style={[styles.badge, styles.gold, size === "sm" ? styles.smPad : styles.mdPad]}
        accessibilityLabel="Met Pioneer"
        accessibilityRole="text"
      >
        <Text style={[styles.star, size === "sm" ? styles.smStar : styles.mdStar]}>★</Text>
      </View>
    );
  }

  if (pioneerScore >= 250) {
    return (
      <View
        style={[styles.badge, styles.green, size === "sm" ? styles.smPad : styles.mdPad]}
        accessibilityLabel="Highly trusted"
        accessibilityRole="text"
      >
        <Feather name="check-circle" size={iconSize} color="#15803D" />
      </View>
    );
  }

  if (isSubscriber) {
    return (
      <View
        style={[styles.badge, styles.blue, size === "sm" ? styles.smPad : styles.mdPad]}
        accessibilityLabel="Met subscriber"
        accessibilityRole="text"
      >
        <Feather name="check-circle" size={iconSize} color="#0369A1" />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  smPad: { padding: 2 },
  mdPad: { padding: 3 },
  gold: { backgroundColor: "rgba(212,175,55,0.18)", borderWidth: 1, borderColor: "#D4AF37" },
  green: { backgroundColor: "rgba(21,128,61,0.12)", borderWidth: 1, borderColor: "#4ADE80" },
  blue: { backgroundColor: "rgba(3,105,161,0.12)", borderWidth: 1, borderColor: "#7DD3FC" },
  star: { color: "#B8860B", fontFamily: "Inter_700Bold" },
  smStar: { fontSize: 11, lineHeight: 13 },
  mdStar: { fontSize: 14, lineHeight: 16 },
});
