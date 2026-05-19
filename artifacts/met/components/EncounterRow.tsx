import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import type { Encounter } from "@/lib/types";

function timeAgo(
  ts: number,
  t: (k: string, opts?: Record<string, unknown>) => string,
) {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return t("encounterRow.timeMomentAgo");
  if (diff < 120) return t("encounterRow.timeMinuteAgo");
  if (diff < 3600)
    return t("encounterRow.timeMinutesAgo", { count: Math.floor(diff / 60) });
  if (diff < 7200) return t("encounterRow.timeHourAgo");
  if (diff < 86400)
    return t("encounterRow.timeHoursAgo", { count: Math.floor(diff / 3600) });
  if (diff < 172800) return t("encounterRow.timeYesterday");
  return t("encounterRow.timeDaysAgo", { count: Math.floor(diff / 86400) });
}

type Props = {
  encounter: Encounter;
};

export function EncounterRow({ encounter }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { t } = useT();
  const { removeEncounter, setBlocked, profile } = useApp();

  const [menuOpen, setMenuOpen] = useState(false);

  const sharedInterest = useMemo(() => {
    const myInterests = profile?.interests;
    const theirInterests = encounter.interests;
    if (!myInterests?.length || !theirInterests?.length) return null;
    const mySet = new Set(myInterests);
    return theirInterests.find((i) => mySet.has(i)) ?? null;
  }, [profile?.interests, encounter.interests]);

  const statusBadge = (() => {
    switch (encounter.status) {
      case "request_sent":
        return {
          label: t("encounterRow.statusRequestSent"),
          color: colors.mutedForeground,
        };
      case "request_received":
        return {
          label: t("encounterRow.statusRequestReceived"),
          color: colors.primary,
        };
      case "connected":
        return {
          label: t("encounterRow.statusConnected"),
          color: colors.primary,
        };
      default:
        return null;
    }
  })();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() =>
          router.push(
            encounter.status === "connected"
              ? `/connection/${encounter.id}`
              : `/encounter/${encounter.id}`,
          )
        }
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
            {t("encounterRow.metAgo", { when: timeAgo(encounter.lastSeenAt, t) })}
          </Text>
          {statusBadge ? (
            <Text style={[styles.status, { color: statusBadge.color }]}>
              {statusBadge.label}
            </Text>
          ) : sharedInterest ? (
            <View style={[styles.repeatPill, { backgroundColor: "#EDE9FE" }]}>
              <Feather name="heart" size={10} color="#7C3AED" />
              <Text style={[styles.repeatText, { color: "#7C3AED" }]}>
                {t("encounterRow.sharedInterest", { interest: t(`interestLabels.${sharedInterest.toLowerCase()}`) })}
              </Text>
            </View>
          ) : encounter.status === "encounter" && encounter.encounterCount > 1 ? (
            <View
              style={[styles.repeatPill, { backgroundColor: "#DCFCE7" }]}
            >
              <Feather name="repeat" size={10} color={colors.primary} />
              <Text style={[styles.repeatText, { color: colors.primary }]}>
                {t("encounterRow.crossedAgainPill", {
                  count: encounter.encounterCount,
                })}
              </Text>
            </View>
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
            label: t("common.remove"),
            icon: "trash-2",
            destructive: true,
            onPress: () => removeEncounter(encounter.id),
          },
          {
            label: t("encounterRow.block"),
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
  repeatPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 4,
  },
  repeatText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
});
