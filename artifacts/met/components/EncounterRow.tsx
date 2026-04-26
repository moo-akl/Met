import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import type { Encounter } from "@/lib/types";

function timeAgo(ts: number) {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type Props = {
  encounter: Encounter;
};

export function EncounterRow({ encounter }: Props) {
  const colors = useColors();
  const router = useRouter();
  const revealed = encounter.status === "connected";

  const statusBadge = (() => {
    switch (encounter.status) {
      case "request_sent":
        return { label: "Request sent", color: colors.mutedForeground };
      case "request_received":
        return { label: "Wants to reveal", color: colors.primary };
      case "connected":
        return { label: "Connected", color: "#7CD27C" };
      default:
        return null;
    }
  })();

  return (
    <Pressable
      onPress={() => router.push(`/encounter/${encounter.id}`)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Avatar
        uri={encounter.photoUri}
        size={54}
        revealed={revealed}
        ring={encounter.status === "request_received"}
      />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.name, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {revealed ? encounter.realName : "Someone nearby"}
          </Text>
          {encounter.encounterCount > 1 ? (
            <View
              style={[
                styles.countBadge,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Text style={[styles.countText, { color: colors.foreground }]}>
                ×{encounter.encounterCount}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={11} color={colors.mutedForeground} />
          <Text
            style={[styles.meta, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {encounter.lastDistanceM}m · {encounter.lastLocation}
          </Text>
          <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
          <Text style={[styles.meta, { color: colors.mutedForeground }]}>
            {timeAgo(encounter.lastSeenAt)}
          </Text>
        </View>
        {statusBadge ? (
          <Text
            style={[styles.status, { color: statusBadge.color }]}
            numberOfLines={1}
          >
            {statusBadge.label}
          </Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    flexShrink: 1,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  meta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    flexShrink: 1,
  },
  dot: {
    fontSize: 12.5,
  },
  status: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 2,
  },
});
