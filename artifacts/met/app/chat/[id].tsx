import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { ReviewModal } from "@/components/ReviewModal";
import type { RecordingOptions } from "expo-av/build/Audio/Recording.types";
import { api } from "@/lib/api/client";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
  clearChatHistory,
  deleteMessage,
  getChatId,
  markChatRead,
  sendMessage,
  subscribeToChatMeta,
  subscribeToMessages,
  toggleReaction,
  uploadChatAudio,
  uploadChatMedia,
} from "@/lib/firestore/chat";

const MAX_CHARS = 500;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// Custom recording preset — same quality as HIGH_QUALITY but with metering
// disabled. The metering timer in expo-av fires on a background thread; if it
// fires after stopAndUnloadAsync() has deallocated the AVAudioRecorder native
// object iOS raises SIGABRT/SIGSEGV, crashing the app. Disabling metering
// eliminates that race condition entirely.
const VOICE_RECORDING_OPTIONS: RecordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  isMeteringEnabled: false,
};

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

function ReplyQuote({
  replyTo,
  isMine,
  peerName,
  myUid,
  myName,
  colors,
}: {
  replyTo: NonNullable<ChatMessage["replyTo"]>;
  isMine: boolean;
  peerName: string;
  myUid: string;
  myName: string;
  colors: ReturnType<typeof useColors>;
}) {
  const quoteText =
    replyTo.mediaType === "image" && !replyTo.text ? "📷 Photo" : replyTo.text;
  return (
    <View
      style={[
        styles.replyQuote,
        {
          borderLeftColor: isMine ? "rgba(255,255,255,0.5)" : colors.primary,
          backgroundColor: isMine
            ? "rgba(0,0,0,0.12)"
            : `${colors.primary}14`,
        },
      ]}
    >
      <Text
        style={[
          styles.replyQuoteAuthor,
          { color: isMine ? "rgba(255,255,255,0.8)" : colors.primary },
        ]}
        numberOfLines={1}
      >
        {replyTo.from === myUid ? myName : peerName}
      </Text>
      <Text
        style={[
          styles.replyQuoteText,
          { color: isMine ? "rgba(255,255,255,0.7)" : colors.mutedForeground },
        ]}
        numberOfLines={2}
      >
        {quoteText}
      </Text>
    </View>
  );
}

