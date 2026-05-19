import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { WelcomeEmptyState } from "@/components/WelcomeEmptyState";
import { EncounterRow } from "@/components/EncounterRow";
import { RequestsSheet } from "@/components/RequestsSheet";
import { ScanFab } from "@/components/ScanFab";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useVisibility } from "@/hooks/useVisibility";
import { useT } from "@/lib/i18n";
import { useSubscription } from "@/lib/revenuecat";
import { DISCOVERY_RANGE_METERS } from "@/lib/storage";
import { FREE_VISIBLE_ENCOUNTERS, startOfTodayMs } from "@/lib/usage";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// Filter values forwarded from Home → "This week" tiles. Anything else is
// ignored so direct tab navigation always shows the unfiltered feed.
type WeeklyFilter = "new" | "repeats" | null;

export default function RecentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { encounters, preferences, profile } = useApp();
  const { isPlusSubscriber, isSubscriptionReady } = useSubscription();
  const { isVisible, toggle: toggleVisibility } = useVisibility();
  const [requestsOpen, setRequestsOpen] = useState(false);

  const weeklyFilter: WeeklyFilter =
    params.filter === "new" || params.filter === "repeats"
      ? params.filter
      : null;
  const clearFilter = () => router.setParams({ filter: undefined });

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
    const weekAgo = Date.now() - WEEK_MS;
    return encounters
      .filter((e) => {
        if (e.status === "connected") return false;
        if (e.status === "encounter") {
          if (e.lastDistanceM > rangeM) return false;
          if (cutoff > 0 && e.lastSeenAt < cutoff) return false;
        }
        // Weekly tile filters from Home — Home shows counts of these exact
        // sets, so the filtered list mirrors the user's expectation.
        if (weeklyFilter === "new" && e.firstSeenAt < weekAgo) return false;
        if (
          weeklyFilter === "repeats" &&
          (e.encounterCount <= 1 || e.lastSeenAt < weekAgo)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }, [
    encounters,
    preferences.discoveryRange,
    preferences.autoCleanupDays,
    weeklyFilter,
  ]);

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

  const handleAddInterests = () => router.push("/(tabs)/profile");

  const showInterestsNudge =
    !!profile && (!profile.interests || profile.interests.length === 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("appHeader.titleRecent")}
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
        {weeklyFilter ? (
          <View
            style={[
              styles.filterChip,
              { backgroundColor: colors.muted, borderColor: colors.primary },
            ]}
          >
            <Feather
              name={weeklyFilter === "new" ? "user-plus" : "repeat"}
              size={14}
              color={colors.primary}
            />
            <Text style={[styles.filterChipText, { color: colors.foreground }]}>
              {t("recent.filterPrefix")} ·{" "}
              {weeklyFilter === "new"
                ? t("recent.filterNewLabel")
                : t("recent.filterRepeatsLabel")}
            </Text>
            <Pressable
              onPress={clearFilter}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("recent.clearFilterA11y")}
            >
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        {showInterestsNudge ? (
          <View
            style={[
              styles.nudgeCard,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.nudgeIcon,
                { backgroundColor: colors.primary },
              ]}
            >
              <Feather name="star" size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.nudgeTitle, { color: colors.foreground }]}>
                {t("recent.interestsNudgeTitle")}
              </Text>
              <Text
                style={[styles.nudgeSub, { color: colors.mutedForeground }]}
              >
                {t("recent.interestsNudgeBody")}
              </Text>
            </View>
            <Pressable
              onPress={handleAddInterests}
              style={({ pressed }) => [
                styles.nudgeBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("recent.interestsNudgeBtn")}
            >
              <Text style={styles.nudgeBtnText}>
                {t("recent.interestsNudgeBtn")}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {visible.length === 0 ? (
          // Brand-new user with zero encounters and no active filter →
          // show the full visual welcome. Otherwise fall back to the slim
          // EmptyState for filtered / no-match cases.
          encounters.length === 0 && !weeklyFilter ? (
            <WelcomeEmptyState
              title={t("recent.welcomeTitle")}
              description={t("recent.welcomeDesc")}
              hintIcon="eye"
              hint={t("recent.welcomeHint")}
            />
          ) : (
            <EmptyState
              icon="users"
              title={
                weeklyFilter === "new"
                  ? t("recent.emptyTitleNew")
                  : weeklyFilter === "repeats"
                    ? t("recent.emptyTitleRepeats")
                    : t("recent.emptyTitleAll")
              }
              description={
                weeklyFilter
                  ? t("recent.emptySubFiltered")
                  : t("recent.emptySubAll")
              }
            />
          )
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
                {t("recent.limitTitle")}
              </Text>
              <Text
                style={[styles.limitSub, { color: colors.mutedForeground }]}
              >
                {t(
                  hiddenCount === 1
                    ? "recent.limitSub_one"
                    : "recent.limitSub_other",
                  { count: hiddenCount },
                )}
              </Text>
            </View>
            <View
              style={[styles.limitCta, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.limitCtaText}>{t("recent.upgradeBtn")}</Text>
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
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginHorizontal: 4,
    marginBottom: 12,
  },
  filterChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
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
  nudgeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  nudgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  nudgeTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  nudgeSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  nudgeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  nudgeBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
});
