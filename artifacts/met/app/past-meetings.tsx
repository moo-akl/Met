import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  getGetMyPastMeetingsQueryKey,
  useGetMyPastMeetings,
} from "@workspace/api-client-react";

const PAST_MEETING_FILTERS = [
  { value: "all", labelKey: "tabs.events.pastMeetingsAll" },
  { value: "event", labelKey: "tabs.events.title" },
  { value: "plan", labelKey: "plans.screenTitle" },
  { value: "hangout", labelKey: "tabs.events.nearbyTab" },
] as const;

type PastMeetingFilter = (typeof PAST_MEETING_FILTERS)[number]["value"];

export default function PastMeetingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useT();
  const { authedUid } = useApp();
  const [filter, setFilter] = useState<PastMeetingFilter>("all");
  const pastMeetings = useGetMyPastMeetings({
    query: {
      enabled: !!authedUid,
      staleTime: 30_000,
      refetchOnMount: "always",
      queryKey: [...getGetMyPastMeetingsQueryKey(), authedUid ?? "signed-out"],
    },
  });
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const meetings = pastMeetings.data?.meetings ?? [];
  const visibleMeetings =
    filter === "all"
      ? meetings
      : meetings.filter((meeting) => meeting.type === filter);
  const filterCounts = meetings.reduce(
    (counts, meeting) => {
      counts.all += 1;
      counts[meeting.type] += 1;
      return counts;
    },
    { all: 0, event: 0, plan: 0, hangout: 0 },
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          testID="past-meetings-back"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>
          {t("tabs.events.pastMeetings")}
        </Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomInset + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!authedUid || pastMeetings.isLoading ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : pastMeetings.isError ? (
          <Pressable
            accessibilityRole="button"
            testID="past-meetings-retry"
            onPress={() => void pastMeetings.refetch()}
            style={[styles.empty, { borderColor: colors.border }]}
          >
            <Feather name="refresh-cw" size={22} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t("plans.screenLoadError")}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              {t("plans.retry")}
            </Text>
          </Pressable>
        ) : meetings.length === 0 ? (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
              <Feather name="clock" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t("plans.screenEmptyTitle")}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
              {t("tabs.events.pastMeetingsEmpty")}
            </Text>
          </View>
        ) : (
          <View>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t("tabs.events.pastMeetingsFilterLabel")}
              testID="past-meetings-filters"
              style={styles.filters}
            >
              {PAST_MEETING_FILTERS.map(({ value, labelKey }) => {
                const selected = filter === value;
                const label = t(labelKey);
                const count = new Intl.NumberFormat(lang).format(
                  filterCounts[value],
                );
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={`${label}, ${count}`}
                    accessibilityState={{ checked: selected }}
                    testID={`past-meetings-filter-${value}`}
                    onPress={() => setFilter(value)}
                    style={({ pressed }) => [
                      styles.filterChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                        opacity: pressed ? 0.78 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        {
                          color: selected
                            ? colors.primaryForeground
                            : colors.text,
                        },
                      ]}
                      testID={`past-meetings-filter-label-${value}`}
                    >
                      {`${label} (${count})`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {visibleMeetings.length === 0 ? (
              <View style={[styles.empty, { borderColor: colors.border }]}>
                <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
                  {t("tabs.events.pastMeetingsFilterEmpty")}
                </Text>
              </View>
            ) : (
              <View style={styles.list}>
                {visibleMeetings.map((meeting) => {
                  const category = meeting.type === "hangout"
                    ? t("tabs.events.nearbyTab")
                    : meeting.type === "plan"
                      ? t("plans.screenTitle")
                      : t("tabs.events.title");
                  const roleLabel = t(
                    meeting.isHost
                      ? "tabs.events.pastMeetingsHosted"
                      : "tabs.events.pastMeetingsAttended",
                  );
                  const isMemberMeeting = meeting.eventType === "member";
                  const date = new Date(meeting.startsAt);
                  return (
                    <Pressable
                      key={`${meeting.eventType}:${meeting.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${meeting.title}, ${category}, ${roleLabel}`}
                      testID={`past-meeting-${meeting.eventType}-${meeting.id}`}
                      onPress={() => router.push(
                        `/event-details/${meeting.eventType}/${meeting.id}` as never,
                      )}
                      style={({ pressed }) => [
                        styles.meeting,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: pressed ? 0.78 : 1,
                        },
                      ]}
                    >
                      <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
                        <Feather
                          name={meeting.type === "event" ? "calendar" : "users"}
                          size={18}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.meetingCopy}>
                        <View style={styles.categoryRow}>
                          <Text style={[styles.category, { color: colors.primary }]}>
                            {category}
                          </Text>
                          <View
                            style={[
                              styles.roleBadge,
                              { backgroundColor: colors.primarySoft },
                            ]}
                          >
                            <Text
                              style={[styles.roleText, { color: colors.primary }]}
                            >
                              {roleLabel}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[styles.meetingTitle, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {meeting.title}
                        </Text>
                        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                          {date.toLocaleString(lang, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </Text>
                        {meeting.location || meeting.hostName ? (
                          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {[meeting.location, meeting.hostName]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        ) : null}
                        {isMemberMeeting && !meeting.isHost ? (
                          <Text style={[styles.rating, { color: colors.primary }]}>
                            {meeting.myRating == null
                              ? t("plans.rateHost")
                              : `${t("plans.updateHostRating")} · ${meeting.myRating}/5`}
                          </Text>
                        ) : null}
                      </View>
                      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  back: { width: 38, height: 42, justifyContent: "center" },
  title: { flex: 1, fontFamily: "serif", fontSize: 30 },
  content: { paddingHorizontal: 20, paddingTop: 6 },
  state: { minHeight: 200, alignItems: "center", justifyContent: "center" },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },
  filterChip: {
    maxWidth: "100%",
    minHeight: 38,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  filterText: { flexShrink: 1, fontSize: 12, fontWeight: "700" },
  empty: {
    minHeight: 210,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 32,
    borderBottomRightRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  list: { gap: 9 },
  meeting: {
    minHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 24,
    borderBottomRightRadius: 20,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  meetingCopy: { flex: 1, gap: 4 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  category: { fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
  roleBadge: {
    maxWidth: "100%",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  roleText: { flexShrink: 1, fontSize: 10, fontWeight: "600", lineHeight: 14 },
  meetingTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  meta: { fontSize: 11, lineHeight: 16 },
  rating: { fontSize: 12, fontWeight: "700", marginTop: 2 },
});
