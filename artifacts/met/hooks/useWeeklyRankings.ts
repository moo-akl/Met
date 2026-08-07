/**
 * useWeeklyRankings
 *
 * Fetches the user's final ranking and check-in count for every venue they
 * checked into during the previous calendar week (Mon–Sun).
 */

import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { api } from "@/lib/api/client";

export type WeeklyRanking = {
  placeId: string;
  placeName: string | null;
  rank: number;
  checkinCount: number;
  weekStart: string;
};

export function useWeeklyRankings() {
  const { authedUid } = useApp();

  return useQuery<WeeklyRanking[], Error>({
    queryKey: ["weeklyRankings", authedUid],
    queryFn: () => api.getWeeklyRankings({ uid: authedUid ?? "" }, authedUid!),
    enabled: !!authedUid,
    staleTime: 5 * 60 * 1000,  // 5 minutes — venue data is stable
    gcTime: 10 * 60 * 1000,   // keep in cache 10 min after unmount for instant re-render
  });
}
