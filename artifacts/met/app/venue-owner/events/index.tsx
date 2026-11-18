/**
 * Venue Owner Events List
 *
 * Aurora (dark):  deep #0A0518 bg, translucent glass cards, white typography.
 * Signal (light): #FAFAF8 editorial bg, rule-separated rows, #0D0D0D typography.
 */
import React, { useCallback, useState } from "react";
import { Feather } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, type VenueEvent } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { useCreateVenueOwnerEventInviteLink } from "@workspace/api-client-react";
import { openVenueManager as openVenueManagerLink } from "@/lib/venueManagerLink";

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
  const createInviteLink = useCreateVenueOwnerEventInviteLink();

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

  useFocusEffect(
    useCallback(() => {
      if (!ownerLoading) void fetchEvents();
    }, [ownerLoading, fetchEvents]),
  );

  const openVenueManager = async () => {
    try {
      await openVenueManagerLink();
    } catch (error) {
      Alert.alert(
        "Venue Manager unavailable",
        error instanceof Error
          ? error.message
          : "Open Venue Manager in your browser to manage venue events.",
      );
    }
  };

  const handleShare = async (event: VenueEvent) => {
    if (!authedUid || event.visibility !== "invite_only") return;
    try {
      const link = await createInviteLink.mutateAsync({ eventId: event.id });
      setEvents((current) => current.map((item) =>
        item.id === event.id ? { ...item, inviteLinkEnabled: true } : item,
      ));
      await Share.share({
        message: `${event.title}\n${link.url}`,
        url: link.url,
        title: event.title,
      });
      if (link.passcodeRequired) {
        Alert.alert(
          "Passcode protected",
          "Send the passcode separately from the invitation link.",
        );
      }
    } catch (error) {
      Alert.alert(
        "Could not share event",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
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
            accessibilityRole="button"
            accessibilityLabel="Open Venue Manager"
            onPress={() => void openVenueManager()}
            style={[styles.addBtn, { backgroundColor: accent }]}
          >
            <Text style={[styles.addBtnText, { color: isDark ? "#fff" : "#0D0D0D" }]}>Manage online</Text>
          </Pressable>
        }
      />

      <FlatList
        data={events}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="calendar" size={38} color={accent} style={styles.emptyEmoji} />
            <Text style={[styles.emptyText, { color: vEmpty }]}>No events yet</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Venue Manager"
              onPress={() => void openVenueManager()}
              style={[styles.emptyBtn, { borderColor: accent }]}
            >
              <Text style={[styles.emptyBtnText, { color: accent }]}>Open Venue Manager</Text>
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
              {item.visibility === "invite_only" ? (
                <Text
                  accessibilityRole="text"
                  testID={`venue-event-invite-link-state-${item.id}`}
                  style={[styles.inviteLinkStatus, { color: item.inviteLinkEnabled ? accent : vMuted }]}
                >
                  Invitation link {item.inviteLinkEnabled ? "active" : "disabled"}
                </Text>
              ) : null}
            </View>
            <View style={styles.cardActions}>
              {item.ownerUid === authedUid ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View RSVPs and attendance for ${item.title}`}
                  testID={`venue-owner-event-rsvps-${item.id}`}
                  onPress={() => router.push({
                    pathname: "/event-attendees/[eventType]/[id]",
                    params: {
                      eventType: "venue",
                      id: String(item.id),
                      title: item.title,
                    },
                  } as never)}
                  style={styles.rsvpAction}
                  hitSlop={8}
                >
                  <Feather name="users" size={17} color={accent} />
                </Pressable>
              ) : null}
              {item.visibility === "invite_only" ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.inviteLinkEnabled ? "Share" : "Create"} invitation link for ${item.title}`}
                  testID={`venue-event-share-link-${item.id}`}
                  disabled={!item.isPublished || createInviteLink.isPending}
                  onPress={() => void handleShare(item)}
                  style={styles.inviteListAction}
                  hitSlop={8}
                >
                  <Feather name={item.inviteLinkEnabled ? "share-2" : "link"} size={18} color={accent} />
                  <Text style={[styles.inviteListActionText, { color: accent }]}>
                    {item.inviteLinkEnabled ? "Share" : "Create"}
                  </Text>
                </Pressable>
              ) : null}
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
  addBtn: { minHeight: 40, borderTopLeftRadius: 16, borderBottomRightRadius: 16, paddingHorizontal: 14, paddingVertical: 8, justifyContent: "center" },
  addBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  list: { paddingHorizontal: 18, paddingVertical: 12, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderTopLeftRadius: 28,
    borderBottomRightRadius: 20,
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
  inviteLinkStatus: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  cardActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  inviteListAction: { flexDirection: "row", alignItems: "center", gap: 3, padding: 4 },
  inviteListActionText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  rsvpAction: { minWidth: 38, minHeight: 38, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyEmoji: { marginBottom: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular", marginBottom: 20 },
  emptyBtn: { minHeight: 44, borderWidth: 1, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
