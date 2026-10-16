/**
 * VenueOwnerMarker
 *
 * Category-specific map pin for approved venue owners.
 * Shows a small badge indicator when the venue has an active reward or upcoming event.
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Marker } from "react-native-maps";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFonts } from "expo-font";
import { getVenueCategoryVisual } from "@/lib/venueCategories";

export interface VenueOwnerPoint {
  placeId: string;
  placeName: string;
  businessName: string;
  venueType?: string | null;
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
  const visual = getVenueCategoryVisual(venue.venueType);
  const isStar = visual.icon === "star";
  const [fontsLoaded] = useFonts(MaterialCommunityIcons.font);
  const [tracking, setTracking] = React.useState(true);
  React.useEffect(() => {
    setTracking(true);
    if (!fontsLoaded) return;
    // Let both native map implementations capture the loaded icon and badges,
    // then stop continuous snapshots to keep map scrolling inexpensive.
    const timer = setTimeout(() => setTracking(false), 250);
    return () => clearTimeout(timer);
  }, [fontsLoaded, visual.icon, venue.hasActiveReward, venue.hasUpcomingEvent]);

  return (
    <Marker
      key={`vo-${venue.placeId}`}
      coordinate={{ latitude: venue.lat, longitude: venue.lng }}
      anchor={{ x: 0.5, y: 1 }}
      onPress={() => onPress?.(venue.placeId)}
      tracksViewChanges={tracking}
      accessibilityLabel={`${venue.businessName}, ${visual.label}`}
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

        {isStar ? (
          <View style={styles.star}>
            <MaterialCommunityIcons name="star" size={44} color="white" />
            <View style={styles.starFill}>
              <MaterialCommunityIcons name="star" size={36} color={visual.color} />
            </View>
          </View>
        ) : (
          <>
            <View style={[styles.pin, { backgroundColor: visual.color, borderColor: "white", shadowColor: visual.color }]}>
              <MaterialCommunityIcons name={visual.icon} size={20} color="white" />
            </View>
            <View style={[styles.tail, { borderTopColor: visual.color }]} />
          </>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  star: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#805B0A",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  starFill: {
    position: "absolute",
    top: 4,
    left: 4,
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
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
});
