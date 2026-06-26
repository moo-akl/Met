import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  useApproveNetworkMember,
  useGetNetwork,
  useJoinNetwork,
  useLeaveNetwork,
  useListNetworkMembers,
  useListPendingMembers,
  useRemoveNetworkMember,
  useUpdateNetworkMemberRole,
} from "@workspace/api-client-react";

export default function NetworkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const networkId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const { allEncounters, profile } = useApp();
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const {
    data: network,
    isLoading,
    refetch,
  } = useGetNetwork(networkId);

  const {
    data: members,
    isLoading: membersLoading,
    refetch: refetchMembers,
  } = useListNetworkMembers(networkId);

  const isAdmin =
    network?.myMembership?.role === "admin" &&
    network?.myMembership?.status === "active";

  const {
    data: pendingMembers,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useListPendingMembers(networkId);

  const joinMutation = useJoinNetwork();
  const leaveMutation = useLeaveNetwork();
  const approveMutation = useApproveNetworkMember();
  const removeMutation = useRemoveNetworkMember();
  const roleMutation = useUpdateNetworkMemberRole();

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchMembers();
      if (isAdmin) refetchPending();
    }, [refetch, refetchMembers, refetchPending, isAdmin]),
  );

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

  async function handleApprove(uid: string, approve: boolean) {
    await approveMutation.mutateAsync({
      id: networkId,
      uid,
      data: { approve },
    });
    await Promise.all([refetch(), refetchPending(), refetchMembers()]);
  }

  function handleRemoveMember(uid: string, displayName: string) {
    Alert.alert(
      displayName,
      t("networks.removeMemberConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("networks.removeMemberConfirmOk"),
          style: "destructive",
          onPress: async () => {
            await removeMutation.mutateAsync({ id: networkId, uid });
            await Promise.all([refetch(), refetchMembers()]);
          },
        },
      ],
    );
  }

  function handleShareInvite() {
    if (!network?.inviteCode) return;
    const code = network.inviteCode;
    const message = `Join "${network.name}" on Met — use invite code ${code} or open: met://n/${code}`;
    Share.share({ message, title: `Join ${network.name}` }).catch(() => {});
  }

  function handleCopyCode() {
    if (!network?.inviteCode) return;
    Clipboard.setString(network.inviteCode);
    Alert.alert(t("common.copied"), network.inviteCode);
  }

  function handleMemberTap(uid: string) {
    if (uid === profile?.id) return;
    const encounter = allEncounters.find((e) => e.id === uid);
    if (encounter?.status === "connected") {
      router.push(`/connection/${uid}` as never);
    } else {
      router.push(`/encounter/${uid}` as never);
    }
  }

  function handleChangeRole(
    uid: string,
    currentRole: "admin" | "member",
  ) {
    const newRole = currentRole === "admin" ? "member" : "admin";
    const isPromoting = newRole === "admin";
    Alert.alert(
      t(isPromoting ? "networks.promoteConfirmTitle" : "networks.demoteConfirmTitle"),
      t(isPromoting ? "networks.promoteConfirmBody" : "networks.demoteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t(
            isPromoting ? "networks.promoteConfirmOk" : "networks.demoteConfirmOk",
          ),
          onPress: async () => {
            await roleMutation.mutateAsync({ id: networkId, uid, data: { role: newRole } });
            await refetchMembers();
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

  const pendingCount = pendingMembers?.length ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* Header row with back + edit buttons */}
      <View style={[styles.headerRow, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        {isAdmin && (
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/network/edit/[id]",
                params: { id: String(networkId) },
              } as never)
            }
            style={styles.headerBtn}
          >
            <Feather name="settings" size={20} color={colors.foreground} />
          </Pressable>
        )}
      </View>

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
        {network.requiresApproval && (
          <View style={styles.locationRow}>
            <Feather name="lock" size={13} color={colors.mutedForeground} />
            <Text
              style={[styles.locationText, { color: colors.mutedForeground }]}
            >
              {t("networks.approvalRequiredBadge")}
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
                  {network.requiresApproval
                    ? t("networks.requestToJoin")
                    : t("networks.joinButton")}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      {/* Invite code (admin only) */}
      {isAdmin && network.inviteCode && (
        <View style={[styles.inviteSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.inviteHeader}>
            <Feather name="link" size={16} color={colors.primary} />
            <Text style={[styles.inviteTitle, { color: colors.foreground }]}>
              {t("networks.inviteCodeTitle")}
            </Text>
          </View>
          <Text style={[styles.inviteSub, { color: colors.mutedForeground }]}>
            {t("networks.inviteCodeSub")}
          </Text>
          <Pressable
            style={[styles.codeBox, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={handleCopyCode}
          >
            <Text style={[styles.codeText, { color: colors.foreground }]}>
              {network.inviteCode}
            </Text>
            <Feather name="copy" size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            style={[styles.shareCodeBtn, { backgroundColor: colors.primary }]}
            onPress={handleShareInvite}
          >
            <Feather name="share-2" size={16} color="#fff" />
            <Text style={styles.shareCodeBtnText}>
              {t("networks.shareInviteLink")}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Pending join requests (admin only) */}
      {isAdmin && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {t("networks.pendingRequestsTitle")}
            </Text>
            {pendingCount > 0 && (
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: "#f59e0b22" },
                ]}
              >
                <Text style={[styles.countBadgeText, { color: "#f59e0b" }]}>
                  {pendingCount}
                </Text>
              </View>
            )}
          </View>
          {pendingLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginTop: 8 }}
            />
          ) : !pendingMembers || pendingMembers.length === 0 ? (
            <Text
              style={[styles.emptyText, { color: colors.mutedForeground }]}
            >
              {t("networks.noPendingRequests")}
            </Text>
          ) : (
            <View
              style={[styles.membersList, { borderColor: colors.border }]}
            >
              {pendingMembers.map((m, i) => (
                <View
                  key={m.uid}
                  style={[
                    styles.memberRow,
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth:
                        i < pendingMembers.length - 1 ? 1 : 0,
                    },
                  ]}
                >
                  <Avatar
                    uri={m.profile.photoUrl ?? undefined}
                    size={40}
                    fallbackText={m.profile.displayName}
                  />
                  <Text
                    style={[
                      styles.memberName,
                      { flex: 1, color: colors.foreground },
                    ]}
                  >
                    {m.profile.displayName}
                  </Text>
                  <Pressable
                    style={[
                      styles.adminActionBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={() => handleApprove(m.uid, true)}
                  >
                    <Text style={styles.adminActionBtnText}>
                      {t("networks.approveButton")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.adminActionBtn,
                      { backgroundColor: colors.muted, marginLeft: 6 },
                    ]}
                    onPress={() => handleApprove(m.uid, false)}
                  >
                    <Text
                      style={[
                        styles.adminActionBtnText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {t("networks.declineButton")}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
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
            {members.map((m, i) => {
              const isSelf = m.uid === profile?.id;
              const rowContent = (
                <>
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
                  {isSelf ? (
                    <Text style={[styles.youLabel, { color: colors.mutedForeground }]}>
                      {t("networks.youLabel")}
                    </Text>
                  ) : isAdmin && m.uid !== network.createdByUid ? (
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          m.profile.displayName,
                          undefined,
                          [
                            {
                              text: t(
                                m.role === "admin"
                                  ? "networks.demoteButton"
                                  : "networks.promoteButton",
                              ),
                              onPress: () =>
                                handleChangeRole(
                                  m.uid,
                                  m.role as "admin" | "member",
                                ),
                            },
                            {
                              text: t("networks.removeButton"),
                              style: "destructive",
                              onPress: () =>
                                handleRemoveMember(
                                  m.uid,
                                  m.profile.displayName,
                                ),
                            },
                            { text: t("common.cancel"), style: "cancel" },
                          ],
                        )
                      }
                      style={styles.moreBtn}
                    >
                      <Feather
                        name="more-vertical"
                        size={18}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  ) : (
                    <Feather
                      name="chevron-right"
                      size={16}
                      color={colors.mutedForeground}
                    />
                  )}
                </>
              );

              const rowStyle = [
                styles.memberRow,
                {
                  borderBottomColor: colors.border,
                  borderBottomWidth: i < members.length - 1 ? 1 : 0,
                },
              ];

              return isSelf ? (
                <View key={m.uid} style={rowStyle}>
                  {rowContent}
                </View>
              ) : (
                <Pressable
                  key={m.uid}
                  style={({ pressed }) => [
                    ...rowStyle,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleMemberTap(m.uid)}
                >
                  {rowContent}
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerBtn: { padding: 4 },
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
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
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
  moreBtn: { padding: 4 },
  adminActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  adminActionBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#fff",
  },
  youLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  inviteSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  inviteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inviteTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  inviteSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  codeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    letterSpacing: 4,
  },
  shareCodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  shareCodeBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
