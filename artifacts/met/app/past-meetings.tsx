import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
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

export default function PastMeetingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useT();
  const { authedUid } = useApp();
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
        ) : (pastMeetings.data?.meetings.length ?? 0) === 0 ? (
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
          <View style={styles.list}>
            {pastMeetings.data?.meetings.map((meeting) => {
              const category = meeting.type === "hangout"
                ? t("tabs.events.nearbyTab")
                : meeting.type === "plan"
                  ? t("plans.screenTitle")
                  : t("tabs.events.title");
              const isMemberMeeting = meeting.eventType === "member";
              const date = new Date(meeting.startsAt);
              return (
                <Pressable
                  key={`${meeting.eventType}:${meeting.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${meeting.title}, ${category}`}
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
                    <Text style={[styles.category, { color: colors.primary }]}>
                      {category}
                    </Text>
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
  category: { fontSize: 10, fontWeight: "700", letterSpacing: 0.7 },
  meetingTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  meta: { fontSize: 11, lineHeight: 16 },
  rating: { fontSize: 12, fontWeight: "700", marginTop: 2 },
});
