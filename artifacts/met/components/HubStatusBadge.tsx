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
import { type HubState, type VenueResult } from "@/hooks/useHubCheckin";
import { SelectVenueModal } from "@/components/SelectVenueModal";
import { EnhancedHubSheet } from "@/components/EnhancedHubSheet";
import { useColors } from "@/hooks/useColors";
import { useSessionCount } from "@/hooks/useSessionCount";
import { useT } from "@/lib/i18n";
import {
  dismissDiscoveryHints,
  initDiscoveryState,
  isDiscoveryDismissedSync,
  subscribeDiscovery,
} from "@/lib/discoveryHints";

// Re-export so callers can import both from one file if needed.
export { useHubCheckin } from "@/hooks/useHubCheckin";

/** Formats a cooldown duration (in minutes) as a short human-readable string.
 *  240 → "4h", 135 → "2h 15m", 45 → "45m"
 */
function formatCooldown(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

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

interface HubStatusBadgeProps {
  hubState: HubState | null;
  cooldownMinutes: number | null;
  pendingVenues: VenueResult[] | null;
  confirmVenue: (venue: VenueResult) => void;
  cancelVenueSelection: () => void;
}

function HubStatusBadgeInner({
  hubState,
  cooldownMinutes,
  pendingVenues,
  confirmVenue,
  cancelVenueSelection,
}: HubStatusBadgeProps) {
  const colors = useColors();
  const router = useRouter();
  const { t } = useT();
  const sessionCount = useSessionCount();

  // Fade badge in/out on visibility change
  const badgeOpacity = React.useRef(new Animated.Value(0)).current;

  // Glow halo: loops 0.25 → 0.7 → 0.25
  const glowOpacity = React.useRef(new Animated.Value(0.25)).current;

  // Flame scale bounce on streak increment
  const flameScale = React.useRef(new Animated.Value(1)).current;
  const prevStreakRef = React.useRef<number | null>(null);

  // Tooltip — "Tap to compete!" shown for first 3 sessions
  const [tooltipVisible, setTooltipVisible] = React.useState(false);
  const [discoveryDismissed, setDiscoveryDismissed] = React.useState(
    isDiscoveryDismissedSync,
  );
  const tooltipOpacity = React.useRef(new Animated.Value(0)).current;
  const tooltipCheckedRef = React.useRef(false);

  // Fade in/out — spring for organic feel; visible when either hubState or cooldown is present
  const badgeVisible = !!hubState || (cooldownMinutes !== null && cooldownMinutes > 0);
  React.useEffect(() => {
    Animated.spring(badgeOpacity, {
      toValue: badgeVisible ? 1 : 0,
      useNativeDriver: true,
      tension: 70,
      friction: 12,
    }).start();
  }, [badgeVisible, badgeOpacity]);

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

  // Subscribe to real-time discovery dismissal (e.g. from HomeTabIcon tap)
  React.useEffect(() => {
    initDiscoveryState()
      .then(() => {
        if (isDiscoveryDismissedSync()) setDiscoveryDismissed(true);
      })
      .catch(() => {});
    return subscribeDiscovery(() => {
      setDiscoveryDismissed(true);
      fadeOutTooltip();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show "Tap to compete!" tooltip for sessions 1–3 unless already dismissed
  React.useEffect(() => {
    if (!hubState || tooltipCheckedRef.current) return;
    if (sessionCount === 0) return;
    if (sessionCount > 3) return;
    if (discoveryDismissed) return;
    tooltipCheckedRef.current = true;
    setTooltipVisible(true);
    Animated.timing(tooltipOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    // Auto-hide after 4 s — visual only, does NOT persist dismissal
    const timer = setTimeout(() => fadeOutTooltip(), 4000);
    return () => clearTimeout(timer);
  }, [hubState, sessionCount, discoveryDismissed, tooltipOpacity]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Fade the tooltip out visually — does NOT persist to storage. */
  const fadeOutTooltip = React.useCallback(() => {
    Animated.timing(tooltipOpacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setTooltipVisible(false));
  }, [tooltipOpacity]);

  // Cooldown pill — shown when the server rejected a re-check-in (403 cooldown)
  // and there is no active hub state to display.
  if (!hubState && cooldownMinutes !== null && cooldownMinutes > 0) {
    const timeLabel = formatCooldown(cooldownMinutes);
    return (
      <>
        <SelectVenueModal
          visible={pendingVenues !== null && pendingVenues.length > 0}
          venues={pendingVenues ?? []}
          onSelect={confirmVenue}
          onDismiss={cancelVenueSelection}
        />
        <Animated.View
          style={{ opacity: badgeOpacity, marginHorizontal: 20, marginTop: 12 }}
        >
          <View
            style={[
              styles.pill,
              styles.cooldownPill,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            accessibilityLabel={t("checkin.cooldownRemaining", { time: timeLabel })}
          >
            <Text style={styles.icon}>⏳</Text>
            <Text
              numberOfLines={1}
              style={[styles.cooldownText, { color: colors.mutedForeground }]}
            >
              {t("checkin.cooldownRemaining", { time: timeLabel })}
            </Text>
          </View>
        </Animated.View>
      </>
    );
  }

  if (!hubState && pendingVenues === null) {
    return null;
  }

  if (!hubState) {
    return (
      <SelectVenueModal
        visible={pendingVenues !== null && pendingVenues.length > 0}
        venues={pendingVenues ?? []}
        onSelect={confirmVenue}
        onDismiss={cancelVenueSelection}
      />
    );
  }

  const [partnerSheetOpen, setPartnerSheetOpen] = React.useState(false);

  const handlePress = () => {
    // Tapping the badge is user intent — permanently dismiss both hints
    dismissDiscoveryHints();
    if (hubState.isMock) return;
    // Verified partner hub → open the Enhanced Hub Sheet
    if (hubState.businessProfile?.isActiveSubscription) {
      setPartnerSheetOpen(true);
      return;
    }
    router.push({
      pathname: "/leaderboard/[placeId]",
      params: { placeId: hubState.placeId, placeName: hubState.placeName },
    } as never);
  };

  const handleLeaderboardFromSheet = React.useCallback(() => {
    setPartnerSheetOpen(false);
    setTimeout(() => {
      router.push({
        pathname: "/leaderboard/[placeId]",
        params: { placeId: hubState.placeId, placeName: hubState.placeName },
      } as never);
    }, 120);
  }, [hubState.placeId, hubState.placeName, router]);

  return (
    <>
      {/* Modal renders on top regardless of whether a hub badge is already active */}
      <SelectVenueModal
        visible={pendingVenues !== null && pendingVenues.length > 0}
        venues={pendingVenues ?? []}
        onSelect={confirmVenue}
        onDismiss={cancelVenueSelection}
      />

      {hubState.businessProfile?.isActiveSubscription ? (
        <EnhancedHubSheet
          visible={partnerSheetOpen}
          onClose={() => setPartnerSheetOpen(false)}
          businessProfile={hubState.businessProfile}
          placeName={hubState.placeName}
          isCheckedIn
          onViewLeaderboard={handleLeaderboardFromSheet}
        />
      ) : null}
      <Animated.View
        style={{ opacity: badgeOpacity, marginHorizontal: 20, marginTop: 12 }}
      >
      {tooltipVisible && (
        <Animated.View
          style={[
            styles.tooltip,
            { backgroundColor: colors.primary, opacity: tooltipOpacity },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.tooltipText, { color: colors.primaryForeground }]}>
            {t("valueTour.hubTooltip")}
          </Text>
          <View style={[styles.tooltipArrow, { borderTopColor: colors.primary }]} />
        </Animated.View>
      )}
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
    </>
  );
}

export function HubStatusBadge(props: HubStatusBadgeProps) {
  return (
    <HubErrorBoundary>
      <HubStatusBadgeInner {...props} />
    </HubErrorBoundary>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    alignSelf: "center",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tooltipText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  tooltipArrow: {
    position: "absolute",
    bottom: -7,
    alignSelf: "center",
    left: "50%",
    marginLeft: -7,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
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
  cooldownPill: {
    opacity: 0.75,
  },
  cooldownText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    flexShrink: 1,
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
