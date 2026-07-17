import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { ActionSheet } from "@/components/ActionSheet";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { TrustScoreBadge } from "@/components/TrustScoreBadge";
import { UserNameHeader } from "@/components/UserNameHeader";
import { WelcomeEmptyState } from "@/components/WelcomeEmptyState";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useVisibility } from "@/hooks/useVisibility";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { useT } from "@/lib/i18n";
import { api } from "@/lib/api/client";
import { subscribeToChatMeta } from "@/lib/firestore/chat";
import {
  loadConnectionsSort,
  saveConnectionsSort,
  type ConnectionsSort,
} from "@/lib/storage";
import type { Encounter } from "@/lib/types";

function timeAgo(ts: number, t: (k: string, opts?: Record<string, unknown>) => string) {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return t("connections.timeNow");
  if (diff < 3600) return t("connections.timeMin", { count: Math.floor(diff / 60) });
  if (diff < 86400)
    return t("connections.timeHour", { count: Math.floor(diff / 3600) });
  if (diff < 604800)
    return t("connections.timeDay", { count: Math.floor(diff / 86400) });
  return t("connections.timeWeek", { count: Math.floor(diff / 604800) });
}

function lastActivityOf(c: Encounter): number {
  return (
    c.openingMessage?.reply?.receivedAt ??
    c.openingMessage?.sentAt ??
    c.lastSeenAt
  );
}

const SORT_KEY: Record<ConnectionsSort, string> = {
  recent: "connections.sortMostRecent",
  frequent: "connections.sortMostMet",
  name: "connections.sortNameAZ",
};

