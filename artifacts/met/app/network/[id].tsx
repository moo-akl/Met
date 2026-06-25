import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  useGetNetwork,
  useJoinNetwork,
  useLeaveNetwork,
  useListNetworkMembers,
} from "@workspace/api-client-react";

export default function NetworkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const networkId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const { data: network, isLoading, refetch } = useGetNetwork(networkId);

  const { data: members, isLoading: membersLoading } =
    useListNetworkMembers(networkId);

  const joinMutation = useJoinNetwork();
  const leaveMutation = useLeaveNetwork();

  async function handleJoin() {
    if (!network) return;
    setJoining(true);
    try {
      await joinMutation.mutateAsync({ id: networkId });
      await refetch();
    } finally {
      setJoining(false);
    }
  }

  function handleLeave() {
    if (!network) return;
    Alert.alert(
      t("networks.leaveConfirmTitle"),
      t("networks.leaveConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("networks.leaveConfirmOk"),
          style: "destructive",
          onPress: async () => {
            setLeaving(true);
            try {
              await leaveMutation.mutateAsync({ id: networkId });
              await refetch();
            } finally {
              setLeaving(false);
            }
          },
        },
      ],
    );
  }

  if (isLoading || isNaN(networkId)) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!network) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <Text style={{ color: colors.mutedForeground }}>
          Network not found.
        </Text>
      </View>
    );
  }

  const membership = network.myMembership;
  const isActive = membership?.status === "active";
  const isPending = membership?.status === "pending";
  const isAdmin = membership?.role === "admin";

  const catIcons: Record<string, string> = {
    university: "book",
    work: "briefcase",
    neighborhood: "map-pin",
    custom: "users",
  };
  const catIcon = catIcons[network.category] ?? "users";
  const catKey =
    `networks.category${network.category.charAt(0).toUpperCase()}${network.category.slice(1)}` as never;
  const catLabel = t(catKey);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* Hero card */}
      <View
        style={[
          styles.hero,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.heroIcon,
            { backgroundColor: colors.primary + "18" },
          ]}
        >
          <Feather name={catIcon as never} size={32} color={colors.primary} />
        </View>
        <Text style={[styles.heroName, { color: colors.foreground }]}>
          {network.name}
        </Text>
        <View style={styles.heroMeta}>
          <View style={[styles.chip, { backgroundColor: colors.primary + "15" }]}>
            <Text style={[styles.chipText, { color: colors.primary }]}>
              {catLabel}
            </Text>
          </View>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {t("networks.members_other", { count: network.memberCount })}
          </Text>
        </View>
        {!!network.neighborhoodName && (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text
              style={[styles.locationText, { color: colors.mutedForeground }]}
            >
              {network.neighborhoodName}
            </Text>
          </View>
        )}
        {!!network.description && (
          <Text
            style={[styles.description, { color: colors.mutedForeground }]}
          >
            {network.description}
          </Text>
        )}
      </View>

      {/* Action button */}
      {!isAdmin && (
        <View style={styles.actionWrap}>
          {isActive ? (
            <Pressable
              style={[
                styles.actionBtn,
                styles.leaveBtn,
                { borderColor: colors.border },
              ]}
              onPress={handleLeave}
              disabled={leaving}
            >
              {leaving ? (
                <ActivityIndicator
                  color={colors.mutedForeground}
                  size="small"
                />
              ) : (
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {t("networks.leaveButton")}
                </Text>
              )}
            </Pressable>
          ) : isPending ? (
            <View style={[styles.actionBtn, { backgroundColor: colors.muted }]}>
              <Text
                style={[
                  styles.actionBtnText,
                  { color: colors.mutedForeground },
                ]}
              >
                {t("networks.pendingBadge")}
              </Text>
            </View>
          ) : (
            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.actionBtnText, { color: "#fff" }]}>
                  {t("networks.joinButton")}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      {/* Members section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {t("networks.membersTitle")}
        </Text>
        {membersLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: 12 }}
          />
        ) : !members || members.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No members yet.
          </Text>
        ) : (
          <View
            style={[styles.membersList, { borderColor: colors.border }]}
          >
            {members.map((m, i) => (
              <View
                key={m.uid}
                style={[
                  styles.memberRow,
                  {
                    borderBottomColor: colors.border,
                    borderBottomWidth: i < members.length - 1 ? 1 : 0,
                  },
                ]}
              >
                <Avatar
                  uri={m.profile.photoUrl ?? undefined}
                  size={40}
                  fallbackText={m.profile.displayName}
                />
                <View style={styles.memberInfo}>
                  <Text
                    style={[styles.memberName, { color: colors.foreground }]}
                  >
                    {m.profile.displayName}
                  </Text>
                  {m.role === "admin" && (
                    <Text
                      style={[styles.memberRole, { color: colors.primary }]}
                    >
                      {t("networks.adminBadge")}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: { fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center" },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  actionWrap: { alignItems: "stretch" },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveBtn: { borderWidth: 1 },
  actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  membersList: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: "Inter_500Medium", fontSize: 15 },
  memberRole: { fontFamily: "Inter_400Regular", fontSize: 12 },
});
