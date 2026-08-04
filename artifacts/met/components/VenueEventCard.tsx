/**
 * VenueEventCard
 *
 * Redesigned event card — large hero image with date/time and RSVP count
 * overlaid, prominent RSVP button below. Used in:
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
import { useColors } from "@/hooks/useColors";

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

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VenueEventCard({ event, onRsvpChange }: Props) {
  const { authedUid } = useApp();
  const colors = useColors();
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

  const isGoing = myRsvp === "going";

  return (
    <View style={[styles.card, { backgroundColor: "#1A1A1E" }]}>

      {/* ── Image hero with overlays ── */}
      <View style={styles.imageWrap}>
        {event.imageUrl ? (
          <Image
            source={{ uri: event.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Text style={styles.imageFallbackEmoji}>🎉</Text>
          </View>
        )}

        {/* Gradient overlay — bottom only */}
        <LinearGradient
          colors={["transparent", "rgba(15,15,18,0.82)"]}
          locations={[0.4, 1]}
          style={[StyleSheet.absoluteFillObject, styles.imageGradient]}
        />

        {/* RSVP count pill — top right */}
        <View style={[styles.rsvpPill, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
          <Text style={styles.rsvpPillText}>
            {rsvpCount} {rsvpCount === 1 ? "going" : "going"}
          </Text>
        </View>

        {/* Date/time — bottom left */}
        <Text style={[styles.dateOverlay, { color: colors.primary }]}>
          {formatEventDate(event.startsAt)}
        </Text>
      </View>

      {/* ── Title + RSVP button ── */}
      <View style={styles.footer}>
        <Text numberOfLines={2} style={styles.title}>{event.title}</Text>

        <Pressable
          onPress={() => handleRsvp(isGoing ? "not_going" : "going")}
          style={[
            styles.rsvpBtn,
            {
              backgroundColor: isGoing ? colors.primary : "transparent",
              borderColor: colors.primary,
            },
          ]}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel={isGoing ? "Cancel RSVP" : "RSVP Going"}
        >
          {loading ? (
            <ActivityIndicator size="small" color={isGoing ? "#fff" : colors.primary} />
          ) : (
            <Text style={[styles.rsvpBtnText, { color: isGoing ? "#fff" : colors.primary }]}>
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
    width: 260,
    borderRadius: 16,
    overflow: "hidden",
    marginRight: 14,
  },

  // Image
  imageWrap:        { position: "relative" },
  image:            { width: "100%", height: 155 },
  imageFallback:    { backgroundColor: "#2C2C2E", alignItems: "center", justifyContent: "center" },
  imageFallbackEmoji: { fontSize: 42 },
  imageGradient:    { borderRadius: 0 },

  // Overlays
  rsvpPill: {
    position: "absolute",
    top: 10,
    right: 10,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  rsvpPillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  dateOverlay: {
    position: "absolute",
    bottom: 10,
    left: 12,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // Footer
  footer: {
    padding: 12,
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.92)",
    lineHeight: 21,
  },

  // RSVP button
  rsvpBtn: {
    borderRadius: 22,
    borderWidth: 1.5,
    paddingVertical: 8,
    alignItems: "center",
  },
  rsvpBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});
