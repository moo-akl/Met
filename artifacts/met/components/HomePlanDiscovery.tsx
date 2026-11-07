import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { getGetEventsFeedQueryKey, useGetEventsFeed, type EventFeedItem } from "@workspace/api-client-react";

function dateLabel(value: string) {
  const date = new Date(value);
  return {
    day: date.toLocaleDateString(undefined, { day: "2-digit" }),
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

export function HomePlanDiscovery() {
  const colors = useColors();
  const router = useRouter();
  const { t } = useT();
  const { authedUid } = useApp();
  const feed = useGetEventsFeed({
    query: {
      staleTime: 30_000,
      enabled: !!authedUid,
      queryKey: [...getGetEventsFeedQueryKey(), authedUid ?? "signed-out"],
    },
  });
  const plans = useMemo(() => {
    const events = feed.data?.events ?? [];
    return events
      .filter((event: EventFeedItem) =>
        event.eventType === "member" &&
        (event.ownerUid === authedUid || event.myRsvp === "going" || event.myRsvp === "maybe"),
      )
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 3);
  }, [feed.data?.events, authedUid]);

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View>
          <Text style={[styles.kicker, { color: colors.primary }]}>{t("plans.homeKicker")}</Text>
          <Text style={[styles.heading, { color: colors.text }]}>{t("plans.homeTitle")}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("plans.seeAllA11y")}
          testID="home-see-all-plans"
          hitSlop={8}
          onPress={() => router.push("/plans" as never)}
          style={styles.seeAll}
        >
          <Text style={[styles.seeAllText, { color: colors.primary }]}>{t("plans.all")}</Text>
          <Feather name="arrow-up-right" size={16} color={colors.primary} />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("plans.createA11y")}
        testID="home-create-plan"
        onPress={() => router.push({ pathname: "/event-create", params: { mode: "plan" } } as never)}
        style={({ pressed }) => [styles.create, { backgroundColor: colors.brandPanel, opacity: pressed ? 0.86 : 1 }]}
      >
        <View style={styles.createIcon}><Feather name="plus" size={20} color={colors.brandPanelText} /></View>
        <View style={styles.createCopy}>
          <Text style={[styles.createTitle, { color: colors.brandPanelText }]}>{t("plans.create")}</Text>
          <Text style={styles.createSub}>{t("plans.createSubtitle")}</Text>
        </View>
        <Feather name="arrow-up-right" size={18} color={colors.brandPanelText} />
      </Pressable>
      {!authedUid || feed.isLoading ? (
        <View style={styles.loading} accessibilityLabel={t("plans.loading")}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>{t("plans.loading")}</Text>
        </View>
      ) : feed.isError ? (
        <Pressable accessibilityRole="button" testID="home-plans-retry" onPress={() => void feed.refetch()} style={styles.inlineState}>
          <Feather name="refresh-cw" size={15} color={colors.primary} />
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>{t("plans.loadError")}</Text>
        </Pressable>
      ) : plans.length ? (
        <View style={styles.planList}>
          {plans.map((plan, index) => <PlanRow key={`${plan.eventType}:${plan.id}`} event={plan} index={index} />)}
        </View>
      ) : (
        <View style={[styles.empty, { backgroundColor: colors.primarySoft }]}>
          <View style={styles.emptyMark}><Feather name="sun" size={17} color={colors.primary} /></View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("plans.emptyTitle")}</Text>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>{t("plans.emptyBody")}</Text>
        </View>
      )}
    </View>
  );

  function PlanRow({ event, index }: { event: EventFeedItem; index: number }) {
    const date = dateLabel(event.startsAt);
    const attending = event.myRsvp === "going" ? t("tabs.events.going") : event.myRsvp === "maybe" ? t("tabs.events.interested") : t("plans.hosting");
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("plans.openChatA11y", { title: event.title })}
        testID={`home-plan-${event.id}`}
        onPress={() => router.push(`/event-chat/${event.id}` as never)}
        style={({ pressed }) => [
          styles.planRow,
          { backgroundColor: index === 0 ? colors.card : "transparent", borderBottomColor: colors.border, opacity: pressed ? 0.78 : 1 },
          index === 0 && { borderTopColor: colors.border },
        ]}
      >
        <View style={[styles.dateMark, { backgroundColor: index === 0 ? colors.primarySoft : colors.muted }]}>
          <Text style={[styles.month, { color: colors.primary }]}>{date.month}</Text>
          <Text style={[styles.day, { color: colors.text }]}>{date.day}</Text>
        </View>
        <View style={styles.planCopy}>
          <Text numberOfLines={1} style={[styles.planTitle, { color: colors.text }]}>{event.title}</Text>
          <Text numberOfLines={1} style={[styles.planMeta, { color: colors.mutedForeground }]}>
            {date.time}{event.location ? ` · ${event.location}` : ""}
          </Text>
        </View>
        <View style={styles.status}>
          <Text style={[styles.statusText, { color: colors.primary }]}>{attending}</Text>
          <Feather name="message-circle" size={16} color={colors.primary} />
        </View>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  section: { marginTop: 24, marginBottom: 18 },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 18, marginBottom: 13 },
  kicker: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginBottom: 4 },
  heading: { fontSize: 23, fontWeight: "700", letterSpacing: -0.5 },
  seeAll: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllText: { fontSize: 13, fontWeight: "600" },
  create: { minHeight: 74, borderTopRightRadius: 30, borderBottomRightRadius: 30, marginRight: 30, marginBottom: 12, paddingHorizontal: 17, flexDirection: "row", alignItems: "center", gap: 12 },
  createIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  createCopy: { flex: 1 },
  createTitle: { fontSize: 16, fontWeight: "700" },
  createSub: { color: "rgba(244,251,243,0.72)", fontSize: 12, marginTop: 3 },
  loading: { paddingVertical: 18, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 9 },
  inlineState: { minHeight: 54, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 9 },
  muted: { fontSize: 12, lineHeight: 18 },
  planList: { paddingLeft: 12 },
  planRow: { minHeight: 76, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 12, borderTopLeftRadius: 24, borderBottomLeftRadius: 24, marginBottom: 7 },
  dateMark: { width: 49, height: 52, borderTopLeftRadius: 17, borderBottomRightRadius: 17, alignItems: "center", justifyContent: "center" },
  month: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  day: { fontSize: 19, fontWeight: "700", lineHeight: 22 },
  planCopy: { flex: 1, gap: 4 },
  planTitle: { fontSize: 14, fontWeight: "700" },
  planMeta: { fontSize: 11 },
  status: { alignItems: "flex-end", gap: 5, paddingRight: 5 },
  statusText: { fontSize: 10, fontWeight: "700" },
  empty: { paddingVertical: 17, paddingHorizontal: 18, borderTopRightRadius: 30, borderBottomLeftRadius: 30, marginHorizontal: 14, gap: 5 },
  emptyMark: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(61,204,68,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 3 },
  emptyTitle: { fontSize: 14, fontWeight: "700" },
});
