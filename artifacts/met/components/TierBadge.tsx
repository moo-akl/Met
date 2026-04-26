import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Tier } from "@/lib/revenuecat";

type Props = {
  tier: Tier;
  size?: "sm" | "md";
  showLabel?: boolean;
};

// Visual signal of an active subscription:
// - Plus  → green check ("verified")
// - Pro   → green check + gold star ("verified + premium")
// - Free  → renders nothing
export function TierBadge({ tier, size = "sm", showLabel = false }: Props) {
  if (tier === "free") return null;

  const dim = size === "md" ? 22 : 18;
  const iconSize = size === "md" ? 13 : 11;
  const isPro = tier === "pro";

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.dot,
          {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            backgroundColor: "#3DCC44",
          },
        ]}
      >
        <Feather name="check" size={iconSize} color="#FFFFFF" />
      </View>
      {isPro ? (
        <View
          style={[
            styles.dot,
            {
              width: dim,
              height: dim,
              borderRadius: dim / 2,
              backgroundColor: "#F5B700",
              marginLeft: -6,
            },
          ]}
        >
          <Feather name="star" size={iconSize} color="#FFFFFF" />
        </View>
      ) : null}
      {showLabel ? (
        <Text
          style={[
            styles.label,
            { color: isPro ? "#9C7A00" : "#1B7A23", marginLeft: 6 },
          ]}
        >
          {isPro ? "Met Pro" : "Met Plus"}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  dot: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.4,
  },
});
