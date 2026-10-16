/**
 * VenueEventCard
 *
 * Canopy place card — paper surface, forest accent, light date badge,
 * photographic cover and server-backed RSVP. Used in:
 *   - Public venue profile horizontal scroll
 *   - Home tab "Events Near Me" section
 */
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "@/contexts/AppContext";
import { api } from "@/lib/api/client";
import themeColors from "@/constants/colors";

const CORAL = themeColors.light.brandPanel;
const TEXT = themeColors.light.text;
const TEXT2 = "#526557";
const MUTED = themeColors.light.mutedForeground;
const CARD = themeColors.light.card;
const BORDER = themeColors.light.border;

export interface VenueEventCardData {
  id: number;
  placeId: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  rsvpCount: number;
  /** Caller's current RSVP status, or null if not RSVPed. */
  myRsvp?: "going" | "maybe" | "not_going" | null;
}

interface Props {
  event: VenueEventCardData;
  onPress?: () => void;
  onRsvpChange?: (eventId: number, status: "going" | "maybe" | "not_going") => void;
  readOnly?: boolean;
}

function formatEventDate(iso: string): { month: string; day: string; time: string } {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day:   d.toLocaleDateString("en-US", { day: "numeric" }),
    time:  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function VenueEventCard({ event, onPress, onRsvpChange, readOnly = false }: Props) {
  const { authedUid } = useApp();
  const [myRsvp, setMyRsvp] = useState<"going" | "maybe" | "not_going" | null>(
    event.myRsvp ?? null,
  );
  const [rsvpCount, setRsvpCount] = useState(event.rsvpCount);
  const [loading, setLoading] = useState(false);

  const handleRsvp = useCallback(
    async (status: "going" | "maybe" | "not_going") => {
      if (readOnly || !authedUid || loading) return;
      setLoading(true);
      try {
        await api.rsvpEvent({ uid: authedUid }, event.id, status);
        const wasGoing = myRsvp === "going" || myRsvp === "maybe";
        const nowGoing = status === "going" || status === "maybe";
        if (!wasGoing && nowGoing) setRsvpCount((c) => c + 1);
        if (wasGoing && !nowGoing) setRsvpCount((c) => Math.max(0, c - 1));
        setMyRsvp(status);
        onRsvpChange?.(event.id, status);
      } catch {
        Alert.alert("Couldn't update RSVP", "Please try again in a moment.");
      } finally {
        setLoading(false);
      }
    },
    [authedUid, event.id, loading, myRsvp, onRsvpChange, readOnly],
  );

  const isGoing   = myRsvp === "going";
  const { month, day, time } = formatEventDate(event.startsAt);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, onPress && pressed && { opacity: 0.88 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      {/* ── Image + date badge ───────────────────────── */}
      <View style={styles.imageWrap}>
        {event.imageUrl ? (
          <Image
            source={{ uri: event.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <LinearGradient
            colors={["#73C8A9", "#E1B866"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.image}
          >
            <Text style={styles.imageFallbackEmoji}>🎉</Text>
          </LinearGradient>
        )}

        {/* Subtle bottom overlay so RSVP count reads cleanly */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.28)"]}
          locations={[0.5, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Date badge — top left */}
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeMonth}>{month}</Text>
          <Text style={styles.dateBadgeDay}>{day}</Text>
        </View>

        {/* RSVP count — bottom right */}
        <View style={styles.rsvpPill}>
          <Text style={styles.rsvpPillText}>{rsvpCount} going</Text>
        </View>
      </View>

      {/* ── Title + time + RSVP button ───────────────── */}
      <View style={styles.footer}>
        <Text numberOfLines={2} style={styles.title}>{event.title}</Text>
        <Text style={styles.time}>🕐 {time}</Text>

        <Pressable
          onPress={() => handleRsvp(isGoing ? "not_going" : "going")}
          style={[
            styles.rsvpBtn,
            isGoing
              ? styles.rsvpBtnActive
              : styles.rsvpBtnIdle,
          ]}
          disabled={loading || readOnly}
          accessibilityRole="button"
          accessibilityLabel={isGoing ? "Cancel RSVP" : "RSVP Going"}
        >
          {loading ? (
            <ActivityIndicator size="small" color={isGoing ? "#fff" : CORAL} />
          ) : (
            <Text style={[styles.rsvpBtnText, isGoing ? styles.rsvpBtnTextActive : styles.rsvpBtnTextIdle]}>
              {isGoing ? "✓ Going" : "RSVP"}
            </Text>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 250,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    marginRight: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Image area
  imageWrap: { position: "relative" },
  image:     { width: "100%", height: 140, alignItems: "center", justifyContent: "center" },
  imageFallbackEmoji: { fontSize: 40 },

  // Date badge
  dateBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: CORAL,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: "center",
    minWidth: 40,
  },
  dateBadgeMonth: { fontSize: 9,  fontFamily: "Inter_700Bold", color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
  dateBadgeDay:   { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", lineHeight: 18 },

  // RSVP count pill
  rsvpPill: {
    position: "absolute",
    bottom: 8,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rsvpPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // Footer
  footer: { padding: 12, gap: 6 },
  title:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: TEXT, lineHeight: 20 },
  time:   { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED },

  // RSVP button
  rsvpBtn: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingVertical: 7,
    alignItems: "center",
    marginTop: 2,
  },
  rsvpBtnIdle:         { backgroundColor: "transparent", borderColor: CORAL },
  rsvpBtnActive:       { backgroundColor: CORAL, borderColor: CORAL },
  rsvpBtnText:         { fontSize: 13, fontFamily: "Inter_700Bold" },
  rsvpBtnTextIdle:     { color: CORAL },
  rsvpBtnTextActive:   { color: "#fff" },
});
