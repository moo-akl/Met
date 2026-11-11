import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import type { RecordingOptions } from "expo-av/build/Audio/Recording.types";
import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  getGetCommunityEventPlanChatQueryKey,
  getGetCommunityEventPlanChatQueryOptions,
  getGetEventsFeedQueryKey,
  getGetMyCommunityEventPlanChatsQueryKey,
  useMarkCommunityEventPlanChatRead,
  useRsvpCommunityEvent,
  useSetCommunityEventPlanChatNotifications,
  useSendCommunityEventPlanChatMessage,
  useCreateCommunityEventPlanChatMediaUpload,
} from "@workspace/api-client-react";

type PendingAttachment = {
  uri: string;
  mediaType: "image" | "voice";
  contentType: "image/jpeg" | "audio/mp4";
  durationMs?: number;
  byteSize?: number;
};

const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  isMeteringEnabled: false,
};

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function VoiceMessagePlayer({
  uri,
  durationMs,
  isMine,
  colors,
}: {
  uri: string;
  durationMs?: number | null;
  isMine: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const { t } = useT();
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const totalMs = durationMs ?? 0;

  useEffect(() => () => {
    soundRef.current?.unloadAsync().catch(() => {});
  }, []);

  const toggle = async () => {
    try {
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) return;
            setPositionMs(status.positionMillis ?? 0);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPositionMs(0);
              soundRef.current?.unloadAsync().catch(() => {});
              soundRef.current = null;
            }
          },
        );
        soundRef.current = sound;
        setIsPlaying(true);
      } else if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch {
      setIsPlaying(false);
    }
  };

  const seconds = Math.max(0, Math.round((positionMs > 0 ? positionMs : totalMs) / 1000));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("tabs.events.planChatVoiceMessage")}
      onPress={() => void toggle()}
      style={styles.voicePlayer}
    >
      <Feather
        name={isPlaying ? "pause" : "play"}
        size={18}
        color={isMine ? colors.primaryForeground : colors.primary}
      />
      <View style={[styles.voiceTrack, { backgroundColor: isMine ? "rgba(255,255,255,0.3)" : colors.border }]}>
        <View
          style={[
            styles.voiceProgress,
            {
              backgroundColor: isMine ? colors.primaryForeground : colors.primary,
              width: totalMs > 0 ? `${Math.min(positionMs / totalMs, 1) * 100}%` : "0%",
            },
          ]}
        />
      </View>
      <Text style={[styles.voiceDuration, { color: isMine ? colors.primaryForeground : colors.text }]}>
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
      </Text>
    </Pressable>
  );
}

