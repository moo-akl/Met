import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { clearChatHistory } from "@/lib/firestore/chat";
import { getFirestoreModule } from "@/lib/firestore/client";

const PINNED_KEY = "inbox_pinned_v1";
const ARCHIVED_KEY = "inbox_archived_v1";

function toMs(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof (v as { toMillis?: () => number }).toMillis === "function") {
    return (v as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function timeAgo(ts: number): string {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

interface ChatEntry {
  chatId: string;
  peerUid: string;
  peerName: string;
  peerPhoto?: string;
  preview: string;
  sentAt: number;
  isUnread: boolean;
  isFromMe: boolean;
}

async function loadSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function saveSet(key: string, set: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

export default function InboxScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { authedUid, encounters } = useApp();
  const [chats, setChats] = useState<ChatEntry[]>([]);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const webBot = Platform.OS === "web" ? 34 : 0;

  // Load persisted pin/archive state
  useEffect(() => {
    void loadSet(PINNED_KEY).then(setPinned);
    void loadSet(ARCHIVED_KEY).then(setArchived);
  }, []);

  // Subscribe to Firestore chats
  useEffect(() => {
    if (!authedUid) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    const connectedMap = new Map<string, { realName: string; photoUri?: string }>();
    for (const e of encounters) {
      if (e.status === "connected") {
        connectedMap.set(e.id, { realName: e.realName, photoUri: e.photoUri ?? undefined });
      }
    }

    getFirestoreModule().then((fs) => {
      if (cancelled || !fs) return;
      unsub = fs
        .collection("chats")
        .where("participants", "array-contains", authedUid)
        .onSnapshot(
          (snap) => {
            if (cancelled) return;
            const entries: ChatEntry[] = [];
            for (const doc of snap.docs) {
              const d = doc.data() as Record<string, unknown>;
              const chatId = doc.id;
              const parts = chatId.split("_");
              const peerUid = parts.find((p) => p !== authedUid) ?? parts[0];

              const lm = d["lastMessage"] as Record<string, unknown> | undefined;
              if (!lm) continue;

              const sentAt = toMs(lm["sentAt"]);
              const from = typeof lm["from"] === "string" ? lm["from"] : "";
              const rawText = typeof lm["text"] === "string" ? lm["text"] : "";
              const mediaType = lm["mediaType"];

              let preview = rawText;
              if (!rawText && mediaType === "audio") preview = "🎤 Voice message";
              else if (!rawText && mediaType === "image") preview = "📷 Photo";

              const lra = d["lastReadAt"] as Record<string, unknown> | undefined;
              const readAt = toMs(lra?.[authedUid]);
              const cla = d["clearedAt"] as Record<string, unknown> | undefined;
              const clearedAt = toMs(cla?.[authedUid]);
              const isUnread = from !== authedUid && sentAt > readAt && sentAt > clearedAt;

              const peer = connectedMap.get(peerUid);
              entries.push({
                chatId,
                peerUid,
                peerName: peer?.realName ?? "Unknown",
                peerPhoto: peer?.photoUri,
                preview,
                sentAt,
                isUnread,
                isFromMe: from === authedUid,
              });
            }
            entries.sort((a, b) => b.sentAt - a.sentAt);
            setChats(entries);
          },
          () => {
            if (!cancelled) setChats([]);
          },
        );
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [authedUid, encounters]);

  const togglePin = useCallback(
    async (chatId: string) => {
      const next = new Set(pinned);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      setPinned(next);
      await saveSet(PINNED_KEY, next);
    },
    [pinned],
  );

  const toggleArchive = useCallback(
    async (chatId: string) => {
      const nextArchived = new Set(archived);
      if (nextArchived.has(chatId)) {
        nextArchived.delete(chatId);
      } else {
        nextArchived.add(chatId);
        // Unpin if archived
        const nextPinned = new Set(pinned);
        if (nextPinned.has(chatId)) {
          nextPinned.delete(chatId);
          setPinned(nextPinned);
          await saveSet(PINNED_KEY, nextPinned);
        }
      }
      setArchived(nextArchived);
      await saveSet(ARCHIVED_KEY, nextArchived);
    },
    [archived, pinned],
  );

  const handleDelete = useCallback(
    (item: ChatEntry) => {
      Alert.alert(
        "Delete Conversation",
        `Delete your chat history with ${item.peerName}? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              // Remove from local state immediately
              const nextArchived = new Set(archived);
              nextArchived.delete(item.chatId);
              const nextPinned = new Set(pinned);
              nextPinned.delete(item.chatId);
              setArchived(nextArchived);
              setPinned(nextPinned);
              await saveSet(ARCHIVED_KEY, nextArchived);
              await saveSet(PINNED_KEY, nextPinned);
              try {
                await clearChatHistory(authedUid ?? "", item.peerUid);
              } catch {
                // ignore
              }
            },
          },
        ],
      );
    },
    [archived, pinned, authedUid],
  );

  const handleLongPress = useCallback(
    (item: ChatEntry) => {
      const isPinned = pinned.has(item.chatId);
      const isArchived = archived.has(item.chatId);
      Alert.alert(item.peerName, undefined, [
        {
          text: isPinned ? "Unpin" : "Pin",
          onPress: () => void togglePin(item.chatId),
        },
        {
          text: isArchived ? "Unarchive" : "Archive",
          onPress: () => void toggleArchive(item.chatId),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDelete(item),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [pinned, archived, togglePin, toggleArchive, handleDelete],
  );

  const { pinnedChats, activeChats, archivedChats } = useMemo(() => {
    const p: ChatEntry[] = [];
    const a: ChatEntry[] = [];
    const arch: ChatEntry[] = [];
    for (const c of chats) {
      if (pinned.has(c.chatId)) p.push(c);
      else if (archived.has(c.chatId)) arch.push(c);
      else a.push(c);
    }
    return { pinnedChats: p, activeChats: a, archivedChats: arch };
  }, [chats, pinned, archived]);

  const renderRow = useCallback(
    (item: ChatEntry) => (
      <Pressable
        onPress={() => router.push(`/chat/${item.peerUid}`)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={350}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Avatar uri={item.peerPhoto} size={52} ring={item.isUnread} />
        <View style={styles.body}>
          <View style={styles.topLine}>
            <View style={styles.nameRow}>
              {pinned.has(item.chatId) ? (
                <Feather name="bookmark" size={12} color={colors.primary} style={styles.pinIcon} />
              ) : null}
              <Text
                style={[
                  styles.name,
                  {
                    color: colors.foreground,
                    fontFamily: item.isUnread ? "Inter_700Bold" : "Inter_600SemiBold",
                  },
                ]}
                numberOfLines={1}
              >
                {item.peerName}
              </Text>
            </View>
            <Text
              style={[
                styles.timestamp,
                { color: item.isUnread ? "#EF4444" : colors.mutedForeground },
              ]}
            >
              {timeAgo(item.sentAt)}
            </Text>
          </View>
          <View style={styles.previewLine}>
            <Text
              style={[
                styles.preview,
                {
                  color: item.isUnread ? colors.foreground : colors.mutedForeground,
                  fontFamily: item.isUnread ? "Inter_600SemiBold" : "Inter_400Regular",
                },
              ]}
              numberOfLines={1}
            >
              {item.isFromMe ? `You: ${item.preview}` : item.preview}
            </Text>
            {item.isUnread ? <View style={styles.unreadDot} /> : null}
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>
    ),
    [router, handleLongPress, pinned, colors],
  );

  const allEmpty = pinnedChats.length === 0 && activeChats.length === 0 && archivedChats.length === 0;

  type Section = { title: string; data: ChatEntry[]; key: string };
  const sections: Section[] = [];
  if (pinnedChats.length > 0) sections.push({ title: "Pinned", data: pinnedChats, key: "pinned" });
  if (activeChats.length > 0) sections.push({ title: "Messages", data: activeChats, key: "active" });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <AppHeader title="Messages" onBack={() => router.back()} />

      {allEmpty ? (
        <EmptyState
          icon="message-circle"
          title="No messages yet"
          description="Your chats with connections will appear here"
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.chatId}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: insets.bottom + webBot + 100,
            paddingHorizontal: 16,
            flexGrow: 1,
          }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            sections.length > 1 ? (
              <View style={styles.sectionHeader}>
                {section.key === "pinned" ? (
                  <Feather name="bookmark" size={12} color={colors.mutedForeground} />
                ) : null}
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                  {section.title}
                </Text>
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
          renderItem={({ item }) => renderRow(item)}
          ListFooterComponent={
            archivedChats.length > 0 ? (
              <View>
                <Pressable
                  onPress={() => setShowArchived((v) => !v)}
                  style={({ pressed }) => [
                    styles.archivedToggle,
                    { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather
                    name="archive"
                    size={15}
                    color={colors.mutedForeground}
                  />
                  <Text style={[styles.archivedToggleText, { color: colors.mutedForeground }]}>
                    {showArchived
                      ? "Hide archived"
                      : `Archived (${archivedChats.length})`}
                  </Text>
                  <Feather
                    name={showArchived ? "chevron-up" : "chevron-down"}
                    size={15}
                    color={colors.mutedForeground}
                  />
                </Pressable>
                {showArchived
                  ? archivedChats.map((item, i) => (
                      <View key={item.chatId}>
                        {renderRow(item)}
                        {i < archivedChats.length - 1 ? (
                          <View style={[styles.separator, { backgroundColor: colors.border }]} />
                        ) : null}
                      </View>
                    ))
                  : null}
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  body: { flex: 1, gap: 4 },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 4,
  },
  pinIcon: { marginRight: 2 },
  name: { fontSize: 15, flex: 1 },
  timestamp: { fontFamily: "Inter_500Medium", fontSize: 12 },
  previewLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  preview: { fontSize: 13, flex: 1 },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  separator: { height: 1, marginLeft: 66 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  archivedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    marginTop: 8,
  },
  archivedToggleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    flex: 1,
  },
});
