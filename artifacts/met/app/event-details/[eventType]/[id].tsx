import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  Alert,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import { EventWelcomeNoteCard } from "@/components/EventWelcomeNoteCard";
import { EventPhotoCarousel } from "@/components/EventPhotoCarousel";
import { EventReviewSection } from "@/components/EventReviewSection";
import { TrustScoreBadge } from "@/components/TrustScoreBadge";
import { cancelEventReminder } from "@/lib/eventReminders";
import { formatApproximateDistance } from "@/lib/hangoutDiscovery";
import {
  DEFAULT_EVENT_WELCOME_NOTE_STYLE,
  resolveEventWelcomeNoteStyle,
} from "@/lib/eventWelcomeNoteStyle";
import type { EventWelcomeNoteStyle } from "@workspace/api-client-react";
import { formatRecurringPlanDate } from "@/lib/formatRecurringPlanDate";
import {
  getActiveVenueBusinessHeaders,
  getActiveVenueBusinessId,
} from "@/lib/api/client";
import {
  getGetEventDetailsQueryKey,
  getGetEventDetailsQueryOptions,
  getGetCommunityEventForEditQueryOptions,
  getGetVenueOwnerMeEventQueryKey,
  getGetVenueOwnerMeEventQueryOptions,
  getGetEventsFeedQueryKey,
  checkInEventByLocation,
  useDeleteCommunityEvent,
  useDeleteVenueOwnerMeEvent,
  useCreateCommunityEventInviteLink,
  useCreateVenueOwnerEventInviteLink,
  useReportCommunityEvent,
  useRsvpCommunityEvent,
  useClaimEventWelcomeNote,
  useAcknowledgeEventWelcomeNote,
  useRequestToJoinCommunityEvent,
  useWithdrawCommunityEventJoinRequest,
  type EventFeedItem,
} from "@workspace/api-client-react";

type RsvpStatus = "going" | "maybe" | "not_going";

const WELCOME_NOTE_SEEN_KEY_PREFIX = "met:eventWelcomeNoteSeen:v1:";
const WELCOME_NOTE_CLAIM_ATTEMPTS = 3;

function getWelcomeNoteSeenKey(uid: string, eventType: "venue" | "member", eventId: number) {
  return `${WELCOME_NOTE_SEEN_KEY_PREFIX}${encodeURIComponent(uid)}:${eventType}:${eventId}`;
}

