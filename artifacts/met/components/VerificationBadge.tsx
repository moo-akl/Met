/**
 * VerificationBadge
 *
 * Universal single-glyph verification mark shown inline next to user names.
 * Four tiers (highest wins — only one shows):
 *
 *   ★ Gold   — Met Pioneer            (isPioneer = true)
 *   ✓ Green  — Highly Trusted         (trustScore ≥ 250)
 *   ✓ Blue   — Active subscriber      (Plus / Pro)
 *   ✓ Gray   — Photo-verified profile (hasPhoto = true, base tier)
 *
 * The gray tier is the baseline — it shows for any user who has uploaded a
 * profile photo, so the mark is visible in typical usage from day one.
 */

import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export interface VerificationBadgeProps {
  isPioneer?: boolean;
  trustScore?: number;
  isSubscriber?: boolean;
  /** True when the peer has a non-empty profile photo — the base verified tier. */
  hasPhoto?: boolean;
  size?: "sm" | "md";
}

export function VerificationBadge({
  isPioneer = false,
  trustScore = 0,
  isSubscriber = false,
  hasPhoto = false,
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

  if (trustScore >= 250) {
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

  if (hasPhoto) {
    return (
      <View
        style={[styles.badge, styles.gray, size === "sm" ? styles.smPad : styles.mdPad]}
        accessibilityLabel="Photo verified"
        accessibilityRole="text"
      >
        <Feather name="check-circle" size={iconSize} color="#6B7280" />
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
  gray: { backgroundColor: "rgba(107,114,128,0.10)", borderWidth: 1, borderColor: "#9CA3AF" },
  star: { color: "#B8860B", fontFamily: "Inter_700Bold" },
  smStar: { fontSize: 11, lineHeight: 13 },
  mdStar: { fontSize: 14, lineHeight: 16 },
});
