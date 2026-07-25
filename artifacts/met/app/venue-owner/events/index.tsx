/**
 * Venue Owner Events List
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
import { api, type VenueEvent } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";

export default function VenueOwnerEventsScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, isLoading: ownerLoading } = useVenueOwner();
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!authedUid || !profile?.placeId) return;
    setLoading(true);
    try {
      const data = await api.getVenueEvents({ uid: authedUid }, profile.placeId);
      setEvents(data.events);
    } finally {
      setLoading(false);
    }
  }, [authedUid, profile?.placeId]);

  useEffect(() => {
    if (!ownerLoading) void fetchEvents();
  }, [ownerLoading, fetchEvents]);

  const handleDelete = (eventId: number) => {
    Alert.alert("Delete Event", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!authedUid) return;
          try {
            await api.deleteVenueEvent({ uid: authedUid }, eventId);
            setEvents((prev) => prev.filter((e) => e.id !== eventId));
          } catch {
            Alert.alert("Error", "Failed to delete event");
          }
        },
      },
    ]);
  };

  if (ownerLoading || loading) {
    return (
      <View style={[styles.center, { backgroundColor: "#0F0F12", paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Events</Text>
        <Pressable
          onPress={() => router.push("/venue-owner/events/new" as never)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </Pressable>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyText}>No events yet</Text>
            <Pressable
              onPress={() => router.push("/venue-owner/events/new" as never)}
              style={[styles.emptyBtn, { borderColor: colors.primary }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primary }]}>Create your first event</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.07)" }]}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
              <Text style={[styles.cardDate, { color: colors.primary }]}>
                {new Date(item.startsAt).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              <Text style={styles.cardRsvp}>{item.rsvpCount} RSVPs • {item.isPublished ? "Published" : "Draft"}</Text>
            </View>
            <Pressable
              onPress={() => handleDelete(item.id)}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backText: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
  title: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  addBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  cardTitle: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  cardDate: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 3 },
  cardRsvp: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular" },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 18 },
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "rgba(255,255,255,0.4)", fontSize: 16, fontFamily: "Inter_400Regular", marginBottom: 20 },
  emptyBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
