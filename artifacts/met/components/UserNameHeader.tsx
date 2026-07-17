/**
 * UserNameHeader
 *
 * Single reusable component that renders a user's display name next to their
 * VerificationBadge in a correctly-aligned flex row. Use this everywhere a
 * username appears alongside a badge to guarantee consistent spacing and
 * alignment across all device sizes.
 *
 * Usage:
 *   <UserNameHeader
 *     name={c.realName}
 *     nameStyle={[styles.name, { color: colors.foreground }]}
 *     isPioneer={isPioneer}
 *     trustScore={standing?.trustScore ?? 0}
 *     isSubscriber={standing?.isSubscriber ?? false}
 *     hasPhoto={!!c.photoUri}
 *   />
 */

import React from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";

import { VerificationBadge, type VerificationBadgeProps } from "./VerificationBadge";

export interface UserNameHeaderProps
  extends Omit<VerificationBadgeProps, "size" | "viewMode"> {
  name: string;
  nameStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  badgeSize?: "sm" | "md";
}

export function UserNameHeader({
  name,
  nameStyle,
  numberOfLines = 1,
  badgeSize = "sm",
  isPioneer,
  trustScore,
  isSubscriber,
  hasPhoto,
}: UserNameHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.nameText, nameStyle]} numberOfLines={numberOfLines}>
        {name}
      </Text>
      <VerificationBadge
        isPioneer={isPioneer}
        trustScore={trustScore}
        isSubscriber={isSubscriber}
        hasPhoto={hasPhoto}
        size={badgeSize}
        viewMode="compact"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  nameText: {
    flexShrink: 1,
  },
});
