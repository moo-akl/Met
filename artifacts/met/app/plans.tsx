import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { MetText as Text } from "@/components/MetText";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { isPlanEvent } from "@/lib/eventFeedClassification";
import { useEventReminderCleanup } from "@/hooks/useEventReminderCleanup";
import {
  getGetEventsFeedQueryKey,
  useGetEventsFeed,
  type EventFeedItem,
} from "@workspace/api-client-react";

export default function PlansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { authedUid } = useApp();
  const [planFilter, setPlanFilter] = useState<"all" | "hosting" | "invitations">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "week">("all");
  const [dateOptionsOpen, setDateOptionsOpen] = useState(false);
  const feed = useGetEventsFeed(undefined, {
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
      event.visibility === "invite_only" &&
      !event.joinApprovalRequired &&
      event.myRsvp !== "not_going" &&
      (event.ownerUid === authedUid || event.isInvited || event.myRsvp === "going" || event.myRsvp === "maybe"),
    ).filter((event: EventFeedItem) => {
      if (planFilter === "hosting") return event.ownerUid === authedUid;
      if (planFilter === "invitations") return event.ownerUid !== authedUid;
      return true;
    }).filter((event: EventFeedItem) => {
      if (dateFilter === "all") return true;
      const startsAt = Date.parse(event.startsAt);
      const now = Date.now();
      return startsAt >= now && startsAt < now + 7 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()), [feed.data?.events, authedUid, dateFilter, planFilter]);

  const openPlan = (event: EventFeedItem) => {
    router.push(`/event-details/member/${event.id}` as never);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 8) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} testID="button-back-plans" onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{t("plans.screenKicker")}</Text>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: colors.text }]}
          >
            {t("plans.screenTitle")}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("plans.createA11y")}
          testID="plans-create"
          onPress={() => router.push({
            pathname: "/event-create",
            params: { mode: "friends" },
          } as never)}
          style={[styles.create, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={21} color={colors.primaryForeground} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 28) }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>{t("plans.friendOnlyIntro")}</Text>
        <View style={styles.filters} accessibilityRole="tablist" testID="plans-category-filters">
          {([
            ["all", t("plans.all")],
            ["hosting", t("plans.hosting")],
            ["invitations", t("tabs.events.invited")],
          ] as const).map(([filter, label]) => {
            const selected = planFilter === filter;
            return (
              <Pressable
                key={filter}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                testID={`plans-filter-${filter}`}
                onPress={() => setPlanFilter(filter)}
                style={[
                  styles.filter,
                  {
                    backgroundColor: selected ? colors.primarySoft : "transparent",
                    borderColor: selected ? "transparent" : colors.border,
                  },
                ]}
              >
                <Text style={[styles.filterText, { color: selected ? colors.brandPanel : colors.mutedForeground }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tabs.events.anyTime")}
            accessibilityState={{ expanded: dateOptionsOpen }}
            testID="plans-date-filter-toggle"
            onPress={() => setDateOptionsOpen((open) => !open)}
            style={styles.dateFilterToggle}
          >
            <Text style={[styles.dateFilterText, { color: colors.primary }]}>
              {dateFilter === "all" ? t("tabs.events.anyTime") : t("tabs.events.filterThisWeek")}
            </Text>
            <Feather name={dateOptionsOpen ? "chevron-up" : "arrow-up-right"} size={14} color={colors.primary} />
          </Pressable>
        </View>
        {dateOptionsOpen ? (
          <View style={styles.dateOptions} testID="plans-date-filter-options">
            {([
              ["all", t("tabs.events.anyTime")],
              ["week", t("tabs.events.filterThisWeek")],
            ] as const).map(([filter, label]) => (
              <Pressable
                key={filter}
                accessibilityRole="button"
                accessibilityState={{ selected: dateFilter === filter }}
                testID={`plans-date-filter-${filter}`}
                onPress={() => { setDateFilter(filter); setDateOptionsOpen(false); }}
                style={[
                  styles.dateOption,
                  { backgroundColor: dateFilter === filter ? colors.primarySoft : colors.card },
                ]}
              >
                <Text style={[styles.filterText, { color: dateFilter === filter ? colors.brandPanel : colors.text }]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
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
            <Pressable
              accessibilityRole="button"
              testID="plans-empty-create"
              onPress={() => router.push({
                pathname: "/event-create",
                params: { mode: "friends" },
              } as never)}
              style={[styles.emptyAction, { backgroundColor: colors.brandPanel ?? colors.primary }]}
            >
              <Text style={[styles.actionText, { color: colors.brandPanelText ?? colors.primaryForeground }]}>{t("plans.make")}</Text>
              <Feather name="arrow-up-right" size={16} color={colors.brandPanelText ?? colors.primaryForeground} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            <View style={styles.weekNote}>
              <View style={styles.weekCopy}>
                <Text style={[styles.weekLabel, { color: colors.mutedForeground }]}>{t("plans.upNext")}</Text>
                <Text style={[styles.weekTitle, { color: colors.text }]}>{t("plans.homeSubtitle")}</Text>
              </View>
              <View style={[styles.countMark, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.countText, { color: colors.primary }]}>{String(plans.length).padStart(2, "0")}</Text>
              </View>
            </View>
            {plans.map((event) => {
              const date = new Date(event.startsAt);
              const owner = event.ownerUid === authedUid;
              const accepted =
                event.myRsvp === "going" || event.myRsvp === "maybe";
              const attendanceLabel = owner
                ? t("plans.hosting")
                : accepted
                  ? t("tabs.events.planInvitationAccepted")
                  : t("tabs.events.invited");
              const hasChatAccess = owner || accepted;
              const accessibilityLabel = [
                event.title,
                date.toLocaleString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }),
                event.location,
                event.creatorName
                  ? `${t("tabs.events.createdBy")} ${event.creatorName}`
                  : t("tabs.events.planHost"),
                attendanceLabel,
              ].filter(Boolean).join(". ");
              return (
                <Pressable
                  key={`${event.eventType}:${event.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  accessibilityHint={
                    hasChatAccess
                      ? t("plans.openChatTitleA11y", { title: event.title })
                      : t("tabs.events.detailsView")
                  }
                  testID={`plan-row-${event.id}`}
                  onPress={() => openPlan(event)}
                  style={({ pressed }) => [
                    styles.plan,
                    styles.standardPlan,
                    { borderColor: colors.border, backgroundColor: "transparent", opacity: pressed ? 0.82 : 1 },
                  ]}
                >
                  <View style={[styles.planDetails, styles.standardDetails]}>
                    <View testID={`plan-date-column-${event.id}`} style={styles.dateColumn}>
                      <View testID={`plan-date-badge-${event.id}`} style={[styles.dateBadge, { backgroundColor: colors.primarySoft }]}>
                        <Text style={[styles.month, { color: colors.brandPanel }]}>{date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</Text>
                        <Text style={[styles.day, { color: colors.text }]}>{date.getDate()}</Text>
                      </View>
                      <View style={[styles.datePin, { backgroundColor: colors.primary }]} />
                    </View>
                    <View style={styles.planCopy}>
                      <Text style={[styles.meta, { color: colors.primary }]}>{date.toLocaleDateString(undefined, { weekday: "long" })} · {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</Text>
                      <Text style={[styles.planTitle, { color: colors.text }]}>{event.title}</Text>
                      {event.location ? (
                        <View style={styles.locationRow}>
                          <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                          <Text style={[styles.locationText, { color: colors.mutedForeground }]}>{event.location}</Text>
                        </View>
                      ) : null}
                      <View style={styles.creatorRow}>
                        {event.creatorPhotoUrl ? (
                          <Image
                            source={{ uri: event.creatorPhotoUrl }}
                            accessibilityLabel={event.creatorName ?? t("tabs.events.planHost")}
                            style={styles.creatorAvatar}
                          />
                        ) : (
                          <View style={[styles.creatorAvatar, { backgroundColor: colors.primarySoft }]}>
                            <Feather name="user" size={13} color={colors.primary} />
                          </View>
                        )}
                        <Text style={[styles.meta, styles.creatorNameText, { color: colors.mutedForeground }]}>
                          {event.creatorName ?? t("tabs.events.planHost")}
                        </Text>
                      </View>
                      <Text style={[styles.host, { color: colors.primary }]}>
                        {owner
                          ? t("plans.hosting")
                          : event.myRsvp === "going" || event.myRsvp === "maybe"
                            ? t("tabs.events.planInvitationAccepted")
                            : t("tabs.events.invited")}
                      </Text>
                    </View>
                    <View style={styles.chatMark}><Feather name="message-circle" size={17} color={colors.primary} /><Feather name="arrow-up-right" size={14} color={colors.mutedForeground} /></View>
                  </View>
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
  header: { paddingHorizontal: 22, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 40, height: 44, justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 1.7, marginBottom: 4 },
  title: { fontFamily: "PlayfairDisplay_500Medium", fontSize: 40, fontWeight: "500", letterSpacing: -1.4 },
  create: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 22, gap: 17 },
  intro: { fontSize: 12, maxWidth: 330, marginBottom: 8 },
  filters: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, marginTop: -3, marginBottom: 3 },
  filter: { minHeight: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 18, paddingHorizontal: 12 },
  filterText: { fontSize: 10, fontWeight: "600" },
  dateFilterToggle: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto", paddingHorizontal: 3 },
  dateFilterText: { fontSize: 10, fontWeight: "700" },
  dateOptions: { flexDirection: "row", gap: 7, marginTop: -7, marginBottom: 3 },
  dateOption: { minHeight: 32, alignItems: "center", justifyContent: "center", borderRadius: 17, paddingHorizontal: 11 },
  state: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 12 },
  stateText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  empty: { minHeight: 236, borderTopRightRadius: 52, borderBottomLeftRadius: 38, alignItems: "center", justifyContent: "center", padding: 26, gap: 9 },
  sun: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptyAction: { marginTop: 8, minHeight: 44, borderRadius: 22, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 7 },
  actionText: { fontSize: 13, fontWeight: "700" },
  list: { gap: 12, paddingLeft: 2 },
  weekNote: { minHeight: 60, marginBottom: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekCopy: { flex: 1, minWidth: 0, gap: 4 },
  weekLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  weekTitle: { fontFamily: "PlayfairDisplay_500Medium", fontSize: 18, fontWeight: "500" },
  countMark: { minWidth: 30, minHeight: 30, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 15, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  countText: { fontSize: 10, fontWeight: "700" },
  plan: { overflow: "hidden" },
  standardPlan: { minHeight: 105, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 3, paddingVertical: 13 },
  planDetails: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 2, paddingBottom: 2 },
  standardDetails: { paddingHorizontal: 0 },
  dateColumn: { minWidth: 48, flexShrink: 0, alignItems: "center", paddingTop: 2 },
  dateBadge: { minWidth: 48, minHeight: 55, paddingHorizontal: 5, paddingVertical: 3, borderTopLeftRadius: 13, borderTopRightRadius: 13, borderBottomRightRadius: 13, borderBottomLeftRadius: 4, alignItems: "center", justifyContent: "center" },
  datePin: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  month: { fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  day: { fontFamily: "PlayfairDisplay_500Medium", fontSize: 22, fontWeight: "500" },
  planCopy: { flex: 1, minWidth: 0, gap: 5, paddingTop: 2 },
  planTitle: { fontFamily: "PlayfairDisplay_500Medium", fontSize: 18, fontWeight: "500", marginTop: 1 },
  meta: { fontSize: 10 },
  locationRow: { minHeight: 20, flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  locationText: { flex: 1, minWidth: 0, fontSize: 10 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3 },
  creatorAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  host: { fontSize: 10, fontWeight: "700", marginTop: 3 },
  creatorNameText: { flex: 1, minWidth: 0 },
  chatMark: { alignItems: "center", gap: 5, paddingHorizontal: 3, paddingTop: 7 },
});
