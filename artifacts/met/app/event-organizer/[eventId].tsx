import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrustScoreBadge } from "@/components/TrustScoreBadge";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import {
  getGetEventDetailsQueryKey,
  getGetEventDetailsQueryOptions,
} from "@workspace/api-client-react";

export default function EventOrganizerProfileScreen() {
  const params = useLocalSearchParams<{ eventId?: string | string[] }>();
  const rawEventId = Array.isArray(params.eventId)
    ? params.eventId[0]
    : params.eventId;
  const eventId = Number(rawEventId);
  const isValidEventId = Number.isSafeInteger(eventId) && eventId > 0;
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { authedUid } = useApp();

  const eventQuery = useQuery({
    ...getGetEventDetailsQueryOptions("member", isValidEventId ? eventId : 0),
    enabled: isValidEventId && !!authedUid,
    queryKey: [
      ...getGetEventDetailsQueryKey("member", isValidEventId ? eventId : 0),
      authedUid ?? "signed-out",
    ],
  });
  const organizerUid = eventQuery.data?.ownerUid;
  const profileQuery = useQuery({
    queryKey: ["event-organizer-profile", organizerUid],
    queryFn: () => api.getProfile({ uid: authedUid ?? "" }, organizerUid!),
    enabled: !!authedUid && !!organizerUid,
  });
  const standingQuery = useQuery({
    queryKey: ["community-standing", organizerUid],
    queryFn: () => api.getCommunityStanding({ uid: authedUid ?? "" }, organizerUid!),
    enabled: !!authedUid && !!organizerUid,
  });

  const event = eventQuery.data;
  const name = profileQuery.data?.displayName ?? event?.creatorName ?? "";
  const photoUrl = profileQuery.data?.photoUrl ?? event?.creatorPhotoUrl ?? null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          testID="event-organizer-back"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("tabs.events.createdBy")}
        </Text>
        {event && organizerUid ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tabs.events.openPastHangouts")}
            testID="event-organizer-past-hangouts"
            onPress={() => router.push({
              pathname: "/event-organizer/past-hangouts",
              params: {
                hostUid: organizerUid,
                hostName: name || t("tabs.events.createdBy"),
              },
            } as never)}
            style={styles.headerButton}
          >
            <Feather name="archive" size={19} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      {eventQuery.isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !event ? (
        <View style={styles.state}>
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            {t("tabs.events.loadError")}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 28 },
          ]}
        >
          <View
            style={[
              styles.profileCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="event-organizer-profile"
          >
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.avatar}
                contentFit="cover"
                accessibilityLabel={name}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarFallback,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <Feather name="user" size={34} color={colors.primary} />
              </View>
            )}
            <Text style={[styles.organizerName, { color: colors.text }]}>
              {name || t("tabs.events.quickPlan")}
            </Text>
            <Text style={[styles.eventContext, { color: colors.mutedForeground }]}>
              {event.title}
            </Text>
            {standingQuery.data?.trustScore != null ? (
              <View style={styles.trustRow}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  {t("trustScore.label")}
                </Text>
                <TrustScoreBadge
                  score={standingQuery.data.trustScore}
                  showScore
                />
              </View>
            ) : standingQuery.isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : null}
            {event.meetingHostRating?.reviewCount ? (
              <Text
                style={[styles.rating, { color: colors.mutedForeground }]}
                testID="event-organizer-host-rating"
              >
                {t("tabs.events.hangoutHostRating", {
                  rating: event.meetingHostRating.averageRating?.toFixed(1) ?? "—",
                  count: event.meetingHostRating.reviewCount,
                })}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { padding: 22 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  stateText: { fontSize: 14, textAlign: "center" },
  profileCard: {
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderTopLeftRadius: 36,
    borderBottomRightRadius: 28,
    padding: 24,
  },
  avatar: { width: 92, height: 92, borderRadius: 46 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  organizerName: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  eventContext: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  trustRow: {
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
  },
  sectionLabel: { fontSize: 12, fontWeight: "600" },
  rating: { fontSize: 13, textAlign: "center", lineHeight: 19 },
});
