/**
 * VenueEventCard
 *
 * Bright & Airy style — white card, coral accent, light date badge,
 * gradient overlay on image, RSVP button in coral. Used in:
 *   - Public venue profile horizontal scroll
 *   - Home tab "Events Near Me" section
 */
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";

const CORAL  = "#FF385C";
const TEXT   = "#222222";
const TEXT2  = "#484848";
const MUTED  = "#9CA3AF";
const CARD   = "#FFFFFF";
const BORDER = "#F0F0F0";

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
  onRsvpChange?: (eventId: number, status: "going" | "maybe" | "not_going") => void;
}

function formatEventDate(iso: string): { month: string; day: string; time: string } {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day:   d.toLocaleDateString("en-US", { day: "numeric" }),
    time:  d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function VenueEventCard({ event, onRsvpChange }: Props) {
  const { authedUid } = useApp();
  const [myRsvp, setMyRsvp] = useState<"going" | "maybe" | "not_going" | null>(
    event.myRsvp ?? null,
  );
  const [rsvpCount, setRsvpCount] = useState(event.rsvpCount);
  const [loading, setLoading] = useState(false);

  const handleRsvp = useCallback(
    async (status: "going" | "maybe" | "not_going") => {
      if (!authedUid || loading) return;
      setLoading(true);
      try {
        await api.rsvpEvent({ uid: authedUid }, event.id, status);
        const wasGoing = myRsvp === "going" || myRsvp === "maybe";
        const nowGoing = status === "going" || status === "maybe";
        if (!wasGoing && nowGoing) setRsvpCount((c) => c + 1);
        if (wasGoing && !nowGoing) setRsvpCount((c) => Math.max(0, c - 1));
        setMyRsvp(status);
        onRsvpChange?.(event.id, status);
      } catch (err) {
        if (!(err instanceof ApiError)) {
          // swallow silently
        }
      } finally {
        setLoading(false);
      }
    },
    [authedUid, event.id, loading, myRsvp, onRsvpChange],
  );

  const isGoing   = myRsvp === "going";
  const { month, day, time } = formatEventDate(event.startsAt);

  return (
    <View style={styles.card}>
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
          disabled={loading}
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
    </View>
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
