/**
 * HubStatusBadge
 *
 * Displays a pill on the home screen when the user is currently at a
 * recognised Google Places venue (a "Hub").
 *
 * Shows:  📍 <Venue Name>  |  🔥 <Streak>
 *
 * Premium visual features:
 *   - Looping glow pulse behind the pill (opacity loop via Animated)
 *   - Scale-bounce on the 🔥 icon whenever the streak increments
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
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
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

  // Fade badge in/out on visibility change
  const badgeOpacity = React.useRef(new Animated.Value(0)).current;

  // Glow halo: loops 0.25 → 0.7 → 0.25
  const glowOpacity = React.useRef(new Animated.Value(0.25)).current;

  // Flame scale bounce on streak increment
  const flameScale = React.useRef(new Animated.Value(1)).current;
  const prevStreakRef = React.useRef<number | null>(null);

  // Fade in/out — spring for organic feel
  React.useEffect(() => {
    Animated.spring(badgeOpacity, {
      toValue: hubState ? 1 : 0,
      useNativeDriver: true,
      tension: 70,
      friction: 12,
    }).start();
  }, [hubState, badgeOpacity]);

  // Glow pulse loop — spring-driven recursive chain
  const glowActiveRef = React.useRef(true);
  React.useEffect(() => {
    if (!hubState) return;
    glowActiveRef.current = true;
    function pulseGlow(toValue: number) {
      if (!glowActiveRef.current) return;
      Animated.spring(glowOpacity, {
        toValue,
        useNativeDriver: true,
        tension: 18,
        friction: 10,
      }).start(({ finished }) => {
        if (finished && glowActiveRef.current) {
          pulseGlow(toValue === 0.7 ? 0.25 : 0.7);
        }
      });
    }
    pulseGlow(0.7);
    return () => {
      glowActiveRef.current = false;
    };
  }, [hubState, glowOpacity]);

  // Flame bounce on streak change
  React.useEffect(() => {
    if (!hubState) return;
    if (
      prevStreakRef.current !== null &&
      hubState.streak !== prevStreakRef.current
    ) {
      Animated.sequence([
        Animated.spring(flameScale, {
          toValue: 1.55,
          useNativeDriver: true,
          tension: 220,
          friction: 4,
        }),
        Animated.spring(flameScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();
    }
    prevStreakRef.current = hubState.streak;
  }, [hubState?.streak, flameScale]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hubState) return null;

  const handlePress = () => {
    if (hubState.isMock) return;
    router.push({
      pathname: "/leaderboard/[placeId]",
      params: { placeId: hubState.placeId, placeName: hubState.placeName },
    } as never);
  };

  return (
    <Animated.View
      style={{ opacity: badgeOpacity, marginHorizontal: 20, marginTop: 12 }}
    >
      <Pressable
        onPress={handlePress}
        disabled={hubState.isMock}
        accessibilityLabel={`Checked in at ${hubState.placeName}, ${hubState.streak} day streak. Tap to see leaderboard.`}
        accessibilityRole="button"
      >
        {/* Glow halo — sits behind the pill */}
        <Animated.View
          style={[
            styles.glow,
            { borderColor: colors.primary, opacity: glowOpacity },
          ]}
          pointerEvents="none"
        />

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

          {/* Animated flame + streak count */}
          <Animated.Text
            style={[styles.fireIcon, { transform: [{ scale: flameScale }] }]}
          >
            🔥
          </Animated.Text>
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
  glow: {
    position: "absolute",
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: 999,
    borderWidth: 2,
  },
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
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
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
