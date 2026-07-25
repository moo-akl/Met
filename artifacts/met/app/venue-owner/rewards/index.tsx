/**
 * Venue Owner Rewards List
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, type VenueReward } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";

const STATUS_COLOR: Record<string, string> = {
  draft: "rgba(255,255,255,0.3)",
  active: "#34C759",
  completed: "#FFD700",
  cancelled: "#FF3B30",
};

export default function VenueOwnerRewardsScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, isLoading: ownerLoading } = useVenueOwner();
  const [rewards, setRewards] = useState<VenueReward[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRewards = useCallback(async () => {
    if (!authedUid || !profile?.placeId) return;
    setLoading(true);
    try {
      const data = await api.getVenueRewards({ uid: authedUid }, profile.placeId);
      setRewards(data.rewards);
    } finally {
      setLoading(false);
    }
  }, [authedUid, profile?.placeId]);

  useEffect(() => {
    if (!ownerLoading) void fetchRewards();
  }, [ownerLoading, fetchRewards]);

  const handleCancel = (rewardId: number) => {
    Alert.alert("Cancel Reward?", "This will cancel the reward campaign.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Reward",
        style: "destructive",
        onPress: async () => {
          if (!authedUid) return;
          try {
            await api.updateVenueReward({ uid: authedUid }, rewardId, { status: "cancelled" });
            setRewards((prev) => prev.map((r) => r.id === rewardId ? { ...r, status: "cancelled" } : r));
          } catch {
            Alert.alert("Error", "Failed to cancel reward");
          }
        },
      },
    ]);
  };

  if (ownerLoading || loading) {
    return (
      <View style={[styles.center, { backgroundColor: "#0F0F12", paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Rewards</Text>
        <Pressable
          onPress={() => router.push("/venue-owner/rewards/new" as never)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </Pressable>
      </View>

      <FlatList
        data={rewards}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎁</Text>
            <Text style={styles.emptyText}>No reward campaigns yet</Text>
            <Pressable
              onPress={() => router.push("/venue-owner/rewards/new" as never)}
              style={[styles.emptyBtn, { borderColor: colors.primary }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primary }]}>Create your first reward</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.07)" }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.cardHeader}>
                <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                <Text style={[styles.statusChip, { color: STATUS_COLOR[item.status] ?? "#fff", borderColor: STATUS_COLOR[item.status] ?? "#fff" }]}>
                  {item.status}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.cardPrize}>{item.prizeDescription}</Text>
              <Text style={styles.cardDates}>
                {new Date(item.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" → "}
                {new Date(item.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </Text>
              {item.winnerUid && (
                <Text style={[styles.winnerLabel, { color: "#FFD700" }]}>🏆 Winner selected</Text>
              )}
            </View>
            {item.status === "active" && (
              <Pressable onPress={() => handleCancel(item.id)} hitSlop={8} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>✕</Text>
              </Pressable>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  backText: { color: "rgba(255,255,255,0.55)", fontSize: 15 },
  title: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  addBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  list: { padding: 16, gap: 10 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "flex-start" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { flex: 1, color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusChip: { fontSize: 11, fontFamily: "Inter_600SemiBold", borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, textTransform: "uppercase" },
  cardPrize: { color: "#FFD700", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  cardDates: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular" },
  winnerLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  cancelBtn: { padding: 4 },
  cancelBtnText: { color: "rgba(255,255,255,0.4)", fontSize: 18 },
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "rgba(255,255,255,0.4)", fontSize: 16, marginBottom: 20 },
  emptyBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
