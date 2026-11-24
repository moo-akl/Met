import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useEventReminderCleanup } from "@/hooks/useEventReminderCleanup";
import { useT } from "@/lib/i18n";
import { formatRecurringPlanDate } from "@/lib/formatRecurringPlanDate";
import { api } from "@/lib/api/client";
import { HangoutsNearbyPanel } from "@/components/HangoutsNearbyPanel";
import { getHangoutOpenPath } from "@/lib/hangoutNavigation";
import { groupEventsByDate } from "@/lib/eventDateGroups";
import { isPlanEvent } from "@/lib/eventFeedClassification";
import { EventPhotoCarousel } from "@/components/EventPhotoCarousel";
import {
  approximateDistanceMetersBetween,
  formatApproximateDistance,
  type Coordinates,
  type HangoutSortMode,
} from "@/lib/hangoutDiscovery";
import {
  getGetEventsFeedQueryKey,
  getGetNearbyHangoutsQueryKey,
  useGetEventsFeed,
  useGetNearbyHangouts,
  useRsvpCommunityEvent,
  type EventFeedItem,
  type NearbyHangoutItem,
} from "@workspace/api-client-react";

type RsvpStatus = "going" | "maybe" | "not_going";

function getApproximateHangoutDistance(
  event: Pick<EventFeedItem, "latitude" | "longitude">,
  userLocation: Coordinates | null,
): number | null {
  if (
    !userLocation ||
    event.latitude == null ||
    event.longitude == null ||
    !Number.isFinite(event.latitude) ||
    !Number.isFinite(event.longitude)
  ) {
    return null;
  }

  return approximateDistanceMetersBetween(userLocation, {
    latitude: event.latitude,
    longitude: event.longitude,
  });
}

function getBrowserLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Browser location is unavailable."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
      reject,
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}

function EventsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, lang, rtl } = useT();
  const { authedUid } = useApp();
  const params = useLocalSearchParams<{ view?: string | string[] }>();
  const requestedView = Array.isArray(params.view) ? params.view[0] : params.view;
  const [activeView, setActiveView] = useState<"plans" | "hangouts" | "events">(
    requestedView === "plans" || requestedView === "events"
      ? requestedView
      : "hangouts",
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<RsvpStatus | null>(null);
  const [actionError, setActionError] = useState("");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [sortMode, setSortMode] = useState<HangoutSortMode>("nearest");
  const automaticLocationLookup = useRef(false);
  const appState = useRef(AppState.currentState);
  const [hangoutPageState, setHangoutPageState] = useState<{
    filterKey: string;
    offset: number;
    events: NearbyHangoutItem[];
    nextOffset: number | null;
  }>({ filterKey: "", offset: 0, events: [], nextOffset: null });
  const processedHangoutPageRef = useRef<string | null>(null);
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
  const memberRsvp = useRsvpCommunityEvent({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetEventsFeedQueryKey() });
      },
    },
  });

  const rsvp = useCallback(async (event: EventFeedItem, status: RsvpStatus) => {
    const key = `${event.eventType}:${event.id}`;
    setPendingKey(key);
    setPendingStatus(status);
    setActionError("");
    try {
      if (event.eventType === "venue") {
        await api.rsvpEvent({ uid: authedUid ?? "" }, event.id, status);
        await queryClient.invalidateQueries({ queryKey: getGetEventsFeedQueryKey() });
      } else {
        await memberRsvp.mutateAsync({ eventId: event.id, data: { status } });
      }
    } catch (error) {
      setActionError(t("tabs.events.eventActionError"));
    } finally {
      setPendingKey(null);
      setPendingStatus(null);
    }
  }, [authedUid, memberRsvp, queryClient]);

  const fetchNativeLocation = useCallback(async () => {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    setUserLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
  }, []);

  const enableNearbySorting = useCallback(async () => {
    setLocationLoading(true);
    try {
      if (Platform.OS === "web") {
        setUserLocation(await getBrowserLocation());
        return;
      }
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted) {
        if (permission.canAskAgain === false) {
          Alert.alert(
            t("tabs.events.locationDenied"),
            t("tabs.events.nearestUsesTimeUntilLocation"),
            [
              { text: t("common.cancel"), style: "cancel" },
              {
                text: t("tabs.events.openLocationSettings"),
                onPress: () => void Linking.openSettings().catch(() => undefined),
              },
            ],
          );
        }
        return;
      }
      await fetchNativeLocation();
    } catch {
      setUserLocation(null);
    } finally {
      setLocationLoading(false);
    }
  }, [fetchNativeLocation, t]);

  useEffect(() => {
    if (
      requestedView === "plans" ||
      requestedView === "events" ||
      requestedView === "hangouts"
    ) {
      setActiveView(requestedView);
    }
  }, [requestedView]);

  useEffect(() => {
    if (
      activeView !== "hangouts" ||
      Platform.OS === "web" ||
      automaticLocationLookup.current
    ) {
      return;
    }
    automaticLocationLookup.current = true;
    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) return;
        await fetchNativeLocation();
      } catch {}
    })();
  }, [activeView, fetchNativeLocation]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appState.current;
      appState.current = nextState;
      if (
        previousState === "active" ||
        nextState !== "active" ||
        activeView === "plans"
      ) {
        return;
      }
      void (async () => {
        try {
          const permission = await Location.getForegroundPermissionsAsync();
          if (!permission.granted) {
            setUserLocation(null);
            return;
          }
          setLocationLoading(true);
          await fetchNativeLocation();
          await queryClient.invalidateQueries({
            queryKey: getGetNearbyHangoutsQueryKey(),
          });
        } catch {
          setUserLocation(null);
        } finally {
          setLocationLoading(false);
        }
      })();
    });
    return () => subscription.remove();
  }, [activeView, fetchNativeLocation, queryClient]);

  const selectView = useCallback((view: "plans" | "events" | "hangouts") => {
    setActiveView(view);
    router.setParams({ view });
  }, [router]);

  const plans = useMemo(() => (feed.data?.events ?? [])
    .filter((event: EventFeedItem) =>
      isPlanEvent(event) &&
      event.eventType === "member" &&
      event.visibility === "invite_only" &&
      !event.joinApprovalRequired &&
      event.myRsvp !== "not_going" &&
      (
        event.ownerUid === authedUid ||
        event.isInvited ||
        event.myRsvp === "going" ||
        event.myRsvp === "maybe"
      ),
    )
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
  [feed.data?.events, authedUid]);

  const events = useMemo(() => {
    const items = (feed.data?.events ?? []).filter(
      (event: EventFeedItem) =>
        !isPlanEvent(event),
    );
    const byStartTime = (a: EventFeedItem, b: EventFeedItem) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    if (!userLocation) return [...items].sort(byStartTime);

    const distanceMeters = (event: EventFeedItem): number | null => {
      if (event.latitude == null || event.longitude == null) return null;
      const radians = (degrees: number) => (degrees * Math.PI) / 180;
      const dLat = radians(event.latitude - userLocation.latitude);
      const dLng = radians(event.longitude - userLocation.longitude);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(radians(userLocation.latitude)) *
          Math.cos(radians(event.latitude)) *
          Math.sin(dLng / 2) ** 2;
      return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    return [...items].sort((a, b) => {
      const aDistance = distanceMeters(a);
      const bDistance = distanceMeters(b);
      if (aDistance == null && bDistance != null) return 1;
      if (aDistance != null && bDistance == null) return -1;
      if (aDistance != null && bDistance != null && aDistance !== bDistance) {
        return aDistance - bDistance;
      }
      return byStartTime(a, b);
    });
  }, [feed.data?.events, userLocation]);

  const eventGroups = useMemo(
    () => groupEventsByDate(events, lang, t("common.today")),
    [events, lang, t],
  );
  const planGroups = useMemo(
    () => groupEventsByDate(plans, lang, t("common.today")),
    [plans, lang, t],
  );
  const visibleGroups = activeView === "plans" ? planGroups : eventGroups;
  const visibleEvents = activeView === "plans" ? plans : events;

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const hangoutFilterKey = JSON.stringify([
    sortMode,
    userLocation?.latitude ?? null,
    userLocation?.longitude ?? null,
    timeZone,
  ]);
  const hangoutPageOffset =
    hangoutPageState.filterKey === hangoutFilterKey ? hangoutPageState.offset : 0;
  const nearbyHangoutParams = {
    sortMode,
    latitude: userLocation?.latitude,
    longitude: userLocation?.longitude,
    timeZone,
    limit: 30,
    offset: hangoutPageOffset,
  };
  const nearbyHangoutQuery = useGetNearbyHangouts(nearbyHangoutParams, {
    query: {
      enabled: !!authedUid && activeView === "hangouts",
      queryKey: [
        ...getGetNearbyHangoutsQueryKey(nearbyHangoutParams),
        authedUid ?? "signed-out",
      ],
    },
  });
  const hangoutPageResponseKey = `${hangoutFilterKey}:${hangoutPageOffset}:${nearbyHangoutQuery.dataUpdatedAt}`;
  useEffect(() => {
    const response = nearbyHangoutQuery.data;
    if (!response || processedHangoutPageRef.current === hangoutPageResponseKey) return;
    processedHangoutPageRef.current = hangoutPageResponseKey;
    setHangoutPageState((current) => {
      const appendPage =
        current.filterKey === hangoutFilterKey &&
        current.offset === hangoutPageOffset &&
        hangoutPageOffset > 0;
      const nextEvents = appendPage
        ? [
            ...current.events,
            ...response.events.filter(
              (event) => !current.events.some((existing) => existing.id === event.id),
            ),
          ]
        : response.events;
      const eventsUnchanged =
        current.events.length === nextEvents.length &&
        current.events.every((event, index) => event.id === nextEvents[index]?.id);
      if (
        current.filterKey === hangoutFilterKey &&
        current.offset === hangoutPageOffset &&
        current.nextOffset === response.nextOffset &&
        eventsUnchanged
      ) {
        return current;
      }
      return {
        filterKey: hangoutFilterKey,
        offset: hangoutPageOffset,
        events: nextEvents,
        nextOffset: response.nextOffset,
      };
    });
  }, [
    nearbyHangoutQuery.data,
    nearbyHangoutQuery.dataUpdatedAt,
    hangoutFilterKey,
    hangoutPageOffset,
    hangoutPageResponseKey,
  ]);
  const hangoutPageMatchesFilters = hangoutPageState.filterKey === hangoutFilterKey;
  const hangouts = hangoutPageMatchesFilters ? hangoutPageState.events : [];
  const hasMoreHangouts =
    hangoutPageMatchesFilters && hangoutPageState.nextOffset != null;
  const loadMoreHangouts = useCallback(() => {
    setHangoutPageState((current) => {
      if (current.filterKey !== hangoutFilterKey || current.nextOffset == null) {
        return current;
      }
      return { ...current, offset: current.nextOffset };
    });
  }, [hangoutFilterKey]);
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 84 : 112),
        }]}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <View style={styles.headerKickerRow}>
              <View style={[styles.headerKickerRule, { backgroundColor: colors.primary }]} />
              <Text style={[styles.headerKicker, { color: colors.mutedForeground }]}>
                {activeView === "plans"
                  ? t("plans.screenKicker")
                  : activeView === "hangouts"
                    ? t("tabs.events.nearbyTab")
                    : t("tabs.events.title")}
              </Text>
            </View>
            <Text testID="events-heading" style={[styles.title, { color: colors.text }]}>
              {activeView === "plans"
                ? t("plans.screenTitle")
                : activeView === "hangouts"
                  ? t("tabs.events.nearbyTab")
                  : t("tabs.events.title")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {t(
                activeView === "plans"
                  ? "tabs.events.plansDescription"
                  : activeView === "hangouts"
                    ? "tabs.events.hangoutsDescription"
                    : "tabs.events.eventsDescription",
              )}
            </Text>
            {activeView === "events" && userLocation ? (
              <Text style={[styles.locationHint, { color: colors.primary }]}>{t("tabs.events.nearbyFirst")}</Text>
            ) : activeView === "events" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("tabs.events.enableNearby")}
                testID="events-enable-nearby-sorting"
                disabled={locationLoading}
                onPress={() => void enableNearbySorting()}
              >
                <Text style={[styles.locationAction, { color: colors.primary }]}>
                  {locationLoading ? t("tabs.events.findingLocation") : t("tabs.events.enableNearby")}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("plans.pastHangoutsTitle")}
              testID="events-past-hangouts"
              onPress={() => router.push("/plans" as never)}
              hitSlop={8}
              style={[styles.topBarIcon, { backgroundColor: colors.primarySoft }]}
            >
              <Feather name="clock" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("tabs.events.networks")}
              testID="events-networks"
              onPress={() => router.push("/(tabs)/networks")}
              hitSlop={8}
              style={[styles.topBarIcon, { backgroundColor: colors.primarySoft }]}
            >
              <Feather name="users" size={20} color={colors.primary} />
            </Pressable>
            {activeView !== "events" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  activeView === "plans" ? "plans.createA11y" : "tabs.events.createHangout",
                )}
                testID={activeView === "plans" ? "events-create-plan" : "events-create-hangout"}
                onPress={() => router.push({
                  pathname: "/event-create",
                  params: { mode: activeView === "plans" ? "friends" : "hangout" },
                } as never)}
                style={[styles.iconButton, { backgroundColor: colors.primary }]}
              >
                <Feather name="plus" size={21} color={colors.primaryForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={[styles.viewTabs, { borderColor: colors.border }]}>
          {([
            ["plans", t("plans.screenTitle")],
            ["hangouts", t("tabs.events.nearbyTab")],
            ["events", t("tabs.events.title")],
          ] as const).map(([view, label]) => {
            const selected = activeView === view;
            return (
              <Pressable
                key={view}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                testID={`events-view-${view}`}
                onPress={() => selectView(view)}
                style={[
                  styles.viewTab,
                  { borderBottomColor: selected ? colors.primary : "transparent" },
                ]}
              >
                <Text style={[styles.viewTabText, { color: selected ? colors.primary : colors.mutedForeground }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {actionError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{actionError}</Text> : null}

        {feed.isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        ) : feed.isError ? (
          <View style={[styles.emptyCard, { backgroundColor: "transparent", borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("tabs.events.loadError")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("tabs.events.refreshHint")}</Text>
            <Pressable
              accessibilityRole="button"
              testID="events-feed-retry"
              onPress={() => void feed.refetch()}
              style={[styles.emptyAction, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.emptyActionText, { color: colors.primaryForeground }]}>
                {t("common.retry")}
              </Text>
              <Feather name="refresh-cw" size={15} color={colors.primaryForeground} />
            </Pressable>
          </View>
        ) : activeView === "hangouts" ? (
          <HangoutsNearbyPanel
            hangouts={hangouts}
            userLocation={userLocation}
            sortMode={sortMode}
            onSortModeChange={(mode) => {
              setSortMode(mode);
              if (mode === "nearest" && !userLocation) {
                void enableNearbySorting();
              }
            }}
            nearestFallsBackToTime={sortMode === "nearest" && !userLocation}
            isLoading={nearbyHangoutQuery.isLoading}
            isLoadingMore={nearbyHangoutQuery.isFetching && hangoutPageOffset > 0}
            isError={nearbyHangoutQuery.isError}
            hasMore={hasMoreHangouts}
            onLoadMore={loadMoreHangouts}
            onRetry={() => void nearbyHangoutQuery.refetch()}
            onPressHangout={(event) => router.push(getHangoutOpenPath(
              event.id,
              event.ownerUid,
              authedUid,
              event.myJoinRequestStatus,
              getApproximateHangoutDistance(event, userLocation),
            ) as never)}
          />
        ) : visibleEvents.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: "transparent", borderColor: colors.border }]}>
            <Feather
              name={activeView === "plans" ? "message-circle" : "calendar"}
              size={24}
              color={colors.primary}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {activeView === "plans" ? t("plans.screenEmptyTitle") : t("tabs.events.empty")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {activeView === "plans" ? t("plans.screenEmptyBody") : t("tabs.events.emptyBody")}
            </Text>
            {activeView === "plans" ? (
              <Pressable
                accessibilityRole="button"
                testID="events-empty-create-plan"
                onPress={() => router.push({
                  pathname: "/event-create",
                  params: { mode: "friends" },
                } as never)}
                style={[styles.emptyAction, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.emptyActionText, { color: colors.primaryForeground }]}>
                  {t("plans.make")}
                </Text>
                <Feather name="arrow-up-right" size={15} color={colors.primaryForeground} />
              </Pressable>
            ) : activeView === "events" ? (
              <View style={styles.emptyActions}>
                <Pressable
                  accessibilityRole="button"
                  testID="events-empty-explore-venues"
                  accessibilityLabel={t("tabs.events.exploreVenues")}
                  onPress={() => router.push("/(tabs)" as never)}
                  style={[styles.emptyAction, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.emptyActionText, { color: colors.primaryForeground }]}>
                    {t("tabs.events.exploreVenues")}
                  </Text>
                  <Feather name="map" size={15} color={colors.primaryForeground} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  testID="events-empty-browse-hangouts"
                  accessibilityLabel={t("tabs.events.allHangouts")}
                  onPress={() => selectView("hangouts")}
                  style={[styles.emptyAction, { backgroundColor: colors.primarySoft }]}
                >
                  <Text style={[styles.emptyActionText, { color: colors.primary }]}>
                    {t("tabs.events.allHangouts")}
                  </Text>
                  <Feather name="arrow-up-right" size={15} color={colors.primary} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.eventList}>
            {visibleGroups.map((group) => (
                  <View key={group.key} style={[styles.eventDateGroup, rtl ? styles.eventDateGroupRtl : styles.eventDateGroupLtr]}>
                <Text
                  accessibilityRole="header"
                  style={[
                    styles.eventDateHeading,
                    {
                      color: colors.primary,
                      textAlign: rtl ? "right" : "left",
                    },
                  ]}
                >
                  {group.label}
                </Text>
                {group.events.map((event) => {
                  const key = `${event.eventType}:${event.id}`;
                  const isPending = pendingKey === key;
                  const eventTypeLabel =
                    activeView === "plans"
                      ? t("tabs.events.friendPlanBadge")
                      : event.eventType === "venue"
                      ? t("tabs.events.venueEvent")
                      : t("tabs.events.memberEvent");
                  const isRecurringPlan =
                    activeView === "plans" &&
                    event.eventType === "member" &&
                    Boolean(event.repeatFrequency);
                  const repeatCadenceLabel =
                    event.repeatFrequency === "daily"
                      ? t("tabs.events.repeatDaily")
                      : event.repeatFrequency === "weekly"
                        ? t("tabs.events.repeatWeekly")
                        : event.repeatFrequency === "monthly"
                          ? t("tabs.events.repeatMonthly")
                          : null;
                  const recurrenceDate = isRecurringPlan
                    ? formatRecurringPlanDate(
                        event.startsAt,
                        lang,
                        event.recurrenceTimeZone ?? "UTC",
                      )
                    : null;
                  const eventTimeLabel = recurrenceDate
                    ? t("tabs.events.nextOccurrence", { date: recurrenceDate })
                    : new Date(event.startsAt).toLocaleString(lang);
                  const eventPhotos = event.galleryPhotos?.length
                    ? event.galleryPhotos
                    : event.imageUrl
                      ? [event.imageUrl]
                      : [];
                  const eventPlaceLabel =
                    event.location ?? event.venueName;
                  const eventDistance = activeView === "events"
                    ? getApproximateHangoutDistance(event, userLocation)
                    : null;
                  const eventDistanceLabel = eventDistance == null
                    ? null
                    : formatApproximateDistance(eventDistance, lang);
                  const eventDistanceText = eventDistanceLabel
                    ? t("tabs.events.distanceAway", { distance: eventDistanceLabel })
                    : null;
                  const eventAccessibilityLabel = [
                    event.title,
                    eventTypeLabel,
                    isRecurringPlan ? repeatCadenceLabel : undefined,
                    event.visibility === "invite_only"
                      ? t("tabs.events.inviteOnly")
                      : undefined,
                    event.verifiedExplorersOnly
                      ? t("verifiedExplorer.eventOnly")
                      : event.isVerifiedExplorerHost
                        ? t("verifiedExplorer.title")
                        : undefined,
                    eventTimeLabel,
                    eventPlaceLabel,
                    event.creatorName
                      ? `${t("tabs.events.createdBy")} ${event.creatorName}`
                      : undefined,
                    eventDistanceText,
                  ]
                    .filter(Boolean)
                    .join(". ");
                  return (
                    <View key={key} style={[styles.eventCard, { borderBottomColor: colors.border }]}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={eventAccessibilityLabel}
                        accessibilityHint={t("tabs.events.detailsView")}
                        testID={`event-card-${event.eventType}-${event.id}`}
                        onPress={() => router.push(
                          event.eventType === "member" && event.joinApprovalRequired
                            ? getHangoutOpenPath(
                                event.id,
                                event.ownerUid,
                                authedUid,
                                event.myJoinRequestStatus,
                                getApproximateHangoutDistance(event, userLocation),
                              ) as never
                            : `/event-details/${event.eventType}/${event.id}` as never,
                        )}
                      >
                        {eventPhotos.length > 0 ? (
                          <EventPhotoCarousel
                            photos={eventPhotos}
                            imageStyle={styles.cover}
                            containerStyle={styles.eventPhotoGallery}
                            testID={`event-card-gallery-${event.eventType}-${event.id}`}
                            accessibilityLabel={`${event.title} photos`}
                            indicatorPlacement="overlay"
                          />
                        ) : null}
                        <View style={styles.eventBody}>
                          <View style={styles.badgeRow}>
                            <Text style={[styles.badge, { color: colors.primary, backgroundColor: "transparent" }]}>
                              {eventTypeLabel}
                            </Text>
                            {event.visibility === "invite_only" ? (
                              <Text style={[styles.privateBadge, { color: colors.mutedForeground }]}>{t("tabs.events.inviteOnly")}</Text>
                            ) : null}
                            {event.verifiedExplorersOnly ? (
                              <Text style={[styles.privateBadge, { color: colors.primary }]}>
                                {t("verifiedExplorer.eventOnly")}
                              </Text>
                            ) : event.isVerifiedExplorerHost ? (
                              <Text style={[styles.privateBadge, { color: colors.primary }]}>
                                {t("verifiedExplorer.title")}
                              </Text>
                            ) : null}
                          </View>
                          <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                          {isRecurringPlan && repeatCadenceLabel ? (
                            <View
                              testID={`event-card-recurrence-${event.id}`}
                              style={[
                                styles.recurrenceMetaRow,
                                { flexDirection: rtl ? "row-reverse" : "row" },
                              ]}
                            >
                              <Feather name="repeat" size={13} color={colors.primary} />
                              <Text style={[styles.recurrenceMetaText, { color: colors.primary }]}>
                                {repeatCadenceLabel}
                              </Text>
                            </View>
                          ) : null}
                          <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>
                            {eventTimeLabel}
                          </Text>
                          {(event.location || event.venueName) ? (
                            <View style={styles.locationMeta}>
                              <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                              <Text numberOfLines={1} style={[styles.eventMeta, styles.locationMetaText, { color: colors.mutedForeground }]}>
                                {event.location ?? event.venueName}
                              </Text>
                            </View>
                          ) : null}
                          {eventDistanceText ? (
                            <View style={styles.locationMeta}>
                              <Feather name="navigation" size={13} color={colors.primary} />
                              <Text
                                testID={`event-card-distance-${event.id}`}
                                style={[styles.eventMeta, styles.locationMetaText, { color: colors.primary }]}
                              >
                                {eventDistanceText}
                              </Text>
                            </View>
                          ) : null}
                          {event.eventType === "member" ? (
                            <View style={styles.creatorMeta}>
                              {event.creatorPhotoUrl ? (
                                <Image
                                  source={{ uri: event.creatorPhotoUrl }}
                                  accessibilityLabel={event.creatorName ?? t("tabs.events.createdBy")}
                                  style={styles.creatorAvatar}
                                />
                              ) : (
                                <View style={[styles.creatorAvatar, { backgroundColor: colors.primarySoft }]}>
                                  <Feather name="user" size={12} color={colors.primary} />
                                </View>
                              )}
                              <Text numberOfLines={1} style={[styles.creatorName, { color: colors.mutedForeground }]}>
                                {t("tabs.events.createdBy")} {event.creatorName ?? t("tabs.events.planHost")}
                              </Text>
                            </View>
                          ) : null}
                          {event.description ? <Text style={[styles.description, { color: colors.text }]} numberOfLines={3}>{event.description}</Text> : null}
                          <View style={styles.detailsLink}>
                            <Text style={[styles.detailsLinkText, { color: colors.primary }]}>
                              {t("tabs.events.detailsView")}
                            </Text>
                            <Feather name="chevron-right" size={16} color={colors.primary} />
                          </View>
                        </View>
                      </Pressable>
                      {activeView !== "plans" ? (
                      <View style={[styles.rsvpFooter, { borderTopColor: colors.border }]}>
                        <View style={styles.rsvpRow}>
                          <Text style={[styles.rsvpCount, { color: colors.mutedForeground }]}>{event.rsvpCount} · {t("tabs.events.going")}</Text>
                          {([
                            ["going", t("tabs.events.going")],
                            ["maybe", t("tabs.events.interested")],
                            ["not_going", t("tabs.events.notGoing")],
                          ] as const).map(([status, label]) => {
                            const selected = event.myRsvp === status;
                            const isCurrentPending = isPending && pendingStatus === status;
                            return (
                              <Pressable
                                key={status}
                                accessibilityRole="button"
                                accessibilityLabel={`${event.title}, ${label}`}
                                accessibilityState={{ selected }}
                                testID={`event-rsvp-${event.eventType}-${event.id}-${status}`}
                                disabled={isPending}
                                onPress={() => void rsvp(event, status)}
                                style={[
                                  styles.rsvpButton,
                                  {
                                    backgroundColor: selected ? colors.primary : "transparent",
                                    borderColor: selected ? colors.primary : colors.border,
                                    opacity: isPending && !isCurrentPending ? 0.65 : 1,
                                  },
                                ]}
                              >
                                {isCurrentPending ? (
                                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                                ) : (
                                  <Text
                                    style={[
                                      styles.rsvpButtonText,
                                      { color: selected ? colors.primaryForeground : colors.text },
                                    ]}
                                  >
                                    {label}
                                  </Text>
                                )}
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 22, gap: 19 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 1 },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  headerKickerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 7 },
  headerKickerRule: { width: 20, height: 1 },
  headerKicker: { fontSize: 9, fontWeight: "700", letterSpacing: 1.3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 3 },
  title: { fontFamily: "serif", fontSize: 43, lineHeight: 48, fontWeight: "400", letterSpacing: -1.3 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  viewTabs: { flexDirection: "row", borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 0, padding: 0, gap: 12 },
  viewTab: { flex: 1, minHeight: 42, borderBottomWidth: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  viewTabText: { fontSize: 11, fontWeight: "700" },
  locationAction: { fontSize: 12, fontWeight: "700", marginTop: 6 },
  locationHint: { fontSize: 12, fontWeight: "600", marginTop: 6 },
  topBarIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 13, fontWeight: "600" },
  loading: { paddingVertical: 56, alignItems: "center" },
  emptyCard: { borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 24, paddingHorizontal: 12, alignItems: "center", gap: 8 },
  emptyTitle: { fontFamily: "serif", fontSize: 21, fontWeight: "400", marginTop: 4 },
  emptyAction: { minHeight: 42, borderTopLeftRadius: 20, borderBottomRightRadius: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, marginTop: 8 },
  emptyActionText: { fontSize: 13, fontWeight: "700" },
  emptyActions: { width: "100%", gap: 7, marginTop: 4 },
  eventList: { gap: 0, paddingTop: 1 },
  eventDateGroup: { gap: 0, borderLeftWidth: 1, paddingLeft: 14, marginLeft: 6 },
  eventDateGroupLtr: { borderLeftWidth: 1, borderRightWidth: 0, paddingLeft: 14, paddingRight: 0, marginLeft: 6, marginRight: 0 },
  eventDateGroupRtl: { borderLeftWidth: 0, borderRightWidth: 1, paddingLeft: 0, paddingRight: 14, marginLeft: 0, marginRight: 6 },
  eventDateHeading: { fontFamily: "serif", fontSize: 21, fontWeight: "400", marginTop: 13, marginBottom: 12 },
  eventCard: { borderBottomWidth: StyleSheet.hairlineWidth, overflow: "hidden", marginBottom: 18, paddingBottom: 17 },
  eventPhotoGallery: { width: "100%", overflow: "hidden" },
  cover: { width: "100%", height: 174, borderTopLeftRadius: 2, borderTopRightRadius: 24, borderBottomLeftRadius: 2 },
  eventBody: { paddingHorizontal: 1, paddingTop: 13, paddingBottom: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 },
  badge: { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: 0, paddingVertical: 0 },
  privateBadge: { fontSize: 11, fontWeight: "600" },
  eventTitle: { fontFamily: "serif", fontSize: 26, fontWeight: "400", lineHeight: 31, letterSpacing: -0.45 },
  eventMeta: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  locationMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  locationMetaText: { flex: 1, marginTop: 0 },
  creatorMeta: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 7 },
  creatorAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  creatorName: { flex: 1, fontSize: 11, fontWeight: "600" },
  recurrenceMetaRow: { alignItems: "center", gap: 6, marginTop: 5 },
  recurrenceMetaText: { fontSize: 12, lineHeight: 17, fontWeight: "600" },
  description: { fontSize: 14, lineHeight: 20, marginTop: 9 },
  detailsLink: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 2, marginTop: 10 },
  detailsLinkText: { fontSize: 12, fontWeight: "700" },
  rsvpFooter: { borderTopWidth: StyleSheet.hairlineWidth, marginHorizontal: 0, paddingTop: 11, paddingBottom: 1 },
  rsvpRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  rsvpCount: { flexGrow: 1, flexBasis: 58, fontSize: 11 },
  rsvpButton: { flexGrow: 1, flexBasis: 65, minWidth: 0, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  rsvpButtonText: { fontSize: 10, fontWeight: "700", textAlign: "center" },
});

export default EventsScreen;
