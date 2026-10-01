/**
 * /leaderboard/[placeId]
 *
 * Full-screen leaderboard for a hub. Receives placeId + placeName via
 * route params — the hub badge on the home screen links here.
 */

import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { LeaderboardScreen } from "@/components/LeaderboardScreen";
import { useTheme } from "@/contexts/ThemeContext";
import {
  isStoreScreenshotDemo,
  STORE_DEMO_LEADERBOARD,
  STORE_DEMO_PLACE_ID,
  STORE_DEMO_PLACE_NAME,
} from "@/lib/storeVenueDemo";

function StoreDemoLeaderboard({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const light = !isDark;

  return (
    <View style={[demoStyles.page, light && demoLight.page]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[demoStyles.topBar, light && demoLight.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onClose} style={demoStyles.iconButton} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={20} color={light ? "#252B36" : "#F8FAFC"} />
        </Pressable>
        <Text style={[demoStyles.topTitle, light && demoLight.ink]}>Venue leaderboard</Text>
        <Feather name="award" size={20} color={light ? "#A26921" : "#F5C45E"} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 22, paddingBottom: insets.bottom + 30 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[demoStyles.demoPill, light && demoLight.demoPill]}>
          <Feather name="layers" size={11} color={light ? "#6552AD" : "#C4B5FD"} />
          <Text style={[demoStyles.demoPillText, light && demoLight.accent]}>SAMPLE LEADERBOARD</Text>
        </View>
        <Text style={[demoStyles.venueName, light && demoLight.ink]}>{STORE_DEMO_PLACE_NAME}</Text>
        <Text style={[demoStyles.subtitle, light && demoLight.muted]}>This month · the community that keeps showing up</Text>

        <View style={[demoStyles.rewardCard, light && demoLight.rewardCard]}>
          <View style={[demoStyles.rewardIcon, light && demoLight.rewardIcon]}>
            <Feather name="gift" size={20} color={light ? "#A26921" : "#F7C968"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[demoStyles.rewardEyebrow, light && demoLight.rewardAccent]}>MONTHLY VENUE REWARD</Text>
            <Text style={[demoStyles.rewardTitle, light && demoLight.ink]}>Coffee & pastry for two</Text>
            <Text style={[demoStyles.rewardSub, light && demoLight.muted]}>Every visit adds to your progress</Text>
          </View>
          <Feather name="chevron-right" size={17} color={light ? "#797F8A" : "#94A3B8"} />
        </View>

        <View style={demoStyles.sectionRow}>
          <Text style={[demoStyles.sectionTitle, light && demoLight.ink]}>Community standings</Text>
          <Text style={[demoStyles.sectionHint, light && demoLight.accent]}>DEMO DATA</Text>
        </View>

        <View style={demoStyles.podium}>
          {STORE_DEMO_LEADERBOARD.slice(0, 3).map((entry, index) => (
            <View
              key={entry.uid}
              style={[
                demoStyles.podiumPerson,
                index === 0 ? demoStyles.podiumWinner : index === 1 ? demoStyles.podiumSecond : demoStyles.podiumThird,
                 light && demoLight.podiumPerson,
                 light && index === 0 && demoLight.podiumWinner,
              ]}
            >
              <View style={demoStyles.podiumAvatar}>
                <Avatar uri={entry.photoUrl} size={48} />
                <View style={[demoStyles.medal, light && demoLight.medal, index === 0 ? demoStyles.gold : index === 1 ? demoStyles.silver : demoStyles.bronze]}>
                  <Text style={demoStyles.medalText}>{entry.rank}</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={[demoStyles.podiumName, light && demoLight.ink]}>
                {entry.displayName.split(" ")[0]}
              </Text>
              <Text style={[demoStyles.podiumCount, light && demoLight.muted]}>{entry.checkinCount} visits</Text>
            </View>
          ))}
        </View>

        <View style={[demoStyles.rowsCard, light && demoLight.rowsCard]}>
          {STORE_DEMO_LEADERBOARD.map((entry, index) => (
            <View
              key={entry.uid}
              style={[
                demoStyles.entryRow,
                entry.uid === "store-demo-user" && demoStyles.currentUserRow,
                 light && demoLight.entryRow,
                 light && entry.uid === "store-demo-user" && demoLight.currentUserRow,
                index === STORE_DEMO_LEADERBOARD.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={[demoStyles.rankNumber, light && demoLight.muted]}>{String(entry.rank).padStart(2, "0")}</Text>
              <Avatar uri={entry.photoUrl} size={37} />
              <View style={{ flex: 1 }}>
                <Text style={[demoStyles.entryName, light && demoLight.ink]}>{entry.displayName}</Text>
                {entry.uid === "store-demo-user" ? (
                  <Text style={[demoStyles.youLabel, light && demoLight.accent]}>YOUR SAMPLE PROFILE</Text>
                ) : null}
              </View>
              <Text style={[demoStyles.entryCount, light && demoLight.ink]}>{entry.checkinCount}</Text>
              <Text style={[demoStyles.visitLabel, light && demoLight.muted]}>visits</Text>
            </View>
          ))}
        </View>
        <Text style={[demoStyles.disclaimer, light && demoLight.muted]}>
          Sample profiles and check-ins for product preview only.
        </Text>
      </ScrollView>
    </View>
  );
}

export default function LeaderboardRoute() {
  const router = useRouter();
  const { placeId, placeName } = useLocalSearchParams<{
    placeId: string;
    placeName?: string;
  }>();

  if (!placeId) return null;

  if (
    isStoreScreenshotDemo("leaderboard") &&
    placeId === STORE_DEMO_PLACE_ID
  ) {
    return <StoreDemoLeaderboard onClose={() => router.back()} />;
  }

  return (
    <LeaderboardScreen
      placeId={placeId}
      placeName={placeName ?? "Hub"}
      onClose={() => router.back()}
    />
  );
}

const demoStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0F0F12" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 17,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.08)",
  },
  iconButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#F8FAFC", fontSize: 16, fontFamily: "Inter_700Bold" },
  demoPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(167,139,250,.12)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,.24)",
  },
  demoPillText: { color: "#C4B5FD", fontSize: 9, letterSpacing: 1, fontFamily: "Inter_700Bold" },
  venueName: { color: "#F8FAFC", fontSize: 23, fontFamily: "Inter_700Bold", marginTop: 13 },
  subtitle: { color: "#8791A3", fontSize: 11, lineHeight: 17, marginTop: 5, fontFamily: "Inter_400Regular" },
  rewardCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 19,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(247,201,104,.28)",
    backgroundColor: "rgba(247,201,104,.075)",
  },
  rewardIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(247,201,104,.12)", alignItems: "center", justifyContent: "center" },
  rewardEyebrow: { color: "#E5BE67", fontSize: 8, letterSpacing: 1, fontFamily: "Inter_700Bold" },
  rewardTitle: { color: "#F8FAFC", fontSize: 13, marginTop: 4, fontFamily: "Inter_700Bold" },
  rewardSub: { color: "#98A2B3", fontSize: 9, marginTop: 3, fontFamily: "Inter_400Regular" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: "#F1F5F9", fontSize: 14, fontFamily: "Inter_700Bold" },
  sectionHint: { color: "#9B8ADD", fontSize: 8, letterSpacing: 1, fontFamily: "Inter_700Bold" },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    minHeight: 165,
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 6,
  },
  podiumPerson: { flex: 1, alignItems: "center", paddingHorizontal: 3, paddingTop: 12, borderTopLeftRadius: 14, borderTopRightRadius: 14, backgroundColor: "#1B1B20" },
  podiumWinner: { height: 148, borderColor: "rgba(245,196,94,.35)", borderWidth: 1, backgroundColor: "rgba(245,196,94,.075)" },
  podiumSecond: { height: 126 },
  podiumThird: { height: 112 },
  podiumAvatar: { marginBottom: 8 },
  medal: { position: "absolute", right: -3, bottom: -3, width: 19, height: 19, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#151519" },
  gold: { backgroundColor: "#F5C45E" },
  silver: { backgroundColor: "#CBD5E1" },
  bronze: { backgroundColor: "#D28A59" },
  medalText: { color: "#242127", fontSize: 9, fontFamily: "Inter_700Bold" },
  podiumName: { color: "#F1F5F9", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  podiumCount: { color: "#9CA3AF", fontSize: 9, marginTop: 3, fontFamily: "Inter_400Regular" },
  rowsCard: { overflow: "hidden", borderRadius: 15, backgroundColor: "#19191E", borderWidth: 1, borderColor: "rgba(255,255,255,.07)" },
  entryRow: { minHeight: 59, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.06)" },
  currentUserRow: { backgroundColor: "rgba(167,139,250,.11)" },
  rankNumber: { width: 20, color: "#8A93A2", fontSize: 10, textAlign: "center", fontFamily: "Inter_700Bold" },
  entryName: { color: "#F1F5F9", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  youLabel: { color: "#B9A8FF", fontSize: 7, marginTop: 3, letterSpacing: 0.8, fontFamily: "Inter_700Bold" },
  entryCount: { color: "#F1F5F9", fontSize: 14, fontFamily: "Inter_700Bold" },
  visitLabel: { color: "#8993A2", fontSize: 8, fontFamily: "Inter_400Regular" },
  disclaimer: { color: "#6E7786", fontSize: 9, lineHeight: 14, textAlign: "center", marginTop: 12, fontFamily: "Inter_400Regular" },
});

const demoLight = StyleSheet.create({
  page: { backgroundColor: "#F8F5EF" },
  topBar: { borderBottomColor: "#E8E3DA" },
  ink: { color: "#252B36" },
  muted: { color: "#717783" },
  accent: { color: "#6552AD" },
  rewardAccent: { color: "#91601D" },
  demoPill: { backgroundColor: "#EEE9F8", borderColor: "#DCD2F1" },
  rewardCard: { backgroundColor: "#FFF3DD", borderColor: "#EEDDBB" },
  rewardIcon: { backgroundColor: "#F8E5BF" },
  podiumPerson: { backgroundColor: "#FFFEFB", borderColor: "#E9E3D9", borderWidth: 1 },
  podiumWinner: { backgroundColor: "#FFF3DD", borderColor: "#E7CC97" },
  medal: { borderColor: "#FFFEFB" },
  rowsCard: { backgroundColor: "#FFFEFB", borderColor: "#E9E3D9" },
  entryRow: { borderBottomColor: "#EEE9E1" },
  currentUserRow: { backgroundColor: "#F1ECFA" },
});
