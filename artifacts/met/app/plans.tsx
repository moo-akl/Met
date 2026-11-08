import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { isPlanEvent } from "@/lib/eventFeedClassification";
import { useEventReminderCleanup } from "@/hooks/useEventReminderCleanup";
import { getGetEventsFeedQueryKey, useGetEventsFeed, type EventFeedItem } from "@workspace/api-client-react";

export default function PlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { authedUid } = useApp();
  const feed = useGetEventsFeed({
    query: {
      staleTime: 30_000,
      refetchOnMount: "always",
      enabled: !!authedUid,
      queryKey: [...getGetEventsFeedQueryKey(), authedUid ?? "signed-out"],
    },
  });
  useEventReminderCleanup(
    authedUid,
    feed.data?.events ?? [],
    feed.isSuccess && !feed.isFetching,
    feed.refetch,
  );
  const plans = useMemo(() => (feed.data?.events ?? [])
    .filter((event: EventFeedItem) =>
      isPlanEvent(event) &&
      (event.joinApprovalRequired || event.ownerUid === authedUid || event.isInvited || event.myRsvp === "going" || event.myRsvp === "maybe" || event.myJoinRequestStatus === "pending"),
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()), [feed.data?.events, authedUid]);

  const openPlan = (event: EventFeedItem) => router.push(
    event.joinApprovalRequired
      ? `/event-details/member/${event.id}` as never
      : `/event-chat/${event.id}` as never,
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} testID="button-back-plans" onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{t("plans.screenKicker")}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{t("plans.screenTitle")}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("plans.createA11y")}
          testID="plans-create"
          onPress={() => router.push({ pathname: "/event-create", params: { mode: "plan" } } as never)}
          style={[styles.create, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={21} color={colors.primaryForeground} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>{t("plans.screenIntro")}</Text>
        {!authedUid || feed.isLoading ? (
          <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={[styles.stateText, { color: colors.mutedForeground }]}>{t("plans.loading")}</Text></View>
        ) : feed.isError ? (
          <Pressable accessibilityRole="button" testID="plans-retry" onPress={() => void feed.refetch()} style={[styles.empty, { backgroundColor: colors.primarySoft }]}>
            <Feather name="refresh-cw" size={22} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("plans.screenLoadError")}</Text>
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{t("plans.retry")}</Text>
          </Pressable>
        ) : plans.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.primarySoft }]}>
            <View style={[styles.sun, { backgroundColor: colors.card }]}><Feather name="sun" size={20} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("plans.screenEmptyTitle")}</Text>
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{t("plans.screenEmptyBody")}</Text>
            <Pressable accessibilityRole="button" testID="plans-empty-create" onPress={() => router.push({ pathname: "/event-create", params: { mode: "plan" } } as never)} style={[styles.emptyAction, { backgroundColor: colors.primary }]}>
              <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{t("plans.make")}</Text>
              <Feather name="arrow-up-right" size={16} color={colors.primaryForeground} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {plans.map((event) => {
              const date = new Date(event.startsAt);
              const owner = event.ownerUid === authedUid;
              return (
                <Pressable
                  key={`${event.eventType}:${event.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={event.joinApprovalRequired
                    ? `${event.title}. ${t("tabs.events.detailsView")}`
                    : t("plans.openChatTitleA11y", { title: event.title })}
                  testID={`plan-row-${event.id}`}
                  onPress={() => openPlan(event)}
                  style={({ pressed }) => [styles.plan, { borderBottomColor: colors.border, opacity: pressed ? 0.78 : 1 }]}
                >
                  <View style={[styles.dateBadge, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.month, { color: colors.primary }]}>{date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</Text>
                    <Text style={[styles.day, { color: colors.text }]}>{date.getDate()}</Text>
                  </View>
                  <View style={styles.planCopy}>
                    <Text style={[styles.planTitle, { color: colors.text }]} numberOfLines={2}>{event.title}</Text>
                    <Text style={[styles.meta, { color: colors.mutedForeground }]}>{date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{event.location ? ` · ${event.location}` : ""}</Text>
                    <Text style={[styles.host, { color: colors.primary }]}>
                      {owner
                        ? t("plans.hosting")
                        : event.myJoinRequestStatus === "pending"
                          ? t("tabs.events.joinRequestPending")
                          : event.myJoinRequestStatus === "declined"
                            ? t("tabs.events.requestAgain")
                          : event.myRsvp === "going"
                            ? t("tabs.events.going")
                            : event.myRsvp === "maybe"
                              ? t("tabs.events.interested")
                              : event.myRsvp === "not_going"
                                ? t("tabs.events.notGoing")
                                : event.joinApprovalRequired
                                  ? t("tabs.events.requestToJoin")
                                  : t("tabs.events.invited")}
                    </Text>
                  </View>
                  <View style={styles.chatMark}><Feather name={event.joinApprovalRequired ? "map-pin" : "message-circle"} size={17} color={colors.primary} /><Feather name="arrow-up-right" size={14} color={colors.mutedForeground} /></View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 18, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 40, height: 44, justifyContent: "center" },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5, marginBottom: 3 },
  title: { fontSize: 30, fontWeight: "700", letterSpacing: -0.6 },
  create: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, gap: 17 },
  intro: { fontSize: 14, lineHeight: 21, maxWidth: 330, marginBottom: 3 },
  state: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 12 },
  stateText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  empty: { minHeight: 236, borderTopRightRadius: 52, borderBottomLeftRadius: 38, alignItems: "center", justifyContent: "center", padding: 26, gap: 9 },
  sun: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptyAction: { marginTop: 8, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 7 },
  actionText: { fontSize: 13, fontWeight: "700" },
  list: { gap: 0, paddingLeft: 3 },
  plan: { minHeight: 108, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 14, borderTopLeftRadius: 34 },
  dateBadge: { width: 56, height: 64, borderTopLeftRadius: 28, borderBottomRightRadius: 28, alignItems: "center", justifyContent: "center" },
  month: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  day: { fontSize: 23, fontWeight: "700", lineHeight: 28 },
  planCopy: { flex: 1, gap: 4 },
  planTitle: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 11 },
  host: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  chatMark: { alignItems: "center", gap: 5, paddingHorizontal: 3 },
});
