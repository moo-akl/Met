import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

function timeAgo(ts: number) {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

export default function ConnectionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { encounters } = useApp();
  const webBot = Platform.OS === "web" ? 34 : 0;

  const [query, setQuery] = useState("");

  // All connected encounters, sorted by last activity (most recent message,
  // or last seen if no messages yet).
  const connections = useMemo(
    () =>
      encounters
        .filter((e) => e.status === "connected")
        .sort((a, b) => {
          const at =
            a.openingMessage?.reply?.receivedAt ??
            a.openingMessage?.sentAt ??
            a.lastSeenAt;
          const bt =
            b.openingMessage?.reply?.receivedAt ??
            b.openingMessage?.sentAt ??
            b.lastSeenAt;
          return bt - at;
        }),
    [encounters],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connections;
    return connections.filter((c) => c.realName.toLowerCase().includes(q));
  }, [connections, query]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Connections" />

      {connections.length > 0 ? (
        <View style={styles.searchWrap}>
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search connections"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} hitSlop={10}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + webBot + 100,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {connections.length === 0 ? (
          <EmptyState
            icon="message-circle"
            title="No connections yet"
            description="Once someone reveals back, they'll show up here."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="search"
            title="No matches"
            description={`No connection named "${query.trim()}".`}
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((c, idx) => {
              const om = c.openingMessage;
              // Preview reflects the messaging-as-flavor stance: a real reply
              // wins, then the user's own outgoing message, otherwise we show
              // a neutral context line (location or "Met N times") instead of
              // pushing the user to message.
              let preview: string;
              let previewColor = colors.mutedForeground;
              let timestamp = c.lastSeenAt;
              let unread = false;

              if (om?.reply) {
                preview = om.reply.text;
                previewColor = colors.foreground;
                timestamp = om.reply.receivedAt;
                unread = Date.now() - om.reply.receivedAt < 60_000;
              } else if (om) {
                preview = `You: ${om.text}`;
                timestamp = om.sentAt;
              } else if (c.lastLocation) {
                preview = c.lastLocation;
              } else {
                preview = `Met ${c.encounterCount} ${c.encounterCount === 1 ? "time" : "times"}`;
              }

              return (
                <View key={c.id}>
                  <Pressable
                    onPress={() => router.push(`/connection/${c.id}`)}
                    style={({ pressed }) => [
                      styles.row,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Avatar uri={c.photoUri} size={54} ring={unread} />
                    <View style={styles.body}>
                      <View style={styles.topLine}>
                        <Text
                          style={[styles.name, { color: colors.foreground }]}
                          numberOfLines={1}
                        >
                          {c.realName}
                        </Text>
                        <Text
                          style={[
                            styles.timestamp,
                            {
                              color: unread
                                ? colors.primary
                                : colors.mutedForeground,
                            },
                          ]}
                        >
                          {timeAgo(timestamp)}
                        </Text>
                      </View>
                      <View style={styles.previewLine}>
                        <Text
                          style={[
                            styles.preview,
                            {
                              color: previewColor,
                              fontFamily: unread
                                ? "Inter_600SemiBold"
                                : "Inter_400Regular",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {preview}
                        </Text>
                        {unread ? (
                          <View
                            style={[
                              styles.unreadDot,
                              { backgroundColor: colors.primary },
                            ]}
                          />
                        ) : null}
                      </View>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                  {idx < filtered.length - 1 ? (
                    <View
                      style={[
                        styles.separator,
                        { backgroundColor: colors.border },
                      ]}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 0,
  },
  list: { paddingHorizontal: 4 },
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
  name: { fontFamily: "Inter_700Bold", fontSize: 16, flex: 1 },
  timestamp: { fontFamily: "Inter_500Medium", fontSize: 12 },
  previewLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  preview: { fontSize: 13, flex: 1 },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
  separator: { height: 1, marginLeft: 70 },
});
