/**
 * VenueEventCard
 *
 * Compact card showing a venue event with image, title, date, RSVP count,
 * and an RSVP action button. Used in:
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
    <View style={[styles.card, { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.08)" }]}>
      {event.imageUrl ? (
        <Image
          source={{ uri: event.imageUrl }}
          style={styles.image}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.imageFallback, { backgroundColor: "#2C2C2E" }]}>
          <Text style={styles.imageFallbackEmoji}>📅</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.title}>
          {event.title}
        </Text>
        <Text style={[styles.date, { color: colors.primary }]}>
          {formatEventDate(event.startsAt)}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.rsvpCount}>
            {rsvpCount} {rsvpCount === 1 ? "going" : "going"}
          </Text>

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
              <Text
                style={[
                  styles.rsvpBtnText,
                  { color: isGoing ? "#fff" : colors.primary },
                ]}
              >
                {isGoing ? "✓ Going" : "RSVP"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 220,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginRight: 12,
  },
  image: {
    width: "100%",
    height: 110,
  },
  imageFallback: {
    width: "100%",
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  imageFallbackEmoji: {
    fontSize: 36,
  },
  content: {
    padding: 10,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.92)",
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rsvpCount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    fontFamily: "Inter_400Regular",
  },
  rsvpBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    minWidth: 68,
    alignItems: "center",
  },
  rsvpBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
