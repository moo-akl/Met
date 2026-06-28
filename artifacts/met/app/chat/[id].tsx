import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  type ChatMessage,
  type ChatMeta,
  markChatRead,
  sendMessage,
  subscribeToChatMeta,
  subscribeToMessages,
} from "@/lib/firestore/chat";

const MAX_CHARS = 500;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(epochMs: number): string {
  const now = Date.now();
  const diff = now - epochMs;
  if (diff < 60_000) return "Just now";
  const date = new Date(epochMs);
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return (
    date.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " · " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function getDayLabel(
  epochMs: number,
  todayLabel: string,
  yesterdayLabel: string,
): string {
  const date = new Date(epochMs);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return todayLabel;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

type ListItem =
  | { type: "date"; label: string; key: string }
  | { type: "message"; message: ChatMessage };

// ─── Sub-components ───────────────────────────────────────────────────────────

function DatePill({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.datePillWrap}>
      <View style={[styles.datePill, { backgroundColor: colors.muted }]}>
        <Text style={[styles.datePillText, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function MessageBubble({
  message,
  isMine,
  showAvatar,
  peerPhoto,
  colors,
}: {
  message: ChatMessage;
  isMine: boolean;
  showAvatar: boolean;
  peerPhoto?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.bubbleRow,
        isMine ? styles.bubbleRowRight : styles.bubbleRowLeft,
      ]}
    >
      {!isMine && (
        <View style={styles.avatarSlot}>
          {showAvatar ? <Avatar uri={peerPhoto} size={28} /> : null}
        </View>
      )}
      <View
        style={[
          styles.bubbleContent,
          isMine ? styles.bubbleContentRight : styles.bubbleContentLeft,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMine
              ? [styles.bubbleMine, { backgroundColor: colors.primary }]
              : [styles.bubbleTheirs, { backgroundColor: colors.muted }],
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isMine ? "#ffffff" : colors.foreground },
            ]}
          >
            {message.text}
          </Text>
        </View>
        <Text
          style={[
            styles.bubbleTime,
            { color: colors.mutedForeground },
            isMine ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
          ]}
        >
          {formatTime(message.sentAt)}
        </Text>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { allEncounters, profile } = useApp();

  const params = useLocalSearchParams<{ id: string | string[] }>();
  const peerUid = Array.isArray(params.id) ? params.id[0] : params.id;

  const myUid = profile?.id ?? "";
  const encounter = useMemo(
    () => allEncounters.find((e) => e.id === peerUid),
    [allEncounters, peerUid],
  );
  const peerName = encounter?.realName ?? t("chat.unknownUser");
  const peerPhoto = encounter?.photoUri;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // undefined = still loading; null = doc doesn't exist yet
  const [meta, setMeta] = useState<ChatMeta | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);

  const listRef = useRef<FlatList<ListItem>>(null);

  const isLoading = meta === undefined;
  const isMyTurn =
    meta === undefined ||
    meta === null ||
    meta.nextSenderUid === null ||
    meta.nextSenderUid === myUid;
  const canSend = isMyTurn && text.trim().length > 0 && !sending;
  const charsLeft = MAX_CHARS - text.length;

  const todayLabel = t("chat.today");
  const yesterdayLabel = t("chat.yesterday");

  const listItems = useMemo((): ListItem[] => {
    const items: ListItem[] = [];
    let lastDay = "";
    for (const msg of messages) {
      const dayLabel = getDayLabel(msg.sentAt, todayLabel, yesterdayLabel);
      if (dayLabel !== lastDay) {
        items.push({ type: "date", label: dayLabel, key: `date-${dayLabel}` });
        lastDay = dayLabel;
      }
      items.push({ type: "message", message: msg });
    }
    return items;
  }, [messages, todayLabel, yesterdayLabel]);

  // Subscribe to chat meta (turn state + last message)
  useEffect(() => {
    if (!myUid || !peerUid) return;
    let cancelled = false;
    let unsubFn: (() => void) | null = null;
    void subscribeToChatMeta(myUid, peerUid, (m) => {
      if (!cancelled) setMeta(m);
    }).then((unsub) => {
      if (cancelled) unsub();
      else unsubFn = unsub;
    });
    return () => {
      cancelled = true;
      if (unsubFn) unsubFn();
    };
  }, [myUid, peerUid]);

  // Subscribe to messages
  useEffect(() => {
    if (!myUid || !peerUid) return;
    let cancelled = false;
    let unsubFn: (() => void) | null = null;
    void subscribeToMessages(myUid, peerUid, (msgs) => {
      if (!cancelled) setMessages(msgs);
    }).then((unsub) => {
      if (cancelled) unsub();
      else unsubFn = unsub;
    });
    return () => {
      cancelled = true;
      if (unsubFn) unsubFn();
    };
  }, [myUid, peerUid]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (listItems.length === 0) return;
    const t2 = setTimeout(
      () => listRef.current?.scrollToEnd({ animated: true }),
      80,
    );
    return () => clearTimeout(t2);
  }, [listItems.length]);

  // Mark read when messages arrive
  useEffect(() => {
    if (!myUid || !peerUid || messages.length === 0) return;
    void markChatRead(myUid, peerUid);
  }, [myUid, peerUid, messages.length]);

  const handleSend = useCallback(async () => {
    if (!canSend || !myUid || !peerUid) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setSendError(false);
    setText("");
    const ok = await sendMessage(myUid, peerUid, trimmed);
    if (!ok) {
      setSendError(true);
      setText(trimmed);
    }
    setSending(false);
  }, [canSend, myUid, peerUid, text]);

  const renderItem = useCallback(
    ({ item, index }: { item: ListItem; index: number }) => {
      if (item.type === "date") {
        return <DatePill label={item.label} colors={colors} />;
      }
      const msg = item.message;
      const isMine = msg.from === myUid;
      const prevItem = listItems[index - 1];
      const prevMsg =
        prevItem?.type === "message" ? prevItem.message : undefined;
      const showAvatar = !isMine && (!prevMsg || prevMsg.from !== msg.from);
      return (
        <MessageBubble
          message={msg}
          isMine={isMine}
          showAvatar={showAvatar}
          peerPhoto={peerPhoto}
          colors={colors}
        />
      );
    },
    [myUid, listItems, peerPhoto, colors],
  );

  if (!encounter) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 24,
          },
        ]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable onPress={() => router.back()} style={styles.backFallback}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.goneText, { color: colors.foreground }]}>
          {t("connection.gone")}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) + 10,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityLabel={t("common.back")}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <Pressable
          onPress={() => router.push(`/connection/${peerUid}`)}
          style={styles.headerCenter}
          hitSlop={4}
        >
          <Avatar uri={peerPhoto} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.headerName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {peerName}
            </Text>
            <Text
              style={[
                styles.headerSub,
                {
                  color: isMyTurn ? colors.primary : colors.mutedForeground,
                },
              ]}
              numberOfLines={1}
            >
              {isLoading
                ? "…"
                : isMyTurn
                  ? t("chat.yourTurnShort")
                  : t("chat.theirTurnShort", { name: peerName })}
            </Text>
          </View>
        </Pressable>

        {/* Spacer to keep center balanced */}
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ── Content area ── */}
        {isLoading ? (
          <View style={styles.centered}>
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              {t("common.loading")}
            </Text>
          </View>
        ) : listItems.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View
              style={[
                styles.emptyIconWrap,
                { backgroundColor: `${colors.primary}18` },
              ]}
            >
              <Feather name="message-circle" size={34} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {t("chat.emptyTitle")}
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              {isMyTurn
                ? t("chat.emptySubYourTurn", { name: peerName })
                : t("chat.emptySubTheirTurn", { name: peerName })}
            </Text>
            <View
              style={[
                styles.hintPill,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            >
              <Feather name="refresh-cw" size={12} color={colors.mutedForeground} />
              <Text
                style={[styles.hintText, { color: colors.mutedForeground }]}
              >
                {t("chat.pingPongHint")}
              </Text>
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={listItems}
            keyExtractor={(item) =>
              item.type === "date" ? item.key : item.message.id
            }
            renderItem={renderItem}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        {/* ── Turn banner ── */}
        <View
          style={[
            styles.turnBanner,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.turnPill,
              {
                backgroundColor: isMyTurn
                  ? `${colors.primary}15`
                  : colors.muted,
              },
            ]}
          >
            <View
              style={[
                styles.turnDot,
                {
                  backgroundColor: isMyTurn
                    ? colors.primary
                    : colors.mutedForeground,
                },
              ]}
            />
            <Text
              style={[
                styles.turnText,
                {
                  color: isMyTurn
                    ? colors.primary
                    : colors.mutedForeground,
                },
              ]}
            >
              {isMyTurn
                ? t("chat.yourTurn")
                : t("chat.waitingFor", { name: peerName })}
            </Text>
          </View>
        </View>

        {/* ── Send error ── */}
        {sendError ? (
          <Text style={[styles.errorText, { color: "#ef4444" }]}>
            {t("chat.sendFailed")}
          </Text>
        ) : null}

        {/* ── Input bar ── */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 20 : 4),
            },
          ]}
        >
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                opacity: isMyTurn ? 1 : 0.5,
              },
            ]}
          >
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v.slice(0, MAX_CHARS));
                setSendError(false);
              }}
              placeholder={
                isMyTurn
                  ? t("chat.inputPlaceholder")
                  : t("chat.inputPlaceholderLocked", { name: peerName })
              }
              placeholderTextColor={colors.mutedForeground}
              editable={isMyTurn && !sending}
              multiline
              style={[styles.textInput, { color: colors.foreground }]}
              returnKeyType="default"
              blurOnSubmit={false}
            />
            {text.length > 400 ? (
              <Text
                style={[
                  styles.charCount,
                  {
                    color:
                      charsLeft <= 0 ? "#ef4444" : colors.mutedForeground,
                  },
                ]}
              >
                {charsLeft}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: canSend ? colors.primary : colors.muted,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            accessibilityLabel={t("common.send")}
          >
            <Feather
              name={sending ? "loader" : "send"}
              size={18}
              color={canSend ? "#ffffff" : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },

  backFallback: { padding: 16 },
  goneText: { fontFamily: "Inter_400Regular", fontSize: 15, padding: 24 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  headerName: { fontFamily: "Inter_700Bold", fontSize: 16 },
  headerSub: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 1 },

  // Loading / centered
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontFamily: "Inter_400Regular", fontSize: 15 },

  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 19,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  hintText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    fontStyle: "italic",
  },

  // Message list
  messageList: { paddingVertical: 14, paddingHorizontal: 12, gap: 2 },

  // Date separator
  datePillWrap: { alignItems: "center", marginVertical: 10 },
  datePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  datePillText: { fontFamily: "Inter_500Medium", fontSize: 11 },

  // Message bubbles
  bubbleRow: { flexDirection: "row", marginVertical: 2 },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubbleRowLeft: { justifyContent: "flex-start" },
  avatarSlot: {
    width: 36,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bubbleContent: { maxWidth: "78%" },
  bubbleContentRight: { alignItems: "flex-end" },
  bubbleContentLeft: { alignItems: "flex-start", marginLeft: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, marginBottom: 3 },
  bubbleMine: { borderRadius: 20, borderBottomRightRadius: 5 },
  bubbleTheirs: { borderRadius: 20, borderBottomLeftRadius: 5 },
  bubbleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    marginHorizontal: 4,
    marginBottom: 2,
  },

  // Turn banner
  turnBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-start",
  },
  turnPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  turnDot: { width: 7, height: 7, borderRadius: 4 },
  turnText: { fontFamily: "Inter_500Medium", fontSize: 13 },

  // Error
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    maxHeight: 120,
  },
  textInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    padding: 0,
    maxHeight: 100,
  },
  charCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    alignSelf: "flex-end",
    marginLeft: 6,
    marginBottom: 1,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
