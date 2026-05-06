import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

type Props = {
  visible: boolean;
  onClose: () => void;
};

function timeAgo(
  ts: number,
  t: (k: string, opts?: Record<string, unknown>) => string,
) {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return t("requestsSheet.timeJustNow");
  if (diff < 3600)
    return t("requestsSheet.timeMin", { count: Math.floor(diff / 60) });
  if (diff < 86400)
    return t("requestsSheet.timeHour", { count: Math.floor(diff / 3600) });
  return t("requestsSheet.timeDay", { count: Math.floor(diff / 86400) });
}

export function RequestsSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const webBot = Platform.OS === "web" ? 34 : 0;
  const { encounters, acceptRevealRequest, declineRevealRequest } = useApp();

  const incoming = encounters
    .filter((e) => e.status === "request_received")
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

  const openDetail = (id: string) => {
    router.push(`/encounter/${id}`);
    onClose();
  };

  const accept = async (id: string) => {
    // CRITICAL: must go through acceptRevealRequest, which hits
    // POST /api/reveals/accept on the server. The server then mirrors
    // the accepted state back into Firestore on BOTH sides so the
    // sender's listener flips their encounter to "connected" too.
    // A local-only updateEncounterStatus would leave the sender stuck.
    try {
      await acceptRevealRequest(id);
    } catch (err) {
      console.warn("[requestsSheet] accept failed", err);
      return;
    }
    onClose();
    router.push(`/connection/${id}`);
  };

  const decline = async (id: string) => {
    // Same reason as accept: declines must round-trip through the
    // server so the sender's outbox poll / listener picks up the
    // declined state, otherwise the sender stays in "request_sent"
    // forever.
    try {
      await declineRevealRequest(id);
    } catch (err) {
      console.warn("[requestsSheet] decline failed", err);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + webBot + 20,
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={{ width: 24 }} />
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {t("requestsSheet.title")}
              </Text>
              {incoming.length > 0 ? (
                <View
                  style={[styles.countPill, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.countPillText}>{incoming.length}</Text>
                </View>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          {incoming.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View
                style={[styles.emptyIcon, { backgroundColor: "#DCFCE7" }]}
              >
                <Feather name="check-circle" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {t("requestsSheet.emptyTitle")}
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                {t("requestsSheet.emptySub")}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: 440 }}
              contentContainerStyle={{ gap: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {incoming.map((e) => (
                <View
                  key={e.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => openDetail(e.id)}
                    style={({ pressed }) => [
                      styles.cardTop,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Avatar uri={e.photoUri} size={48} ring />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={[styles.name, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {e.realName}
                      </Text>
                      <Text
                        style={[
                          styles.meta,
                          { color: colors.mutedForeground },
                        ]}
                        numberOfLines={1}
                      >
                        {t("requestsSheet.wantsToShareWithTime", {
                          when: timeAgo(e.lastSeenAt, t),
                        })}
                      </Text>
                      {e.bio ? (
                        <Text
                          style={[
                            styles.bio,
                            { color: colors.mutedForeground },
                          ]}
                          numberOfLines={2}
                        >
                          {e.bio}
                        </Text>
                      ) : null}
                    </View>
                    <Feather
                      name="chevron-right"
                      size={20}
                      color={colors.mutedForeground}
                    />
                  </Pressable>

                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={() => decline(e.id)}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        styles.declineBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionText,
                          { color: colors.foreground },
                        ]}
                      >
                        {t("requestsSheet.notNow")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => accept(e.id)}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Feather name="check" size={16} color="#FFFFFF" />
                      <Text
                        style={[styles.actionText, { color: "#FFFFFF" }]}
                      >
                        {t("requestsSheet.acceptReveal")}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 14,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 17 },
  countPill: {
    minWidth: 22,
    paddingHorizontal: 7,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  emptyWrap: {
    paddingVertical: 36,
    alignItems: "center",
    gap: 10,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 19,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  name: { fontFamily: "Inter_700Bold", fontSize: 15 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 12 },
  bio: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  declineBtn: {},
  actionText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
});