export default function EventChatScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const eventId = Number(rawId);
  const isValidRoute = Number.isSafeInteger(eventId) && eventId > 0;

  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useT();
  const { authedUid } = useApp();
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recordSecsRef = useRef(0);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [leavePending, setLeavePending] = useState(false);
  const setPlanNotifications = useSetCommunityEventPlanChatNotifications();
  const markPlanChatRead = useMarkCommunityEventPlanChatRead();
  const lastMarkedReadRef = useRef<{ eventId: number; messageId: number } | null>(null);
  const updateRsvp = useRsvpCommunityEvent();
  const uploadMedia = useCreateCommunityEventPlanChatMediaUpload();
  const planChat = useQuery({
    ...getGetCommunityEventPlanChatQueryOptions(isValidRoute ? eventId : 0),
    enabled: isValidRoute && !!authedUid,
    refetchInterval: 8_000,
  });
  const sendMessage = useSendCommunityEventPlanChatMessage();
  const notificationsMuted = planChat.data?.notificationsMuted ?? false;
  const chatTitle = planChat.data?.event?.joinApprovalRequired
    ? t("tabs.events.hangoutChat")
    : t("tabs.events.planChat");

  const messages = planChat.data?.messages ?? [];
  const newestFirstMessages = useMemo(() => [...messages].reverse(), [messages]);
  const participants = planChat.data?.participants ?? [];
  const latestMessageId = messages.length ? messages[messages.length - 1]?.id : undefined;
  const [firstUnreadDivider, setFirstUnreadDivider] = useState<{
    eventId: number;
    messageId: number;
  } | null>(null);
  const capturedUnreadEventIdRef = useRef<number | null>(null);
  const firstUnreadMessageId =
    firstUnreadDivider?.eventId === eventId ? firstUnreadDivider.messageId : null;

  useEffect(() => {
    if (
      !isValidRoute ||
      !authedUid ||
      !planChat.isSuccess ||
      planChat.isFetching ||
      !planChat.data ||
      planChat.data.event.id !== eventId ||
      capturedUnreadEventIdRef.current === eventId
    ) return;

    capturedUnreadEventIdRef.current = eventId;
    const readThroughMessageId = planChat.data.readThroughMessageId ?? 0;
    const firstUnreadMessage = messages.find(
      (message) =>
        message.senderUid !== authedUid && message.id > readThroughMessageId,
    );
    setFirstUnreadDivider(
      firstUnreadMessage
        ? { eventId, messageId: firstUnreadMessage.id }
        : null,
    );
  }, [
    authedUid,
    eventId,
    isValidRoute,
    messages,
    planChat.data,
    planChat.isFetching,
    planChat.isSuccess,
  ]);

  useEffect(() => {
    if (!isValidRoute || !authedUid || latestMessageId == null) return;
    const previousRead = lastMarkedReadRef.current;
    if (
      previousRead?.eventId === eventId &&
      latestMessageId <= previousRead.messageId
    ) return;

    let cancelled = false;
    void markPlanChatRead.mutateAsync({ eventId })
      .then(() => {
        if (cancelled) return;
        lastMarkedReadRef.current = { eventId, messageId: latestMessageId };
        void queryClient.invalidateQueries({
          queryKey: getGetMyCommunityEventPlanChatsQueryKey(),
        });
      })
      .catch(() => {
        // The next successful chat refresh will retry marking this read.
      });
    return () => {
      cancelled = true;
    };
  }, [
    authedUid,
    eventId,
    isValidRoute,
    latestMessageId,
    markPlanChatRead.mutateAsync,
    planChat.dataUpdatedAt,
    queryClient,
  ]);>>>>>>> current GitHub main

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      const stale = recordingRef.current;
      recordingRef.current = null;
      if (stale) stale.stopAndUnloadAsync().catch(() => {});
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
    };
  }, []);

  const stopVoiceRecording = async () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
    const recording = recordingRef.current;
    recordingRef.current = null;
    const recordedSeconds = recordSecsRef.current;
    if (!recording) return;
    try {
      const status = await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        setPendingAttachment({
          uri,
          mediaType: "voice",
          contentType: "audio/mp4",
          durationMs: Math.max(1, status.durationMillis ?? recordedSeconds * 1000),
        });
      }
    } catch {
      setSendError(t("tabs.events.planChatMediaUploadError"));
    } finally {
      recordSecsRef.current = 0;
      setRecordSecs(0);
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
    }
  };

  const pickChatPhoto = async () => {
    if (sendMessage.isPending || uploadingAttachment || isRecording) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
      });
      const asset = result.canceled ? null : result.assets[0];
      if (!asset) return;
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
      );
      const info = await FileSystem.getInfoAsync(resized.uri);
      const byteSize = info.exists && "size" in info ? Number(info.size) : asset.fileSize ?? 0;
      if (byteSize > 8 * 1024 * 1024) {
        setSendError(t("tabs.events.planChatMediaUploadError"));
        return;
      }
      setSendError("");
      setPendingAttachment({
        uri: resized.uri,
        mediaType: "image",
        contentType: "image/jpeg",
        byteSize,
      });
    } catch {
      setSendError(t("tabs.events.planChatMediaUploadError"));
    }
  };

  const toggleVoiceRecording = async () => {
    if (sendMessage.isPending || uploadingAttachment || pendingAttachment) return;
    if (isRecording) {
      await stopVoiceRecording();
      return;
    }
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          t("tabs.events.planChatRecordVoice"),
          t("tabs.events.planChatMediaUploadError"),
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      const { recording } = await Audio.Recording.createAsync(VOICE_RECORDING_OPTIONS);
      recordingRef.current = recording;
      setIsRecording(true);
      recordSecsRef.current = 0;
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => {
        const nextSeconds = recordSecsRef.current + 1;
        recordSecsRef.current = nextSeconds;
        setRecordSecs(nextSeconds);
        if (nextSeconds >= 120) void stopVoiceRecording();
      }, 1000);
      setSendError("");
    } catch {
      setSendError(t("tabs.events.planChatMediaUploadError"));
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
    }
  };

  const uploadAttachment = async (attachment: PendingAttachment): Promise<string> => {
    const reservation = await uploadMedia.mutateAsync({
      eventId,
      data: {
        mediaType: attachment.mediaType,
        contentType: attachment.contentType,
      },
    });
    if (attachment.byteSize != null && attachment.byteSize > reservation.maxBytes) {
      throw new Error("ATTACHMENT_TOO_LARGE");
    }
    const extension = attachment.mediaType === "image" ? "jpg" : "m4a";
    const response = await FileSystem.uploadAsync(
      reservation.uploadUrl,
      attachment.uri,
      {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        mimeType: attachment.contentType,
        parameters: reservation.uploadFields,
      },
    );
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`ATTACHMENT_UPLOAD_FAILED_${response.status}`);
    }
    return reservation.mediaObjectPath;
  };

  const submitMessage = async () => {
    const text = draft.trim();
    if (
      (!text && !pendingAttachment) ||
      !isValidRoute ||
      sendMessage.isPending ||
      uploadingAttachment ||
      isRecording
    ) return;
    setSendError("");
    setUploadingAttachment(Boolean(pendingAttachment));
    try {
      let mediaObjectPath: string | undefined;
      if (pendingAttachment) {
        mediaObjectPath = await uploadAttachment(pendingAttachment);
      }
      await sendMessage.mutateAsync({
        eventId,
        data: {
          text: text || undefined,
          mediaType: pendingAttachment?.mediaType,
          mediaObjectPath,
          audioDurationMs: pendingAttachment?.mediaType === "voice"
            ? pendingAttachment.durationMs
            : undefined,
        },
      });
      setDraft("");
      setPendingAttachment(null);
      await queryClient.invalidateQueries({
        queryKey: getGetCommunityEventPlanChatQueryKey(eventId),
      });
    } catch (error) {
      console.warn(
        "[event-chat] attachment send failed",
        error instanceof Error ? error.message : "Unknown upload error",
      );
      setSendError(pendingAttachment
        ? t("tabs.events.planChatMediaUploadError")
        : t("tabs.events.planChatSendError"));
    } finally {
      setUploadingAttachment(false);
    }
  };

  const togglePlanNotifications = async () => {
    if (!planChat.data || !isValidRoute || setPlanNotifications.isPending) return;
    const nextMuted = !planChat.data.notificationsMuted;
    try {
      const result = await setPlanNotifications.mutateAsync({
        eventId,
        data: { muted: nextMuted },
      });
      queryClient.setQueryData(getGetCommunityEventPlanChatQueryKey(eventId), {
        ...planChat.data,
        notificationsMuted: result.muted,
      });
    } catch {
      Alert.alert(
        chatTitle,
        t("tabs.events.planChatNotificationUpdateError"),
      );
    }
  };

  const leaveHangoutChat = () => {
    if (!isValidRoute || leavePending) return;
    Alert.alert(
      t("tabs.events.leavePlanChat"),
      t("tabs.events.leavePlanChatConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("tabs.events.leavePlanChat"),
          style: "destructive",
          onPress: () => {
            setLeavePending(true);
            void (async () => {
              try {
                await updateRsvp.mutateAsync({
                  eventId,
                  data: { status: "not_going" },
                });
                await Promise.all([
                  queryClient.invalidateQueries({
                    queryKey: getGetCommunityEventPlanChatQueryKey(eventId),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: getGetEventsFeedQueryKey(),
                  }),
                ]);
                router.replace("/plans" as never);
              } catch {
                Alert.alert(
                  t("tabs.events.leavePlanChat"),
                  t("tabs.events.leavePlanChatError"),
                );
              } finally {
                setLeavePending(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
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
            testID="button-back-plan-chat"
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={planChat.data?.event?.title ? `Open details for ${planChat.data.event.title}` : t("tabs.events.detailsView")}
            testID="button-open-plan-details"
            disabled={!planChat.data?.event}
            onPress={() => planChat.data?.event && router.push(`/event-details/member/${planChat.data.event.id}` as never)}
            style={styles.headerCopy}
          >
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {chatTitle}
            </Text>
            {planChat.data?.event ? (
              <View style={styles.headerTitleLine}>
                <Text numberOfLines={1} style={[styles.headerSubtitle, { color: colors.primary }]}>
                  {planChat.data.event.title}
                </Text>
                <Feather name="chevron-down" size={14} color={colors.primary} />
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              notificationsMuted
                ? t("tabs.events.planChatUnmuteAlerts")
                : t("tabs.events.planChatMuteAlerts")
            }
            accessibilityState={{
              disabled: setPlanNotifications.isPending,
              selected: notificationsMuted,
            }}
            testID="button-toggle-plan-chat-notifications"
            disabled={setPlanNotifications.isPending}
            onPress={() => void togglePlanNotifications()}
            style={[styles.headerButton, styles.headerAction]}
          >
            <Feather
              name={notificationsMuted ? "bell-off" : "bell"}
              size={19}
              color={notificationsMuted ? colors.mutedForeground : colors.text}
            />
          </Pressable>
          {participants.some(
            (participant) =>
              participant.uid === authedUid && participant.status !== "host",
          ) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("tabs.events.leavePlanChat")}
              testID="button-leave-plan-chat"
              disabled={leavePending}
              onPress={leaveHangoutChat}
              style={[styles.headerButton, styles.headerAction]}
            >
              {leavePending ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : (
                <Feather name="log-out" size={18} color={colors.destructive} />
              )}
            </Pressable>
          ) : null}
        </View>

        {planChat.isLoading ? (
          <View style={styles.state}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : planChat.isError || !planChat.data ? (
          <View style={styles.state}>
            <Feather name="message-circle" size={28} color={colors.mutedForeground} />
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
              {t("tabs.events.planChatLoadError")}
            </Text>
            <Pressable
              accessibilityRole="button"
              testID="button-retry-plan-chat"
              onPress={() => void planChat.refetch()}
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
                {t("common.retry")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.eventInfo, { borderBottomColor: colors.border }]}>
              <View style={styles.eventMeta}>
                <Feather name="clock" size={14} color={colors.mutedForeground} />
                <Text style={[styles.eventMetaText, { color: colors.mutedForeground }]}>
                  {new Date(planChat.data.event.startsAt).toLocaleString()}
                </Text>
              </View>
              {planChat.data.event.location ? (
                <View style={styles.eventMeta}>
                  <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                  <Text
                    numberOfLines={1}
                    style={[styles.eventMetaText, { color: colors.mutedForeground }]}
                  >
                    {planChat.data.event.location}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.participants, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t("tabs.events.planParticipants")}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.participantList}
              >
                {participants.map((participant) => {
                  const statusLabel =
                    participant.status === "host"
                      ? t("tabs.events.planHost")
                      : participant.status === "maybe"
                        ? t("tabs.events.maybe")
                        : t("tabs.events.going");
                  return (
                    <View key={participant.uid} style={styles.participant}>
                      <Avatar
                        uri={participant.photoUrl}
                        size={38}
                        fallbackText={participant.displayName}
                      />
                      <Text
                        numberOfLines={1}
                        style={[styles.participantName, { color: colors.text }]}
                      >
                        {participant.displayName}
                      </Text>
                      <Text style={[styles.participantStatus, { color: colors.mutedForeground }]}>
                        {statusLabel}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            <FlatList
              style={styles.messageList}
              data={newestFirstMessages}
              keyExtractor={(item) => String(item.id)}
              inverted
              scrollEnabled={messages.length > 0}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.messageListContent,
                messages.length === 0 ? styles.emptyMessageList : null,
              ]}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {t("tabs.events.planChatEmpty")}
                </Text>
              }
              renderItem={({ item }) => {
                const isMine = item.senderUid === authedUid;
                return (
                  <View>
                    {item.id === firstUnreadMessageId ? (
                      <View
                        accessible
                        accessibilityRole="text"
                        accessibilityLabel={t("tabs.events.planChatNewMessages")}
                        style={styles.unreadDivider}
                      >
                        <View style={[styles.unreadDividerLine, { backgroundColor: colors.border }]} />
                        <Text style={[styles.unreadDividerText, { color: colors.primary }]}>
                          {t("tabs.events.planChatNewMessages")}
                        </Text>
                        <View style={[styles.unreadDividerLine, { backgroundColor: colors.border }]} />
                      </View>
                    ) : null}
                    <View
                      style={[
                        styles.messageRow,
                        isMine ? styles.messageRowMine : styles.messageRowOther,
                      ]}
                    >
                      {!isMine ? (
                        <Avatar uri={item.senderPhotoUrl} size={28} fallbackText={item.senderName} />
                      ) : null}
                      <View style={[styles.messageContent, isMine ? styles.messageContentMine : null]}>
                        {!isMine ? (
                          <Text style={[styles.senderName, { color: colors.mutedForeground }]}>
                            {item.senderName}
                          </Text>
                        ) : null}
                        <View
                          style={[
                            styles.messageBubble,
                            item.mediaType === "image" ? styles.messageBubbleImage : null,
                            {
                              backgroundColor: isMine ? colors.primary : colors.card,
                              borderColor: isMine ? colors.primary : colors.border,
                            },
                          ]}
                        >
                          {item.mediaType === "image" && item.mediaUrl ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={t("tabs.events.planChatChoosePhoto")}
                              onPress={() => setViewerUri(item.mediaUrl)}
                            >
                              <Image
                                source={{ uri: item.mediaUrl }}
                                contentFit="cover"
                                style={styles.messageImage}
                              />
                            </Pressable>
                          ) : null}
                          {item.mediaType === "voice" && item.mediaUrl ? (
                            <VoiceMessagePlayer
                              uri={item.mediaUrl}
                              durationMs={item.audioDurationMs}
                              isMine={isMine}
                              colors={colors}
                            />
                          ) : null}
                          {item.mediaType && !item.mediaUrl ? (
                            <Text
                              style={[
                                styles.messageText,
                                { color: isMine ? colors.primaryForeground : colors.text },
                              ]}
                            >
                              {t("tabs.events.planChatMediaUnavailable")}
                            </Text>
                          ) : null}
                          {item.text ? (
                            <Text
                              style={[
                                styles.messageText,
                                { color: isMine ? colors.primaryForeground : colors.text },
                              ]}
                            >
                              {item.text}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={[styles.messageTime, { color: colors.mutedForeground }]}>
                          {formatMessageTime(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />

            <View
              style={[
                styles.composer,
                {
                  paddingBottom: Math.max(insets.bottom, 10) + 8,
                  borderTopColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            >
              {sendError ? (
                <Text accessibilityRole="alert" style={[styles.sendError, { color: colors.destructive }]}>
                  {sendError}
                </Text>
              ) : null}
              {pendingAttachment ? (
                <View style={[styles.pendingAttachment, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {pendingAttachment.mediaType === "image" ? (
                    <Image source={{ uri: pendingAttachment.uri }} style={styles.pendingImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.pendingVoiceIcon, { backgroundColor: colors.primarySoft }]}>
                      <Feather name="mic" size={16} color={colors.primary} />
                    </View>
                  )}
                  <Text style={[styles.pendingAttachmentText, { color: colors.text }]} numberOfLines={1}>
                    {pendingAttachment.mediaType === "voice"
                      ? t("tabs.events.planChatVoiceMessage")
                      : t("tabs.events.planChatChoosePhoto")}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("tabs.events.planChatRemoveAttachment")}
                    testID="button-remove-plan-chat-attachment"
                    onPress={() => setPendingAttachment(null)}
                    style={styles.removeAttachment}
                  >
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ) : null}
              {isRecording ? (
                <Text style={[styles.recordingLabel, { color: colors.destructive }]}>
                  {t("tabs.events.planChatRecording")} {Math.floor(recordSecs / 60)}:{String(recordSecs % 60).padStart(2, "0")}
                </Text>
              ) : null}
              <View style={styles.composerRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("tabs.events.planChatChoosePhoto")}
                  testID="button-pick-plan-chat-photo"
                  disabled={sendMessage.isPending || uploadingAttachment || isRecording}
                  onPress={() => void pickChatPhoto()}
                  style={[
                    styles.mediaButton,
                    { backgroundColor: colors.card, opacity: sendMessage.isPending || uploadingAttachment || isRecording ? 0.5 : 1 },
                  ]}
                >
                  <Feather name="image" size={18} color={colors.primary} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isRecording
                    ? t("tabs.events.planChatStopRecording")
                    : t("tabs.events.planChatRecordVoice")}
                  testID="button-toggle-plan-chat-recording"
                  disabled={sendMessage.isPending || uploadingAttachment || Boolean(pendingAttachment)}
                  onPress={() => void toggleVoiceRecording()}
                  style={[
                    styles.mediaButton,
                    {
                      backgroundColor: isRecording ? colors.destructive : colors.card,
                      opacity: sendMessage.isPending || uploadingAttachment || Boolean(pendingAttachment) ? 0.5 : 1,
                    },
                  ]}
                >
                  <Feather
                    name={isRecording ? "square" : "mic"}
                    size={17}
                    color={isRecording ? colors.primaryForeground : colors.primary}
                  />
                </Pressable>
                <TextInput
                  accessibilityLabel={t("tabs.events.planChatPlaceholder")}
                  testID="input-plan-chat-message"
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t("tabs.events.planChatPlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={500}
                  multiline
                  editable={!sendMessage.isPending && !uploadingAttachment}
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("common.send")}
                  testID="button-send-plan-chat-message"
                  disabled={
                    (!draft.trim() && !pendingAttachment) ||
                    sendMessage.isPending ||
                    uploadingAttachment ||
                    uploadMedia.isPending ||
                    isRecording
                  }
                  onPress={() => void submitMessage()}
                  style={[
                    styles.sendButton,
                    {
                      backgroundColor: colors.primary,
                      opacity:
                        (!draft.trim() && !pendingAttachment) ||
                        sendMessage.isPending ||
                        uploadingAttachment ||
                        uploadMedia.isPending ||
                        isRecording
                          ? 0.55
                          : 1,
                    },
                  ]}
                >
                  {sendMessage.isPending || uploadingAttachment || uploadMedia.isPending ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="arrow-up" size={19} color={colors.primaryForeground} />
                  )}
                </Pressable>
              </View>
              <Text style={[styles.expiryNote, { color: colors.mutedForeground }]}>
                {t("tabs.events.planChatMediaExpiry")}
              </Text>
            </View>
          </>
        )}
      </View>
      <Modal
        visible={Boolean(viewerUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <Pressable style={styles.imageViewer} onPress={() => setViewerUri(null)}>
          {viewerUri ? (
            <Image source={{ uri: viewerUri }} contentFit="contain" style={styles.viewerImage} />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            onPress={() => setViewerUri(null)}
            style={styles.viewerClose}
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 60,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: { width: 40, height: 40, justifyContent: "center" },
  headerAction: { alignItems: "center" },
  headerCopy: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  headerTitleLine: { maxWidth: "90%", flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
  headerSubtitle: { fontSize: 12, marginTop: 2, maxWidth: "90%" },
  eventInfo: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 7 },
  eventMetaText: { fontSize: 12, flex: 1 },
  participants: {
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { paddingHorizontal: 18, fontSize: 14, fontWeight: "700" },
  participantList: { paddingHorizontal: 16, paddingTop: 10, gap: 15 },
  participant: { width: 62, alignItems: "center", gap: 3 },
  participantName: { width: "100%", fontSize: 11, fontWeight: "600", textAlign: "center" },
  participantStatus: { fontSize: 10, textAlign: "center" },
  messageList: { flex: 1 },
  messageListContent: { paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  unreadDivider: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  unreadDividerLine: { height: StyleSheet.hairlineWidth, flex: 1 },
  unreadDividerText: { fontSize: 11, fontWeight: "700" },
  emptyMessageList: { flexGrow: 1, justifyContent: "center" },
  emptyText: { alignSelf: "center", textAlign: "center", maxWidth: 260, fontSize: 14, lineHeight: 21 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 7 },
  messageRowMine: { justifyContent: "flex-end" },
  messageRowOther: { justifyContent: "flex-start" },
  messageContent: { maxWidth: "82%", gap: 3 },
  messageContentMine: { alignItems: "flex-end" },
  senderName: { fontSize: 11, marginLeft: 4 },
  messageBubble: { borderWidth: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  messageBubbleImage: { padding: 4, overflow: "hidden" },
  messageImage: { width: 220, height: 190, borderRadius: 13 },
  messageText: { fontSize: 14, lineHeight: 19 },
  voicePlayer: { minWidth: 190, flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 2 },
  voiceTrack: { height: 4, flex: 1, borderRadius: 2, overflow: "hidden" },
  voiceProgress: { height: 4, borderRadius: 2 },
  voiceDuration: { minWidth: 34, fontSize: 11, fontVariant: ["tabular-nums"] },
  messageTime: { fontSize: 10, marginHorizontal: 5 },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 9,
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 9 },
  mediaButton: { width: 38, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 112,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  pendingAttachment: { minHeight: 48, paddingHorizontal: 9, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 },
  pendingImage: { width: 36, height: 36, borderRadius: 7 },
  pendingVoiceIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pendingAttachmentText: { flex: 1, fontSize: 12, fontWeight: "600" },
  removeAttachment: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  recordingLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  expiryNote: { fontSize: 10, lineHeight: 14, marginTop: 6, textAlign: "center" },
  imageViewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)", alignItems: "center", justifyContent: "center" },
  viewerImage: { width: "100%", height: "100%" },
  viewerClose: { position: "absolute", top: 52, right: 18, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  sendError: { fontSize: 12, marginBottom: 6 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  stateText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  retryButton: { minHeight: 46, paddingHorizontal: 20, borderTopLeftRadius: 24, borderBottomRightRadius: 18, alignItems: "center", justifyContent: "center" },
  retryText: { fontSize: 14, fontWeight: "700" },
});
