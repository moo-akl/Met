/**
 * /leaderboard/[placeId]
 *
 * Full-screen leaderboard for a hub. Receives placeId + placeName via
 * route params — the hub badge on the home screen links here.
 */

import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";

import { LeaderboardScreen } from "@/components/LeaderboardScreen";

export default function LeaderboardRoute() {
  const router = useRouter();
  const { placeId, placeName } = useLocalSearchParams<{
    placeId: string;
    placeName?: string;
  }>();

  if (!placeId) return null;

  return (
    <LeaderboardScreen
      placeId={placeId}
      placeName={placeName ?? "Hub"}
      onClose={() => router.back()}
    />
  );
}
