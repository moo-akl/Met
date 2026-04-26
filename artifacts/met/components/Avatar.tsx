import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  uri?: string | null;
  size?: number;
  ring?: boolean;
};

export function Avatar({ uri, size = 56, ring }: Props) {
  const colors = useColors();
  const radius = size / 2;

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
      <Feather name="user" size={size * 0.45} color={colors.mutedForeground} />
    </View>
  );

  if (!ring) return <View>{inner}</View>;

  return (
    <View
      style={{
        padding: 2,
        borderRadius: radius + 3,
        borderWidth: 2,
        borderColor: colors.primary,
      }}
    >
      {inner}
    </View>
  );
}

const _u = StyleSheet.create({});
