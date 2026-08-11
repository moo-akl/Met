/**
 * Venue Owner Events List
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
import { api, type VenueEvent } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";

const GREEN = "#00E87A";

export default function VenueOwnerEventsScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, isLoading: ownerLoading, error: ownerError } = useVenueOwner();
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Venue theme tokens ──────────────────────────────────────────────────────
  const vBg         = isDark ? "#0A0518"                    : "#FAFAF8";
  const vCard       = isDark ? "rgba(255,255,255,0.06)"     : "#fff";
  const vCardBorder = isDark ? "rgba(255,255,255,0.1)"      : "rgba(0,0,0,0.08)";
  const vText       = isDark ? "#fff"                       : "#0D0D0D";
  const vMuted      = isDark ? "rgba(255,255,255,0.4)"      : "rgba(0,0,0,0.38)";
  const vSeparator  = isDark ? "rgba(255,255,255,0.07)"     : "rgba(0,0,0,0.06)";
  const vEmpty      = isDark ? "rgba(255,255,255,0.4)"      : "rgba(0,0,0,0.38)";
  const accent      = isDark ? colors.primary               : GREEN;

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
      <View style={[styles.root, { backgroundColor: vBg }]}>
        <VenueOwnerHeader title="Events" />
        <View style={styles.center}>
          <ActivityIndicator color={accent} />
        </View>
      </View>
    );
  }

  if (ownerError || !profile) {
    return (
      <View style={[styles.root, { backgroundColor: vBg }]}>
        <VenueOwnerHeader title="Events" />
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: vEmpty }]}>We couldn't refresh your venue access.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: vBg }]}>
      <VenueOwnerHeader
        title="Events"
        onBack={() => router.back()}
        rightAction={
          <Pressable
            testID="venue-owner-new-event"
            onPress={() => router.push("/venue-owner/events/new" as never)}
            style={[styles.addBtn, { backgroundColor: accent }]}
          >
            <Text style={[styles.addBtnText, { color: isDark ? "#fff" : "#0D0D0D" }]}>+ New</Text>
          </Pressable>
        }
      />

      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={[styles.emptyText, { color: vEmpty }]}>No events yet</Text>
            <Pressable
              onPress={() => router.push("/venue-owner/events/new" as never)}
              style={[styles.emptyBtn, { borderColor: accent }]}
            >
              <Text style={[styles.emptyBtnText, { color: accent }]}>Create your first event</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: vCard, borderColor: vCardBorder }]}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.cardTitle, { color: vText }]}>{item.title}</Text>
              <Text style={[styles.cardDate, { color: accent }]}>
                {new Date(item.startsAt).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              <Text style={[styles.cardRsvp, { color: vMuted }]}>{item.rsvpCount} RSVPs • {item.isPublished ? "Published" : "Draft"}</Text>
            </View>
            <View style={styles.cardActions}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: `/venue-owner/events/${item.id}` as never,
                    params: {
                      id: String(item.id),
                      title: item.title,
                      description: item.description ?? "",
                      imageUrl: item.imageUrl ?? "",
                      startsAt: item.startsAt,
                      endsAt: item.endsAt ?? "",
                      capacityLimit: item.capacityLimit != null ? String(item.capacityLimit) : "",
                      isPublished: String(item.isPublished),
                    },
                  })
                }
                style={styles.editBtn}
                hitSlop={8}
              >
                <Text style={styles.editBtnText}>✏️</Text>
              </Pressable>
              <Pressable
                onPress={() => handleDelete(item.id)}
                style={styles.deleteBtn}
                hitSlop={8}
              >
                <Text style={styles.deleteBtnText}>🗑</Text>
              </Pressable>
            </View>
            {/* Signal mode: thin bottom separator between rows */}
            {!isDark && <View style={[StyleSheet.absoluteFill, { top: undefined, bottom: -8, height: 0.5, backgroundColor: vSeparator, marginHorizontal: 14 }]} pointerEvents="none" />}
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
  addBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    // Aurora glow
    shadowColor: "rgba(139,92,246,0.15)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  cardDate: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 3 },
  cardRsvp: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  editBtn: { padding: 4 },
  editBtnText: { fontSize: 16 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 18 },
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular", marginBottom: 20 },
  emptyBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
