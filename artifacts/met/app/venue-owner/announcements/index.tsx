/**
 * Venue Owner Announcements List
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
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";

export default function VenueOwnerAnnouncementsScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, isLoading: ownerLoading, error: ownerError } = useVenueOwner();
  const [announcements, setAnnouncements] = useState<VenueAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

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
      <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
        <VenueOwnerHeader title="Announcements" />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (ownerError || !profile) {
    return (
      <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
        <VenueOwnerHeader title="Announcements" />
        <View style={styles.center}>
          <Text style={styles.emptyText}>We couldn't refresh your venue access.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
      <VenueOwnerHeader
        title="Announcements"
        onBack={() => router.back()}
        rightAction={
          <Pressable
            testID="venue-owner-new-announcement"
            onPress={() => router.push("/venue-owner/announcements/new" as never)}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.addBtnText}>+ New</Text>
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
            <Text style={styles.emptyTitle}>No announcements yet</Text>
            <Text style={styles.emptyText}>Post updates, promos, or news for guests visiting your venue.</Text>
            <Pressable
              onPress={() => router.push("/venue-owner/announcements/new" as never)}
              style={[styles.emptyBtn, { borderColor: colors.primary }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primary }]}>Create your first announcement</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.07)" }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.cardTitleRow}>
                {item.isPinned && (
                  <Text style={styles.pinBadge}>📌</Text>
                )}
                <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
              </View>
              <Text numberOfLines={2} style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.cardDate}>
                {new Date(item.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <Pressable
              onPress={() => handleDelete(item.id, item.title)}
              style={styles.deleteBtn}
              hitSlop={8}
            >
              <Text style={styles.deleteBtnText}>🗑</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  addBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  pinBadge: { fontSize: 14 },
  cardTitle: { flex: 1, color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardBody: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  cardDate: { color: "rgba(255,255,255,0.28)", fontSize: 11, fontFamily: "Inter_400Regular" },
  deleteBtn: { paddingTop: 2 },
  deleteBtnText: { fontSize: 18 },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8 },
  emptyText: { color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 20, lineHeight: 20 },
  emptyBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
