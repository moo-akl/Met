/**
 * HubStatusBadge
 *
 * Displays a pill on the home screen when the user is currently at a
 * recognised Google Places venue (a "Hub").
 *
 * Shows the current venue with a quiet activity streak marker.
 *
 * The card follows the warm green Home surfaces and retains a soft entrance
 * transition plus the first-visit discovery hint.
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
import { Feather } from "@expo/vector-icons";
import React from "react";
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
import { type HubState, type VenueResult } from "@/hooks/useHubCheckin";
import { SelectVenueModal } from "@/components/SelectVenueModal";
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
              styles.cooldownCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            accessibilityLabel={t("checkin.cooldownRemaining", { time: timeLabel })}
          >
            <View style={[styles.statusIcon, { backgroundColor: colors.primarySoft }]}>
              <Feather name="clock" size={17} color={colors.primary} />
            </View>
            <View style={styles.statusCopy}>
              <Text style={[styles.statusEyebrow, { color: colors.mutedForeground }]}>CHECK-IN PAUSE</Text>
              <Text numberOfLines={1} style={[styles.cooldownText, { color: colors.foreground }]}>
                {t("checkin.cooldownRemaining", { time: timeLabel })}
              </Text>
            </View>
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

  const handlePress = () => {
    // Tapping the badge is user intent — permanently dismiss both hints
    dismissDiscoveryHints();
    if (hubState.isMock) return;
    router.push({
      pathname: "/leaderboard/[placeId]",
      params: { placeId: hubState.placeId, placeName: hubState.placeName },
    } as never);
  };

  const handleScanQr = () => {
    if (hubState.isMock) return;
    router.push({
      pathname: "/qr-scan",
      params: { placeId: hubState.placeId, placeName: hubState.placeName },
    } as never);
  };

  // Show the "Scan QR → Unlock Reward" prompt when at a registered venue
  // that hasn't been QR-verified yet this session.
  const showQrCta = hubState.isRegisteredVenue && !hubState.isQrVerified && !hubState.isMock;

  return (
    <>
      {/* Modal renders on top regardless of whether a hub badge is already active */}
      <SelectVenueModal
        visible={pendingVenues !== null && pendingVenues.length > 0}
        venues={pendingVenues ?? []}
        onSelect={confirmVenue}
        onDismiss={cancelVenueSelection}
      />
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
        accessibilityLabel={`Checked in at ${hubState.placeName}, ${hubState.streak} day streak. Tap to see visitors.`}
        accessibilityRole="button"
        style={({ pressed }) => pressed && !hubState.isMock ? { opacity: 0.88, transform: [{ scale: 0.99 }] } : undefined}
      >
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.statusIcon, { backgroundColor: colors.primarySoft }]}>
            <Feather name="map-pin" size={17} color={colors.primary} />
          </View>
          <View style={styles.statusCopy}>
            <Text style={[styles.statusEyebrow, { color: colors.mutedForeground }]}>YOU’RE AT</Text>
            <Text numberOfLines={1} style={[styles.placeName, { color: colors.foreground }]}>
              {hubState.placeName}
            </Text>
          </View>
          <View style={[styles.streakPill, { backgroundColor: colors.primarySoft }]}>
            <Feather name="activity" size={14} color={colors.primary} />
            <Text style={[styles.streakCount, { color: colors.primary }]}>{hubState.streak}</Text>
          </View>

          {/* Dev-only MOCK label */}
          {hubState.isMock ? (
            <View style={styles.mockBadge}>
              <Text style={styles.mockText}>MOCK</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* "Scan QR → Unlock Reward" CTA — shown when at a registered venue
          that hasn't been QR-verified yet this check-in session. */}
      {showQrCta && (
        <Pressable
          onPress={handleScanQr}
          style={({ pressed }) => [
            styles.qrCta,
            { backgroundColor: colors.primarySoft, opacity: pressed ? 0.82 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Scan the venue QR code to unlock your reward"
        >
          <Feather name="maximize" size={15} color={colors.primary} />
          <Text style={[styles.qrCtaText, { color: colors.primary }]}>
            You're here! Scan QR → Unlock Reward
          </Text>
          <Feather name="arrow-right" size={15} color={colors.primary} />
        </Pressable>
      )}
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
    alignSelf: "center", borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 9, marginBottom: 8, elevation: 2,
  },
  tooltipText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  tooltipArrow: {
    position: "absolute", bottom: -7, alignSelf: "center", left: "50%",
    marginLeft: -7, width: 0, height: 0, borderLeftWidth: 7,
    borderRightWidth: 7, borderTopWidth: 7,
    borderLeftColor: "transparent", borderRightColor: "transparent",
  },
  statusCard: {
    width: "100%", minHeight: 76, flexDirection: "row", alignItems: "center",
    gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20,
    borderWidth: 1,
  },
  statusIcon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  statusCopy: { flex: 1, minWidth: 0, gap: 3 },
  statusEyebrow: { fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 1.1 },
  placeName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    flexShrink: 1,
    maxWidth: "100%",
  },
  streakPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999 },
  streakCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  cooldownCard: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, padding: 13, borderRadius: 18, borderWidth: 1 },
  cooldownText: {
    fontFamily: "Inter_600SemiBold",
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
  qrCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9, marginTop: 9, paddingHorizontal: 13, paddingVertical: 12,
    borderRadius: 15,
  },
  qrCtaText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12, flex: 1,
  },
});
