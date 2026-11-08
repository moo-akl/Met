/**
 * Venue Owner Rewards List
 *
 * Aurora (dark):  deep #0A0518 bg, translucent glass cards, white typography.
 * Signal (light): #FAFAF8 editorial bg, rule-separated rows, #0D0D0D typography.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Feather } from "@expo/vector-icons";
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
import { useTheme } from "@/contexts/ThemeContext";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";

const GREEN = "#00E87A";

export default function VenueOwnerRewardsScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, isLoading: ownerLoading, error: ownerError } = useVenueOwner();
  const [rewards, setRewards] = useState<VenueReward[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Venue theme tokens ──────────────────────────────────────────────────────
  const vBg         = isDark ? "#0A0518"                : "#FAFAF8";
  const vCard       = isDark ? "rgba(255,255,255,0.06)" : "#fff";
  const vCardBorder = isDark ? "rgba(255,255,255,0.1)"  : "rgba(0,0,0,0.08)";
  const vText       = isDark ? "#fff"                   : "#0D0D0D";
  const vMuted      = isDark ? "rgba(255,255,255,0.4)"  : "rgba(0,0,0,0.38)";
  const vEmpty      = isDark ? "rgba(255,255,255,0.4)"  : "rgba(0,0,0,0.38)";
  const accent      = isDark ? colors.primary           : GREEN;

  // Status colours adapted per theme
  const STATUS_COLOR: Record<string, string> = isDark ? {
    draft: "rgba(255,255,255,0.3)",
    active: "#34C759",
    completed: "#FFD700",
    cancelled: "#FF3B30",
  } : {
    draft: "rgba(0,0,0,0.28)",
    active: "#16A34A",
    completed: "#B45309",
    cancelled: "#DC2626",
  };

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
      <View style={[styles.root, { backgroundColor: vBg }]}>
        <VenueOwnerHeader title="Rewards" />
        <View style={styles.center}>
          <ActivityIndicator color={accent} />
        </View>
      </View>
    );
  }

  if (ownerError || !profile) {
    return (
      <View style={[styles.root, { backgroundColor: vBg }]}>
        <VenueOwnerHeader title="Rewards" />
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: vEmpty }]}>We couldn't refresh your venue access.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: vBg }]}>
      <VenueOwnerHeader
        title="Rewards"
        onBack={() => router.back()}
        rightAction={
          <Pressable
            testID="venue-owner-new-reward"
            onPress={() => router.push("/venue-owner/rewards/new" as never)}
            style={[styles.addBtn, { backgroundColor: accent }]}
          >
            <Text style={[styles.addBtnText, { color: isDark ? "#fff" : "#0D0D0D" }]}>+ New</Text>
          </Pressable>
        }
      />

      <FlatList
        data={rewards}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="gift" size={38} color={accent} style={styles.emptyEmoji} />
            <Text style={[styles.emptyText, { color: vEmpty }]}>No reward campaigns yet</Text>
            <Pressable
              onPress={() => router.push("/venue-owner/rewards/new" as never)}
              style={[styles.emptyBtn, { borderColor: accent }]}
            >
              <Text style={[styles.emptyBtnText, { color: accent }]}>Create your first reward</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: vCard, borderColor: vCardBorder }]}>
            <View style={{ flex: 1 }}>
              <View style={styles.cardHeader}>
                <Text numberOfLines={1} style={[styles.cardTitle, { color: vText }]}>{item.title}</Text>
                <Text style={[styles.statusChip, { color: STATUS_COLOR[item.status] ?? vText, borderColor: STATUS_COLOR[item.status] ?? vText }]}>
                  {item.status}
                </Text>
              </View>
              <Text numberOfLines={1} style={[styles.cardPrize, { color: isDark ? "#FFD700" : "#B45309" }]}>{item.prizeDescription}</Text>
              <Text style={[styles.cardDates, { color: vMuted }]}>
                {new Date(item.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" → "}
                {new Date(item.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </Text>
              {item.winnerUid && (
                <View style={styles.winnerRow}>
                  <Feather name="award" size={14} color={isDark ? "#FFD700" : "#B45309"} />
                  <Text style={[styles.winnerLabel, { color: isDark ? "#FFD700" : "#B45309" }]}>Winner selected</Text>
                </View>
              )}
            </View>
            <View style={styles.cardActions}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: `/venue-owner/rewards/${item.id}` as never,
                    params: {
                      id: String(item.id),
                      title: item.title,
                      description: item.description ?? "",
                      prizeDescription: item.prizeDescription,
                      rewardType: item.rewardType,
                      status: item.status,
                      startDate: item.startDate,
                      endDate: item.endDate,
                      venueTimezone: item.venueTimezone,
                    },
                  })
                }
                hitSlop={8}
                style={styles.editBtn}
              >
                  <Feather name="edit-2" size={16} color={accent} />
              </Pressable>
              {item.status === "active" && (
                <Pressable onPress={() => handleCancel(item.id)} hitSlop={8} style={styles.cancelBtn}>
                  <Feather name="x" size={18} color={vMuted} />
                </Pressable>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  addBtn: { minHeight: 40, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  list: { paddingHorizontal: 18, paddingVertical: 12, gap: 10 },
  card: {
    borderTopLeftRadius: 28,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    shadowColor: "rgba(139,92,246,0.15)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusChip: { fontSize: 11, fontFamily: "Inter_600SemiBold", borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, textTransform: "uppercase" },
  cardPrize: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  cardDates: { fontSize: 12, fontFamily: "Inter_400Regular" },
  winnerRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  winnerLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cardActions: { flexDirection: "column", alignItems: "center", gap: 4 },
  editBtn: { minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center" },
  cancelBtn: { minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyEmoji: { marginBottom: 12 },
  emptyText: { fontSize: 16, marginBottom: 20, fontFamily: "Inter_400Regular" },
  emptyBtn: { minHeight: 44, borderWidth: 1, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
