import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { routeNotifTap, type NotifData } from "@/lib/notifications";
import {
  getGetNotificationInboxQueryKey,
  useGetNotificationInbox,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type NotificationInboxItem,
} from "@workspace/api-client-react";

const PAGE_SIZE = 50;

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function notificationIcon(type: string | undefined): React.ComponentProps<typeof Feather>["name"] {
  if (type === "chat_message" || type === "event_plan_message") return "message-circle";
  if (type?.startsWith("hangout_") || type === "event_reminder" || type === "venue_event_notification") {
    return "calendar";
  }
  if (type === "reveal_accepted" || type === "reveal_request") return "heart";
  return "bell";
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useT();
  const { authedUid } = useApp();
  const [beforeId, setBeforeId] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<NotificationInboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const params = useMemo(
    () => ({ limit: PAGE_SIZE, ...(beforeId ? { beforeId } : {}) }),
    [beforeId],
  );
  const inbox = useGetNotificationInbox(params, {
    query: {
      enabled: !!authedUid,
      staleTime: 15_000,
      refetchOnMount: "always",
      queryKey: [
        ...getGetNotificationInboxQueryKey(params),
        authedUid ?? "signed-out",
      ],
    },
  });

  useEffect(() => {
    if (!inbox.data) return;
    setUnreadCount(inbox.data.unreadCount);
    setItems((previous) => {
      const merged = new Map(previous.map((item) => [item.id, item]));
      for (const item of inbox.data!.items) merged.set(item.id, item);
      return [...merged.values()].sort((a, b) => b.id - a.id);
    });
  }, [inbox.data]);

  const invalidateInbox = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetNotificationInboxQueryKey(),
    });
  };
  const markRead = useMarkNotificationRead({
    mutation: {
      onSuccess: (result, variables) => {
        const readAt = new Date().toISOString();
        setItems((previous) => previous.map((item) =>
          item.id === variables.notificationId
            ? { ...item, readAt }
            : item,
        ));
        setUnreadCount(result.unreadCount);
        invalidateInbox();
      },
    },
  });
  const markAllRead = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: (result) => {
        const readAt = new Date().toISOString();
        setItems((previous) => previous.map((item) => ({ ...item, readAt })));
        setUnreadCount(result.unreadCount);
        invalidateInbox();
      },
    },
  });

  const openNotification = (item: NotificationInboxItem) => {
    if (!item.readAt) {
      markRead.mutate({ notificationId: item.id });
    }
    routeNotifTap(item.data as unknown as NotifData, router);
  };

  return (
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
          testID="notifications-back"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>
            {t("notificationInbox.title").toUpperCase()}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("notificationInbox.title")}
          </Text>
        </View>
        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("notificationInbox.markAllRead")}
            testID="notifications-mark-all-read"
            disabled={markAllRead.isPending}
            onPress={() => markAllRead.mutate()}
            style={styles.headerButton}
          >
            {markAllRead.isPending
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="check-circle" size={20} color={colors.primary} />}
          </Pressable>
        ) : <View style={styles.headerButton} />}
      </View>

      {inbox.isLoading && items.length === 0 ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : inbox.isError && items.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          testID="notifications-retry"
          onPress={() => void inbox.refetch()}
          style={styles.state}
        >
          <Feather name="refresh-cw" size={24} color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            {t("notificationInbox.loadError")}
          </Text>
        </Pressable>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
            <Feather name="bell" size={23} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t("notificationInbox.emptyTitle")}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>
            {t("notificationInbox.emptyBody")}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 28 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => {
            const unread = !item.readAt;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: unread }}
                testID={`notification-${item.id}`}
                onPress={() => openNotification(item)}
                style={({ pressed }) => [
                  styles.notification,
                  {
                    backgroundColor: unread ? colors.primarySoft : colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <View style={[styles.notificationIcon, { backgroundColor: colors.background }]}>
                  <Feather
                    name={notificationIcon(item.data.type)}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.notificationCopy}>
                  <View style={styles.notificationHeading}>
                    <Text style={[styles.notificationTitle, { color: colors.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
                  </View>
                  <Text style={[styles.notificationBody, { color: colors.mutedForeground }]} numberOfLines={3}>
                    {item.body}
                  </Text>
                  <Text style={[styles.date, { color: colors.mutedForeground }]}>
                    {formatDate(item.createdAt)}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {inbox.isError ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void inbox.refetch()}
              style={[styles.loadOlder, { borderColor: colors.border }]}
            >
              <Text style={[styles.loadOlderText, { color: colors.primary }]}>
                {t("notificationInbox.loadError")}
              </Text>
            </Pressable>
          ) : inbox.data?.nextCursor ? (
            <Pressable
              accessibilityRole="button"
              testID="notifications-load-older"
              disabled={inbox.isFetching}
              onPress={() => setBeforeId(inbox.data?.nextCursor ?? undefined)}
              style={[styles.loadOlder, { borderColor: colors.border }]}
            >
              {inbox.isFetching
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={[styles.loadOlderText, { color: colors.primary }]}>
                    {t("notificationInbox.loadOlder")}
                  </Text>}
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 62,
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerButton: { width: 40, height: 42, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  eyebrow: { fontSize: 9, fontWeight: "700", letterSpacing: 1.7, marginBottom: 3 },
  title: { fontFamily: "serif", fontSize: 30, fontWeight: "400", letterSpacing: -0.6 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  stateText: { fontSize: 14, textAlign: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, gap: 10 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontFamily: "serif", fontSize: 24, textAlign: "center" },
  emptyBody: { fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 300 },
  list: { paddingHorizontal: 18, paddingTop: 16, gap: 10 },
  notification: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 13, flexDirection: "row", gap: 11 },
  notificationIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  notificationCopy: { flex: 1, gap: 4 },
  notificationHeading: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  notificationTitle: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  notificationBody: { fontSize: 13, lineHeight: 18 },
  date: { fontSize: 10, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  loadOlder: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, alignItems: "center", justifyContent: "center", marginTop: 5 },
  loadOlderText: { fontSize: 13, fontWeight: "600" },
});
