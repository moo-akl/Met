/**
 * Venue Owner Announcements List
 *
 * Aurora (dark):  deep #0A0518 bg, translucent glass cards, white typography.
 * Signal (light): #FAFAF8 editorial bg, rule-separated rows, #0D0D0D typography.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, type VenueAnnouncement } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";

const GREEN = "#00E87A";

export default function VenueOwnerAnnouncementsScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, isLoading: ownerLoading, error: ownerError } = useVenueOwner();
  const [announcements, setAnnouncements] = useState<VenueAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Venue theme tokens ──────────────────────────────────────────────────────
  const vBg         = isDark ? "#0A0518"                : "#FAFAF8";
  const vCard       = isDark ? "rgba(255,255,255,0.06)" : "#fff";
  const vCardPress  = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.03)";
  const vCardBorder = isDark ? "rgba(255,255,255,0.1)"  : "rgba(0,0,0,0.08)";
  const vText       = isDark ? "#fff"                   : "#0D0D0D";
  const vBody       = isDark ? "rgba(255,255,255,0.5)"  : "rgba(0,0,0,0.5)";
  const vDate       = isDark ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.28)";
  const vEmpty      = isDark ? "rgba(255,255,255,0.4)"  : "rgba(0,0,0,0.38)";
  const vEmptyTitle = isDark ? "#fff"                   : "#0D0D0D";
  const accent      = isDark ? colors.primary           : GREEN;

  const fetchAnnouncements = useCallback(async () => {
    if (!authedUid || !profile?.placeId) return;
    setLoading(true);
    try {
      const data = await api.getVenueAnnouncements({ uid: authedUid }, profile.placeId);
      setAnnouncements(data.announcements);
    } catch {
      // error state handled below
    } finally {
      setLoading(false);
    }
  }, [authedUid, profile?.placeId]);

  useEffect(() => {
    if (!ownerLoading) void fetchAnnouncements();
  }, [ownerLoading, fetchAnnouncements]);

  const handleDelete = (id: number, title: string) => {
    Alert.alert(`Delete "${title}"?`, "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!authedUid) return;
          try {
            await api.deleteVenueAnnouncement({ uid: authedUid }, id);
            setAnnouncements((prev) => prev.filter((a) => a.id !== id));
          } catch {
            Alert.alert("Error", "Failed to delete announcement");
          }
        },
      },
    ]);
  };

  if (ownerLoading || loading) {
    return (
      <View style={[styles.root, { backgroundColor: vBg }]}>
        <VenueOwnerHeader title="Announcements" />
        <View style={styles.center}>
          <ActivityIndicator color={accent} />
        </View>
      </View>
    );
  }

  if (ownerError || !profile) {
    return (
      <View style={[styles.root, { backgroundColor: vBg }]}>
        <VenueOwnerHeader title="Announcements" />
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: vEmpty }]}>We couldn't refresh your venue access.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: vBg }]}>
      <VenueOwnerHeader
        title="Announcements"
        onBack={() => router.back()}
        rightAction={
          <Pressable
            testID="venue-owner-new-announcement"
            onPress={() => router.push("/venue-owner/announcements/new" as never)}
            style={[styles.addBtn, { backgroundColor: accent }]}
          >
            <Text style={[styles.addBtnText, { color: isDark ? "#fff" : "#0D0D0D" }]}>+ New</Text>
          </Pressable>
        }
      />

      <FlatList
        data={announcements}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📢</Text>
            <Text style={[styles.emptyTitle, { color: vEmptyTitle }]}>No announcements yet</Text>
            <Text style={[styles.emptyText, { color: vEmpty }]}>Post updates, promos, or news for guests visiting your venue.</Text>
            <Pressable
              onPress={() => router.push("/venue-owner/announcements/new" as never)}
              style={[styles.emptyBtn, { borderColor: accent }]}
            >
              <Text style={[styles.emptyBtnText, { color: accent }]}>Create your first announcement</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/venue-owner/announcements/[id]" as never,
                params: {
                  id: String(item.id),
                  title: item.title,
                  body: item.body,
                  imageUrl: item.imageUrl ?? "",
                  isPinned: String(item.isPinned),
                },
              } as never)
            }
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: pressed ? vCardPress : vCard, borderColor: vCardBorder },
            ]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.cardTitleRow}>
                {item.isPinned && (
                  <Text style={styles.pinBadge}>📌</Text>
                )}
                <Text numberOfLines={1} style={[styles.cardTitle, { color: vText }]}>{item.title}</Text>
              </View>
              <Text numberOfLines={2} style={[styles.cardBody, { color: vBody }]}>{item.body}</Text>
              <Text style={[styles.cardDate, { color: vDate }]}>
                {new Date(item.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <View style={styles.cardActions}>
              <Pressable
                onPress={() => handleDelete(item.id, item.title)}
                style={styles.deleteBtn}
                hitSlop={8}
              >
                <Text style={styles.deleteBtnText}>🗑</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  addBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowColor: "rgba(139,92,246,0.15)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  pinBadge: { fontSize: 14 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  cardDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cardActions: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  deleteBtn: { paddingTop: 2 },
  deleteBtnText: { fontSize: 18 },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  emptyBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