export default function ConnectionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { encounters, profile, authedUid } = useApp();
  const { isVisible, toggle: toggleVisibility } = useVisibility();

  const unreadChatCount = useUnreadChatCount();
  const webBot = Platform.OS === "web" ? 34 : 0;

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ConnectionsSort>("recent");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Persisted sort. Loaded once at mount; never blocks first render.
  useEffect(() => {
    let cancelled = false;
    loadConnectionsSort().then((s) => {
      if (!cancelled && s) setSort(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSort = (next: ConnectionsSort) => {
    setSort(next);
    saveConnectionsSort(next).catch(() => {});
  };

  const connections = useMemo(
    () => encounters.filter((e) => e.status === "connected"),
    [encounters],
  );

  // All distinct tags currently in use across connections, lowercased.
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of connections) {
      for (const t of c.tags ?? []) set.add(t);
    }
    return Array.from(set).sort();
  }, [connections]);

  // If the active tag disappears (last connection with it removed), clear it.
  useEffect(() => {
    if (activeTag && !availableTags.includes(activeTag)) {
      setActiveTag(null);
    }
  }, [activeTag, availableTags]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = connections;
    if (activeTag) {
      list = list.filter((c) => (c.tags ?? []).includes(activeTag));
    }
    if (q) {
      list = list.filter(
        (c) =>
          c.realName.toLowerCase().includes(q) ||
          (c.tags ?? []).some((t) => t.includes(q)) ||
          (c.note ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [connections, query, activeTag]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort === "recent") {
      list.sort((a, b) => lastActivityOf(b) - lastActivityOf(a));
    } else if (sort === "frequent") {
      list.sort((a, b) => {
        if (b.encounterCount !== a.encounterCount) {
          return b.encounterCount - a.encounterCount;
        }
        return lastActivityOf(b) - lastActivityOf(a);
      });
    } else {
      list.sort((a, b) =>
        a.realName.localeCompare(b.realName, undefined, { sensitivity: "base" }),
      );
    }
    return list;
  }, [filtered, sort]);

  // Group-by-date is only meaningful for the recent sort. Other sorts render
  // a flat list because date headers would be misleading.
  const groups = useMemo(() => {
    if (sort !== "recent") {
      return [{ key: "all", label: null, items: sorted }];
    }
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const today: Encounter[] = [];
    const week: Encounter[] = [];
    const earlier: Encounter[] = [];
    for (const c of sorted) {
      const ts = lastActivityOf(c);
      if (now - ts < dayMs) today.push(c);
      else if (now - ts < 7 * dayMs) week.push(c);
      else earlier.push(c);
    }
    return [
      { key: "today", label: t("connections.groupToday"), items: today },
      { key: "week", label: t("connections.groupWeek"), items: week },
      { key: "earlier", label: t("connections.groupEarlier"), items: earlier },
    ].filter((g) => g.items.length > 0);
  }, [sorted, sort, t]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("appHeader.titleConnections")}
        visibility={{ isVisible, onToggle: toggleVisibility }}
        actions={[
          { icon: "mail", onPress: () => router.push("/inbox"), badge: unreadChatCount },
          { icon: "sliders", onPress: () => setSortMenuOpen(true) },
        ]}
      />

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
              placeholder={t("connections.searchPlaceholder")}
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
          <Pressable
            onPress={() => setSortMenuOpen(true)}
            style={({ pressed }) => [
              styles.sortChip,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="bar-chart-2" size={13} color={colors.foreground} />
            <Text style={[styles.sortChipText, { color: colors.foreground }]}>
              {t(SORT_KEY[sort])}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {availableTags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagsRow}
        >
          <TagPill
            label={t("connections.tagAll")}
            active={activeTag === null}
            onPress={() => setActiveTag(null)}
            colors={colors}
          />
          {availableTags.map((tag) => (
            <TagPill
              key={tag}
              label={`#${tag}`}
              active={activeTag === tag}
              onPress={() => setActiveTag(activeTag === tag ? null : tag)}
              colors={colors}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.listWrapper}>
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
          // Brand-new user (no encounters at all) → big visual welcome.
          // Active user with encounters but no connections yet → slim
          // contextual hint that they just need someone to reveal back.
          encounters.length === 0 ? (
            <WelcomeEmptyState
              title={t("connections.welcomeTitle")}
              description={t("connections.welcomeDesc")}
              hintIcon="send"
              hint={t("connections.welcomeHint")}
            />
          ) : (
            <EmptyState
              icon="message-circle"
              title={t("connections.emptyTitle")}
              description={t("connections.emptySub")}
            />
          )
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="search"
            title={t("connections.noMatchesTitle")}
            description={
              activeTag
                ? t("connections.noMatchesByTag", {
                    tag: activeTag,
                    andQuery: query.trim()
                      ? t("connections.matchingQuerySuffix", {
                          query: query.trim(),
                        })
                      : "",
                  })
                : t("connections.noMatchesByQuery", { query: query.trim() })
            }
          />
        ) : (
          <View style={styles.list}>
            {groups.map((group) => (
              <View key={group.key} style={{ gap: 0 }}>
                {group.label ? (
                  <Text
                    style={[
                      styles.groupHeader,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {group.label}
                  </Text>
                ) : null}
                {group.items.map((c, idx) => (
                  <ConnectionRow
                    key={c.id}
                    connection={c}
                    myUid={authedUid ?? profile?.id}
                    isLast={idx === group.items.length - 1}
                    colors={colors}
                    t={t}
                    onPress={() => router.push(`/connection/${c.id}`)}
                    onChatPress={() => router.push(`/chat/${c.id}`)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      </View>

      <ActionSheet
        visible={sortMenuOpen}
        onClose={() => setSortMenuOpen(false)}
        title={t("connections.sortMenuTitle")}
        actions={(
          ["recent", "frequent", "name"] as ConnectionsSort[]
        ).map((opt) => ({
          label: t(SORT_KEY[opt]) + (sort === opt ? "  ✓" : ""),
          icon:
            opt === "recent"
              ? "clock"
              : opt === "frequent"
                ? "repeat"
                : "type",
          onPress: () => updateSort(opt),
        }))}
      />

    </View>
  );
}

function ConnectionRow({
  connection: c,
  myUid,
  isLast,
  colors,
  t,
  onPress,
  onChatPress,
}: {
  connection: Encounter;
  myUid: string | undefined;
  isLast: boolean;
  colors: ReturnType<typeof useColors>;
  t: (k: string, opts?: Record<string, unknown>) => string;
  onPress: () => void;
  onChatPress: () => void;
}) {
  const verified = !!(c.photoUri && c.photoUri !== "");

  const { data: standing } = useQuery({
    queryKey: ["communityStanding", c.id],
    queryFn: () => api.getCommunityStanding({ uid: myUid ?? "" }, c.id),
    enabled: !!myUid && !!c.id,
    staleTime: 5 * 60 * 1000,
  });
  const averageRating =
    standing?.hasEnough && standing?.averageRating != null
      ? standing.averageRating
      : null;
  const isPioneer = standing?.isPioneer ?? false;
  const trophyCount = standing?.trophyCount ?? 0;
  const peerTrustScore = standing?.trustScore ?? null;

  const om = c.openingMessage;
  let preview: string;
  let previewColor = colors.mutedForeground;
  let timestamp = c.lastSeenAt;
  let openingUnread = false;

  if (om?.reply) {
    preview = om.reply.text;
    previewColor = colors.foreground;
    timestamp = om.reply.receivedAt;
    openingUnread = Date.now() - om.reply.receivedAt < 60_000;
  } else if (om) {
    preview = t("connections.youColon", { text: om.text });
    timestamp = om.sentAt;
  } else if (c.note) {
    preview = t("connections.notePrefix", { note: c.note });
  } else if (c.lastLocation) {
    preview = c.lastLocation;
  } else {
    preview = t(
      c.encounterCount === 1
        ? "connections.metTimes_one"
        : "connections.metTimes_other",
      { count: c.encounterCount },
    );
  }

  // Subscribe to this peer's chat doc for live preview + unread indicator.
  const [chatMeta, setChatMeta] = useState<import("@/lib/firestore/chat").ChatMeta | null>(null);
  useEffect(() => {
    if (!myUid || !c.id) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    subscribeToChatMeta(myUid, c.id, (meta) => {
      if (cancelled) return;
      setChatMeta(meta);
    }).then((fn) => {
      if (cancelled) fn();
      else unsub = fn;
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [myUid, c.id]);

  const chatLast = chatMeta?.lastMessage ?? null;
  const chatUnread = (() => {
    if (!chatLast || !myUid) return false;
    const readAt = chatMeta?.lastReadAt[myUid] ?? 0;
    const cleared = (chatMeta?.clearedAt ?? {})[myUid] ?? 0;
    return chatLast.sentAt > readAt && chatLast.sentAt > cleared;
  })();

  // Override preview and timestamp with the actual last chat message when available.
  // lastMessage.text is already formatted by sendMessage ("🎤 Voice message", "📷", or plain text).
  if (chatLast) {
    const isMine = chatLast.from === myUid;
    preview = isMine
      ? t("connections.youColon", { text: chatLast.text })
      : chatLast.text;
    timestamp = chatLast.sentAt;
    previewColor = chatUnread ? colors.foreground : colors.mutedForeground;
  }

  const unread = openingUnread || chatUnread;

  return (
    <View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Avatar uri={c.photoUri} size={54} ring={unread} />
        <View style={styles.body}>
          <View style={styles.topLine}>
            <View style={styles.nameGroup}>
              <UserNameHeader
                name={c.realName}
                nameStyle={[styles.name, { color: colors.foreground }]}
                isPioneer={isPioneer}
                trustScore={standing?.trustScore ?? 0}
                isSubscriber={standing?.isSubscriber ?? false}
                hasPhoto={!!(c.photoUri && c.photoUri !== "")}
              />
              {averageRating != null ? (
                <View style={styles.ratingPill}>
                  <Feather name="star" size={10} color="#FFD700" />
                  <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
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
              {timeAgo(timestamp, t)}
            </Text>
          </View>
          <View style={styles.previewLine}>
            <Text
              style={[
                styles.preview,
                {
                  color: unread ? colors.foreground : previewColor,
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
                  { backgroundColor: chatUnread ? "#EF4444" : colors.primary },
                ]}
              />
            ) : null}
          </View>
          {(c.tags?.length ?? 0) > 0 ? (
            <View style={styles.rowTags}>
              {(c.tags ?? []).slice(0, 3).map((tag) => (
                <Text
                  key={tag}
                  style={[
                    styles.rowTag,
                    {
                      color: colors.primary,
                      backgroundColor: "#DCFCE7",
                    },
                  ]}
                >
                  #{tag}
                </Text>
              ))}
            </View>
          ) : null}

          {peerTrustScore !== null ? (
            <View style={styles.badgesRow}>
              <TrustScoreBadge score={peerTrustScore} size="sm" showScore />
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={(e) => { e.stopPropagation(); onChatPress(); }}
          hitSlop={10}
          style={styles.chatIconWrap}
          accessibilityLabel="Open chat"
          accessibilityRole="button"
        >
          <Feather
            name="message-circle"
            size={22}
            color={chatUnread ? "#EF4444" : colors.mutedForeground}
          />
          {chatUnread ? <View style={styles.chatIconDot} /> : null}
        </Pressable>
        <Feather
          name="chevron-right"
          size={20}
          color={colors.mutedForeground}
        />
      </Pressable>
      {!isLast ? (
        <View
          style={[
            styles.separator,
            { backgroundColor: colors.border },
          ]}
        />
      ) : null}
    </View>
  );
}

function TagPill({
  label,
  active,
  onPress,
  colors,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tagPill,
        {
          backgroundColor: active ? colors.primary : colors.muted,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.tagPillText,
          { color: active ? "#FFFFFF" : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listWrapper: { flex: 1 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  searchBar: {
    flex: 1,
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
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  sortChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  tagsRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tagPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  groupHeader: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 4,
    paddingTop: 14,
    paddingBottom: 6,
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
  nameGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    flexShrink: 1,
    overflow: "hidden",
  },
  name: { fontFamily: "Inter_700Bold", fontSize: 16, flexShrink: 1 },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#FEF9C3",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ratingText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "#92400E",
  },
  timestamp: { fontFamily: "Inter_500Medium", fontSize: 12 },
  previewLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  preview: { fontSize: 13, flex: 1 },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
  rowTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  rowTag: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 3,
  },
  pioneerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(212,175,55,0.12)",
    borderWidth: 1,
    borderColor: "#D4AF37",
  },
  pioneerBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.5,
    color: "#D4AF37",
    textTransform: "uppercase",
  },
  trophyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(255,215,0,0.10)",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  trophyBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1,
    color: "#92400E",
    textTransform: "uppercase",
  },
  myBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  myBadgesYouLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    marginRight: 2,
  },
  chatIconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  chatIconDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  separator: { height: 1, marginLeft: 70 },
});
