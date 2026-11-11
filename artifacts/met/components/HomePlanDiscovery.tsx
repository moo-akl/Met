import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { getHangoutOpenPath } from "@/lib/hangoutNavigation";
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
  const feed = useGetEventsFeed(undefined, {
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
        event.visibility === "invite_only" &&
        !event.joinApprovalRequired &&
        (event.ownerUid === authedUid || event.isInvited || event.myRsvp === "going" || event.myRsvp === "maybe"),
      )
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 3);
  }, [feed.data?.events, authedUid]);
  const hangouts = useMemo(() => {
    const events = feed.data?.events ?? [];
    return events
      .filter((event: EventFeedItem) =>
        event.eventType === "member" &&
        event.visibility === "public" &&
        event.joinApprovalRequired,
      )
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 3);
  }, [feed.data?.events]);

  return (
    <>
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
        <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
          {t("plans.homeSubtitle")}
        </Text>
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
            {plans.map((plan, index) => (
              <HomeEventRow key={`${plan.eventType}:${plan.id}`} event={plan} index={index} />
            ))}
          </View>
        ) : (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <View style={styles.emptyMark}><Feather name="users" size={17} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("plans.emptyTitle")}</Text>
            <Text style={[styles.muted, { color: colors.mutedForeground }]}>{t("plans.emptyBody")}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.headingRow}>
          <View>
            <Text style={[styles.kicker, { color: colors.primary }]}>{t("tabs.events.public")}</Text>
            <Text style={[styles.heading, { color: colors.text }]}>{t("tabs.events.nearbyTab")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tabs.events.allHangouts")}
            testID="home-hangouts-nearby"
            hitSlop={8}
            onPress={() => router.push({
              pathname: "/(tabs)/events",
              params: { view: "hangouts" },
            } as never)}
            style={styles.seeAll}
          >
            <Text style={[styles.seeAllText, { color: colors.primary }]}>{t("tabs.events.allHangouts")}</Text>
            <Feather name="arrow-up-right" size={16} color={colors.primary} />
          </Pressable>
        </View>
        <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
          {t("tabs.events.nearbySubtitle")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("tabs.events.createHangout")}
          testID="home-create-hangout"
          onPress={() => router.push({ pathname: "/event-create", params: { mode: "hangout" } } as never)}
          style={({ pressed }) => [styles.create, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
        >
          <View style={[styles.createIcon, { backgroundColor: colors.primarySoft }]}>
            <Feather name="plus" size={18} color={colors.primary} />
          </View>
          <View style={styles.createCopy}>
            <Text style={[styles.createTitle, { color: colors.primary }]}>{t("tabs.events.createHangout")}</Text>
            <Text style={[styles.createSub, { color: colors.mutedForeground }]}>{t("tabs.events.quickPlanHint")}</Text>
          </View>
          <Feather name="arrow-up-right" size={18} color={colors.primary} />
        </Pressable>
        {!feed.isError && hangouts.length ? (
          <View style={styles.planList}>
            {hangouts.map((hangout, index) => (
              <HomeEventRow
                key={`${hangout.eventType}:${hangout.id}`}
                event={hangout}
                index={index}
                isHangout
              />
            ))}
          </View>
        ) : null}
      </View>
    </>
  );

  function HomeEventRow({
    event,
    index,
    isHangout = false,
  }: {
    event: EventFeedItem;
    index: number;
    isHangout?: boolean;
  }) {
    const date = dateLabel(event.startsAt);
    const attending = event.ownerUid === authedUid
      ? t("plans.hosting")
      : event.myJoinRequestStatus === "pending"
        ? t("tabs.events.joinRequestPending")
        : event.myJoinRequestStatus === "declined"
          ? t("tabs.events.requestAgain")
          : event.myRsvp === "going"
            ? t("tabs.events.going")
            : event.myRsvp === "maybe"
              ? t("tabs.events.interested")
              : isHangout
                ? t("tabs.events.requestToJoin")
                : t("plans.hosting");
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isHangout
          ? `${event.title}. ${t("tabs.events.hangoutDetailsView")}`
          : t("plans.openChatA11y", { title: event.title })}
        testID={`home-${isHangout ? "hangout" : "plan"}-${event.id}`}
        onPress={() => router.push(
          isHangout
            ? getHangoutOpenPath(event.id, event.ownerUid, authedUid, event.myJoinRequestStatus) as never
            : `/event-chat/${event.id}` as never,
        )}
        style={({ pressed }) => [
          styles.planRow,
          { backgroundColor: "transparent", borderBottomColor: colors.border, opacity: pressed ? 0.78 : 1 },
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
          {isHangout ? (
            <View style={styles.creatorByline}>
              {event.creatorPhotoUrl ? (
                <Image
                  testID={`home-hangout-creator-photo-${event.id}`}
                  accessibilityLabel={event.creatorName ?? t("tabs.events.createdBy")}
                  source={{ uri: event.creatorPhotoUrl }}
                  style={styles.creatorAvatar}
                />
              ) : (
                <View style={[styles.creatorAvatar, { backgroundColor: colors.primarySoft }]}>
                  <Feather name="user" size={14} color={colors.primary} />
                </View>
              )}
              <Text
                testID={`home-hangout-creator-${event.id}`}
                numberOfLines={1}
                style={[styles.creatorName, { color: colors.mutedForeground }]}
              >
                {t("tabs.events.createdBy")} {event.creatorName ?? t("tabs.events.planHost")}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.status}>
          <Text style={[styles.statusText, { color: colors.primary }]}>{attending}</Text>
          <Feather name={isHangout ? "arrow-up-right" : "message-circle"} size={16} color={colors.primary} />
        </View>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  section: { marginTop: 24, marginBottom: 18 },
  headingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 18, marginBottom: 13 },
  sectionSubtitle: { fontSize: 12, lineHeight: 18, marginHorizontal: 18, marginTop: -5, marginBottom: 10 },
  kicker: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginBottom: 4 },
  heading: { fontFamily: "serif", fontSize: 24, fontWeight: "400", letterSpacing: -0.4 },
  seeAll: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllText: { fontSize: 13, fontWeight: "600" },
  create: { minHeight: 62, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 0, marginHorizontal: 18, marginBottom: 12, paddingHorizontal: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  createIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  createCopy: { flex: 1 },
  createTitle: { fontSize: 16, fontWeight: "700" },
  createSub: { fontSize: 12, marginTop: 3 },
  loading: { paddingVertical: 18, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 9 },
  inlineState: { minHeight: 54, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 9 },
  muted: { fontSize: 12, lineHeight: 18 },
  planList: { paddingLeft: 12 },
  planRow: { minHeight: 78, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 13, borderTopLeftRadius: 30, borderBottomLeftRadius: 30, marginBottom: 5 },
  dateMark: { width: 48, height: 54, borderTopLeftRadius: 24, borderBottomRightRadius: 24, alignItems: "center", justifyContent: "center" },
  month: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  day: { fontSize: 19, fontWeight: "700", lineHeight: 22 },
  planCopy: { flex: 1, gap: 4 },
  planTitle: { fontSize: 14, fontWeight: "700" },
  planMeta: { fontSize: 11 },
  creatorByline: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, minWidth: 0 },
  creatorName: { fontSize: 10, fontWeight: "600" },
  status: { flexDirection: "row", alignItems: "center", gap: 7, paddingRight: 5 },
  statusText: { fontSize: 10, fontWeight: "700" },
  creatorAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  empty: { paddingVertical: 18, paddingHorizontal: 19, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 0, marginHorizontal: 18, gap: 5 },
  emptyMark: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(61,204,68,0.12)", alignItems: "center", justifyContent: "center", marginBottom: 3 },
  emptyTitle: { fontSize: 14, fontWeight: "700" },
});
