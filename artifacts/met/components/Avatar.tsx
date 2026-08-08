import { Feather } from "@expo/vector-icons";
import { Image } from "@/components/MetImage";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  uri?: string | null;
  size?: number;
  ring?: boolean;
  /** Override the ring border colour. Defaults to the theme primary colour. */
  ringColor?: string;
  fallbackText?: string;
};

export function Avatar({ uri, size = 56, ring, ringColor, fallbackText }: Props) {
  const colors = useColors();
  const radius = size / 2;

  const initial = fallbackText
    ? fallbackText.trim().charAt(0).toUpperCase()
    : "";

  const inner = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: radius }}
      contentFit="cover"
      transition={200}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: colors.muted,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {initial ? (
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_700Bold",
            fontSize: size * 0.4,
          }}
        >
          {initial}
        </Text>
      ) : (
        <Feather
          name="user"
          size={size * 0.45}
          color={colors.mutedForeground}
        />
      )}
    </View>
  );

  if (!ring) return <View>{inner}</View>;

  return (
    <View
      style={{
        padding: 2,
        borderRadius: radius + 3,
        borderWidth: 2,
        borderColor: ringColor ?? colors.primary,
      }}
    >
      {inner}
    </View>
  );
}

const _u = StyleSheet.create({});
