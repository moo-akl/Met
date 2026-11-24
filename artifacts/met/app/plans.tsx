import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
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
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()), [feed.data?.events, authedUid]);

  const openPlan = (event: EventFeedItem) => {
    const accepted = event.myRsvp === "going" || event.myRsvp === "maybe";
    router.push(
      event.ownerUid === authedUid || accepted
        ? `/event-chat/${event.id}` as never
        : `/event-details/member/${event.id}` as never,
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 8) }]}>
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
              style={[styles.emptyAction, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{t("plans.make")}</Text>
              <Feather name="arrow-up-right" size={16} color={colors.primaryForeground} />
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
            {plans.map((event, index) => {
              const date = new Date(event.startsAt);
              const owner = event.ownerUid === authedUid;
              const isFeatured = index === 0;
              const artwork = event.galleryPhotos?.[0] ?? event.imageUrl;
              return (
                <React.Fragment key={`${event.eventType}:${event.id}`}>
                  {index === 1 ? (
                    <View style={[styles.afterHeader, { borderTopColor: colors.border }]}>
                      <Text style={[styles.afterLabel, { color: colors.mutedForeground }]}>{t("plans.afterThat")}</Text>
                      <Text style={[styles.afterCount, { color: colors.mutedForeground }]}>{String(plans.length - 1).padStart(2, "0")}</Text>
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("plans.openChatTitleA11y", { title: event.title })}
                    testID={`plan-row-${event.id}`}
                    onPress={() => openPlan(event)}
                    style={({ pressed }) => [
                      styles.plan,
                      isFeatured ? styles.featuredPlan : styles.standardPlan,
                      { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.82 : 1 },
                    ]}
                  >
                    {isFeatured ? (
                      <View
                        testID="plan-featured-artwork"
                        style={[styles.featuredArtwork, { backgroundColor: colors.primarySoft }]}
                      >
                        {artwork ? (
                          <Image
                            testID="plan-featured-photo"
                            source={{ uri: artwork }}
                            accessibilityLabel={event.title}
                            style={styles.featuredImage}
                          />
                        ) : (
                          <View testID="plan-featured-fallback" style={styles.orbitArtwork}>
                            <View style={[styles.orbitRing, styles.orbitRingOuter, { borderColor: colors.primary }]} />
                            <View style={[styles.orbitRing, styles.orbitRingInner, { borderColor: colors.primary }]} />
                            <View style={[styles.orbitCore, { backgroundColor: colors.card }]}>
                              <Feather name="sun" size={23} color={colors.primary} />
                            </View>
                          </View>
                        )}
                        <View style={styles.featuredTopline}>
                          <View style={[styles.upNextPill, { backgroundColor: colors.card }]}>
                            <View style={[styles.upNextDot, { backgroundColor: colors.primary }]} />
                            <Text style={[styles.upNextText, { color: colors.text }]}>{t("plans.upNext")}</Text>
                          </View>
                        </View>
                        <View style={[styles.featuredDate, { backgroundColor: colors.card }]}>
                          <Text style={[styles.month, { color: colors.primary }]}>{date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</Text>
                          <Text style={[styles.day, { color: colors.text }]}>{date.getDate()}</Text>
                        </View>
                      </View>
                    ) : null}
                    <View style={[styles.planDetails, !isFeatured && styles.standardDetails]}>
                      {!isFeatured ? (
                        <View style={styles.dateColumn}>
                          <View style={[styles.dateBadge, { backgroundColor: colors.primarySoft }]}>
                            <Text style={[styles.month, { color: colors.primary }]}>{date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</Text>
                            <Text style={[styles.day, { color: colors.text }]}>{date.getDate()}</Text>
                          </View>
                          <View style={[styles.datePin, { backgroundColor: colors.primary }]} />
                        </View>
                      ) : null}
                      <View style={styles.planCopy}>
                        <Text style={[styles.meta, { color: colors.primary }]}>{date.toLocaleDateString(undefined, { weekday: "long" })} · {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</Text>
                        <Text style={[styles.planTitle, { color: colors.text }]} numberOfLines={2}>{event.title}</Text>
                        {event.location ? (
                          <View style={styles.locationRow}>
                            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                            <Text numberOfLines={1} style={[styles.locationText, { color: colors.mutedForeground }]}>{event.location}</Text>
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
                          <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground }]}>
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
                </React.Fragment>
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
  list: { gap: 12, paddingLeft: 2 },
  weekNote: { minHeight: 60, marginBottom: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekCopy: { flex: 1, minWidth: 0, gap: 4 },
  weekLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  weekTitle: { fontFamily: "serif", fontSize: 19, lineHeight: 24 },
  countMark: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  countText: { fontSize: 10, fontWeight: "700" },
  afterHeader: { minHeight: 40, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 3, paddingTop: 9 },
  afterLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.4 },
  afterCount: { fontSize: 9, fontWeight: "600", letterSpacing: 0.8 },
  plan: { overflow: "hidden" },
  featuredPlan: { borderWidth: 1, borderTopLeftRadius: 27, borderBottomRightRadius: 25, padding: 10, gap: 12 },
  standardPlan: { minHeight: 105, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 3, paddingVertical: 14 },
  featuredArtwork: { height: 146, borderTopLeftRadius: 20, borderBottomRightRadius: 17, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  featuredImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  featuredTopline: { ...StyleSheet.absoluteFillObject, alignItems: "flex-start", justifyContent: "flex-start", padding: 10 },
  upNextPill: { minHeight: 25, borderTopLeftRadius: 11, borderBottomRightRadius: 10, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9 },
  upNextDot: { width: 6, height: 6, borderRadius: 3 },
  upNextText: { fontSize: 8, fontWeight: "700", letterSpacing: 1 },
  orbitArtwork: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  orbitRing: { position: "absolute", borderWidth: 1, borderRadius: 999, opacity: 0.32 },
  orbitRingOuter: { width: 190, height: 82, transform: [{ rotate: "-24deg" }] },
  orbitRingInner: { width: 145, height: 66, transform: [{ rotate: "30deg" }] },
  orbitCore: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  featuredDate: { position: "absolute", top: 10, right: 10, width: 48, height: 55, borderTopLeftRadius: 17, borderBottomRightRadius: 16, alignItems: "center", justifyContent: "center" },
  planDetails: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 2, paddingBottom: 2 },
  standardDetails: { paddingHorizontal: 0 },
  dateColumn: { width: 54, alignItems: "center", paddingTop: 2 },
  dateBadge: { width: 48, height: 53, borderTopLeftRadius: 18, borderBottomRightRadius: 18, alignItems: "center", justifyContent: "center" },
  datePin: { width: 5, height: 5, borderRadius: 3, marginTop: 9 },
  month: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  day: { fontFamily: "serif", fontSize: 23, fontWeight: "400", lineHeight: 27 },
  planCopy: { flex: 1, minWidth: 0, gap: 5, paddingTop: 2 },
  planTitle: { fontFamily: "serif", fontSize: 20, lineHeight: 25, fontWeight: "400", marginTop: 1 },
  meta: { fontSize: 11, lineHeight: 16 },
  locationRow: { minHeight: 20, flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  locationText: { flex: 1, fontSize: 11, lineHeight: 16 },
  creatorRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3 },
  creatorAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  host: { fontSize: 10, fontWeight: "700", marginTop: 3 },
  chatMark: { alignItems: "center", gap: 5, paddingHorizontal: 3, paddingTop: 7 },
});
