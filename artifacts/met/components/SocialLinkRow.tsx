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

export const PLATFORM_META: Record<
  SocialPlatform,
  {
    label: string;
    icon: React.ComponentProps<typeof FontAwesome5>["name"];
    bg: string;
    fg: string;
    url: (h: string) => string;
  }
> = {
  instagram: {
    label: "Instagram",
    icon: "instagram",
    bg: "#FCE7F3",
    fg: "#E1306C",
    url: (h) => `https://instagram.com/${h.replace(/^@/, "")}`,
  },
  facebook: {
    label: "Facebook",
    icon: "facebook",
    bg: "#DBEAFE",
    fg: "#1877F2",
    url: (h) => `https://facebook.com/${h.replace(/^@/, "")}`,
  },
  x: {
    label: "X",
    icon: "twitter",
    bg: "#E5E7EB",
    fg: "#0F172A",
    url: (h) => `https://x.com/${h.replace(/^@/, "")}`,
  },
  tiktok: {
    label: "TikTok",
    icon: "tiktok",
    bg: "#E5E7EB",
    fg: "#0F172A",
    url: (h) => `https://tiktok.com/@${h.replace(/^@/, "")}`,
  },
  snapchat: {
    label: "Snapchat",
    icon: "snapchat-ghost",
    bg: "#FEF3C7",
    fg: "#EAB308",
    url: (h) => `https://snapchat.com/add/${h.replace(/^@/, "")}`,
  },
  linkedin: {
    label: "LinkedIn",
    icon: "linkedin-in",
    bg: "#DBEAFE",
    fg: "#0A66C2",
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
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
        <FontAwesome5 name={meta.icon} size={18} color={meta.fg} />
      </View>
      <Text style={[styles.label, { color: colors.foreground }]}>
        {meta.label}
      </Text>
      <Feather name="external-link" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    flex: 1,
  },
});