export default function EventDetailsScreen() {
  const params = useLocalSearchParams<{
    eventType?: string | string[];
    id?: string | string[];
    approxDistance?: string | string[];
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
  const { width: windowWidth } = useWindowDimensions();
  const detailPhotoWidth = Math.max(240, Math.min(windowWidth - 54, 440));
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, lang } = useT();
  const { authedUid } = useApp();
  const [actionError, setActionError] = useState("");
  const [reportPending, setReportPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rsvpPending, setRsvpPending] = useState(false);
  const [joinRequestPending, setJoinRequestPending] = useState(false);
  const [checkinPending, setCheckinPending] = useState(false);
  const [startedEventKey, setStartedEventKey] = useState("");
  const [welcomeNote, setWelcomeNote] = useState<string | null>(null);
  const [welcomeNoteStyle, setWelcomeNoteStyle] = useState<EventWelcomeNoteStyle>(
    DEFAULT_EVENT_WELCOME_NOTE_STYLE,
  );
  const [welcomeNoteVisible, setWelcomeNoteVisible] = useState(false);
  const welcomeNoteClaimedKey = useRef<string | null>(null);
  const welcomeNoteDisplayTarget = useRef<{
    key: string;
    storageKey: string;
    uid: string;
    eventType: "venue" | "member";
    eventId: number;
  } | null>(null);
  const welcomeNoteAcknowledgedKey = useRef<string | null>(null);
  const [locationPermission, requestLocationPermission] =
    Location.useForegroundPermissions();
  const eventQuery = useQuery({
    ...getGetEventDetailsQueryOptions(eventType, isValidRoute ? eventId : 0),
    enabled: isValidRoute && !!authedUid,
    queryKey: [
      ...getGetEventDetailsQueryKey(eventType, isValidRoute ? eventId : 0),
      authedUid ?? "signed-out",
    ],
    refetchInterval: (query) =>
      query.state.data?.myJoinRequestStatus === "pending" ? 5_000 : false,
  });
  const venueBusinessId = getActiveVenueBusinessId();
  const venueBusinessHeaders = getActiveVenueBusinessHeaders();
  const venueOwnerEventOptions = getGetVenueOwnerMeEventQueryOptions(
    isValidRoute ? eventId : 0,
    { request: { headers: venueBusinessHeaders } },
  );
  const venueOwnerEventQuery = useQuery({
    ...venueOwnerEventOptions,
    enabled: eventType === "venue" && isValidRoute && !!authedUid,
    queryKey: [
      ...getGetVenueOwnerMeEventQueryKey(isValidRoute ? eventId : 0),
      authedUid ?? "signed-out",
      venueBusinessId ?? "no-branch",
    ],
    staleTime: 30_000,
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
  const claimEventWelcomeNote = useClaimEventWelcomeNote();
  const acknowledgeEventWelcomeNote = useAcknowledgeEventWelcomeNote();
  const requestToJoin = useRequestToJoinCommunityEvent();
  const withdrawJoinRequest = useWithdrawCommunityEventJoinRequest();
  const handleDeleteSuccess = async () => {
    if (authedUid) {
      await cancelEventReminder(authedUid, eventType, eventId).catch(() => {});
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetEventsFeedQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: getGetEventDetailsQueryKey(eventType, eventId),
      }),
      eventType === "venue"
        ? queryClient.invalidateQueries({
            queryKey: getGetVenueOwnerMeEventQueryKey(eventId),
          })
        : Promise.resolve(),
    ]);
    router.replace("/(tabs)/events" as never);
  };
  const handleDeleteError = (error: unknown) => {
    setActionError(
      error instanceof Error ? error.message : t("tabs.events.eventActionError"),
    );
    setConfirmDelete(false);
  };
  const deleteMemberEvent = useDeleteCommunityEvent({
    mutation: {
      onSuccess: handleDeleteSuccess,
      onError: handleDeleteError,
    },
  });
  const deleteVenueEvent = useDeleteVenueOwnerMeEvent({
    request: { headers: venueBusinessHeaders },
    mutation: {
      onSuccess: handleDeleteSuccess,
      onError: handleDeleteError,
    },
  });
  const isDeletePending = deleteMemberEvent.isPending || deleteVenueEvent.isPending;

  const event = eventQuery.data;
  const eventStartKey = event ? `${event.eventType}:${event.id}:${event.startsAt}` : "";
  const eventHasStarted = Boolean(
    event &&
      ((Number.isFinite(Date.parse(event.startsAt)) &&
        Date.parse(event.startsAt) <= Date.now()) ||
        eventStartKey === startedEventKey),
  );
  useEffect(() => {
    if (!event || !eventStartKey) return;
    const startsAtMs = Date.parse(event.startsAt);
    if (!Number.isFinite(startsAtMs)) return;
    if (startsAtMs <= Date.now()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const updateStartState = () => {
      const remaining = startsAtMs - Date.now();
      if (remaining <= 0) {
        setStartedEventKey(eventStartKey);
        return;
      }
      timer = setTimeout(updateStartState, Math.min(remaining, 60_000));
    };
    updateStartState();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [event, eventStartKey]);
  const isOwner = Boolean(
    event &&
      (event.eventType === "venue"
        ? venueOwnerEventQuery.isSuccess
        : event.ownerUid === authedUid),
  );
  const hasActiveMembership = Boolean(
    event &&
      (event.myRsvp === "going" ||
        event.myRsvp === "maybe" ||
        event.myJoinRequestStatus === "accepted"),
  );
  const welcomeNoteUid = !isOwner && hasActiveMembership ? authedUid : null;
  const welcomeNoteEventType =
    welcomeNoteUid && event ? event.eventType : null;
  const welcomeNoteEventId = welcomeNoteUid && event ? event.id : null;
  const welcomeNoteTargetKey =
    welcomeNoteUid && welcomeNoteEventType && welcomeNoteEventId
      ? `${welcomeNoteUid}:${welcomeNoteEventType}:${welcomeNoteEventId}`
      : null;
  useEffect(() => {
    if (
      !welcomeNoteUid ||
      !welcomeNoteEventType ||
      !welcomeNoteEventId ||
      !welcomeNoteTargetKey
    ) {
      return;
    }
    if (welcomeNoteClaimedKey.current === welcomeNoteTargetKey) return;
    welcomeNoteClaimedKey.current = welcomeNoteTargetKey;
    let cancelled = false;
    const storageKey = getWelcomeNoteSeenKey(
      welcomeNoteUid,
      welcomeNoteEventType,
      welcomeNoteEventId,
    );

    void (async () => {
      let alreadyDisplayed = false;
      try {
        alreadyDisplayed = (await AsyncStorage.getItem(storageKey)) === "1";
      } catch {
        // If local storage is unavailable, retrieving the pending note is safer
        // than silently suppressing a note the participant may never have seen.
      }
      if (cancelled) return;
      if (alreadyDisplayed) {
        void acknowledgeEventWelcomeNote
          .mutateAsync({
            eventType: welcomeNoteEventType,
            eventId: welcomeNoteEventId,
          })
          .catch(() => {});
        return;
      }

      for (let attempt = 0; attempt < WELCOME_NOTE_CLAIM_ATTEMPTS; attempt += 1) {
        if (cancelled) return;
        try {
          const {
            welcomeNote: note,
            welcomeNoteStyle: noteStyle,
          } = await claimEventWelcomeNote.mutateAsync({
            eventType: welcomeNoteEventType,
            eventId: welcomeNoteEventId,
          });
          if (cancelled) return;
          if (note?.trim()) {
            welcomeNoteDisplayTarget.current = {
              key: welcomeNoteTargetKey,
              storageKey,
              uid: welcomeNoteUid,
              eventType: welcomeNoteEventType,
              eventId: welcomeNoteEventId,
            };
            setWelcomeNote(note);
            setWelcomeNoteStyle(resolveEventWelcomeNoteStyle(noteStyle));
            setWelcomeNoteVisible(true);
          }
          return;
        } catch {
          if (attempt + 1 === WELCOME_NOTE_CLAIM_ATTEMPTS) {
            if (welcomeNoteClaimedKey.current === welcomeNoteTargetKey) {
              welcomeNoteClaimedKey.current = null;
            }
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    acknowledgeEventWelcomeNote.mutateAsync,
    claimEventWelcomeNote.mutateAsync,
    welcomeNoteEventId,
    welcomeNoteEventType,
    welcomeNoteTargetKey,
    welcomeNoteUid,
  ]);
  const acknowledgeDisplayedWelcomeNote = () => {
    const target = welcomeNoteDisplayTarget.current;
    if (!target || welcomeNoteAcknowledgedKey.current === target.key) return;
    welcomeNoteAcknowledgedKey.current = target.key;
    void (async () => {
      try {
        await AsyncStorage.setItem(target.storageKey, "1");
      } catch {
        // Server acknowledgment still prevents another delivery on this account.
      }
      try {
        await acknowledgeEventWelcomeNote.mutateAsync({
          eventType: target.eventType,
          eventId: target.eventId,
        });
      } catch {
        // The local marker suppresses a duplicate; reopening retries the ack.
      }
    })();
  };
  const isHangout = Boolean(eventType === "member" && event?.joinApprovalRequired);
  const isFriendPlan = Boolean(
    eventType === "member" &&
      !event?.joinApprovalRequired &&
      event?.visibility === "invite_only",
  );
  const showWebsite = !isHangout && !isFriendPlan;
  const recurrenceTimeZone = event?.repeatFrequency
    ? event.recurrenceTimeZone ?? "UTC"
    : undefined;
  const eventDateTimeOptions = recurrenceTimeZone
    ? { timeZone: recurrenceTimeZone }
    : {};
  const repeatCadenceLabel = event?.repeatFrequency === "daily"
    ? t("tabs.events.repeatDaily")
    : event?.repeatFrequency === "weekly"
      ? t("tabs.events.repeatWeekly")
      : event?.repeatFrequency === "monthly"
        ? t("tabs.events.repeatMonthly")
        : null;
  const nextOccurrenceLabel = event?.repeatFrequency && recurrenceTimeZone
    ? formatRecurringPlanDate(event.startsAt, lang, recurrenceTimeZone)
    : null;
  const hostRating = event?.meetingHostRating ?? null;
  const eventEndTime = event
    ? new Date(
        event.endsAt ??
          new Date(new Date(event.startsAt).getTime() + 4 * 60 * 60 * 1000),
      )
    : null;
  const eventEnded = Boolean(eventEndTime && eventEndTime.getTime() <= Date.now());
  const hangoutEnded = eventEnded;
  const isConcludedHangout = isHangout && hangoutEnded;
  const canEditEvent = Boolean(
    isOwner &&
      event &&
      !isFriendPlan &&
      !isConcludedHangout &&
      (event.eventType !== "venue" || event.placeId),
  );
  const canReviewEvent = Boolean(
    event &&
      eventEnded &&
      !isOwner &&
      !event.repeatFrequency &&
      (event.eventType === "venue"
        ? event.myRsvp === "going" || event.myRsvp === "maybe"
        : event.joinApprovalRequired
          ? event.myJoinRequestStatus === "accepted"
          : event.myRsvp === "going" || event.myRsvp === "maybe"),
  );
  const creatorUid = event?.eventType === "member" ? event.ownerUid : null;
  const creatorStandingQuery = useQuery({
    queryKey: ["community-standing", creatorUid],
    queryFn: () => api.getCommunityStanding({ uid: authedUid ?? "" }, creatorUid!),
    enabled: !!authedUid && !!creatorUid && eventType === "member",
    staleTime: 60_000,
  });
  const canAccessHangout = Boolean(
    event &&
      (!event.joinApprovalRequired ||
        isOwner ||
        event.isInvited ||
        event.myJoinRequestStatus === "accepted" ||
        event.myRsvp === "going" ||
        event.myRsvp === "maybe"),
  );
  const location = event?.location ?? event?.venueName ?? null;
  const rawApproximateDistance = Array.isArray(params.approxDistance)
    ? params.approxDistance[0]
    : params.approxDistance;
  const approximateDistanceMeters =
    isHangout &&
    !isConcludedHangout &&
    rawApproximateDistance &&
    /^\d+$/.test(rawApproximateDistance)
      ? Number(rawApproximateDistance)
      : null;
  const approximateDistanceText =
    approximateDistanceMeters == null
      ? null
      : formatApproximateDistance(approximateDistanceMeters, lang);
  const eventPhotos = event
    ? event.galleryPhotos?.length
      ? event.galleryPhotos
      : event.imageUrl
        ? [event.imageUrl]
        : []
    : [];
  const ownerManageQuery = useQuery({
    ...getGetCommunityEventForEditQueryOptions(isValidRoute ? eventId : 0),
    enabled: isOwner && event?.eventType === "member",
  });
  const shareInviteMutation = useCreateCommunityEventInviteLink();
  const shareVenueInviteMutation = useCreateVenueOwnerEventInviteLink({
    request: { headers: venueBusinessHeaders },
  });
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
      setActionError(t("tabs.events.eventActionError"));
    } finally {
      setRsvpPending(false);
    }
  };

  const updateFriendPlanInvitation = async (status: "going" | "not_going") => {
    if (!event || event.eventType !== "member" || !isFriendPlan || isOwner) return;
    setRsvpPending(true);
    setActionError("");
    try {
      await memberRsvp.mutateAsync({ eventId: event.id, data: { status } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetEventsFeedQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getGetEventDetailsQueryKey(event.eventType, event.id),
        }),
      ]);
      if (status === "not_going") router.replace("/plans" as never);
    } catch {
      setActionError(t("tabs.events.planInvitationActionError"));
    } finally {
      setRsvpPending(false);
    }
  };

  const leaveFriendPlan = () => {
    Alert.alert(
      t("tabs.events.leavePlan"),
      t("tabs.events.leavePlanConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("tabs.events.leavePlan"),
          style: "destructive",
          onPress: () => void updateFriendPlanInvitation("not_going"),
        },
      ],
    );
  };

  const updateJoinRequest = async () => {
    if (event?.eventType !== "member" || isOwner) return;
    const withdrawing = event.myJoinRequestStatus === "pending";
    setJoinRequestPending(true);
    setActionError("");
    try {
      if (withdrawing) {
        await withdrawJoinRequest.mutateAsync({ eventId: event.id });
      } else {
        await requestToJoin.mutateAsync({ eventId: event.id });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetEventsFeedQueryKey() }),
        queryClient.invalidateQueries({
          queryKey: getGetEventDetailsQueryKey(event.eventType, event.id),
        }),
      ]);
    } catch (error) {
      setActionError(t("tabs.events.eventActionError"));
    } finally {
      setJoinRequestPending(false);
    }
  };

  const checkInWithLocation = async () => {
    if (!event || !eventHasStarted || isOwner || !canAccessHangout || event.latitude == null || event.longitude == null) return;
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
      (isFriendPlan
        ? isOwner || event.myRsvp === "going" || event.myRsvp === "maybe"
        : isOwner ||
          event.isInvited ||
          event.myRsvp === "going" ||
          event.myRsvp === "maybe" ||
          event.myJoinRequestStatus === "accepted"),
  );
  const planChatLabel = isHangout
    ? t("tabs.events.hangoutChat")
    : t("tabs.events.planChat");
  const canRsvpDirectly = Boolean(
    event &&
      (!event.joinApprovalRequired ||
        (!isOwner &&
          (event.isInvited || event.myJoinRequestStatus === "accepted"))),
  );
  const showHangoutActionDock = Boolean(
    isHangout &&
      !isOwner &&
      !isConcludedHangout &&
      event?.myJoinRequestStatus !== "accepted",
  );
  const manageEventLabel = event?.joinApprovalRequired
    ? `${t("tabs.events.joinRequests")}${event.pendingJoinRequestCount ? ` (${event.pendingJoinRequestCount})` : ""}`
    : t("tabs.events.manageAttendance");

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
        new Date(event.startsAt).toLocaleString(lang),
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
    if (!event || !isOwner) return;
    if (event.eventType === "venue") {
      deleteVenueEvent.mutate({ eventId: event.id });
      return;
    }
    deleteMemberEvent.mutate({ eventId: event.id });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 8, borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={[styles.headerTitle, { color: colors.text }]}>
          {t(
            isConcludedHangout
              ? "plans.pastHangoutsTitle"
              : isHangout
                ? "tabs.events.hangoutDetailsTitle"
                : isFriendPlan
                  ? "plans.screenTitle"
                  : "tabs.events.detailsView",
          )}
        </Text>
        {canEditEvent && event ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tabs.events.editEvent")}
            testID="event-details-edit-button"
            onPress={() => {
              if (event.eventType === "venue") {
                router.push(`/venue-owner/events/${event.id}` as never);
              } else {
                router.push(`/event-edit/${event.id}` as never);
              }
            }}
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
          {eventQuery.isError ? (
            <Pressable
              accessibilityRole="button"
              testID="event-details-retry"
              onPress={() => void eventQuery.refetch()}
              style={[styles.retryButton, { backgroundColor: colors.primarySoft }]}
            >
              <Text style={[styles.retryButtonText, { color: colors.primary }]}>
                {t("common.retry")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                insets.bottom +
                (Platform.OS === "web" ? 34 : 0) +
                (showHangoutActionDock ? 16 : 28),
            },
          ]}
        >
          {isHangout ? (
            <View testID="event-detail-hangout-hero" style={[styles.hangoutHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.hangoutHeroMedia}>
                {isConcludedHangout || !eventPhotos.length ? (
                  <View style={[styles.hangoutPlaceholder, { backgroundColor: colors.primarySoft }]}>
                    <View style={[styles.hangoutSun, { backgroundColor: colors.primary }]} />
                    <View style={[styles.hangoutHillBack, { backgroundColor: colors.card }]} />
                    <View style={[styles.hangoutHillFront, { backgroundColor: colors.primarySoft }]} />
                    <View style={styles.hangoutPlaceholderContent}>
                      <Feather name="users" size={30} color={colors.primary} />
                      <Text style={[styles.hangoutPlaceholderText, { color: colors.primary }]}>
                        {t("tabs.events.hangoutDetailsTitle")}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <EventPhotoCarousel
                    photos={eventPhotos}
                    imageStyle={[styles.hangoutCover, { width: detailPhotoWidth }]}
                    containerStyle={styles.hangoutPhotoRow}
                    testID="event-detail-hangout-gallery"
                    accessibilityLabel={t("tabs.events.planPhotos")}
                  />
                )}
                {approximateDistanceText ? (
                  <View
                    testID="event-detail-hangout-distance"
                    style={[styles.hangoutDistancePill, { backgroundColor: colors.card }]}
                  >
                    <Feather name="map-pin" size={13} color={colors.primary} />
                    <Text style={[styles.hangoutDistanceText, { color: colors.primary }]}>
                      {t("tabs.events.distanceAway", { distance: approximateDistanceText })}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.hangoutHeroFooter}>
                <View style={[styles.hangoutHeroIcon, { backgroundColor: colors.primarySoft }]}>
                  <Feather name="users" size={19} color={colors.primary} />
                </View>
                <View style={styles.hangoutHeroCopy}>
                  <Text style={[styles.hangoutHeroEyebrow, { color: colors.primary }]}>
                    {t("tabs.events.quickPlan")}
                  </Text>
                </View>
                <Feather name="arrow-up-right" size={18} color={colors.primary} />
              </View>
            </View>
          ) : isFriendPlan ? (
            <>
              <View testID="event-detail-plan-hero" style={[styles.planHero, { backgroundColor: colors.primarySoft }]}>
                <View style={[styles.planDateTile, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.planMonth, { color: colors.primaryForeground }]}>
                    {new Date(event.startsAt).toLocaleDateString(lang, {
                      month: "short",
                      ...eventDateTimeOptions,
                    }).toUpperCase()}
                  </Text>
                  <Text style={[styles.planDay, { color: colors.primaryForeground }]}>
                    {recurrenceTimeZone
                      ? new Date(event.startsAt).toLocaleDateString(lang, {
                          day: "numeric",
                          timeZone: recurrenceTimeZone,
                        })
                      : new Date(event.startsAt).getDate()}
                  </Text>
                </View>
                <View style={styles.planHeroCopy}>
                  <Text style={[styles.planHeroEyebrow, { color: colors.primary }]}>
                    {t("tabs.events.friendPlanBadge")}
                  </Text>
                  <Text style={[styles.planHeroDate, { color: colors.text }]}>
                    {new Date(event.startsAt).toLocaleDateString(lang, {
                      weekday: "long",
                      ...eventDateTimeOptions,
                    })}
                  </Text>
                  <Text style={[styles.planHeroTime, { color: colors.mutedForeground }]}>
                    {new Date(event.startsAt).toLocaleTimeString(lang, {
                      hour: "numeric",
                      minute: "2-digit",
                      ...eventDateTimeOptions,
                    })}
                  </Text>
                </View>
              </View>
              {eventPhotos.length > 0 ? (
                <EventPhotoCarousel
                  photos={eventPhotos}
                  imageStyle={[styles.planGalleryImage, { width: detailPhotoWidth }]}
                  containerStyle={styles.planGallery}
                  testID="event-detail-plan-gallery"
                  accessibilityLabel={t("tabs.events.planPhotos")}
                />
              ) : null}
            </>
          ) : eventPhotos.length > 0 ? (
            <EventPhotoCarousel
              photos={eventPhotos}
              imageStyle={[styles.cover, { width: detailPhotoWidth }]}
              containerStyle={styles.standardPhotoRow}
              testID="event-detail-standard-hero"
              accessibilityLabel={t("tabs.events.planPhotos")}
            />
          ) : !isConcludedHangout ? (
            <View
              testID="event-detail-standard-hero-placeholder"
              style={[styles.coverPlaceholder, { backgroundColor: colors.primarySoft }]}
            >
              <Feather name={event.eventType === "venue" ? "calendar" : "users"} size={34} color={colors.primary} />
            </View>
          ) : null}

          <View
            testID={isConcludedHangout ? "concluded-hangout-summary" : undefined}
            style={styles.body}
          >
            <View style={styles.badgeRow}>
              <Text style={[styles.badge, { color: colors.primary, backgroundColor: colors.primarySoft }]}>
                {isConcludedHangout
                  ? t("plans.pastHangoutsTitle")
                  : event.eventType === "venue"
                    ? t("tabs.events.venueEvent")
                    : isHangout
                      ? t("tabs.events.quickPlan")
                      : t("tabs.events.friendPlanBadge")}
              </Text>
              {!isConcludedHangout && event.visibility === "invite_only" ? (
                <Text style={[styles.privateBadge, { color: colors.mutedForeground }]}>
                  {t("tabs.events.inviteOnly")}
                </Text>
              ) : null}
            </View>
            <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{event.title}</Text>
            {event.eventType === "venue" ? (
              <View
                testID="event-detail-schedule"
                style={[styles.eventSchedule, { borderColor: colors.border }]}
              >
                <View style={[styles.scheduleDateTile, { backgroundColor: colors.primarySoft }]}>
                  <Text style={[styles.scheduleMonth, { color: colors.primary }]}>
                    {new Date(event.startsAt).toLocaleDateString(lang, {
                      month: "short",
                      ...eventDateTimeOptions,
                    }).toUpperCase()}
                  </Text>
                  <Text style={[styles.scheduleDay, { color: colors.text }]}>
                    {new Date(event.startsAt).toLocaleDateString(lang, {
                      day: "numeric",
                      ...eventDateTimeOptions,
                    })}
                  </Text>
                  <Text style={[styles.scheduleWeekday, { color: colors.mutedForeground }]}>
                    {new Date(event.startsAt).toLocaleDateString(lang, {
                      weekday: "short",
                      ...eventDateTimeOptions,
                    }).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.scheduleCopy}>
                  <Text style={[styles.scheduleDateText, { color: colors.text }]}>
                    {new Date(event.startsAt).toLocaleDateString(lang, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      ...eventDateTimeOptions,
                    })}
                  </Text>
                  <Text style={[styles.scheduleTimeText, { color: colors.mutedForeground }]}>
                    {new Date(event.startsAt).toLocaleTimeString(lang, {
                      hour: "numeric",
                      minute: "2-digit",
                      ...eventDateTimeOptions,
                    })}
                    {event.endsAt
                      ? ` · ${new Date(event.endsAt).toLocaleTimeString(lang, {
                          hour: "numeric",
                          minute: "2-digit",
                          ...eventDateTimeOptions,
                        })}`
                      : ""}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.metaRow}>
                  <Feather name="clock" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {new Date(event.startsAt).toLocaleString(lang, eventDateTimeOptions)}
                  </Text>
                </View>
                {!isConcludedHangout && event.endsAt ? (
                  <View style={styles.metaRow}>
                    <Feather name="clock" size={16} color={colors.mutedForeground} />
                    <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                      {new Date(event.endsAt).toLocaleString(lang, eventDateTimeOptions)}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
            {isFriendPlan && repeatCadenceLabel && nextOccurrenceLabel ? (
              <View
                testID="event-detail-next-occurrence"
                style={[styles.recurrenceCard, { backgroundColor: colors.primarySoft }]}
              >
                <Feather name="repeat" size={17} color={colors.primary} />
                <View style={styles.recurrenceCopy}>
                  <Text style={[styles.recurrenceCadence, { color: colors.text }]}>
                    {repeatCadenceLabel}
                  </Text>
                  <Text style={[styles.recurrenceDate, { color: colors.mutedForeground }]}>
                    {t("tabs.events.nextOccurrence", { date: nextOccurrenceLabel })}
                  </Text>
                </View>
              </View>
            ) : null}
            {location ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${location}. ${t("tabs.events.openMap")}`}
                onPress={() => void openDirections(event)}
                style={styles.locationRow}
              >
                <Feather name="map-pin" size={16} color={colors.primary} />
                <Text numberOfLines={1} style={[styles.locationText, { color: colors.text }]}>{location}</Text>
                <Feather name="navigation" size={18} color={colors.primary} />
              </Pressable>
            ) : null}
            {eventType === "member" ? (
              <View style={styles.creatorCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("tabs.events.viewOrganizerProfile", {
                    name: event.creatorName ?? t("tabs.events.createdBy"),
                  })}
                  testID="hangout-creator-profile"
                  onPress={() => router.push({
                    pathname: "/event-organizer/[eventId]",
                    params: { eventId: String(event.id) },
                  } as never)}
                  style={styles.creatorProfileLink}
                >
                  {event.creatorPhotoUrl ? (
                    <Image
                      testID="hangout-creator-photo"
                      accessibilityLabel={event.creatorName ?? t("tabs.events.createdBy")}
                      source={{ uri: event.creatorPhotoUrl }}
                      style={styles.creatorAvatar}
                    />
                  ) : (
                    <View style={[styles.creatorAvatar, styles.creatorAvatarFallback, { backgroundColor: colors.primarySoft }]}>
                      <Feather name="user" size={20} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.creatorDetails}>
                    <Text style={[styles.creatorScoreLabel, { color: colors.mutedForeground }]}>
                      {t("tabs.events.createdBy")}
                    </Text>
                    <Text testID="hangout-creator-name" style={[styles.creatorName, { color: colors.text }]}>
                      {event.creatorName ?? t("tabs.events.quickPlan")}
                    </Text>
                    {creatorStandingQuery.data?.trustScore != null ? (
                      <View style={styles.creatorScoreRow}>
                        <Text style={[styles.creatorScoreLabel, { color: colors.mutedForeground }]}>
                          {t("trustScore.label")}
                        </Text>
                        <TrustScoreBadge score={creatorStandingQuery.data.trustScore} showScore />
                      </View>
                    ) : null}
                  </View>
                </Pressable>
                  {hostRating && hostRating.reviewCount > 0 &&
                  hostRating.averageRating != null ? (
                    <Text
                      testID="hangout-creator-rating"
                      style={[styles.creatorRating, { color: colors.mutedForeground }]}
                    >
                      {t("tabs.events.hangoutHostRating", {
                        rating: hostRating.averageRating.toFixed(1),
                        count: hostRating.reviewCount,
                      })}
                    </Text>
                  ) : hostRating ? (
                    <Text testID="hangout-creator-rating-empty" style={[styles.creatorRating, { color: colors.mutedForeground }]}>
                      {t("tabs.events.hangoutHostNoReviews")}
                    </Text>
                  ) : null}
              </View>
            ) : event.creatorName ? (
              <Text style={[styles.creator, { color: colors.mutedForeground }]}>
                {t("tabs.events.createdBy")} {event.creatorName}
              </Text>
            ) : null}
            {!isConcludedHangout ? (
              <>
            {event.description ? (
              <Text style={[styles.description, { color: colors.text }]}>
                {event.description}
              </Text>
            ) : null}
            <EventFollowThroughActions event={event} uid={authedUid ?? null} />
            {isOwner && (event.eventType === "venue" || isHangout) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={manageEventLabel}
                testID="button-manage-event-attendance"
                onPress={() => router.push({
                  pathname: "/event-attendees/[eventType]/[id]",
                  params: {
                    eventType: event.eventType,
                    id: String(event.id),
                    title: event.title,
                    joinApprovalRequired: String(event.joinApprovalRequired),
                  },
                } as never)}
                style={[styles.ownerManageAction, { borderBottomColor: colors.border }]}
              >
                <View style={[styles.ownerManageIcon, { backgroundColor: colors.primarySoft }]}>
                  <Feather name={event.joinApprovalRequired ? "user-check" : "users"} size={17} color={colors.primary} />
                </View>
                <Text style={[styles.ownerManageText, { color: colors.text }]}>{manageEventLabel}</Text>
                <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
            {!isOwner && event.eventType === "venue" && canAccessHangout && eventHasStarted ? (
            <View testID="event-checkin-panel" style={[styles.attendanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.attendanceHeading}>
                <View style={[styles.attendanceIcon, { backgroundColor: colors.primarySoft }]}>
                  <Feather name="check-circle" size={18} color={colors.primary} />
                </View>
                <View style={styles.attendanceCopy}>
                  <Text accessibilityRole="header" style={[styles.attendanceTitle, { color: colors.text }]}>
                    {t("tabs.events.attendanceGuestHeading")}
                  </Text>
                </View>
              </View>
              <View style={styles.attendanceActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("tabs.events.scanEventQr")}
                    testID="button-scan-event-qr"
                    onPress={() => router.push("/qr-scan" as never)}
                    style={[styles.attendanceButton, styles.attendanceButtonScan, { backgroundColor: colors.primary }]}
                  >
                    <Feather name="maximize" size={16} color={colors.primaryForeground} />
                    <Text style={[styles.attendanceButtonText, { color: colors.primaryForeground }]}>
                      {t("tabs.events.scanEventQr")}
                    </Text>
                  </Pressable>
                  {event.latitude != null && event.longitude != null ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("tabs.events.checkInByLocation")}
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
                        {t("tabs.events.checkInByLocation")}
                      </Text>
                    </Pressable>
                  ) : null}
              </View>
            </View>
            ) : null}
            {event.contactPhone || (showWebsite && event.websiteUrl) || event.publicEmail ? (
              <View testID="event-contact-section" style={{ gap: 10, marginTop: 4 }}>
                <Text accessibilityRole="header" style={[styles.contactHeading, { color: colors.text }]}>
                  {t("tabs.events.contactHeading")}
                </Text>
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
                {showWebsite && event.websiteUrl ? (
                  <Pressable
                    accessibilityRole="link"
                    testID="event-website-link"
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

            {isFriendPlan && !isOwner ? (
              <View style={[styles.rsvpSection, { borderTopColor: colors.border }]}>
                {event.myRsvp === "not_going" ? (
                  <Text style={[styles.attendanceHint, { color: colors.mutedForeground }]}>
                    {t("tabs.events.leftPlanNotice")}
                  </Text>
                ) : event.myRsvp === "going" || event.myRsvp === "maybe" ? (
                  <>
                    <Text style={[styles.rsvpHeading, { color: colors.text }]}>
                      {t("tabs.events.planInvitationAccepted")}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("tabs.events.leavePlan")}
                      testID="button-leave-friend-plan"
                      disabled={rsvpPending}
                      onPress={leaveFriendPlan}
                      style={[
                        styles.attendanceButton,
                        { backgroundColor: colors.primarySoft, opacity: rsvpPending ? 0.65 : 1 },
                      ]}
                    >
                      {rsvpPending ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Feather name="log-out" size={16} color={colors.primary} />
                      )}
                      <Text style={[styles.attendanceButtonText, { color: colors.primary }]}>
                        {t("tabs.events.leavePlan")}
                      </Text>
                    </Pressable>
                  </>
                ) : event.isInvited ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("tabs.events.acceptPlanInvitation")}
                    testID="button-accept-plan-invitation"
                    disabled={rsvpPending}
                    onPress={() => void updateFriendPlanInvitation("going")}
                    style={[
                      styles.attendanceButton,
                      { backgroundColor: colors.primary, opacity: rsvpPending ? 0.65 : 1 },
                    ]}
                  >
                    {rsvpPending ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Feather name="check" size={16} color={colors.primaryForeground} />
                    )}
                    <Text style={[styles.attendanceButtonText, { color: colors.primaryForeground }]}>
                      {t("tabs.events.acceptPlanInvitation")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : !isHangout && canRsvpDirectly ? (
            <View style={[styles.rsvpSection, { borderTopColor: colors.border }]}>
              {!(isFriendPlan && isOwner) ? (
                <Text accessibilityRole="header" style={[styles.rsvpHeading, { color: colors.text }]}>
                  {t("tabs.events.rsvpHeading")}
                </Text>
              ) : null}
              <Text testID="event-rsvp-count" style={[styles.rsvpCount, { color: colors.mutedForeground }]}>
                {event.rsvpCount} · {t("tabs.events.going")}
              </Text>
              {!(isFriendPlan && isOwner) ? (
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
                        accessibilityLabel={`${event.title}, ${label}`}
                        testID={`button-direct-rsvp-${status}`}
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
              ) : null}
            </View>
            ) : !isHangout && !isFriendPlan ? (
              <View style={[styles.rsvpSection, { borderTopColor: colors.border }]}>
                <Text accessibilityRole="header" style={[styles.rsvpHeading, { color: colors.text }]}>
                  {t("tabs.events.joinRequests")}
                </Text>
                {event.myJoinRequestStatus === "pending" ? (
                  <Text style={[styles.attendanceHint, { color: colors.mutedForeground }]}>
                    {t("tabs.events.joinRequestPending")}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={event.myJoinRequestStatus === "pending"
                    ? t("tabs.events.cancelJoinRequest")
                    : event.myJoinRequestStatus === "declined"
                      ? t("tabs.events.requestAgain")
                      : t("tabs.events.requestToJoin")}
                  testID="button-request-to-join"
                  disabled={joinRequestPending}
                  onPress={() => void updateJoinRequest()}
                  style={[
                    styles.attendanceButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: joinRequestPending ? 0.65 : 1,
                      alignSelf: "flex-start",
                    },
                  ]}
                >
                  {joinRequestPending ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather
                      name={event.myJoinRequestStatus === "pending" ? "x" : "user-plus"}
                      size={16}
                      color={colors.primaryForeground}
                    />
                  )}
                  <Text style={[styles.attendanceButtonText, { color: colors.primaryForeground }]}>
                    {event.myJoinRequestStatus === "pending"
                      ? t("tabs.events.cancelJoinRequest")
                      : event.myJoinRequestStatus === "declined"
                        ? t("tabs.events.requestAgain")
                        : t("tabs.events.requestToJoin")}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {canOpenPlanChat ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={planChatLabel}
                testID="button-open-plan-chat"
                onPress={() => router.push(`/event-chat/${event.id}` as never)}
                style={[
                  styles.shareButton,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Feather name="message-circle" size={17} color={colors.primary} />
                <Text style={[styles.shareText, { color: colors.primary }]}>
                  {planChatLabel}
                </Text>
                <Feather name="chevron-right" size={17} color={colors.primary} />
              </Pressable>
            ) : null}

            {canShareEvent ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("common.share")}: ${event.title}`}
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
                accessibilityLabel={
                  reportPending
                    ? t("tabs.events.reportPending")
                    : t("tabs.events.reportEvent")
                }
                disabled={reportPending}
                onPress={showEventReportOptions}
                style={[styles.reportButton, { opacity: reportPending ? 0.6 : 1 }]}
              >
                <Feather name="flag" size={14} color={colors.mutedForeground} />
                <Text style={[styles.reportText, { color: colors.mutedForeground }]}>
                  {reportPending
                    ? t("tabs.events.reportPending")
                    : t("tabs.events.reportEvent")}
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
                        accessibilityLabel={t("common.cancel")}
                        onPress={() => setConfirmDelete(false)}
                        style={[styles.confirmButton, { backgroundColor: colors.muted }]}
                      >
                        <Text style={[styles.confirmButtonText, { color: colors.text }]}>
                          {t("common.cancel")}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("tabs.events.deleteEvent")}
                        testID="button-confirm-delete-event"
                        disabled={isDeletePending}
                        onPress={doDelete}
                        style={[styles.confirmButton, { backgroundColor: colors.destructive }]}
                      >
                        {isDeletePending ? (
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
                    accessibilityLabel={t("tabs.events.deleteEvent")}
                    testID="button-delete-event"
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
              </>
            ) : null}

            {eventEnded ? (
              <EventReviewSection
                eventType={event.eventType}
                eventId={event.id}
                uid={authedUid ?? null}
                canReview={canReviewEvent}
              />
            ) : null}

            {actionError ? (
              <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>
                {actionError}
              </Text>
            ) : null}
          </View>
        </ScrollView>
        {showHangoutActionDock && event ? (
          <View
            testID="hangout-action-dock"
            style={[
              styles.hangoutActionDock,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.background,
                paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 34 : 12),
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                event.myJoinRequestStatus === "pending"
                  ? t("tabs.events.cancelJoinRequest")
                  : event.myJoinRequestStatus === "declined"
                    ? t("tabs.events.requestAgain")
                    : t("tabs.events.requestToJoin")
              }
              testID="button-request-to-join"
              disabled={joinRequestPending}
              onPress={() => void updateJoinRequest()}
              style={[
                styles.hangoutActionButton,
                {
                  backgroundColor: colors.primary,
                  opacity: joinRequestPending ? 0.65 : 1,
                },
              ]}
            >
              {joinRequestPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather
                  name={event.myJoinRequestStatus === "pending" ? "x" : "user-plus"}
                  size={16}
                  color={colors.primaryForeground}
                />
              )}
              <Text style={[styles.attendanceButtonText, { color: colors.primaryForeground }]}>
                {event.myJoinRequestStatus === "pending"
                  ? t("tabs.events.cancelJoinRequest")
                  : event.myJoinRequestStatus === "declined"
                    ? t("tabs.events.requestAgain")
                    : t("tabs.events.requestToJoin")}
              </Text>
            </Pressable>
            {event.myJoinRequestStatus === "pending" ? (
              <Text style={[styles.hangoutActionHint, { color: colors.mutedForeground }]}>
                {t("tabs.events.joinRequestPending")}
              </Text>
            ) : null}
          </View>
        ) : null}
        </>
      )}
      <Modal
        transparent
        visible={welcomeNoteVisible && Boolean(welcomeNote)}
        animationType="fade"
        onShow={acknowledgeDisplayedWelcomeNote}
        onRequestClose={() => {
          setWelcomeNoteVisible(false);
          setWelcomeNote(null);
        }}
      >
        <View style={styles.welcomeModalOverlay}>
          <View
            accessibilityViewIsModal
            testID="event-welcome-note-card"
            style={styles.welcomeModalCard}
          >
            <EventWelcomeNoteCard
              note={welcomeNote ?? ""}
              style={welcomeNoteStyle}
              colors={colors}
              title={t("tabs.events.welcomeCardTitle")}
              dismissLabel={t("tabs.events.welcomeCardDismiss")}
              testID="event-welcome-note-style-card"
              bodyTestID="event-welcome-note-body"
              dismissTestID="event-welcome-note-dismiss"
              onDismiss={() => {
                setWelcomeNoteVisible(false);
                setWelcomeNote(null);
              }}
            />
          </View>
        </View>
      </Modal>
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
  retryButton: { minHeight: 40, borderRadius: 20, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontWeight: "700" },
  content: { paddingBottom: 24 },
  cover: { width: "100%", height: 230 },
  coverPlaceholder: { width: "100%", height: 160, alignItems: "center", justifyContent: "center" },
  standardPhotoRow: { gap: 10, paddingLeft: 18, paddingRight: 18, paddingTop: 13 },
  hangoutHero: { marginHorizontal: 18, marginTop: 18, borderWidth: 1, borderTopLeftRadius: 30, borderBottomRightRadius: 24, overflow: "hidden" },
  hangoutHeroMedia: { position: "relative" },
  hangoutPhotoRow: { gap: 8, padding: 8 },
  hangoutCover: { height: 205, borderTopLeftRadius: 24, borderBottomRightRadius: 20 },
  hangoutDistancePill: { position: "absolute", top: 15, right: 15, zIndex: 2, maxWidth: "82%", minHeight: 30, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, borderTopLeftRadius: 14, borderBottomRightRadius: 12 },
  hangoutDistanceText: { flexShrink: 1, fontSize: 10, fontWeight: "700" },
  hangoutPlaceholder: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 10, overflow: "hidden" },
  hangoutSun: { position: "absolute", width: 46, height: 46, borderRadius: 23, right: 44, top: 31, opacity: 0.2 },
  hangoutHillBack: { position: "absolute", width: 250, height: 98, borderRadius: 90, left: -54, bottom: -58, transform: [{ rotate: "-13deg" }] },
  hangoutHillFront: { position: "absolute", width: 270, height: 105, borderRadius: 90, right: -62, bottom: -68, transform: [{ rotate: "13deg" }] },
  hangoutPlaceholderContent: { alignItems: "center", justifyContent: "center", gap: 9, zIndex: 1 },
  hangoutPlaceholderText: { fontFamily: "serif", fontSize: 17, fontWeight: "400" },
  hangoutHeroFooter: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13 },
  hangoutHeroIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  hangoutHeroCopy: { flex: 1, gap: 3 },
  hangoutHeroEyebrow: { fontSize: 13, fontWeight: "700" },
  hangoutHeroHint: { fontSize: 11, lineHeight: 16 },
  planHero: { marginHorizontal: 18, marginTop: 18, minHeight: 122, borderTopLeftRadius: 32, borderBottomRightRadius: 24, padding: 14, flexDirection: "row", alignItems: "center", gap: 13 },
  planDateTile: { width: 68, height: 82, borderTopLeftRadius: 22, borderBottomRightRadius: 16, alignItems: "center", justifyContent: "center" },
  planMonth: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  planDay: { fontSize: 30, lineHeight: 36, fontWeight: "700" },
  planHeroCopy: { flex: 1, gap: 4 },
  planHeroEyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  planHeroDate: { fontSize: 15, fontWeight: "700" },
  planHeroTime: { fontSize: 12, fontWeight: "600" },
  planGallery: { gap: 9, paddingTop: 12, paddingLeft: 18, paddingRight: 18 },
  planGalleryImage: { height: 180, borderTopRightRadius: 24, borderBottomLeftRadius: 20 },
  body: { paddingHorizontal: 18, paddingTop: 18 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 9 },
  badge: { fontSize: 11, fontWeight: "700", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99 },
  privateBadge: { fontSize: 11, fontWeight: "600" },
  title: { fontFamily: "serif", fontSize: 32, lineHeight: 38, fontWeight: "400", letterSpacing: -0.6, marginBottom: 17 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 9 },
  meta: { fontSize: 14, lineHeight: 20, flex: 1 },
  eventSchedule: { flexDirection: "row", alignItems: "center", gap: 13, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  scheduleDateTile: { width: 52, minHeight: 61, flexShrink: 0, borderTopLeftRadius: 15, borderBottomRightRadius: 13, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  scheduleMonth: { fontSize: 8, fontWeight: "700", letterSpacing: 0.8 },
  scheduleDay: { fontFamily: "serif", fontSize: 24, lineHeight: 27 },
  scheduleWeekday: { fontSize: 7, fontWeight: "700", letterSpacing: 0.7 },
  scheduleCopy: { flex: 1, minWidth: 0, gap: 5 },
  scheduleDateText: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  scheduleTimeText: { fontSize: 12, lineHeight: 17 },
  recurrenceCard: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, marginTop: 4, marginBottom: 10 },
  recurrenceCopy: { flex: 1, gap: 2 },
  recurrenceCadence: { fontSize: 13, fontWeight: "700" },
  recurrenceDate: { fontSize: 12, lineHeight: 18 },
  locationRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 9, marginTop: 8 },
  locationText: { flex: 1, fontSize: 14, fontWeight: "600" },
  creator: { fontSize: 13, marginTop: 14 },
  creatorCard: { marginTop: 14, gap: 8 },
  creatorProfileLink: { flexDirection: "row", alignItems: "center", gap: 10 },
  creatorAvatar: { width: 38, height: 38, borderRadius: 19 },
  creatorAvatarFallback: { alignItems: "center", justifyContent: "center" },
  creatorDetails: { flex: 1, gap: 2 },
  creatorName: { fontSize: 14, fontWeight: "700" },
  creatorScoreRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  creatorScoreLabel: { fontSize: 11, fontWeight: "600" },
  creatorRating: { fontSize: 12, fontWeight: "600" },
  hostRatingForm: { gap: 8, marginTop: 3 },
  hostRatingStars: { flexDirection: "row", gap: 10, alignItems: "center" },
  hostRatingSubmit: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  hostRatingSubmitText: { fontSize: 12, fontWeight: "700" },
  description: { fontSize: 15, lineHeight: 23, marginTop: 18 },
  contactHeading: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  ownerManageAction: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    marginTop: 18,
  },
  ownerManageIcon: {
    width: 38,
    height: 38,
    borderTopLeftRadius: 15,
    borderBottomRightRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerManageText: { flex: 1, fontSize: 14, fontWeight: "700" },
  attendanceCard: { borderWidth: 1, borderTopLeftRadius: 30, borderBottomRightRadius: 22, padding: 16, gap: 14, marginTop: 20 },
  attendanceHeading: { flexDirection: "row", alignItems: "center", gap: 11 },
  attendanceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  attendanceCopy: { flex: 1, gap: 3 },
  attendanceTitle: { fontSize: 15, fontWeight: "700" },
  attendanceHint: { fontSize: 12, lineHeight: 17 },
  attendanceActions: { gap: 8 },
  attendanceButton: { minHeight: 48, borderTopLeftRadius: 24, borderBottomRightRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14 },
  attendanceButtonScan: { borderTopLeftRadius: 24, borderBottomRightRadius: 18 },
  attendanceButtonSecondary: { borderWidth: 1, backgroundColor: "transparent" },
  attendanceButtonText: { fontSize: 13, fontWeight: "700" },
  rsvpSection: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 22, paddingTop: 16 },
  rsvpHeading: { fontSize: 17, fontWeight: "700", marginBottom: 10 },
  rsvpCount: { fontSize: 13, fontWeight: "600", marginBottom: 10 },
  rsvpRow: { flexDirection: "row", gap: 8 },
  rsvpButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: 7, borderRadius: 999 },
  rsvpButtonText: { fontSize: 12, fontWeight: "700" },
  hangoutActionDock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 18, gap: 7 },
  hangoutActionButton: { minHeight: 50, borderTopLeftRadius: 25, borderBottomRightRadius: 19, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16 },
  hangoutActionHint: { fontSize: 11, lineHeight: 16, textAlign: "center" },
  ownerActions: { marginTop: 18 },
  shareButton: { minHeight: 48, borderWidth: 1, borderTopLeftRadius: 24, borderBottomRightRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  shareText: { fontSize: 14, fontWeight: "700" },
  reportButton: { minHeight: 36, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, marginBottom: 10 },
  reportText: { fontSize: 13, fontWeight: "600" },
  deleteButton: { minHeight: 48, borderWidth: 1, borderTopLeftRadius: 24, borderBottomRightRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  deleteText: { fontSize: 14, fontWeight: "700" },
  confirmCard: { borderWidth: 1, borderTopLeftRadius: 26, borderBottomRightRadius: 18, padding: 16, gap: 8 },
  confirmTitle: { fontSize: 15, fontWeight: "700" },
  confirmBody: { fontSize: 13, lineHeight: 19 },
  confirmButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  confirmButton: { minHeight: 40, minWidth: 90, borderRadius: 10, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  confirmButtonText: { fontSize: 13, fontWeight: "700" },
  errorText: { marginTop: 14, fontSize: 13, fontWeight: "600" },
  welcomeModalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
  },
  welcomeModalCard: {
    width: "100%",
    maxWidth: 420,
  },
});
