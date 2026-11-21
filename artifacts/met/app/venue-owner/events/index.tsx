import React, { useCallback } from "react";
import { Feather } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { getActiveVenueBusinessHeaders } from "@/lib/api/client";
import {
  getGetVenueOwnerMeEventsQueryKey,
  useCreateVenueOwnerEventInviteLink,
  useGetVenueOwnerMeEvents,
  useUpdateVenueOwnerMeEvent,
  type VenueManagerEvent,
} from "@workspace/api-client-react";

export default function VenueOwnerEventsScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    profile,
    isLoading: ownerLoading,
    error: ownerError,
    branchError,
    activeBusinessId,
  } = useVenueOwner();
  const requestHeaders = getActiveVenueBusinessHeaders();
  const eventsQuery = useGetVenueOwnerMeEvents({
    query: {
      enabled: !!authedUid && !ownerLoading && profile?.isApproved === true,
      queryKey: [
        ...getGetVenueOwnerMeEventsQueryKey(),
        authedUid ?? "signed-out",
        activeBusinessId ?? "no-branch",
      ],
    },
    request: { headers: requestHeaders },
  });
  const createInviteLink = useCreateVenueOwnerEventInviteLink({
    request: { headers: requestHeaders },
  });
  const updateEvent = useUpdateVenueOwnerMeEvent({
    request: { headers: requestHeaders },
  });
  const events = eventsQuery.data?.events ?? [];
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const refreshEvents = useCallback(async () => {
    await eventsQuery.refetch();
  }, [eventsQuery.refetch]);

  useFocusEffect(
    useCallback(() => {
      if (!ownerLoading && profile?.isApproved) void refreshEvents();
    }, [ownerLoading, profile?.isApproved, activeBusinessId, refreshEvents]),
  );

  const invalidateEvents = async () => {
    await queryClient.invalidateQueries({
      queryKey: getGetVenueOwnerMeEventsQueryKey(),
    });
  };

  const openEvent = (event: VenueManagerEvent) =>
    router.push({
      pathname: "/event-details/[eventType]/[id]",
      params: { eventType: "venue", id: String(event.id) },
    } as never);

  const openAttendees = (event: VenueManagerEvent) =>
    router.push({
      pathname: "/event-attendees/[eventType]/[id]",
      params: {
        eventType: "venue",
        id: String(event.id),
        title: event.title,
      },
    } as never);

  const handleShare = async (event: VenueManagerEvent) => {
    if (event.visibility !== "invite_only") return;
    try {
      const link = await createInviteLink.mutateAsync({ eventId: event.id });
      await invalidateEvents();
      await Share.share({
        message: `${event.title}\n${link.url}`,
        url: link.url,
        title: event.title,
      });
      if (link.passcodeRequired) {
        Alert.alert(
          "Passcode protected",
          "Send the passcode separately from the invitation link.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Could not share event",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const togglePublished = (event: VenueManagerEvent) => {
    const action = event.isPublished ? "Unpublish" : "Publish";
    Alert.alert(
      `${action} this event?`,
      event.isPublished
        ? "Guests will no longer see or RSVP to this event."
        : "Guests will be able to find this event and RSVP.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action,
          onPress: () => {
            void updateEvent.mutateAsync({
              eventId: event.id,
              data: { isPublished: !event.isPublished },
            }).then(invalidateEvents).catch((error: unknown) => {
              Alert.alert(
                `Could not ${action.toLowerCase()} event`,
                error instanceof Error ? error.message : "Please try again.",
              );
            });
          },
        },
      ],
    );
  };

  const openCreate = () => router.push("/venue-owner/events/new" as never);
  const isLoading = ownerLoading || eventsQuery.isLoading;
  const accessError = ownerError || branchError || !profile?.isApproved;

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <VenueOwnerHeader title="Events" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (accessError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <VenueOwnerHeader title="Events" onBack={() => router.back()} />
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color={colors.destructive} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            We couldn't refresh your venue access.
          </Text>
        </View>
      </View>
    );
  }

  if (eventsQuery.isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <VenueOwnerHeader title="Events" onBack={() => router.back()} />
        <View style={styles.center}>
          <Feather name="alert-circle" size={28} color={colors.destructive} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Events couldn't be loaded.
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="venue-owner-events-retry"
            onPress={() => void eventsQuery.refetch()}
            style={[styles.emptyBtn, { borderColor: colors.primary }]}
          >
            <Text style={[styles.emptyBtnText, { color: colors.primary }]}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <VenueOwnerHeader
        title="Events"
        onBack={() => router.back()}
        rightAction={
          <Pressable
            testID="venue-owner-new-event"
            accessibilityRole="button"
            accessibilityLabel="Create a venue event"
            onPress={openCreate}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>
              New event
            </Text>
          </Pressable>
        }
      />
      <FlatList
        data={events}
        scrollEnabled={events.length > 0}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + webBottomInset + 24 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="calendar" size={34} color={colors.primary} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No events yet
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create your first event"
              onPress={openCreate}
              style={[styles.emptyBtn, { borderColor: colors.primary }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primary }]}>
                Create your first event
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${item.title}`}
              testID={`venue-owner-event-open-${item.id}`}
              onPress={() => openEvent(item)}
              style={styles.eventSummary}
            >
              <View style={styles.titleLine}>
                <Text numberOfLines={1} style={[styles.cardTitle, { color: colors.text }]}>
                  {item.title}
                </Text>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.cardDate, { color: colors.primary }]}>
                {new Date(item.startsAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              <Text style={[styles.cardRsvp, { color: colors.mutedForeground }]}>
                {item.rsvpCount} RSVPs · {item.isPublished ? "Published" : "Draft"}
                {item.visibility === "invite_only" ? " · Invitation only" : ""}
              </Text>
            </Pressable>
            <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
              <IconAction
                label={`View RSVPs and attendance for ${item.title}`}
                testID={`venue-owner-event-rsvps-${item.id}`}
                onPress={() => openAttendees(item)}
                color={colors.primary}
                icon="users"
              />
              <IconAction
                label={`${item.isPublished ? "Unpublish" : "Publish"} ${item.title}`}
                testID={`venue-owner-event-publish-${item.id}`}
                onPress={() => togglePublished(item)}
                color={colors.mutedForeground}
                icon={item.isPublished ? "eye-off" : "eye"}
              />
              {item.visibility === "invite_only" ? (
                <IconAction
                  label={`${item.inviteLinkEnabled ? "Share" : "Create"} invitation link for ${item.title}`}
                  testID={`venue-event-share-link-${item.id}`}
                  onPress={() => void handleShare(item)}
                  color={colors.primary}
                  icon={item.inviteLinkEnabled ? "share-2" : "link"}
                  disabled={!item.isPublished || createInviteLink.isPending}
                />
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  );
}

function IconAction({
  label,
  testID,
  onPress,
  color,
  icon,
  disabled = false,
}: {
  label: string;
  testID: string;
  onPress: () => void;
  color: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.iconAction, { opacity: disabled ? 0.45 : pressed ? 0.65 : 1 }]}
      hitSlop={6}
    >
      <Feather name={icon} size={17} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 24 },
  addBtn: {
    minHeight: 40,
    borderTopLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  list: { paddingHorizontal: 18, paddingVertical: 12, gap: 10 },
  card: {
    borderTopLeftRadius: 24,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  eventSummary: { padding: 14, gap: 5 },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cardDate: { fontSize: 12, fontFamily: "Inter_500Medium" },
  cardRsvp: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardActions: {
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  iconAction: { minWidth: 42, minHeight: 42, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { marginBottom: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 16, textAlign: "center" },
  emptyBtn: { minHeight: 44, borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10, justifyContent: "center" },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