function ReactionBadges({
  reactions,
  myUid,
  chatId,
  msgId,
  colors,
}: {
  reactions: Record<string, string[]>;
  myUid: string;
  chatId: string;
  msgId: string;
  colors: ReturnType<typeof useColors>;
}) {
  const entries = Object.entries(reactions).filter(([, uids]) => uids.length > 0);
  if (entries.length === 0) return null;

  return (
    <View style={styles.reactionRow}>
      {entries.map(([emoji, uids]) => {
        const iMine = uids.includes(myUid);
        return (
          <Pressable
            key={emoji}
            onPress={() => void toggleReaction(chatId, msgId, emoji, myUid)}
            style={[
              styles.reactionBadge,
              {
                backgroundColor: iMine
                  ? `${colors.primary}22`
                  : colors.muted,
                borderColor: iMine ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            <Text
              style={[
                styles.reactionCount,
                { color: iMine ? colors.primary : colors.mutedForeground },
              ]}
            >
              {uids.length}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────

function AudioPlayer({
  uri,
  durationMs,
  isMine,
  colors,
}: {
  uri: string;
  durationMs?: number;
  isMine: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [posMs, setPosMs] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const totalMs = durationMs ?? 0;

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) return;
            setPosMs(status.positionMillis ?? 0);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPosMs(0);
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
      // Ignore transient playback errors
    }
  }, [uri, isPlaying]);

  const displayMs = isPlaying ? posMs : posMs > 0 ? posMs : totalMs;
  const seconds = Math.max(0, Math.round(displayMs / 1000));
  const label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const progress = totalMs > 0 ? Math.min(posMs / totalMs, 1) : 0;

  return (
    <View style={styles.audioPlayer}>
      <Pressable
        onPress={toggle}
        style={[
          styles.audioPlayBtn,
          {
            backgroundColor: isMine
              ? "rgba(255,255,255,0.25)"
              : "#00000018",
          },
        ]}
      >
        <Feather
          name={isPlaying ? "pause" : "play"}
          size={15}
          color={isMine ? "#ffffff" : colors.foreground}
        />
      </Pressable>
      <View style={styles.audioTrack}>
        <View
          style={[
            styles.audioTrackFill,
            {
              backgroundColor: isMine ? "#ffffff" : colors.primary,
              width: `${Math.round(progress * 100)}%` as `${number}%`,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.audioDuration,
          { color: isMine ? "rgba(255,255,255,0.8)" : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isMine,
  showAvatar,
  peerPhoto,
  peerName,
  myUid,
  myName,
  chatId,
  colors,
  onImagePress,
  onLongPress,
}: {
  message: ChatMessage;
  isMine: boolean;
  showAvatar: boolean;
  peerPhoto?: string;
  peerName: string;
  myUid: string;
  myName: string;
  chatId: string;
  colors: ReturnType<typeof useColors>;
  onImagePress: (uri: string) => void;
  onLongPress: (message: ChatMessage) => void;
}) {
  const hasMedia = !!message.mediaUri && message.mediaType === "image";
  const hasAudio = !!message.mediaUri && message.mediaType === "audio";
  const hasText = !!message.text;
  const isDeleted = message.deleted === true;

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
        {/* Reply quote block */}
        {!isDeleted && message.replyTo ? (
          <ReplyQuote
            replyTo={message.replyTo}
            isMine={isMine}
            peerName={peerName}
            myUid={myUid}
            myName={myName}
            colors={colors}
          />
        ) : null}

        <Pressable
          onPress={hasMedia && !hasAudio && !isDeleted ? () => onImagePress(message.mediaUri!) : undefined}
          onLongPress={() => onLongPress(message)}
          delayLongPress={300}
          disabled={false}
          style={[
            styles.bubble,
            isMine
              ? [styles.bubbleMine, { backgroundColor: colors.primary }]
              : [styles.bubbleTheirs, { backgroundColor: colors.muted }],
            hasMedia && !hasText && !isDeleted && !hasAudio ? styles.bubbleImageOnly : null,
            isDeleted ? styles.bubbleDeleted : null,
          ]}
        >
          {isDeleted ? (
            <Text
              style={[
                styles.bubbleDeletedText,
                {
                  color: isMine
                    ? "rgba(255,255,255,0.55)"
                    : colors.mutedForeground,
                },
              ]}
            >
              🗑 Message deleted
            </Text>
          ) : (
            <>
              {hasAudio && !isDeleted ? (
                <AudioPlayer
                  uri={message.mediaUri!}
                  durationMs={message.audioDurationMs}
                  isMine={isMine}
                  colors={colors}
                />
              ) : null}
              {hasMedia && !hasAudio ? (
                <Image
                  source={{ uri: message.mediaUri }}
                  style={styles.bubbleImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : null}
              {hasText ? (
                <Text
                  style={[
                    styles.bubbleText,
                    { color: isMine ? "#ffffff" : colors.foreground },
                    hasMedia && !hasAudio ? styles.bubbleCaption : null,
                  ]}
                >
                  {message.text}
                </Text>
              ) : null}
            </>
          )}
        </Pressable>

        {/* Reaction badges */}
        {message.reactions && !isDeleted ? (
          <ReactionBadges
            reactions={message.reactions}
            myUid={myUid}
            chatId={chatId}
            msgId={message.id}
            colors={colors}
          />
        ) : null}

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

// ─── Action menu (long-press) ─────────────────────────────────────────────────

function MessageActionMenu({
  visible,
  message,
  isMine,
  myUid,
  chatId,
  colors,
  peerName,
  onClose,
  onReply,
  onDeleteDone,
}: {
  visible: boolean;
  message: ChatMessage | null;
  isMine: boolean;
  myUid: string;
  chatId: string;
  colors: ReturnType<typeof useColors>;
  peerName: string;
  onClose: () => void;
  onReply: (msg: ChatMessage) => void;
  onDeleteDone: () => void;
}) {
  const { t } = useT();
  const [deletingMsg, setDeletingMsg] = useState(false);

  if (!message) return null;

  const handleReact = async (emoji: string) => {
    onClose();
    await toggleReaction(chatId, message.id, emoji, myUid);
  };

  const handleReply = () => {
    onClose();
    onReply(message);
  };

  const handleDelete = () => {
    Alert.alert(
      t("chat.deleteMessageTitle"),
      t("chat.deleteMessageConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chat.deleteAction"),
          style: "destructive",
          onPress: async () => {
            setDeletingMsg(true);
            try {
              await deleteMessage(chatId, message.id);
              onDeleteDone();
            } catch {
              // silently ignore
            } finally {
              setDeletingMsg(false);
              onClose();
            }
          },
        },
      ],
    );
  };

  const isDeleted = message.deleted === true;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.menuOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.menuSheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Reaction row */}
          {!isDeleted ? (
            <View style={styles.menuReactionRow}>
              {REACTION_EMOJIS.map((emoji) => {
                const alreadyReacted =
                  message.reactions?.[emoji]?.includes(myUid) ?? false;
                return (
                  <Pressable
                    key={emoji}
                    onPress={() => void handleReact(emoji)}
                    style={[
                      styles.menuReactionBtn,
                      alreadyReacted && {
                        backgroundColor: `${colors.primary}20`,
                        borderRadius: 20,
                      },
                    ]}
                  >
                    <Text style={styles.menuReactionEmoji}>{emoji}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Divider */}
          {!isDeleted ? (
            <View
              style={[styles.menuDivider, { backgroundColor: colors.border }]}
            />
          ) : null}

          {/* Reply */}
          {!isDeleted ? (
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { opacity: 0.6 },
              ]}
              onPress={handleReply}
            >
              <Feather name="corner-up-left" size={18} color={colors.foreground} />
              <Text style={[styles.menuItemText, { color: colors.foreground }]}>
                {t("chat.replyAction")}
              </Text>
            </Pressable>
          ) : null}

          {/* Delete — only own non-deleted messages */}
          {isMine && !isDeleted ? (
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                pressed && { opacity: 0.6 },
              ]}
              onPress={handleDelete}
              disabled={deletingMsg}
            >
              <Feather name="trash-2" size={18} color="#ef4444" />
              <Text style={[styles.menuItemText, { color: "#ef4444" }]}>
                {deletingMsg ? "Deleting…" : t("chat.deleteAction")}
              </Text>
            </Pressable>
          ) : null}

          {/* Cancel */}
          <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.6 },
            ]}
            onPress={onClose}
          >
            <Text
              style={[
                styles.menuItemText,
                styles.menuCancelText,
                { color: colors.mutedForeground },
              ]}
            >
              {t("common.cancel")}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { allEncounters, authedUid, profile } = useApp();
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<{
    messageCount: number;
    hasMetInRealLife: boolean;
  } | null>(null);

  const params = useLocalSearchParams<{ id: string | string[] }>();
  const peerUid = Array.isArray(params.id) ? params.id[0] : params.id;

  const myUid = authedUid ?? "";
  const myName = profile?.name ?? "You";

  const encounter = useMemo(
    () => allEncounters.find((e) => e.id === peerUid),
    [allEncounters, peerUid],
  );
  const peerName = encounter?.realName ?? t("chat.unknownUser");
  const peerPhoto = encounter?.photoUri;

  const chatId = useMemo(
    () => (myUid && peerUid ? getChatId(myUid, peerUid) : ""),
    [myUid, peerUid],
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meta, setMeta] = useState<ChatMeta | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // Long-press action menu state
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  // Voice message state
  const [pendingAudio, setPendingAudio] = useState<string | null>(null);
  const [pendingAudioMs, setPendingAudioMs] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up any active recording when the screen unmounts (e.g. user navigates
  // away mid-recording). Without this the iOS AVAudioSession stays locked in
  // PlayAndRecord mode and the next createAsync call crashes or returns an error.
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      const stale = recordingRef.current;
      if (stale) {
        recordingRef.current = null;
        stale.stopAndUnloadAsync().catch(() => {});
      }
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
    };
  }, []);

  const listRef = useRef<FlatList<ListItem>>(null);

  const isLoading = meta === undefined;
  const isMyTurn =
    meta === undefined ||
    meta === null ||
    meta.nextSenderUid === null ||
    meta.nextSenderUid === myUid;
  const canSend =
    isMyTurn &&
    (text.trim().length > 0 || pendingMedia !== null || pendingAudio !== null) &&
    !sending &&
    !isRecording;
  const charsLeft = MAX_CHARS - text.length;

  const todayLabel = t("chat.today");
  const yesterdayLabel = t("chat.yesterday");

  // Filter out messages cleared by this user
  const visibleMessages = useMemo(() => {
    const clearedAt = meta?.clearedAt?.[myUid] ?? 0;
    return clearedAt > 0 ? messages.filter((m) => m.sentAt > clearedAt) : messages;
  }, [messages, meta, myUid]);

  const listItems = useMemo((): ListItem[] => {
    const items: ListItem[] = [];
    let lastDay = "";
    for (const msg of visibleMessages) {
      const dayLabel = getDayLabel(msg.sentAt, todayLabel, yesterdayLabel);
      if (dayLabel !== lastDay) {
        items.push({ type: "date", label: dayLabel, key: `date-${dayLabel}` });
        lastDay = dayLabel;
      }
      items.push({ type: "message", message: msg });
    }
    return items;
  }, [visibleMessages, todayLabel, yesterdayLabel]);

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
    if (!myUid || !peerUid || visibleMessages.length === 0) return;
    void markChatRead(myUid, peerUid);
  }, [myUid, peerUid, visibleMessages.length]);

  // Fetch quality-threshold data when entering the chat so the Rate button
  // can check the 10-message or "met in real life" gate immediately.
  useEffect(() => {
    if (!myUid || !peerUid) return;
    api
      .getConnectionQuality({ uid: myUid }, peerUid)
      .then((q) => setConnectionQuality(q))
      .catch(() => {});
  }, [myUid, peerUid]);

  const handlePickImage = useCallback(async () => {
    if (!isMyTurn || sending) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
      let byteSize = asset.fileSize;
      if (byteSize == null) {
        const FileSystem = await import("expo-file-system/legacy");
        const info = await FileSystem.getInfoAsync(asset.uri);
        byteSize = info.exists && "size" in info ? (info.size as number) : 0;
      }
      if (byteSize > MAX_BYTES) {
        Alert.alert("Image too large", "Please choose an image under 5 MB.");
        return;
      }
      setPendingMedia(asset.uri);
      setSendError(null);
    }
  }, [isMyTurn, sending]);

  const handleToggleRecording = useCallback(async () => {
    if (!isMyTurn || sending) return;
    if (isRecording) {
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      try {
        const rec = recordingRef.current;
        if (!rec) return;
        recordingRef.current = null;
        const status = await rec.stopAndUnloadAsync();
        const uri = rec.getURI();
        if (uri) {
          setPendingAudio(uri);
          setPendingAudioMs((status as { durationMillis?: number }).durationMillis ?? recordSecs * 1000);
          setSendError(null);
        }
      } catch {
        // ignore transient recording errors
      } finally {
        // Always reset audio mode after stopping so playback works normally
        // and the AVAudioSession isn't left in PlayAndRecord for the next attempt.
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        }).catch(() => {});
      }
      setRecordSecs(0);
    } else {
      setPendingAudio(null);

      // Defensive: unload any stale recording object that was never cleaned up
      // (e.g. a previous attempt that errored out mid-way).
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }

      try {
        // Request mic permission first — on iOS we must have a decision before
        // activating the AVAudioSession in PlayAndRecord mode. Trying to activate
        // the session before the permission is resolved can raise an uncaught
        // AVAudioSession exception on certain iOS versions.
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert(
            "Microphone access needed",
            "Please allow microphone access in Settings to send voice messages.",
          );
          return;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });
        const { recording } = await Audio.Recording.createAsync(
          VOICE_RECORDING_OPTIONS,
        );
        recordingRef.current = recording;
        setIsRecording(true);
        setRecordSecs(0);
        recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);
      } catch (err) {
        console.warn("[recording] start failed:", err);
        Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
        Alert.alert("Error", "Could not start recording. Please try again.");
      }
    }
  }, [isMyTurn, sending, isRecording, recordSecs]);

  const handleSend = useCallback(async () => {
    if (!canSend || !myUid || !peerUid) return;
    const trimmed = text.trim();
    if (!trimmed && !pendingMedia && !pendingAudio) return;

    setSending(true);
    setSendError(null);

    const capturedMedia = pendingMedia;
    const capturedAudio = pendingAudio;
    const capturedAudioMs = pendingAudioMs;
    const capturedReplyTo = replyingTo;
    setText("");
    setPendingMedia(null);
    setPendingAudio(null);
    setPendingAudioMs(0);
    setReplyingTo(null);

    let mediaUrl: string | undefined;
    if (capturedMedia) {
      try {
        mediaUrl = await uploadChatMedia(myUid, peerUid, capturedMedia);
      } catch {
        setSendError(t("chat.sendFailed"));
        if (trimmed) setText(trimmed);
        setPendingMedia(capturedMedia);
        setReplyingTo(capturedReplyTo);
        setSending(false);
        return;
      }
    } else if (capturedAudio) {
      try {
        mediaUrl = await uploadChatAudio(myUid, peerUid, capturedAudio);
      } catch {
        setSendError(t("chat.sendFailed"));
        if (trimmed) setText(trimmed);
        setPendingAudio(capturedAudio);
        setPendingAudioMs(capturedAudioMs);
        setReplyingTo(capturedReplyTo);
        setSending(false);
        return;
      }
    }

    const replyToPayload = capturedReplyTo
      ? {
          id: capturedReplyTo.id,
          from: capturedReplyTo.from,
          text: capturedReplyTo.text,
          ...(capturedReplyTo.mediaType ? { mediaType: capturedReplyTo.mediaType } : {}),
        }
      : undefined;

    const err = await sendMessage(myUid, peerUid, trimmed, {
      mediaUri: capturedAudio ? undefined : mediaUrl,
      audioUri: capturedAudio ? mediaUrl : undefined,
      audioDurationMs: capturedAudio ? capturedAudioMs : undefined,
      replyTo: replyToPayload,
    });
    if (err !== null) {
      setSendError(t("chat.sendFailed"));
      if (trimmed) setText(trimmed);
      if (capturedMedia && !mediaUrl) setPendingMedia(capturedMedia);
      if (capturedAudio && !mediaUrl) {
        setPendingAudio(capturedAudio);
        setPendingAudioMs(capturedAudioMs);
      }
      if (capturedReplyTo) setReplyingTo(capturedReplyTo);
    }
    setSending(false);
  }, [canSend, myUid, peerUid, text, pendingMedia, pendingAudio, pendingAudioMs, replyingTo, t]);

  // AsyncStorage key for the 14-day frequency cap per connection.
  const reviewPromptKey = `@met/review_prompt_${peerUid ?? "unknown"}_last_date`;

  const handleRateConnection = useCallback(async () => {
    const threshold =
      (connectionQuality?.messageCount ?? 0) >= 10 ||
      connectionQuality?.hasMetInRealLife === true;

    if (!threshold) {
      Alert.alert(
        "Keep chatting! 💬",
        "The more you connect, the more accurate your rating will be. You can rate after 10 messages or once you've met in person.",
        [{ text: "Got it" }],
      );
      return;
    }

    // 14-day frequency cap
    const raw = await AsyncStorage.getItem(reviewPromptKey).catch(() => null);
    if (raw) {
      const daysSince = (Date.now() - Number(raw)) / (1000 * 60 * 60 * 24);
      if (daysSince < 14) {
        Alert.alert(
          "Already rated recently",
          "You can rate this connection again in a few weeks.",
          [{ text: "OK" }],
        );
        return;
      }
    }

    setShowReviewModal(true);
  }, [connectionQuality, reviewPromptKey]);

  const handleClearHistory = useCallback(() => {
    Alert.alert(
      t("chat.clearHistoryTitle"),
      t("chat.clearHistoryConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chat.clearHistoryAction"),
          style: "destructive",
          onPress: async () => {
            try {
              await clearChatHistory(myUid, peerUid);
            } catch {
              // silently ignore
            }
          },
        },
      ],
    );
  }, [myUid, peerUid, t]);

  const handleDeleteConversation = useCallback(() => {
    Alert.alert(
      t("chat.deleteConversationTitle"),
      t("chat.deleteConversationConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("chat.deleteConversationAction"),
          style: "destructive",
          onPress: async () => {
            try {
              await clearChatHistory(myUid, peerUid);
            } catch {
              // silently ignore
            }
            router.back();
          },
        },
      ],
    );
  }, [myUid, peerUid, router, t]);

  const handleChatOptions = useCallback(() => {
    Alert.alert(
      t("chat.options"),
      undefined,
      [
        {
          text: "We met in real life! 🤝",
          onPress: () => {
            if (!myUid || !peerUid) return;
            api.markAsMet({ uid: myUid }, peerUid).then(() => {
              setConnectionQuality((q) =>
                q ? { ...q, hasMetInRealLife: true } : q,
              );
              Alert.alert("Marked as met! ✅", "Your connection is now verified as a real-life meeting.");
            }).catch(() => {});
          },
        },
        {
          text: t("chat.clearHistoryAction"),
          style: "destructive",
          onPress: handleClearHistory,
        },
        {
          text: t("chat.deleteConversationAction"),
          style: "destructive",
          onPress: handleDeleteConversation,
        },
        { text: t("common.cancel"), style: "cancel" },
      ],
    );
  }, [handleClearHistory, handleDeleteConversation, myUid, peerUid, t]);

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
          peerName={peerName}
          myUid={myUid}
          myName={myName}
          chatId={chatId}
          colors={colors}
          onImagePress={setViewerUri}
          onLongPress={setActionMessage}
        />
      );
    },
    [myUid, myName, listItems, peerPhoto, peerName, chatId, colors],
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

        {/* Rate Connection button — subtle star icon in the header */}
        <Pressable
          onPress={handleRateConnection}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityLabel="Rate connection"
        >
          <Feather
            name="star"
            size={20}
            color={
              (connectionQuality?.messageCount ?? 0) >= 10 ||
              connectionQuality?.hasMetInRealLife
                ? "#FFB800"
                : colors.mutedForeground
            }
          />
        </Pressable>

        {/* Chat options button */}
        <Pressable
          onPress={handleChatOptions}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityLabel={t("chat.options")}
        >
          <Feather name="more-vertical" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
        {sendError !== null ? (
          <Text style={[styles.errorText, { color: "#ef4444" }]}>
            {sendError}
          </Text>
        ) : null}

        {/* ── Reply preview strip ── */}
        {replyingTo !== null ? (
          <View
            style={[
              styles.replyPreviewBar,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
                borderLeftColor: colors.primary,
              },
            ]}
          >
            <View style={styles.replyPreviewContent}>
              <Text
                style={[styles.replyPreviewLabel, { color: colors.primary }]}
              >
                {t("chat.replyingTo")}{" "}
                {replyingTo.from === myUid ? myName : peerName}
              </Text>
              <Text
                style={[
                  styles.replyPreviewText,
                  { color: colors.mutedForeground },
                ]}
                numberOfLines={1}
              >
                {replyingTo.mediaType === "image" && !replyingTo.text
                  ? "📷 Photo"
                  : replyingTo.mediaType === "audio" && !replyingTo.text
                    ? "🎤 Voice message"
                    : replyingTo.text}
              </Text>
            </View>
            <Pressable
              onPress={() => setReplyingTo(null)}
              hitSlop={10}
              style={[styles.replyPreviewClose, { backgroundColor: colors.muted }]}
              accessibilityLabel={t("chat.cancelReply")}
            >
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        {/* ── Recording indicator ── */}
        {isRecording ? (
          <View
            style={[
              styles.mediaPreviewBar,
              { backgroundColor: colors.card, borderTopColor: colors.border },
            ]}
          >
            <View style={styles.recordingRow}>
              <View style={[styles.recordingDot, { backgroundColor: "#ef4444" }]} />
              <Text style={[styles.recordingTimer, { color: colors.foreground }]}>
                {`${Math.floor(recordSecs / 60)}:${String(recordSecs % 60).padStart(2, "0")}`}
              </Text>
            </View>
            <Text style={[{ fontFamily: "Inter_400Regular", fontSize: 13 }, { color: colors.mutedForeground }]}>
              Tap ■ to finish
            </Text>
          </View>
        ) : null}

        {/* ── Pending audio preview ── */}
        {pendingAudio !== null && !isRecording ? (
          <View
            style={[
              styles.mediaPreviewBar,
              { backgroundColor: colors.card, borderTopColor: colors.border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <AudioPlayer
                uri={pendingAudio}
                durationMs={pendingAudioMs}
                isMine={false}
                colors={colors}
              />
            </View>
            <Pressable
              onPress={() => { setPendingAudio(null); setPendingAudioMs(0); }}
              style={[styles.mediaRemoveBtn, { backgroundColor: colors.muted }]}
              hitSlop={8}
            >
              <Feather name="x" size={14} color={colors.foreground} />
            </Pressable>
          </View>
        ) : null}

        {/* ── Pending media preview strip ── */}
        {pendingMedia !== null ? (
          <View
            style={[
              styles.mediaPreviewBar,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
              },
            ]}
          >
            <Pressable
              onPress={() => setViewerUri(pendingMedia)}
              style={styles.mediaThumbWrap}
              accessibilityLabel={t("chat.photo")}
            >
              <Image
                source={{ uri: pendingMedia }}
                style={styles.mediaThumb}
                contentFit="cover"
              />
            </Pressable>
            <Pressable
              onPress={() => setPendingMedia(null)}
              style={[styles.mediaRemoveBtn, { backgroundColor: colors.muted }]}
              accessibilityLabel={t("chat.removePhoto")}
              hitSlop={8}
            >
              <Feather name="x" size={14} color={colors.foreground} />
            </Pressable>
          </View>
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
          {/* Photo attach button */}
          <Pressable
            onPress={handlePickImage}
            disabled={!isMyTurn || sending}
            style={({ pressed }) => [
              styles.photoBtn,
              {
                opacity: !isMyTurn || sending ? 0.35 : pressed ? 0.6 : 1,
              },
            ]}
            accessibilityLabel={t("chat.attachPhoto")}
          >
            <Feather name="image" size={22} color={colors.mutedForeground} />
          </Pressable>

          {/* Voice message button */}
          <Pressable
            onPress={handleToggleRecording}
            disabled={!isMyTurn || sending}
            style={({ pressed }) => [
              styles.photoBtn,
              {
                backgroundColor: isRecording ? "#ef4444" : "transparent",
                borderRadius: 22,
                opacity: !isMyTurn || sending ? 0.35 : pressed ? 0.6 : 1,
              },
            ]}
            accessibilityLabel={isRecording ? "Stop recording" : "Record voice message"}
          >
            <Feather
              name={isRecording ? "square" : "mic"}
              size={22}
              color={isRecording ? "#ffffff" : colors.mutedForeground}
            />
          </Pressable>

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
                setSendError(null);
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

      {/* ── Fullscreen image viewer ── */}
      <Modal
        visible={viewerUri !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
        statusBarTranslucent
      >
        <Pressable
          style={styles.viewerOverlay}
          onPress={() => setViewerUri(null)}
        >
          <Image
            source={{ uri: viewerUri ?? "" }}
            style={styles.viewerImage}
            contentFit="contain"
            cachePolicy="memory-disk"
          />
        </Pressable>
      </Modal>

      {/* ── Long-press action menu ── */}
      <MessageActionMenu
        visible={actionMessage !== null}
        message={actionMessage}
        isMine={actionMessage?.from === myUid}
        myUid={myUid}
        chatId={chatId}
        colors={colors}
        peerName={peerName}
        onClose={() => setActionMessage(null)}
        onReply={(msg) => {
          setActionMessage(null);
          setReplyingTo(msg);
        }}
        onDeleteDone={() => setActionMessage(null)}
      />

      {/* ── Vibe review (triggered via Rate Connection button) ── */}
      <ReviewModal
        visible={showReviewModal}
        receiverUid={peerUid ?? ""}
        receiverName={peerName}
        onDone={() => {
          setShowReviewModal(false);
          // Record timestamp for 14-day frequency cap.
          AsyncStorage.setItem(reviewPromptKey, String(Date.now())).catch(
            () => {},
          );
        }}
      />
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
  bubbleDeleted: { opacity: 0.7 },
  bubbleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleDeletedText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  bubbleTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    marginHorizontal: 4,
    marginBottom: 2,
  },

  // Reply quote inside bubble
  replyQuote: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    paddingRight: 4,
    marginBottom: 6,
    borderRadius: 4,
  },
  replyQuoteAuthor: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    marginBottom: 2,
  },
  replyQuoteText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },

  // Reaction badges below bubble
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
    marginBottom: 2,
  },
  reactionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontFamily: "Inter_500Medium", fontSize: 11 },

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

  // Reply preview strip (above input bar)
  replyPreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    gap: 8,
  },
  replyPreviewContent: { flex: 1 },
  replyPreviewLabel: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginBottom: 1 },
  replyPreviewText: { fontFamily: "Inter_400Regular", fontSize: 12 },
  replyPreviewClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
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

  // Photo button (left of text input)
  photoBtn: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  // Pending media preview strip (above input bar)
  mediaPreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  mediaThumbWrap: {
    borderRadius: 10,
    overflow: "hidden",
  },
  mediaThumb: {
    width: 64,
    height: 64,
  },
  mediaRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  // Message bubble image support
  bubbleImageOnly: {
    padding: 0,
    overflow: "hidden",
  },
  bubbleImage: {
    width: 210,
    height: 210,
    borderRadius: 15,
  },
  bubbleCaption: {
    paddingTop: 6,
  },

  // Fullscreen image viewer
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "80%",
  },

  // Long-press action menu
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
    overflow: "hidden",
  },
  menuReactionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  menuReactionBtn: {
    padding: 6,
  },
  menuReactionEmoji: { fontSize: 28 },
  menuDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 0 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  menuItemText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  },
  menuCancelText: {
    textAlign: "center",
    flex: 1,
  },

  // Audio player in message bubble
  audioPlayer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 160,
    paddingVertical: 2,
  },
  audioPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  audioTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.3)",
    overflow: "hidden",
  },
  audioTrackFill: {
    height: "100%",
    borderRadius: 2,
  },
  audioDuration: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    minWidth: 32,
    textAlign: "right",
  },

  // Recording indicator
  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recordingTimer: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
