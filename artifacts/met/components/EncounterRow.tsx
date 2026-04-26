import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import type { Encounter } from "@/lib/types";

function timeAgo(ts: number) {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return "a moment ago";
  if (diff < 120) return "a minute ago";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 7200) return "an hour ago";
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return "yesterday";
  return `${Math.floor(diff / 86400)} days ago`;
}

type Props = {
  encounter: Encounter;
};

export function EncounterRow({ encounter }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { removeEncounter, setBlocked } = useApp();

  const [menuOpen, setMenuOpen] = useState(false);

  const statusBadge = (() => {
    switch (encounter.status) {
      case "request_sent":
        return { label: "Reveal request sent", color: colors.mutedForeground };
      case "request_received":
        return { label: "Wants to share socials", color: colors.primary };
      case "connected":
        return { label: "Connected", color: colors.primary };
      default:
        return null;
    }
  })();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push(`/encounter/${encounter.id}`)}
        style={({ pressed }) => [
          styles.tapArea,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Avatar
          uri={encounter.photoUri}
          size={54}
          ring={encounter.status === "request_received"}
        />
        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {encounter.realName}
          </Text>
          <Text
            style={[styles.meta, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            Met {timeAgo(encounter.lastSeenAt)}
          </Text>
          {statusBadge ? (
            <Text style={[styles.status, { color: statusBadge.color }]}>
              {statusBadge.label}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        onPress={() => setMenuOpen(true)}
        hitSlop={12}
        style={({ pressed }) => [
          styles.menuBtn,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Feather name="more-vertical" size={20} color={colors.mutedForeground} />
      </Pressable>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={encounter.realName}
        actions={[
          {
            label: "Remove",
            icon: "trash-2",
            destructive: true,
            onPress: () => removeEncounter(encounter.id),
          },
          {
            label: "Block",
            icon: "slash",
            destructive: true,
            onPress: () => setBlocked(encounter.id, true),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  tapArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingRight: 8,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  meta: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  status: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 2,
  },
  menuBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});
