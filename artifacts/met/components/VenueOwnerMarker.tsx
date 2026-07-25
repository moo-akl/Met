/**
 * VenueOwnerMarker
 *
 * Gold/branded map pin for approved venue owners.
 * Shows a small badge indicator when the venue has an active reward or upcoming event.
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Marker } from "react-native-maps";

export interface VenueOwnerPoint {
  placeId: string;
  placeName: string;
  businessName: string;
  tagline?: string | null;
  logoUrl?: string | null;
  lat: number;
  lng: number;
  hasActiveReward: boolean;
  hasUpcomingEvent: boolean;
}

interface Props {
  venue: VenueOwnerPoint;
  onPress?: (placeId: string) => void;
}

export function VenueOwnerMarker({ venue, onPress }: Props) {
  const hasBadge = venue.hasActiveReward || venue.hasUpcomingEvent;

  return (
    <Marker
      key={`vo-${venue.placeId}`}
      coordinate={{ latitude: venue.lat, longitude: venue.lng }}
      anchor={{ x: 0.5, y: 1 }}
      onPress={() => onPress?.(venue.placeId)}
      tracksViewChanges={false}
    >
      <View style={styles.container}>
        {/* Badge: reward 🎁, event 📅, or both */}
        {hasBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {venue.hasActiveReward ? "🎁" : "📅"}
            </Text>
          </View>
        )}

        {/* Gold pin body */}
        <View style={styles.pin}>
          <Text style={styles.pinIcon}>⭐</Text>
        </View>

        {/* Pin tail */}
        <View style={styles.tail} />
      </View>
    </Marker>
  );
}

const GOLD = "#FFD700";
const GOLD_DARK = "#B8860B";

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: -10,
    right: -10,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    borderWidth: 1,
    borderColor: "#fff",
  },
  badgeText: {
    fontSize: 9,
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GOLD,
    borderWidth: 2.5,
    borderColor: GOLD_DARK,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GOLD,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  pinIcon: {
    fontSize: 18,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: GOLD_DARK,
    marginTop: -1,
  },
});
