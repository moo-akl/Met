import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "@/components/MetGradient";
import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  title: string;
  description: string;
  hintIcon?: React.ComponentProps<typeof Feather>["name"];
  hint?: string;
};

// A "constellation" of small ghost avatars surrounding a central pulse —
// gives a brand-new (production) user a richer first-launch moment than a
// generic empty-state icon. Pure RN primitives, no image assets, no
// animation libraries — safe to render on any device with no startup cost.
const GHOST_POSITIONS: Array<{
  top: string;
  left: string;
  size: number;
  opacity: number;
}> = [
  { top: "10%", left: "18%", size: 28, opacity: 0.55 },
  { top: "8%", left: "70%", size: 22, opacity: 0.4 },
  { top: "30%", left: "8%", size: 24, opacity: 0.45 },
  { top: "32%", left: "82%", size: 30, opacity: 0.6 },
  { top: "62%", left: "16%", size: 22, opacity: 0.4 },
  { top: "68%", left: "74%", size: 26, opacity: 0.5 },
  { top: "82%", left: "44%", size: 20, opacity: 0.35 },
];

export function WelcomeEmptyState({ title, description, hintIcon, hint }: Props) {
  const colors = useColors();

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[colors.secondary, colors.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.illustration, { borderColor: colors.border }]}
      >
        {GHOST_POSITIONS.map((pos, i) => (
          <View
            key={i}
            style={
              [
                styles.ghost,
                {
                  top: pos.top,
                  left: pos.left,
                  width: pos.size,
                  height: pos.size,
                  borderRadius: pos.size / 2,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pos.opacity,
                },
              ] as ViewStyle[]
            }
          >
            <Feather
              name="user"
              size={Math.round(pos.size * 0.55)}
              color={colors.mutedForeground}
            />
          </View>
        ))}

        <View
          style={[
            styles.centerHaloOuter,
            { backgroundColor: colors.primary, opacity: 0.12 },
          ]}
        />
        <View
          style={[
            styles.centerHaloInner,
            { backgroundColor: colors.primary, opacity: 0.18 },
          ]}
        />
        <View
          style={[
            styles.centerCore,
            {
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            },
          ]}
        >
          <Feather name="user" size={28} color="#fff" />
        </View>
      </LinearGradient>

      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.desc, { color: colors.mutedForeground }]}>
        {description}
      </Text>

      {hint ? (
        <View
          style={[
            styles.hintPill,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          {hintIcon ? (
            <Feather name={hintIcon} size={14} color={colors.primary} />
          ) : null}
          <Text style={[styles.hintText, { color: colors.foreground }]}>
            {hint}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 56,
    paddingHorizontal: 24,
    gap: 14,
  },
  illustration: {
    width: "100%",
    maxWidth: 360,
    aspectRatio: 1.2,
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  ghost: {
    position: "absolute",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerHaloOuter: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  centerHaloInner: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  centerCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    textAlign: "center",
    marginTop: 8,
  },
  desc: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
  },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
  },
  hintText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
});
