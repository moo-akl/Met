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
import { api, ApiError } from "@/lib/api/client";
import { HangoutsNearbyPanel } from "@/components/HangoutsNearbyPanel";
import { getHangoutOpenPath } from "@/lib/hangoutNavigation";
import { groupEventsByDate } from "@/lib/eventDateGroups";
import { isPlanEvent } from "@/lib/eventFeedClassification";
import { type HangoutSortMode } from "@/lib/hangoutDiscovery";
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
  const [activeView, setActiveView] = useState<"events" | "hangouts">(
    requestedView === "hangouts" ? "hangouts" : "events",
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<RsvpStatus | null>(null);
  const [actionError, setActionError] = useState("");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<"permission" | "unavailable" | null>(null);
  const [locationNeedsSettings, setLocationNeedsSettings] = useState(false);
  const [sortMode, setSortMode] = useState<HangoutSortMode>("nearest");
  const automaticLocationLookup = useRef(false);
  const appState = useRef(AppState.currentState);
  const [hangoutPageState, setHangoutPageState] = useState<{
    queryKey: string;
    offset: number;
    events: NearbyHangoutItem[];
    nextOffset: number | null;
  }>({ queryKey: "", offset: 0, events: [], nextOffset: null });
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
      setActionError(error instanceof ApiError ? error.message : "Could not update your RSVP.");
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
    setLocationError(null);
    setLocationNeedsSettings(false);
  }, []);

  const enableNearbySorting = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    setLocationNeedsSettings(false);
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
        setLocationError("permission");
        if (permission.canAskAgain === false) {
          setLocationNeedsSettings(true);
          if (activeView !== "hangouts") {
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
        }
        return;
      }
      await fetchNativeLocation();
    } catch {
      setUserLocation(null);
      setLocationError("unavailable");
    } finally {
      setLocationLoading(false);
    }
  }, [activeView, fetchNativeLocation, t]);

  useEffect(() => {
    if (requestedView === "events" || requestedView === "hangouts") {
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
        if (!permission.granted) {
          setLocationError("permission");
          setLocationNeedsSettings(permission.canAskAgain === false);
          return;
        }
        await fetchNativeLocation();
      } catch {
        setLocationError("unavailable");
        setLocationNeedsSettings(false);
      }
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
        activeView !== "hangouts"
      ) {
        return;
      }
      void (async () => {
        try {
          const permission = await Location.getForegroundPermissionsAsync();
          if (!permission.granted) {
            setUserLocation(null);
            setLocationError("permission");
            setLocationNeedsSettings(permission.canAskAgain === false);
            return;
          }
          if (!userLocation) {
            setLocationLoading(true);
            await fetchNativeLocation();
          }
        } catch {
          setUserLocation(null);
          setLocationError("unavailable");
          setLocationNeedsSettings(false);
        } finally {
          setLocationLoading(false);
        }
      })();
    });
    return () => subscription.remove();
  }, [activeView, fetchNativeLocation, userLocation]);

  const selectView = useCallback((view: "events" | "hangouts") => {
    setActiveView(view);
    router.setParams({ view });
  }, [router]);

  const events = useMemo(() => {
    const items = (feed.data?.events ?? []).filter((event: EventFeedItem) => !isPlanEvent(event));
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

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const hangoutQueryKey = JSON.stringify([
    sortMode,
    userLocation?.latitude ?? null,
    userLocation?.longitude ?? null,
    timeZone,
  ]);
  const hangoutPageOffset =
    hangoutPageState.queryKey === hangoutQueryKey ? hangoutPageState.offset : 0;
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
  const hangoutPageResponseKey = `${hangoutQueryKey}:${hangoutPageOffset}:${nearbyHangoutQuery.dataUpdatedAt}`;
  useEffect(() => {
    const response = nearbyHangoutQuery.data;
    if (!response || processedHangoutPageRef.current === hangoutPageResponseKey) return;
    processedHangoutPageRef.current = hangoutPageResponseKey;
    setHangoutPageState((current) => {
      const appendPage =
        current.queryKey === hangoutQueryKey &&
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
        current.queryKey === hangoutQueryKey &&
        current.offset === hangoutPageOffset &&
        current.nextOffset === response.nextOffset &&
        eventsUnchanged
      ) {
        return current;
      }
      return {
        queryKey: hangoutQueryKey,
        offset: hangoutPageOffset,
        events: nextEvents,
        nextOffset: response.nextOffset,
      };
    });
  }, [
    nearbyHangoutQuery.data,
    nearbyHangoutQuery.dataUpdatedAt,
    hangoutQueryKey,
    hangoutPageOffset,
    hangoutPageResponseKey,
  ]);
  const hangoutPageMatchesFilters = hangoutPageState.queryKey === hangoutQueryKey;
  const hangouts = hangoutPageMatchesFilters ? hangoutPageState.events : [];
  const hasMoreHangouts =
    hangoutPageMatchesFilters && hangoutPageState.nextOffset != null;
  const loadMoreHangouts = useCallback(() => {
    setHangoutPageState((current) => {
      if (current.queryKey !== hangoutQueryKey || current.nextOffset == null) {
        return current;
      }
      return { ...current, offset: current.nextOffset };
    });
  }, [hangoutQueryKey]);
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 112 }]}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>
              {activeView === "hangouts" ? t("tabs.events.nearbyTab") : t("tabs.events.title")}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {activeView === "hangouts"
                ? t("tabs.events.nearbySubtitle")
                : t("tabs.events.subtitle")}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={activeView === "hangouts" ? t("tabs.events.createHangout") : t("tabs.events.create")}
            onPress={() => router.push(
              activeView === "hangouts"
                ? { pathname: "/event-create", params: { mode: "plan" } } as never
                : "/event-create" as never,
            )}
            style={[styles.iconButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={21} color={colors.primaryForeground} />
          </Pressable>
        </View>

        <View style={[styles.viewTabs, { borderColor: colors.border }]}>
          {([
            ["events", t("tabs.events.title"), "calendar"],
            ["hangouts", t("tabs.events.nearbyTab"), "map-pin"],
          ] as const).map(([view, label, icon]) => {
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
                  selected && { backgroundColor: colors.primarySoft, borderBottomColor: colors.primary },
                ]}
              >
                <Feather name={icon} size={16} color={selected ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.viewTabText, { color: selected ? colors.primary : colors.mutedForeground }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeView === "events" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/networks")}
            style={[styles.networkLink, { backgroundColor: "transparent", borderColor: colors.border }]}
          >
            <View style={[styles.networkIcon, { backgroundColor: colors.primarySoft }]}>
              <Feather name="users" size={18} color={colors.primary} />
            </View>
            <View style={styles.networkCopy}>
              <Text style={[styles.networkTitle, { color: colors.text }]}>{t("tabs.events.networks")}</Text>
              <Text style={[styles.networkDescription, { color: colors.mutedForeground }]}>Your existing groups, membership, and invites</Text>
            </View>
            <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
          </Pressable>
        ) : null}

        {activeView === "events" && actionError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{actionError}</Text> : null}

        {feed.isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        ) : feed.isError ? (
          <View style={[styles.emptyCard, { backgroundColor: "transparent", borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("tabs.events.loadError")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("tabs.events.refreshHint")}</Text>
          </View>
        ) : activeView === "hangouts" ? (
          <HangoutsNearbyPanel
            hangouts={hangouts}
            userLocation={userLocation}
            locationLoading={locationLoading}
            locationError={locationError}
            locationNeedsSettings={locationNeedsSettings}
            onUseLocation={() => void enableNearbySorting()}
            onOpenSettings={() => void Linking.openSettings().catch(() => undefined)}
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
            onPressHangout={(eventId) => {
              const event = hangouts.find((item) => item.id === eventId);
              if (!event) return;
              router.push(getHangoutOpenPath(
                event.id,
                event.ownerUid,
                authedUid,
                event.myJoinRequestStatus,
              ) as never);
            }}
          />
        ) : events.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: "transparent", borderColor: colors.border }]}>
            <Feather name="calendar" size={24} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("tabs.events.empty")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("tabs.events.emptyBody")}</Text>
          </View>
        ) : (
          <View style={styles.eventList}>
            {eventGroups.map((group) => (
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
                    event.eventType === "venue"
                      ? t("tabs.events.venueEvent")
                      : t("tabs.events.memberEvent");
                  const eventTimeLabel = new Date(event.startsAt).toLocaleString(lang);
                  const eventPlaceLabel =
                    event.location ?? event.venueName ?? event.creatorName;
                  const eventAccessibilityLabel = [
                    event.title,
                    eventTypeLabel,
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
                              ) as never
                            : `/event-details/${event.eventType}/${event.id}` as never,
                        )}
                      >
                        {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={styles.cover} resizeMode="cover" /> : null}
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
                          <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>
                            {eventTimeLabel}
                          </Text>
                          {(event.location || event.venueName || event.creatorName) ? (
                            <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>
                              {event.location ?? event.venueName ?? event.creatorName}
                            </Text>
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
  content: { paddingHorizontal: 20, gap: 15 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  title: { fontFamily: "serif", fontSize: 36, fontWeight: "400", letterSpacing: -0.8 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  viewTabs: { flexDirection: "row", borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 0, padding: 0, gap: 4 },
  viewTab: { flex: 1, minHeight: 44, borderRadius: 0, borderBottomWidth: 2, borderBottomColor: "transparent", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 5 },
  viewTabText: { fontSize: 12, fontWeight: "700" },
  locationAction: { fontSize: 12, fontWeight: "700", marginTop: 6 },
  locationHint: { fontSize: 12, fontWeight: "600", marginTop: 6 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  networkLink: { borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  networkIcon: { width: 38, height: 38, borderTopLeftRadius: 14, borderBottomRightRadius: 14, alignItems: "center", justifyContent: "center" },
  networkCopy: { flex: 1 },
  networkTitle: { fontSize: 15, fontWeight: "700" },
  networkDescription: { fontSize: 12, marginTop: 3 },
  errorText: { fontSize: 13, fontWeight: "600" },
  loading: { paddingVertical: 56, alignItems: "center" },
  emptyCard: { borderWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 24, paddingHorizontal: 12, alignItems: "center", gap: 8 },
  emptyTitle: { fontFamily: "serif", fontSize: 21, fontWeight: "400", marginTop: 4 },
  eventList: { gap: 0, paddingTop: 3 },
  eventDateGroup: { gap: 0, borderLeftWidth: 1, paddingLeft: 14, marginLeft: 6 },
  eventDateGroupLtr: { borderLeftWidth: 1, borderRightWidth: 0, paddingLeft: 14, paddingRight: 0, marginLeft: 6, marginRight: 0 },
  eventDateGroupRtl: { borderLeftWidth: 0, borderRightWidth: 1, paddingLeft: 0, paddingRight: 14, marginLeft: 0, marginRight: 6 },
  eventDateHeading: { fontFamily: "serif", fontSize: 19, fontWeight: "400", marginTop: 10, marginBottom: 8 },
  eventCard: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 15, marginBottom: 8 },
  cover: { width: "100%", height: 154, borderTopRightRadius: 30, borderBottomLeftRadius: 22 },
  eventBody: { paddingTop: 12, paddingBottom: 5 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 7 },
  badge: { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: 0, paddingVertical: 0 },
  privateBadge: { fontSize: 11, fontWeight: "600" },
  eventTitle: { fontFamily: "serif", fontSize: 21, fontWeight: "400", lineHeight: 27 },
  eventMeta: { fontSize: 12, lineHeight: 17, marginTop: 5 },
  description: { fontSize: 14, lineHeight: 20, marginTop: 9 },
  detailsLink: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 2, marginTop: 10 },
  detailsLinkText: { fontSize: 12, fontWeight: "700" },
  rsvpFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingBottom: 1 },
  rsvpRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  rsvpCount: { flexGrow: 1, flexBasis: 58, fontSize: 11 },
  rsvpButton: { flexGrow: 1, flexBasis: 65, minWidth: 0, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  rsvpButtonText: { fontSize: 10, fontWeight: "700", textAlign: "center" },
});

export default EventsScreen;
