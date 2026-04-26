import { FontAwesome5 } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { PLATFORM_META } from "@/components/SocialLinkRow";
import type { SocialPlatform } from "@/lib/types";

type Props = {
  platform: SocialPlatform;
  handle: string;
  size?: number;
};

export function SocialChip({ platform, handle, size = 44 }: Props) {
  const meta = PLATFORM_META[platform];

  const handleOpen = () => {
    WebBrowser.openBrowserAsync(meta.url(handle)).catch(() => {});
  };

  return (
    <Pressable
      onPress={handleOpen}
      style={({ pressed }) => [
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: meta.bg,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <FontAwesome5 name={meta.icon} size={size * 0.45} color={meta.fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    justifyContent: "center",
  },
});
