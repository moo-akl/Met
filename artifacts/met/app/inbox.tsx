import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
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
import { getFirestoreModule } from "@/lib/firestore/client";

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

export default function InboxScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { authedUid, encounters } = useApp();
  const [chats, setChats] = useState<ChatEntry[]>([]);
  const webBot = Platform.OS === "web" ? 34 : 0;

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
          () => { if (!cancelled) setChats([]); },
        );
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [authedUid, encounters]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Messages" />
      <FlatList
        data={chats}
        keyExtractor={(item) => item.chatId}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + webBot + 100,
          paddingHorizontal: 16,
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => (
          <View style={[styles.separator, { backgroundColor: colors.border }]} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="message-circle"
            title="No messages yet"
            description="Your chats with connections will appear here"
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/chat/${item.peerUid}`)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Avatar uri={item.peerPhoto} size={52} ring={item.isUnread} />
            <View style={styles.body}>
              <View style={styles.topLine}>
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
                {item.isUnread ? (
                  <View style={styles.unreadDot} />
                ) : null}
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      />
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
});
