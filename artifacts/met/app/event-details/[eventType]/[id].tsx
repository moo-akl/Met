import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import * as Location from "expo-location";
import {
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  Share,
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
import { getAppCheckToken } from "@/lib/firestore/client";
import { buildEventDetailsUrl } from "@/lib/eventLinks";
import EventFollowThroughActions from "@/components/EventFollowThroughActions";
import { cancelEventReminder } from "@/lib/eventReminders";
import {
  getGetEventDetailsQueryKey,
  getGetEventDetailsQueryOptions,
  getGetCommunityEventForEditQueryOptions,
  getGetEventsFeedQueryKey,
  checkInEventByLocation,
  useDeleteCommunityEvent,
  useCreateCommunityEventInviteLink,
  useCreateVenueOwnerEventInviteLink,
  useReportCommunityEvent,
  useRsvpCommunityEvent,
  type EventFeedItem,
} from "@workspace/api-client-react";

type RsvpStatus = "going" | "maybe" | "not_going";

export default function EventDetailsScreen() {
  const params = useLocalSearchParams<{
    eventType?: string | string[];
    id?: string | string[];
  }>();
  const rawType = Array.isArray(params.eventType) ? params.eventType[0] : params.eventType;
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const eventType: "venue" | "member" = rawType === "venue" ? "venue" : "member";
  const eventId = Number(rawId);
  const isValidRoute =
    (rawType === "venue" || rawType === "member") &&
    Number.isSafeInteger(eventId) &&
    eventId > 0;

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useT();
  const { authedUid } = useApp();
  const [actionError, setActionError] = useState("");
  const [reportPending, setReportPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rsvpPending, setRsvpPending] = useState(false);
  const [checkinPending, setCheckinPending] = useState(false);
  const [locationPermission, requestLocationPermission] =
    Location.useForegroundPermissions();
  const eventQuery = useQuery({
    ...getGetEventDetailsQueryOptions(eventType, isValidRoute ? eventId : 0),
    enabled: isValidRoute,
  });
  useEffect(() => {
    if (
      !authedUid ||
      !(eventQuery.error instanceof ApiError) ||
      eventQuery.error.status !== 404
    ) {
      return;
    }
    void cancelEventReminder(authedUid, eventType, eventId).catch(() => {});
  }, [authedUid, eventId, eventQuery.error, eventType]);

  const memberRsvp = useRsvpCommunityEvent();
  const deleteEvent = useDeleteCommunityEvent({
    mutation: {
      onSuccess: async () => {
        if (authedUid) {
          await cancelEventReminder(authedUid, "member", eventId).catch(() => {});
        }
        await queryClient.invalidateQueries({ queryKey: getGetEventsFeedQueryKey() });
        router.replace("/(tabs)/events" as never);
      },
      onError: (error) => {
        setActionError(error instanceof Error ? error.message : "Could not delete the event.");
        setConfirmDelete(false);
      },
    },
  });

  const event = eventQuery.data;
  const isOwner = Boolean(event && event.ownerUid === authedUid);
  const location = event?.location ?? event?.venueName ?? null;
  const ownerManageQuery = useQuery({
    ...getGetCommunityEventForEditQueryOptions(isValidRoute ? eventId : 0),
    enabled: isOwner && event?.eventType === "member",
  });
  const shareInviteMutation = useCreateCommunityEventInviteLink();
  const shareVenueInviteMutation = useCreateVenueOwnerEventInviteLink();
  const reportCommunityEvent = useReportCommunityEvent();

  const saveRsvp = async (status: RsvpStatus) => {
    if (!event) return;
    setRsvpPending(true);
    setActionError("");
    try {
      if (event.eventType === "venue") {
        await api.rsvpEvent({ uid: authedUid ?? "" }, event.id, status);
      } else {
        await memberRsvp.mutateAsync({ eventId: event.id, data: { status } });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetEventsFeedQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getGetEventDetailsQueryKey(event.eventType, event.id),
        }),
      ]);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Could not update your RSVP.");
    } finally {
      setRsvpPending(false);
    }
  };

  const checkInWithLocation = async () => {
    if (!event || isOwner || event.latitude == null || event.longitude == null) return;
    setCheckinPending(true);
    setActionError("");
    try {
      let permission = locationPermission;
      if (!permission?.granted) {
        permission = await requestLocationPermission();
      }
      if (!permission?.granted) {
        throw new Error("Allow location access to check in at this event.");
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const accuracy = position.coords.accuracy;
      if (accuracy == null) {
        throw new Error("Your location could not be verified. Scan the event QR code instead.");
      }
      const appCheckToken = await getAppCheckToken();
      const result = await checkInEventByLocation(
        event.eventType,
        event.id,
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy,
          ...(typeof position.mocked === "boolean" ? { mocked: position.mocked } : {}),
        },
        {
          headers: appCheckToken
            ? { "X-Firebase-AppCheck": appCheckToken }
            : {},
        },
      );
      await queryClient.invalidateQueries({
        queryKey: getGetEventDetailsQueryKey(event.eventType, event.id),
      });
      Alert.alert(
        result.alreadyCheckedIn ? "Already checked in" : "Attendance confirmed",
        result.alreadyCheckedIn
          ? "Your attendance was already recorded for this event."
          : `You're checked in to ${result.title}.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not check in at this event.",
      );
    } finally {
      setCheckinPending(false);
    }
  };

  const canShareEvent = Boolean(
    event &&
    (event.eventType === "venue"
      ? event.visibility === "public" || isOwner
      :
      event.visibility === "public" ||
      (isOwner && ownerManageQuery.data?.inviteLinkEnabled)),
  );
  const canOpenPlanChat = Boolean(
    event?.eventType === "member" &&
      (isOwner || event.isInvited || event.myRsvp === "going" || event.myRsvp === "maybe"),
  );

  const shareEvent = async () => {
    if (!event || !canShareEvent) return;
    setActionError("");
    try {
      const link = event.eventType === "venue"
        ? event.visibility === "invite_only"
          ? await shareVenueInviteMutation.mutateAsync({ eventId: event.id })
          : { url: buildEventDetailsUrl("venue", event.id), passcodeRequired: false }
        : await shareInviteMutation.mutateAsync({ eventId: event.id });
      if (event.eventType === "venue" && !event.placeId) {
        throw new Error("This venue event does not have a shareable venue link.");
      }
      const details = [
        event.title,
        new Date(event.startsAt).toLocaleString(),
        location,
      ].filter(Boolean).join("\n");
      await Share.share({
        message: `${details}\n${link.url}`,
        url: link.url,
        title: event.title,
      });
      if (link.passcodeRequired) {
        Alert.alert(
          t("tabs.events.passcodeProtected"),
          t("tabs.events.passcodeShareReminder"),
        );
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : t("tabs.events.inviteLinkShareFailed"),
      );
    }
  };

  const submitEventReport = async (
    reason: "inappropriate" | "harassment" | "spam" | "offensive_image" | "other",
  ) => {
    if (!event || isOwner) return;
    setReportPending(true);
    setActionError("");
    try {
      if (event.eventType === "member") {
        await reportCommunityEvent.mutateAsync({
          data: { eventId: event.id, reason },
        });
      } else if (event.placeId) {
        await api.reportVenueContent(
          { uid: authedUid ?? "" },
          {
            entityType: "event",
            entityId: event.id,
            placeId: event.placeId,
            reason,
          },
        );
      } else {
        throw new Error("This event cannot be reported right now.");
      }
      Alert.alert("Thanks", "Your report has been submitted for review.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not submit the report. Please try again.",
      );
    } finally {
      setReportPending(false);
    }
  };

  const showEventReportOptions = () => {
    if (!event || isOwner || reportPending) return;
    Alert.alert("Report this event", "Why are you reporting this?", [
      { text: "Inappropriate", onPress: () => void submitEventReport("inappropriate") },
      { text: "Offensive image", onPress: () => void submitEventReport("offensive_image") },
      { text: "Spam", onPress: () => void submitEventReport("spam") },
      { text: "Harassment", onPress: () => void submitEventReport("harassment") },
      { text: "Other", onPress: () => void submitEventReport("other") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const openDirections = async (currentEvent: EventFeedItem) => {
    const destination =
      currentEvent.latitude != null && currentEvent.longitude != null
        ? `${currentEvent.latitude},${currentEvent.longitude}`
        : currentEvent.location ?? currentEvent.venueName ?? "";
    if (!destination.trim()) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    try {
      await Linking.openURL(url);
    } catch {
      setActionError(t("tabs.events.mapsUnavailable"));
    }
  };

  const doDelete = () => {
    if (event?.eventType !== "member" || !isOwner) return;
    deleteEvent.mutate({ eventId: event.id });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t("tabs.events.detailsView")}
        </Text>
        {isOwner && event ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tabs.events.editEvent")}
            onPress={() => router.push(`/event-edit/${event.id}` as never)}
            style={styles.headerButton}
          >
            <Feather name="edit-2" size={19} color={colors.text} />
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
          <Feather name="calendar" size={28} color={colors.mutedForeground} />
          <Text style={[styles.stateText, { color: colors.text }]}>
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
          {event.imageUrl ? (
            <Image source={{ uri: event.imageUrl }} style={styles.cover} resizeMode="cover" />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: colors.primarySoft }]}>
              <Feather name="calendar" size={34} color={colors.primary} />
            </View>
          )}

          <View style={styles.body}>
            <View style={styles.badgeRow}>
              <Text style={[styles.badge, { color: colors.primary, backgroundColor: colors.primarySoft }]}>
                {event.eventType === "venue"
                  ? t("tabs.events.venueEvent")
                  : t("tabs.events.memberEvent")}
              </Text>
              {event.visibility === "invite_only" ? (
                <Text style={[styles.privateBadge, { color: colors.mutedForeground }]}>
                  {t("tabs.events.inviteOnly")}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>
            <View style={styles.metaRow}>
              <Feather name="clock" size={16} color={colors.mutedForeground} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {new Date(event.startsAt).toLocaleString()}
              </Text>
            </View>
            {event.endsAt ? (
              <View style={styles.metaRow}>
                <Feather name="clock" size={16} color={colors.mutedForeground} />
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {new Date(event.endsAt).toLocaleString()}
                </Text>
              </View>
            ) : null}
            {location ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${location}. ${t("tabs.events.openMap")}`}
                onPress={() => void openDirections(event)}
                style={[styles.locationRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.locationIcon, { backgroundColor: colors.primarySoft }]}>
                  <Feather name="map-pin" size={17} color={colors.primary} />
                </View>
                <View style={styles.locationCopy}>
                  <Text style={[styles.locationLabel, { color: colors.mutedForeground }]}>
                    {t("tabs.events.location")}
                  </Text>
                  <Text style={[styles.locationText, { color: colors.text }]}>{location}</Text>
                </View>
                <Feather name="navigation" size={18} color={colors.primary} />
              </Pressable>
            ) : null}
            {event.creatorName ? (
              <Text style={[styles.creator, { color: colors.mutedForeground }]}>
                {t("tabs.events.createdBy")} {event.creatorName}
              </Text>
            ) : null}
            {event.description ? (
              <Text style={[styles.description, { color: colors.text }]}>
                {event.description}
              </Text>
            ) : null}
            <EventFollowThroughActions event={event} uid={authedUid ?? null} />
            <View style={[styles.attendanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.attendanceHeading}>
                <View style={[styles.attendanceIcon, { backgroundColor: colors.primarySoft }]}>
                  <Feather name="check-circle" size={18} color={colors.primary} />
                </View>
                <View style={styles.attendanceCopy}>
                  <Text style={[styles.attendanceTitle, { color: colors.text }]}>
                    {isOwner ? "Event attendance" : "Were you there?"}
                  </Text>
                  <Text style={[styles.attendanceHint, { color: colors.mutedForeground }]}>
                    {isOwner
                      ? "Verified check-ins are separate from RSVPs."
                      : "Only a verified check-in counts as attendance."}
                  </Text>
                </View>
              </View>
              {isOwner ? (
                <Pressable
                  accessibilityRole="button"
                  testID="button-manage-event-attendance"
                  onPress={() => router.push({
                    pathname: "/event-attendees/[eventType]/[id]",
                    params: {
                      eventType: event.eventType,
                      id: String(event.id),
                      title: event.title,
                    },
                  } as never)}
                  style={[styles.attendanceButton, { backgroundColor: colors.primary }]}
                >
                  <Feather name="users" size={16} color={colors.primaryForeground} />
                  <Text style={[styles.attendanceButtonText, { color: colors.primaryForeground }]}>
                    Manage attendance
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.attendanceActions}>
                  <Pressable
                    accessibilityRole="button"
                    testID="button-scan-event-qr"
                    onPress={() => router.push("/qr-scan" as never)}
                    style={[styles.attendanceButton, { backgroundColor: colors.primary }]}
                  >
                    <Feather name="maximize" size={16} color={colors.primaryForeground} />
                    <Text style={[styles.attendanceButtonText, { color: colors.primaryForeground }]}>
                      Scan event QR
                    </Text>
                  </Pressable>
                  {event.latitude != null && event.longitude != null ? (
                    <Pressable
                      accessibilityRole="button"
                      testID="button-check-in-by-location"
                      disabled={checkinPending}
                      onPress={() => void checkInWithLocation()}
                      style={[styles.attendanceButton, styles.attendanceButtonSecondary, { borderColor: colors.primary, opacity: checkinPending ? 0.65 : 1 }]}
                    >
                      {checkinPending ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Feather name="map-pin" size={16} color={colors.primary} />
                      )}
                      <Text style={[styles.attendanceButtonText, { color: colors.primary }]}>
                        Check in by location
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
            {event.contactPhone || event.websiteUrl || event.publicEmail ? (
              <View style={{ gap: 10, marginTop: 4 }}>
                {event.contactPhone ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void Linking.openURL(`tel:${event.contactPhone}`)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
                  >
                    <Feather name="phone" size={16} color={colors.primary} />
                    <Text style={{ color: colors.text, fontSize: 14 }}>{event.contactPhone}</Text>
                  </Pressable>
                ) : null}
                {event.websiteUrl ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void Linking.openURL(
                      /^https?:\/\//i.test(event.websiteUrl!) ? event.websiteUrl! : `https://${event.websiteUrl}`,
                    )}
                    style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
                  >
                    <Feather name="globe" size={16} color={colors.primary} />
                    <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 14 }}>{event.websiteUrl}</Text>
                  </Pressable>
                ) : null}
                {event.publicEmail ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void Linking.openURL(`mailto:${event.publicEmail}`)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 9 }}
                  >
                    <Feather name="mail" size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 14 }}>{event.publicEmail}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <View style={[styles.rsvpSection, { borderTopColor: colors.border }]}>
              <Text style={[styles.rsvpCount, { color: colors.mutedForeground }]}>
                {event.rsvpCount} · {t("tabs.events.going")}
              </Text>
              <View style={styles.rsvpRow}>
                {([
                  ["going", t("tabs.events.going")],
                  ["maybe", t("tabs.events.interested")],
                  ["not_going", t("tabs.events.notGoing")],
                ] as const).map(([status, label]) => {
                  const selected = event.myRsvp === status;
                  return (
                    <Pressable
                      key={status}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={rsvpPending}
                      onPress={() => void saveRsvp(status)}
                      style={[
                        styles.rsvpButton,
                        {
                          backgroundColor: selected ? colors.primary : colors.primarySoft,
                          opacity: rsvpPending ? 0.65 : 1,
                        },
                      ]}
                    >
                      {rsvpPending && selected ? (
                        <ActivityIndicator size="small" color={selected ? colors.primaryForeground : colors.primary} />
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

            {canOpenPlanChat ? (
              <Pressable
                accessibilityRole="button"
                testID="button-open-plan-chat"
                onPress={() => router.push(`/event-chat/${event.id}` as never)}
                style={[
                  styles.shareButton,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Feather name="message-circle" size={17} color={colors.primary} />
                <Text style={[styles.shareText, { color: colors.primary }]}>
                  {t("tabs.events.planChat")}
                </Text>
                <Feather name="chevron-right" size={17} color={colors.primary} />
              </Pressable>
            ) : null}

            {canShareEvent ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("common.share")}
                disabled={shareInviteMutation.isPending}
                onPress={() => void shareEvent()}
                style={[
                  styles.shareButton,
                  {
                    borderColor: colors.primary,
                    opacity: shareInviteMutation.isPending ? 0.65 : 1,
                  },
                ]}
              >
                {shareInviteMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather name="share-2" size={16} color={colors.primary} />
                )}
                <Text style={[styles.shareText, { color: colors.primary }]}>
                  {t("common.share")}
                </Text>
              </Pressable>
            ) : null}
            {!isOwner ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Report this event"
                disabled={reportPending}
                onPress={showEventReportOptions}
                style={[styles.reportButton, { opacity: reportPending ? 0.6 : 1 }]}
              >
                <Feather name="flag" size={14} color={colors.mutedForeground} />
                <Text style={[styles.reportText, { color: colors.mutedForeground }]}>
                  {reportPending ? "Submitting report…" : "Report this event"}
                </Text>
              </Pressable>
            ) : null}

            {isOwner ? (
              <View style={styles.ownerActions}>
                {confirmDelete ? (
                  <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.confirmTitle, { color: colors.text }]}>
                      {t("tabs.events.deleteConfirmTitle")}
                    </Text>
                    <Text style={[styles.confirmBody, { color: colors.mutedForeground }]}>
                      {t("tabs.events.deleteConfirmBody")}
                    </Text>
                    <View style={styles.confirmButtons}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setConfirmDelete(false)}
                        style={[styles.confirmButton, { backgroundColor: colors.muted }]}
                      >
                        <Text style={[styles.confirmButtonText, { color: colors.text }]}>
                          {t("common.cancel")}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={deleteEvent.isPending}
                        onPress={doDelete}
                        style={[styles.confirmButton, { backgroundColor: colors.destructive }]}
                      >
                        {deleteEvent.isPending ? (
                          <ActivityIndicator size="small" color={colors.primaryForeground} />
                        ) : (
                          <Text style={[styles.confirmButtonText, { color: colors.primaryForeground }]}>
                            {t("tabs.events.deleteEvent")}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirmDelete(true)}
                    style={[styles.deleteButton, { borderColor: colors.destructive }]}
                  >
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                    <Text style={[styles.deleteText, { color: colors.destructive }]}>
                      {t("tabs.events.deleteEvent")}
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {actionError ? (
              <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>
                {actionError}
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
  headerButton: { width: 40, height: 40, justifyContent: "center", alignItems: "flex-start" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  stateText: { fontSize: 15, fontWeight: "600" },
  content: { paddingBottom: 24 },
  cover: { width: "100%", height: 230 },
  coverPlaceholder: { width: "100%", height: 160, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 18, paddingTop: 18 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  badge: { fontSize: 11, fontWeight: "700", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99 },
  privateBadge: { fontSize: 11, fontWeight: "600" },
  title: { fontSize: 26, lineHeight: 32, fontWeight: "700", marginBottom: 15 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 9 },
  meta: { fontSize: 14, lineHeight: 20, flex: 1 },
  locationRow: {
    borderWidth: 1,
    borderRadius: 15,
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 11,
    marginTop: 6,
  },
  locationIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  locationCopy: { flex: 1 },
  locationLabel: { fontSize: 11, fontWeight: "600" },
  locationText: { fontSize: 14, fontWeight: "600", marginTop: 3 },
  creator: { fontSize: 13, marginTop: 14 },
  description: { fontSize: 15, lineHeight: 23, marginTop: 18 },
  attendanceCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 14, marginTop: 20 },
  attendanceHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  attendanceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  attendanceCopy: { flex: 1, gap: 3 },
  attendanceTitle: { fontSize: 15, fontWeight: "700" },
  attendanceHint: { fontSize: 12, lineHeight: 17 },
  attendanceActions: { gap: 8 },
  attendanceButton: { minHeight: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  attendanceButtonSecondary: { borderWidth: 1, backgroundColor: "transparent" },
  attendanceButtonText: { fontSize: 13, fontWeight: "700" },
  rsvpSection: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 22, paddingTop: 16 },
  rsvpCount: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  rsvpRow: { flexDirection: "row", gap: 8 },
  rsvpButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", paddingHorizontal: 7, borderRadius: 12 },
  rsvpButtonText: { fontSize: 12, fontWeight: "700" },
  ownerActions: { marginTop: 18 },
  shareButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  shareText: { fontSize: 14, fontWeight: "700" },
  reportButton: { minHeight: 36, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, marginBottom: 10 },
  reportText: { fontSize: 13, fontWeight: "600" },
  deleteButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  deleteText: { fontSize: 14, fontWeight: "700" },
  confirmCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  confirmTitle: { fontSize: 15, fontWeight: "700" },
  confirmBody: { fontSize: 13, lineHeight: 19 },
  confirmButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  confirmButton: { minHeight: 40, minWidth: 90, borderRadius: 10, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  confirmButtonText: { fontSize: 13, fontWeight: "700" },
  errorText: { marginTop: 14, fontSize: 13, fontWeight: "600" },
});
