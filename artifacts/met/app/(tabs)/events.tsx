import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

function EventsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useT();
  const { authedUid } = useApp();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const feed = useGetEventsFeed({ query: { staleTime: 30_000, refetchOnMount: "always" } });
  const memberRsvp = useRsvpCommunityEvent({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetEventsFeedQueryKey() });
      },
    },
  });

  const rsvp = useCallback(async (event: EventFeedItem, status: "going" | "maybe") => {
    const key = `${event.eventType}:${event.id}`;
    setPendingKey(key);
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
    }
  }, [authedUid, memberRsvp, queryClient]);

  const events = feed.data?.events ?? [];

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
                  {event.description ? <Text style={[styles.description, { color: colors.text }]}>{event.description}</Text> : null}
                  <View style={styles.rsvpRow}>
                    <Text style={[styles.rsvpCount, { color: colors.mutedForeground }]}>{event.rsvpCount} · {t("tabs.events.going")}</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isPending}
                      onPress={() => void rsvp(event, "going")}
                      style={[styles.rsvpButton, { backgroundColor: event.myRsvp === "going" ? colors.primary : colors.primarySoft }]}
                    >
                      {isPending ? <ActivityIndicator size="small" color={colors.primary} /> : (
                        <Text style={[styles.rsvpButtonText, { color: event.myRsvp === "going" ? colors.primaryForeground : colors.primary }]}>{t("tabs.events.going")}</Text>
                      )}
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isPending}
                      onPress={() => void rsvp(event, "maybe")}
                      style={[styles.rsvpButton, { backgroundColor: event.myRsvp === "maybe" ? colors.primary : colors.muted }]}
                    >
                      <Text style={[styles.rsvpButtonText, { color: event.myRsvp === "maybe" ? colors.primaryForeground : colors.text }]}>{t("tabs.events.maybe")}</Text>
                    </Pressable>
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
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  networkLink: { borderWidth: 1, borderRadius: 16, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  networkIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  networkCopy: { flex: 1 },
  networkTitle: { fontSize: 15, fontWeight: "700" },
  networkDescription: { fontSize: 12, marginTop: 3 },
  errorText: { fontSize: 13, fontWeight: "600" },
  loading: { paddingVertical: 56, alignItems: "center" },
  emptyCard: { borderWidth: 1, borderRadius: 18, padding: 24, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700", marginTop: 4 },
  eventCard: { borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  cover: { width: "100%", height: 170 },
  eventBody: { padding: 15 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  badge: { fontSize: 11, fontWeight: "700", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99 },
  privateBadge: { fontSize: 11, fontWeight: "600" },
  eventTitle: { fontSize: 19, fontWeight: "700" },
  eventMeta: { fontSize: 13, marginTop: 5 },
  description: { fontSize: 14, lineHeight: 20, marginTop: 9 },
  rsvpRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  rsvpCount: { flex: 1, fontSize: 12 },
  rsvpButton: { minWidth: 72, alignItems: "center", justifyContent: "center", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11 },
  rsvpButtonText: { fontSize: 12, fontWeight: "700" },
});

export default EventsScreen;
