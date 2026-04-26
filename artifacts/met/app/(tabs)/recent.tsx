import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { EncounterRow } from "@/components/EncounterRow";
import { RequestsSheet } from "@/components/RequestsSheet";
import { ScanFab } from "@/components/ScanFab";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useVisibility } from "@/hooks/useVisibility";
import { useSubscription } from "@/lib/revenuecat";
import { DISCOVERY_RANGE_METERS } from "@/lib/storage";
import { FREE_VISIBLE_ENCOUNTERS, startOfTodayMs } from "@/lib/usage";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function RecentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { encounters, preferences } = useApp();
  const { isPlusSubscriber, isSubscriptionReady } = useSubscription();
  const { isVisible, toggle: toggleVisibility } = useVisibility();
  const [requestsOpen, setRequestsOpen] = useState(false);

  // Connected encounters live in the dedicated Connections tab, so the Recent
  // feed is now the "discover / pending" surface only. Plain `encounter`-status
  // rows additionally honour discovery range + auto-cleanup; pending requests
  // (sent/received) are always shown so the user never loses a live action.
  const sorted = useMemo(() => {
    const rangeM = DISCOVERY_RANGE_METERS[preferences.discoveryRange];
    const cutoff =
      preferences.autoCleanupDays > 0
        ? Date.now() - preferences.autoCleanupDays * DAY_MS
        : 0;
    return encounters
      .filter((e) => {
        if (e.status === "connected") return false;
        if (e.status === "encounter") {
          if (e.lastDistanceM > rangeM) return false;
          if (cutoff > 0 && e.lastSeenAt < cutoff) return false;
        }
        return true;
      })
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }, [encounters, preferences.discoveryRange, preferences.autoCleanupDays]);

  const pendingRequests = useMemo(
    () => encounters.filter((e) => e.status === "request_received").length,
    [encounters],
  );

  // Free users only see the most recent N encounters per *day* — the bucket
  // resets at midnight. Until RevenueCat resolves we show everything (we'd
  // rather over-show briefly than blink the list down for a paid user).
  const { visible, hiddenCount } = useMemo(() => {
    if (!isSubscriptionReady || isPlusSubscriber) {
      return { visible: sorted, hiddenCount: 0 };
    }
    const dayStart = startOfTodayMs();
    const today: typeof sorted = [];
    const earlier: typeof sorted = [];
    for (const e of sorted) {
      if (e.lastSeenAt >= dayStart) today.push(e);
      else earlier.push(e);
    }
    const todayVisible = today.slice(0, FREE_VISIBLE_ENCOUNTERS);
    const todayHidden = Math.max(0, today.length - todayVisible.length);
    return {
      visible: [...todayVisible, ...earlier],
      hiddenCount: todayHidden,
    };
  }, [sorted, isSubscriptionReady, isPlusSubscriber]);

  const webBot = Platform.OS === "web" ? 34 : 0;

  const handleBell = () => {
    setRequestsOpen(true);
  };

  const handleScan = () => {
    router.push("/scan");
  };

  const handleUpgrade = () => router.push("/paywall");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Recent Encounters"
        visibility={{ isVisible, onToggle: toggleVisibility }}
        actions={[{ icon: "bell", onPress: handleBell, badge: pendingRequests }]}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + webBot + 160,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {visible.length === 0 ? (
          <EmptyState
            icon="users"
            title="No encounters yet"
            description="Keep your beacon on. The next person you cross paths with will appear here."
          />
        ) : (
          <View style={styles.list}>
            {visible.map((e, idx) => (
              <View key={e.id}>
                <EncounterRow encounter={e} />
                {idx < visible.length - 1 ? (
                  <View
                    style={[
                      styles.separator,
                      { backgroundColor: colors.border },
                    ]}
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}

        {hiddenCount > 0 ? (
          <Pressable
            onPress={handleUpgrade}
            style={({ pressed }) => [
              styles.limitCard,
              {
                backgroundColor: colors.muted,
                borderColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={styles.limitIcon}>
              <Feather name="lock" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.limitTitle, { color: colors.foreground }]}>
                You&rsquo;ve reached today&rsquo;s limit
              </Text>
              <Text
                style={[styles.limitSub, { color: colors.mutedForeground }]}
              >
                {hiddenCount} more{" "}
                {hiddenCount === 1 ? "encounter" : "encounters"} hidden. Met
                Plus shows them all.
              </Text>
            </View>
            <View
              style={[styles.limitCta, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.limitCtaText}>Upgrade</Text>
            </View>
          </Pressable>
        ) : null}
      </ScrollView>
      <ScanFab onPress={handleScan} />
      <RequestsSheet
        visible={requestsOpen}
        onClose={() => setRequestsOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 4 },
  separator: { height: 1, marginLeft: 70 },
  limitCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 18,
  },
  limitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3DCC44",
    alignItems: "center",
    justifyContent: "center",
  },
  limitTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  limitSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  limitCta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  limitCtaText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
});
