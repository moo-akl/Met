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
import {
  getGetEventsFeedQueryKey,
  getGetMyPastHangoutsQueryKey,
  useGetEventsFeed,
  useGetMyPastHangouts,
  type EventFeedItem,
} from "@workspace/api-client-react";

export default function PlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { authedUid } = useApp();
  const feed = useGetEventsFeed(undefined, {
    query: {
      staleTime: 30_000,
      refetchOnMount: "always",
      enabled: !!authedUid,
      queryKey: [...getGetEventsFeedQueryKey(), authedUid ?? "signed-out"],
    },
  });
  const pastHangouts = useGetMyPastHangouts({
    query: {
      enabled: !!authedUid,
      staleTime: 30_000,
      refetchOnMount: "always",
      queryKey: [...getGetMyPastHangoutsQueryKey(), authedUid ?? "signed-out"],
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
      event.visibility === "invite_only" &&
      !event.joinApprovalRequired &&
      (event.ownerUid === authedUid || event.isInvited || event.myRsvp === "going" || event.myRsvp === "maybe"),
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()), [feed.data?.events, authedUid]);

  const openPlan = (event: EventFeedItem) => router.push(`/event-chat/${event.id}` as never);

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
          onPress={() => router.push("/event-create" as never)}
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
            <Pressable accessibilityRole="button" testID="plans-empty-create" onPress={() => router.push("/event-create" as never)} style={[styles.emptyAction, { backgroundColor: colors.primary }]}>
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
                  accessibilityLabel={t("plans.openChatTitleA11y", { title: event.title })}
                  testID={`plan-row-${event.id}`}
                  onPress={() => openPlan(event)}
                  style={({ pressed }) => [styles.plan, { borderTopColor: colors.border, opacity: pressed ? 0.78 : 1 }]}
                >
                  <View style={styles.dateColumn}>
                    <View style={[styles.dateBadge, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.month, { color: colors.primary }]}>{date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</Text>
                    <Text style={[styles.day, { color: colors.text }]}>{date.getDate()}</Text>
                    </View>
                    <View style={[styles.datePin, { backgroundColor: colors.primary }]} />
                  </View>
                  <View style={styles.planCopy}>
                    <Text style={[styles.meta, { color: colors.primary }]}>{date.toLocaleDateString(undefined, { weekday: "long" })} · {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</Text>
                    <Text style={[styles.planTitle, { color: colors.text }]} numberOfLines={2}>{event.title}</Text>
                    {event.location ? <Text style={[styles.meta, { color: colors.mutedForeground }]}>{event.location}</Text> : null}
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
                                : t("tabs.events.invited")}
                    </Text>
                  </View>
                  <View style={styles.chatMark}><Feather name="message-circle" size={17} color={colors.primary} /><Feather name="arrow-up-right" size={14} color={colors.mutedForeground} /></View>
                </Pressable>
              );
            })}
          </View>
        )}
        {authedUid ? (
          <View style={styles.pastSection}>
            <Text style={[styles.pastHeading, { color: colors.text }]}>
              {t("plans.pastHangoutsTitle")}
            </Text>
            {pastHangouts.isLoading ? (
              <View style={styles.pastState}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : pastHangouts.isError ? (
              <Pressable
                accessibilityRole="button"
                testID="past-hangouts-retry"
                onPress={() => void pastHangouts.refetch()}
                style={[styles.pastEmpty, { borderColor: colors.border }]}
              >
                <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
                  {t("plans.screenLoadError")}
                </Text>
                <Text style={[styles.pastAction, { color: colors.primary }]}>
                  {t("plans.retry")}
                </Text>
              </Pressable>
            ) : (pastHangouts.data?.events.length ?? 0) === 0 ? (
              <Text style={[styles.pastEmptyText, { color: colors.mutedForeground }]}>
                {t("plans.pastHangoutsEmpty")}
              </Text>
            ) : (
              <View style={styles.pastList}>
                {pastHangouts.data?.events.map((event) => (
                  <Pressable
                    key={event.id}
                    accessibilityRole="button"
                    testID={`past-hangout-${event.id}`}
                    onPress={() => router.push(`/event-details/member/${event.id}` as never)}
                    style={({ pressed }) => [
                      styles.pastRow,
                      { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
                    <View style={[styles.pastIcon, { backgroundColor: colors.primarySoft }]}>
                      <Feather name="calendar" size={17} color={colors.primary} />
                    </View>
                    <View style={styles.pastCopy}>
                      <Text style={[styles.pastRowTitle, { color: colors.text }]} numberOfLines={2}>
                        {event.title}
                      </Text>
                      <Text style={[styles.pastRowMeta, { color: colors.mutedForeground }]}>
                        {new Date(event.startsAt).toLocaleDateString()} · {event.creatorName ?? t("tabs.events.planHost")}
                      </Text>
                      <Text style={[styles.pastAction, { color: colors.primary }]}>
                        {event.myRating == null
                          ? t("plans.rateHost")
                          : `${t("plans.updateHostRating")} · ${event.myRating}/5`}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 22, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 40, height: 44, justifyContent: "center" },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 1.7, marginBottom: 4 },
  title: { fontFamily: "serif", fontSize: 39, fontWeight: "400", letterSpacing: -1 },
  create: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 22, gap: 17 },
  intro: { fontSize: 14, lineHeight: 21, maxWidth: 330, marginBottom: 8 },
  state: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 12 },
  stateText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  empty: { minHeight: 236, borderTopRightRadius: 52, borderBottomLeftRadius: 38, alignItems: "center", justifyContent: "center", padding: 26, gap: 9 },
  sun: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptyAction: { marginTop: 8, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 7 },
  actionText: { fontSize: 13, fontWeight: "700" },
  list: { gap: 0, paddingLeft: 2 },
  plan: { minHeight: 116, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 3, paddingVertical: 17, flexDirection: "row", alignItems: "flex-start", gap: 14 },
  dateColumn: { width: 54, alignItems: "center", paddingTop: 2 },
  dateBadge: { width: 48, height: 53, borderTopLeftRadius: 18, borderBottomRightRadius: 18, alignItems: "center", justifyContent: "center" },
  datePin: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  month: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  day: { fontFamily: "serif", fontSize: 23, fontWeight: "400", lineHeight: 27 },
  planCopy: { flex: 1, gap: 5, paddingTop: 2 },
  planTitle: { fontFamily: "serif", fontSize: 20, lineHeight: 25, fontWeight: "400", marginTop: 1 },
  meta: { fontSize: 11, lineHeight: 16 },
  host: { fontSize: 10, fontWeight: "700", marginTop: 3 },
  chatMark: { alignItems: "center", gap: 5, paddingHorizontal: 3, paddingTop: 7 },
  pastSection: { marginTop: 14, gap: 12 },
  pastHeading: { fontFamily: "serif", fontSize: 23, fontWeight: "400" },
  pastState: { minHeight: 70, alignItems: "center", justifyContent: "center" },
  pastEmpty: { padding: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, alignItems: "center", gap: 6 },
  pastEmptyText: { fontSize: 13, lineHeight: 19 },
  pastList: { gap: 8 },
  pastRow: { minHeight: 82, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 11 },
  pastIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  pastCopy: { flex: 1, gap: 4 },
  pastRowTitle: { fontSize: 14, lineHeight: 19, fontWeight: "700" },
  pastRowMeta: { fontSize: 11 },
  pastAction: { fontSize: 12, fontWeight: "700", marginTop: 2 },
});
