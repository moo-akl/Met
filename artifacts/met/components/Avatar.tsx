import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  uri?: string | null;
  size?: number;
  revealed?: boolean;
  ring?: boolean;
};

export function Avatar({ uri, size = 56, revealed = true, ring }: Props) {
  const colors = useColors();
  const radius = size / 2;

  const inner = revealed && uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: radius }}
      contentFit="cover"
      transition={200}
    />
  ) : (
    <LinearGradient
      colors={["#2A2A38", "#16161E"]}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather name="user" size={size * 0.45} color={colors.mutedForeground} />
    </LinearGradient>
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

const _unused = StyleSheet.create({});
