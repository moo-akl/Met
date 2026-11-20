import React from "react";
import "./_group.css";
import { ActivityIndicator, Feather, Pressable, ScrollView, StyleSheet, Text, View, useColors, useT } from "./rnDom";

type PlanRecord = {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  ownerUid: string;
  joinApprovalRequired: boolean;
  isInvited?: boolean;
  myRsvp?: "going" | "maybe" | "not_going";
  myJoinRequestStatus?: "pending" | "declined";
};

const dateFromNow = (days: number, hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const staticEvents: PlanRecord[] = [
  { id: "plan-201", title: "Golden hour picnic at Dolores Park", startsAt: dateFromNow(3, 18), location: "Dolores Park, San Francisco", ownerUid: "sample-user", joinApprovalRequired: true, myJoinRequestStatus: "pending" },
  { id: "plan-202", title: "Saturday morning coastal walk", startsAt: dateFromNow(6, 9), location: "Lands End Trail", ownerUid: "friend-41", joinApprovalRequired: false, isInvited: true },
  { id: "plan-203", title: "Dinner and board games", startsAt: dateFromNow(10, 19), location: "Mission District", ownerUid: "sample-user", joinApprovalRequired: false, myRsvp: "going" },
];

export function CurrentPlans() {
  const colors = useColors();
  const { t } = useT();
  const authedUid = "sample-user";
  const plans = staticEvents;
  const feed = { isLoading: false, isError: false };
  const noop = () => {};

  return (
    <View className="met-plans-events" style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} testID="button-back-plans" onPress={noop} style={styles.back}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{t("plans.screenKicker")}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{t("plans.screenTitle")}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t("plans.createA11y")} testID="plans-create" onPress={noop} style={[styles.create, { backgroundColor: colors.primary }]}>
          <Feather name="plus" size={21} color={colors.primaryForeground} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>{t("plans.screenIntro")}</Text>
        {!authedUid || feed.isLoading ? (
          <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={[styles.stateText, { color: colors.mutedForeground }]}>{t("plans.loading")}</Text></View>
        ) : feed.isError ? (
          <Pressable accessibilityRole="button" testID="plans-retry" onPress={noop} style={[styles.empty, { backgroundColor: colors.primarySoft }]}>
            <Feather name="refresh-cw" size={22} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("plans.screenLoadError")}</Text>
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{t("plans.retry")}</Text>
          </Pressable>
        ) : plans.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.primarySoft }]}>
            <View style={[styles.sun, { backgroundColor: colors.card }]}><Feather name="sun" size={20} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("plans.screenEmptyTitle")}</Text>
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{t("plans.screenEmptyBody")}</Text>
            <Pressable accessibilityRole="button" testID="plans-empty-create" onPress={noop} style={[styles.emptyAction, { backgroundColor: colors.primary }]}>
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
                  key={`${event.joinApprovalRequired ? "member" : "member"}:${event.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={event.joinApprovalRequired ? `${event.title}. ${t("tabs.events.detailsView")}` : t("plans.openChatTitleA11y", { title: event.title })}
                  testID={`plan-row-${event.id}`}
                  onPress={noop}
                  style={({ pressed }: { pressed: boolean }) => [styles.plan, { borderBottomColor: colors.border, opacity: pressed ? 0.78 : 1 }]}
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
