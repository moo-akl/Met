import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useT } from "@/lib/i18n";
import { api, ApiError } from "@/lib/api/client";
import {
  getGetEventsFeedQueryKey,
  useGetEventsFeed,
  useRsvpCommunityEvent,
  type EventFeedItem,
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
  const { t } = useT();
  const { authedUid } = useApp();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<RsvpStatus | null>(null);
  const [actionError, setActionError] = useState("");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const feed = useGetEventsFeed({ query: { staleTime: 30_000, refetchOnMount: "always" } });
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

  const enableNearbySorting = useCallback(async () => {
    setLocationLoading(true);
    try {
      if (Platform.OS === "web") {
        setUserLocation(await getBrowserLocation());
        return;
      }
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted) return;
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setUserLocation(null);
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const events = useMemo(() => {
    const items = feed.data?.events ?? [];
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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 112 }]}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{t("tabs.events.title")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("tabs.events.subtitle")}</Text>
            {userLocation ? (
              <Text style={[styles.locationHint, { color: colors.primary }]}>{t("tabs.events.nearbyFirst")}</Text>
            ) : (
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
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tabs.events.create")}
            onPress={() => router.push("/event-create" as never)}
            style={[styles.iconButton, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={21} color={colors.primaryForeground} />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/networks")}
          style={[styles.networkLink, { backgroundColor: colors.card, borderColor: colors.border }]}
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

        {actionError ? <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{actionError}</Text> : null}

        {feed.isLoading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View>
        ) : feed.isError ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("tabs.events.loadError")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("tabs.events.refreshHint")}</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="calendar" size={24} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("tabs.events.empty")}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("tabs.events.emptyBody")}</Text>
          </View>
        ) : (
          events.map((event) => {
            const key = `${event.eventType}:${event.id}`;
            const isPending = pendingKey === key;
            return (
              <View key={key} style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${event.title}, ${t("tabs.events.detailsView")}`}
                  testID={`event-card-${event.eventType}-${event.id}`}
                  onPress={() => router.push(`/event-details/${event.eventType}/${event.id}` as never)}
                >
                  {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={styles.cover} resizeMode="cover" /> : null}
                  <View style={styles.eventBody}>
                    <View style={styles.badgeRow}>
                      <Text style={[styles.badge, { color: colors.primary, backgroundColor: colors.primarySoft }]}>
                        {event.eventType === "venue" ? t("tabs.events.venueEvent") : t("tabs.events.memberEvent")}
                      </Text>
                      {event.visibility === "invite_only" ? (
                        <Text style={[styles.privateBadge, { color: colors.mutedForeground }]}>{t("tabs.events.inviteOnly")}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                    <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>
                      {new Date(event.startsAt).toLocaleString()}
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
                <View style={styles.rsvpFooter}>
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
                          accessibilityState={{ selected }}
                          testID={`event-rsvp-${event.eventType}-${event.id}-${status}`}
                          disabled={isPending}
                          onPress={() => void rsvp(event, status)}
                          style={[
                            styles.rsvpButton,
                            {
                              backgroundColor: selected ? colors.primary : colors.primarySoft,
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
                                { color: selected ? colors.primaryForeground : colors.primary },
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
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontSize: 30, fontWeight: "700" },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  locationAction: { fontSize: 12, fontWeight: "700", marginTop: 6 },
  locationHint: { fontSize: 12, fontWeight: "600", marginTop: 6 },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  networkLink: { borderWidth: 1, borderTopRightRadius: 26, borderBottomLeftRadius: 26, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  networkIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  networkCopy: { flex: 1 },
  networkTitle: { fontSize: 15, fontWeight: "700" },
  networkDescription: { fontSize: 12, marginTop: 3 },
  errorText: { fontSize: 13, fontWeight: "600" },
  loading: { paddingVertical: 56, alignItems: "center" },
  emptyCard: { borderWidth: 1, borderRadius: 18, padding: 24, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700", marginTop: 4 },
  eventCard: { borderBottomLeftRadius: 30, borderTopRightRadius: 30, overflow: "hidden", marginBottom: 8 },
  cover: { width: "100%", height: 170 },
  eventBody: { padding: 15 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  badge: { fontSize: 11, fontWeight: "700", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99 },
  privateBadge: { fontSize: 11, fontWeight: "600" },
  eventTitle: { fontSize: 19, fontWeight: "700" },
  eventMeta: { fontSize: 13, marginTop: 5 },
  description: { fontSize: 14, lineHeight: 20, marginTop: 9 },
  detailsLink: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2, marginTop: 12 },
  detailsLinkText: { fontSize: 12, fontWeight: "700" },
  rsvpFooter: { paddingHorizontal: 15, paddingBottom: 14 },
  rsvpRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rsvpCount: { flex: 1, fontSize: 12 },
  rsvpButton: { flex: 1, minWidth: 0, minHeight: 38, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, paddingVertical: 7, borderRadius: 11 },
  rsvpButtonText: { fontSize: 11, fontWeight: "700", textAlign: "center" },
});

export default EventsScreen;
