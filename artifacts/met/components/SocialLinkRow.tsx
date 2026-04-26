import { FontAwesome5, Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { SocialPlatform } from "@/lib/types";

type Props = {
  platform: SocialPlatform;
  handle: string;
};

const PLATFORM_META: Record<
  SocialPlatform,
  { label: string; icon: React.ComponentProps<typeof FontAwesome5>["name"]; url: (h: string) => string }
> = {
  instagram: {
    label: "Instagram",
    icon: "instagram",
    url: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
  },
  x: {
    label: "X",
    icon: "twitter",
    url: (h) => `https://x.com/${h.replace(/^@/, "")}`,
  },
  tiktok: {
    label: "TikTok",
    icon: "tiktok",
    url: (h) => `https://tiktok.com/@${h.replace(/^@/, "")}`,
  },
  snapchat: {
    label: "Snapchat",
    icon: "snapchat-ghost",
    url: (h) => `https://snapchat.com/add/${h.replace(/^@/, "")}`,
  },
  linkedin: {
    label: "LinkedIn",
    icon: "linkedin-in",
    url: (h) => `https://linkedin.com/in/${h.replace(/^@/, "")}`,
  },
};

export function SocialLinkRow({ platform, handle }: Props) {
  const colors = useColors();
  const meta = PLATFORM_META[platform];

  const handleOpen = () => {
    WebBrowser.openBrowserAsync(meta.url(handle)).catch(() => {});
  };

  return (
    <Pressable
      onPress={handleOpen}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
        <FontAwesome5 name={meta.icon} size={16} color={colors.foreground} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {meta.label}
        </Text>
        <Text
          style={[styles.handle, { color: colors.foreground }]}
          numberOfLines={1}
        >
          @{handle.replace(/^@/, "")}
        </Text>
      </View>
      <Feather name="external-link" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
  label: { fontFamily: "Inter_400Regular", fontSize: 11 },
  handle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
