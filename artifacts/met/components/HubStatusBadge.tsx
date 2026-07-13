/**
 * HubStatusBadge
 *
 * Displays a pill on the home screen when the user is currently at a
 * recognised Google Places venue (a "Hub").
 *
 * Shows:  📍 <Venue Name>  |  🔥 <Streak>
 *
 * Hides itself (returns null) when:
 *   - No hub is found within 50 m
 *   - Location permission is not granted
 *   - The server is unreachable in production
 *
 * In __DEV__ builds, a failed API call produces a "Mock Check-in" state
 * (isMock: true) so the badge is always visible for UI testing. A small
 * orange "MOCK" label is shown in that case.
 */

import { useRouter } from "expo-router";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
} from "react-native";
import { useHubCheckin } from "@/hooks/useHubCheckin";
import { useColors } from "@/hooks/useColors";

// Re-export so callers can import both from one file if needed.
export { useHubCheckin } from "@/hooks/useHubCheckin";

class HubErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function HubStatusBadgeInner() {
  const colors = useColors();
  const router = useRouter();
  const { hubState } = useHubCheckin();

  // Fade the badge in when it first appears and out when it disappears.
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: hubState ? 1 : 0,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [hubState, opacity]);

  if (!hubState) return null;

  const handlePress = () => {
    if (hubState.isMock) return;
    router.push({
      pathname: "/leaderboard/[placeId]",
      params: { placeId: hubState.placeId, placeName: hubState.placeName },
    } as never);
  };

  return (
    <Animated.View style={{ opacity, marginHorizontal: 20, marginTop: 12 }}>
      <Pressable
        onPress={handlePress}
        disabled={hubState.isMock}
        accessibilityLabel={`Checked in at ${hubState.placeName}, ${hubState.streak} day streak. Tap to see leaderboard.`}
        accessibilityRole="button"
      >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: colors.card,
            borderColor: colors.primary,
          },
        ]}
      >
        {/* Location icon + venue name */}
        <Text style={styles.icon}>📍</Text>
        <Text
          numberOfLines={1}
          style={[styles.placeName, { color: colors.foreground }]}
        >
          {hubState.placeName}
        </Text>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Streak */}
        <Text style={styles.fireIcon}>🔥</Text>
        <Text style={[styles.streakCount, { color: colors.primary }]}>
          {hubState.streak}
        </Text>

        {/* Dev-only MOCK label */}
        {hubState.isMock ? (
          <View style={styles.mockBadge}>
            <Text style={styles.mockText}>MOCK</Text>
          </View>
        ) : null}
      </View>
      </Pressable>
    </Animated.View>
  );
}

export function HubStatusBadge() {
  return (
    <HubErrorBoundary>
      <HubStatusBadgeInner />
    </HubErrorBoundary>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
  },
  icon: {
    fontSize: 14,
    lineHeight: 18,
  },
  placeName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    flexShrink: 1,
    maxWidth: 180,
  },
  divider: {
    width: 1,
    height: 14,
    borderRadius: 1,
  },
  fireIcon: {
    fontSize: 14,
    lineHeight: 18,
  },
  streakCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  mockBadge: {
    backgroundColor: "#F97316",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 2,
  },
  mockText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});
