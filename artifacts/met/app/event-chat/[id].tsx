import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
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
  useSetCommunityEventPlanChatNotifications,
  useSendCommunityEventPlanChatMessage,
} from "@workspace/api-client-react";

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  const setPlanNotifications = useSetCommunityEventPlanChatNotifications();
  const planChat = useQuery({
    ...getGetCommunityEventPlanChatQueryOptions(isValidRoute ? eventId : 0),
    enabled: isValidRoute,
    refetchInterval: 8_000,
  });
  const sendMessage = useSendCommunityEventPlanChatMessage();
  const notificationsMuted = planChat.data?.notificationsMuted ?? false;

  const messages = planChat.data?.messages ?? [];
  const newestFirstMessages = useMemo(() => [...messages].reverse(), [messages]);
  const participants = planChat.data?.participants ?? [];

  const submitMessage = async () => {
    const text = draft.trim();
    if (!text || !isValidRoute || sendMessage.isPending) return;
    setSendError("");
    try {
      await sendMessage.mutateAsync({ eventId, data: { text } });
      setDraft("");
      await queryClient.invalidateQueries({
        queryKey: getGetCommunityEventPlanChatQueryKey(eventId),
      });
    } catch {
      setSendError(t("tabs.events.planChatSendError"));
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
        t("tabs.events.planChat"),
        t("tabs.events.planChatNotificationUpdateError"),
      );
    }
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
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t("tabs.events.planChat")}
            </Text>
            {planChat.data?.event ? (
              <Text
                numberOfLines={1}
                style={[styles.headerSubtitle, { color: colors.mutedForeground }]}
              >
                {planChat.data.event.title}
              </Text>
            ) : null}
          </View>
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
                          {
                            backgroundColor: isMine ? colors.primary : colors.card,
                            borderColor: isMine ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.messageText,
                            { color: isMine ? colors.primaryForeground : colors.text },
                          ]}
                        >
                          {item.text}
                        </Text>
                      </View>
                      <Text style={[styles.messageTime, { color: colors.mutedForeground }]}>
                        {formatMessageTime(item.createdAt)}
                      </Text>
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
              <View style={styles.composerRow}>
                <TextInput
                  accessibilityLabel={t("tabs.events.planChatPlaceholder")}
                  testID="input-plan-chat-message"
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t("tabs.events.planChatPlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={500}
                  multiline
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
                  disabled={!draft.trim() || sendMessage.isPending}
                  onPress={() => void submitMessage()}
                  style={[
                    styles.sendButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: !draft.trim() || sendMessage.isPending ? 0.55 : 1,
                    },
                  ]}
                >
                  {sendMessage.isPending ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="arrow-up" size={19} color={colors.primaryForeground} />
                  )}
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
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
  emptyMessageList: { flexGrow: 1, justifyContent: "center" },
  emptyText: { alignSelf: "center", textAlign: "center", maxWidth: 260, fontSize: 14, lineHeight: 21 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 7 },
  messageRowMine: { justifyContent: "flex-end" },
  messageRowOther: { justifyContent: "flex-start" },
  messageContent: { maxWidth: "82%", gap: 3 },
  messageContentMine: { alignItems: "flex-end" },
  senderName: { fontSize: 11, marginLeft: 4 },
  messageBubble: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  messageText: { fontSize: 14, lineHeight: 19 },
  messageTime: { fontSize: 10, marginHorizontal: 5 },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 9,
  },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 9 },
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
  sendError: { fontSize: 12, marginBottom: 6 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 },
  stateText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  retryButton: { minHeight: 42, paddingHorizontal: 18, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  retryText: { fontSize: 14, fontWeight: "700" },
});
