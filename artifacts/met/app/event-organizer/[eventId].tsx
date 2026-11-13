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
  useGetHostPastHangouts,
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
  const pastHangoutsQuery = useGetHostPastHangouts(organizerUid ?? "", {
    query: {
      enabled: !!authedUid && !!organizerUid,
      staleTime: 60_000,
    },
  });

  const event = eventQuery.data;
  const name = profileQuery.data?.displayName ?? event?.creatorName ?? "";
  const photoUrl = profileQuery.data?.photoUrl ?? event?.creatorPhotoUrl ?? null;
  const hostEvents = pastHangoutsQuery.data?.events ?? [];
  const hostReviewCount = hostEvents.reduce((total, item) => total + item.reviewCount, 0);
  const hostAverageRating = hostReviewCount
    ? hostEvents.reduce(
        (total, item) =>
          total + (item.averageRating ?? 0) * item.reviewCount,
        0,
      ) / hostReviewCount
    : null;
  const hostReviews = hostEvents
    .flatMap((item) =>
      item.reviews.map((review) => ({
        ...review,
        eventTitle: item.title,
      })),
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 3);

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
          <View style={[styles.reviewsSection, { borderTopColor: colors.border }]} testID="event-organizer-reviews">
            <View style={styles.reviewsHeadingRow}>
              <View style={styles.reviewsHeadingCopy}>
                <Text style={[styles.reviewsTitle, { color: colors.text }]}>
                  {t("tabs.events.pastHangoutsTitle")}
                </Text>
                <Text style={[styles.reviewsSubtitle, { color: colors.mutedForeground }]}>
                  {t("tabs.events.pastHangoutsByHost", { name: name || t("tabs.events.createdBy") })}
                </Text>
              </View>
              {organizerUid ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("tabs.events.openPastHangouts")}
                  testID="event-organizer-all-reviews"
                  onPress={() => router.push({
                    pathname: "/event-organizer/past-hangouts",
                    params: {
                      hostUid: organizerUid,
                      hostName: name || t("tabs.events.createdBy"),
                    },
                  } as never)}
                  hitSlop={8}
                  style={styles.allReviewsButton}
                >
                  <Feather name="arrow-up-right" size={18} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
            {hostAverageRating != null ? (
              <View style={[styles.reviewSummary, { backgroundColor: colors.primarySoft }]}>
                <Feather name="star" size={18} color={colors.primary} />
                <Text style={[styles.reviewSummaryRating, { color: colors.text }]}>
                  {hostAverageRating.toFixed(1)}
                </Text>
                <Text style={[styles.reviewSummaryCount, { color: colors.mutedForeground }]}>
                  {t("tabs.events.hangoutHostRating", {
                    rating: hostAverageRating.toFixed(1),
                    count: hostReviewCount,
                  })}
                </Text>
              </View>
            ) : null}
            {pastHangoutsQuery.isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : pastHangoutsQuery.isError ? (
              <Text style={[styles.reviewEmpty, { color: colors.mutedForeground }]}>
                {t("tabs.events.reviewsLoadError")}
              </Text>
            ) : hostReviews.length ? (
              <View style={styles.reviewList}>
                {hostReviews.map((review, index) => (
                  <View
                    key={`${review.createdAt}-${index}`}
                    style={[styles.reviewItem, { borderTopColor: colors.border }]}
                  >
                    <View style={styles.reviewItemHeader}>
                      <Text style={[styles.reviewEventTitle, { color: colors.text }]} numberOfLines={1}>
                        {review.eventTitle}
                      </Text>
                      <View style={styles.reviewStars}>
                        <Feather name="star" size={13} color={colors.primary} />
                        <Text style={[styles.reviewStarValue, { color: colors.primary }]}>
                          {review.rating}/5
                        </Text>
                      </View>
                    </View>
                    {review.reviewText ? (
                      <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>
                        {review.reviewText}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.reviewEmpty, { color: colors.mutedForeground }]}>
                {t("tabs.events.noReviews")}
              </Text>
            )}
            {hostEvents.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("tabs.events.openPastHangouts")}
                testID="event-organizer-view-all-reviews"
                onPress={() => router.push({
                  pathname: "/event-organizer/past-hangouts",
                  params: {
                    hostUid: organizerUid ?? "",
                    hostName: name || t("tabs.events.createdBy"),
                  },
                } as never)}
                style={styles.viewAllReviews}
              >
                <Text style={[styles.viewAllReviewsText, { color: colors.primary }]}>
                  {t("tabs.events.openPastHangouts")}
                </Text>
                <Feather name="chevron-right" size={17} color={colors.primary} />
              </Pressable>
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
  reviewsSection: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 22, paddingTop: 18, gap: 14 },
  reviewsHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  reviewsHeadingCopy: { flex: 1, gap: 4 },
  reviewsTitle: { fontSize: 17, fontWeight: "700" },
  reviewsSubtitle: { fontSize: 12, lineHeight: 17 },
  allReviewsButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  reviewSummary: { minHeight: 48, borderTopLeftRadius: 20, borderBottomRightRadius: 16, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 8 },
  reviewSummaryRating: { fontSize: 17, fontWeight: "700" },
  reviewSummaryCount: { flex: 1, fontSize: 12, fontWeight: "600" },
  reviewList: { gap: 11 },
  reviewItem: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, gap: 5 },
  reviewItemHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  reviewEventTitle: { flex: 1, fontSize: 13, fontWeight: "600" },
  reviewStars: { flexDirection: "row", alignItems: "center", gap: 4 },
  reviewStarValue: { fontSize: 12, fontWeight: "700" },
  reviewText: { fontSize: 13, lineHeight: 19 },
  reviewEmpty: { fontSize: 13, lineHeight: 19 },
  viewAllReviews: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 5 },
  viewAllReviewsText: { fontSize: 13, fontWeight: "700" },
});
