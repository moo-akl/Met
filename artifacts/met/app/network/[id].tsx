import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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
  useRegenerateNetworkCode,
  useRemoveNetworkMember,
  useUpdateNetworkMemberRole,
} from "@workspace/api-client-react";

type Tab = "feed" | "members" | "info";

const CAT_COLORS: Record<string, string> = {
  university: "#3b82f6",
  work: "#8b5cf6",
  neighborhood: "#22c55e",
  custom: "#f59e0b",
};

const CAT_ICONS: Record<string, string> = {
  university: "book",
  work: "briefcase",
  neighborhood: "map-pin",
  custom: "users",
};

function NetworkTabs({
  active,
  tabs,
  onChange,
  colors,
}: {
  active: Tab;
  tabs: Array<{ key: Tab; label: string }>;
  onChange: (t: Tab) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const tabWidth = barWidth > 0 ? barWidth / tabs.length : 0;

  React.useEffect(() => {
    if (tabWidth === 0) return;
    const idx = tabs.findIndex((tab) => tab.key === active);
    Animated.spring(indicatorX, {
      toValue: idx * tabWidth,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  }, [active, tabWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      style={[
        styles.tabBar,
        { borderBottomColor: colors.border, backgroundColor: colors.background },
      ]}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={styles.tabBtn}
            onPress={() => onChange(tab.key)}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? colors.primary : colors.mutedForeground },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
      {barWidth > 0 && (
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              backgroundColor: colors.primary,
              width: tabWidth,
              transform: [{ translateX: indicatorX }],
            },
          ]}
        />
      )}
    </View>
  );
}

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
  const [activeTab, setActiveTab] = useState<Tab>("feed");

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
  const regenerateCodeMutation = useRegenerateNetworkCode();

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
    await approveMutation.mutateAsync({ id: networkId, uid, data: { approve } });
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
    const url = `https://metapp.replit.app/join/${code}`;
    const message = `Join "${network.name}" on Met — tap the link or use invite code ${code}\n${url}`;
    Share.share({ message, url, title: `Join ${network.name}` }).catch(() => {});
  }

  function handleCopyCode() {
    if (!network?.inviteCode) return;
    Clipboard.setString(network.inviteCode);
    Alert.alert(t("common.copied"), network.inviteCode);
  }

  function handleRegenerateCode() {
    Alert.alert(
      t("networks.regenerateCodeTitle"),
      t("networks.regenerateCodeConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("networks.regenerateCodeOk"),
          style: "destructive",
          onPress: async () => {
            try {
              await regenerateCodeMutation.mutateAsync({ id: String(networkId) });
              refetch();
            } catch {}
          },
        },
      ],
    );
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

  function handleChangeRole(uid: string, currentRole: "admin" | "member") {
    const newRole = currentRole === "admin" ? "member" : "admin";
    const isPromoting = newRole === "admin";
    Alert.alert(
      t(isPromoting ? "networks.promoteConfirmTitle" : "networks.demoteConfirmTitle"),
      t(isPromoting ? "networks.promoteConfirmBody" : "networks.demoteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t(isPromoting ? "networks.promoteConfirmOk" : "networks.demoteConfirmOk"),
          onPress: async () => {
            await roleMutation.mutateAsync({ id: networkId, uid, data: { role: newRole } });
            await refetchMembers();
          },
        },
      ],
    );
  }

  function showMemberMenu(uid: string, displayName: string, role: "admin" | "member") {
    Alert.alert(displayName, undefined, [
      {
        text: t(role === "admin" ? "networks.demoteButton" : "networks.promoteButton"),
        onPress: () => handleChangeRole(uid, role),
      },
      {
        text: t("networks.removeButton"),
        style: "destructive",
        onPress: () => handleRemoveMember(uid, displayName),
      },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  }

  // ── Skeleton loading state ──────────────────────────────────────────────────

  if (isLoading || isNaN(networkId)) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={[styles.skeletonHero, { backgroundColor: colors.card }]}>
          <View
            style={{
              paddingTop: insets.top + 8,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              marginBottom: 20,
            }}
          >
            <View
              style={[
                styles.skeletonCircle,
                { backgroundColor: colors.muted },
              ]}
            />
          </View>
          <View
            style={{ alignItems: "center", paddingBottom: 28, gap: 12 }}
          >
            <View
              style={[styles.skeletonIcon, { backgroundColor: colors.muted }]}
            />
            <View
              style={[
                styles.skeletonLine,
                { width: 160, backgroundColor: colors.muted },
              ]}
            />
            <View
              style={[
                styles.skeletonPill,
                { backgroundColor: colors.muted },
              ]}
            />
          </View>
        </View>
        <View
          style={[
            styles.tabBar,
            {
              borderBottomColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.tabBtn,
                { alignItems: "center", justifyContent: "center" },
              ]}
            >
              <View
                style={[
                  styles.skeletonLine,
                  { width: 52, backgroundColor: colors.muted },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
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
        <Text style={{ color: colors.mutedForeground }}>Network not found.</Text>
      </View>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const membership = network.myMembership;
  const isActive = membership?.status === "active";
  const isPending = membership?.status === "pending";
  const catColor = CAT_COLORS[network.category] ?? "#f59e0b";
  const catIcon = CAT_ICONS[network.category] ?? "users";
  const catKey =
    `networks.category${network.category.charAt(0).toUpperCase()}${network.category.slice(1)}` as never;
  const catLabel = t(catKey);
  const pendingCount = pendingMembers?.length ?? 0;

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: "feed", label: t("networks.feedTab") },
    { key: "members", label: t("networks.membersTab") },
    { key: "info", label: t("networks.infoTab") },
  ];

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {/* ── Hero banner ──────────────────────────────────────────────────── */}
        <View style={[styles.hero, { backgroundColor: colors.card }]}>
          <LinearGradient
            colors={[catColor + "38", catColor + "14", "transparent"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          {/* Back + settings */}
          <View style={[styles.heroNav, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={() => router.back()}
              style={styles.heroNavBtn}
              hitSlop={8}
            >
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
                style={styles.heroNavBtn}
                hitSlop={8}
              >
                <Feather name="settings" size={20} color={colors.foreground} />
              </Pressable>
            )}
          </View>
          {/* Icon (72px) */}
          <View
            style={[
              styles.heroIconWrap,
              {
                backgroundColor: catColor + "20",
                borderColor: catColor + "40",
              },
            ]}
          >
            <Feather name={catIcon as never} size={36} color={catColor} />
          </View>
          {/* Name */}
          <Text style={[styles.heroName, { color: colors.foreground }]}>
            {network.name}
          </Text>
          {/* Member count pill */}
          <View
            style={[
              styles.heroCountPill,
              {
                backgroundColor: catColor + "18",
                borderColor: catColor + "30",
              },
            ]}
          >
            <Feather name="users" size={12} color={catColor} />
            <Text style={[styles.heroCountText, { color: catColor }]}>
              {t("networks.members_other", { count: network.memberCount })}
            </Text>
          </View>
        </View>

        {/* ── Tab bar ──────────────────────────────────────────────────────── */}
        <NetworkTabs
          active={activeTab}
          tabs={TABS}
          onChange={setActiveTab}
          colors={colors}
        />

        {/* ── Tab content ──────────────────────────────────────────────────── */}
        <View style={styles.tabContent}>

          {/* Feed tab ─ announcement placeholder */}
          {activeTab === "feed" && (
            <View
              style={[
                styles.feedEmptyCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="bell" size={32} color={colors.mutedForeground} />
              <Text style={[styles.feedEmptyTitle, { color: colors.foreground }]}>
                {t("networks.noAnnouncementsTitle")}
              </Text>
              <Text style={[styles.feedEmptyBody, { color: colors.mutedForeground }]}>
                {t("networks.noAnnouncementsBody")}
              </Text>
            </View>
          )}

          {/* Members tab */}
          {activeTab === "members" && (
            <>
              {/* Pending approval panel (admin only) */}
              {isAdmin && (
                <View style={styles.pendingSection}>
                  <View style={styles.rowGap}>
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
                      style={[
                        styles.emptyText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {t("networks.noPendingRequests")}
                    </Text>
                  ) : (
                    <View
                      style={[
                        styles.membersList,
                        { borderColor: colors.border },
                      ]}
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
                              styles.pendingName,
                              { flex: 1, color: colors.foreground },
                            ]}
                          >
                            {m.profile.displayName}
                          </Text>
                          <Pressable
                            style={[
                              styles.approveBtn,
                              { backgroundColor: colors.primary },
                            ]}
                            onPress={() => handleApprove(m.uid, true)}
                          >
                            <Text style={styles.approveBtnText}>
                              {t("networks.approveButton")}
                            </Text>
                          </Pressable>
                          <Pressable
                            style={[
                              styles.approveBtn,
                              {
                                backgroundColor: colors.muted,
                                marginLeft: 6,
                              },
                            ]}
                            onPress={() => handleApprove(m.uid, false)}
                          >
                            <Text
                              style={[
                                styles.approveBtnText,
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

              {/* Member grid — 4 columns */}
              {membersLoading ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={{ marginTop: 24 }}
                />
              ) : !members || members.length === 0 ? (
                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {t("networks.membersTitle")}
                </Text>
              ) : (
                <View style={styles.memberGrid}>
                  {members.map((m) => {
                    const isSelf = m.uid === profile?.id;
                    const canManage =
                      isAdmin && !isSelf && m.uid !== network.createdByUid;
                    return (
                      <Pressable
                        key={m.uid}
                        style={({ pressed }) => [
                          styles.memberCell,
                          pressed && !isSelf && { opacity: 0.7 },
                        ]}
                        onPress={() => !isSelf && handleMemberTap(m.uid)}
                        onLongPress={() =>
                          canManage &&
                          showMemberMenu(
                            m.uid,
                            m.profile.displayName,
                            m.role as "admin" | "member",
                          )
                        }
                        delayLongPress={400}
                      >
                        <Avatar
                          uri={m.profile.photoUrl ?? undefined}
                          size={52}
                          fallbackText={m.profile.displayName}
                        />
                        {m.role === "admin" && (
                          <Text
                            style={[
                              styles.memberCellRole,
                              { color: colors.primary },
                            ]}
                          >
                            {t("networks.adminBadge")}
                          </Text>
                        )}
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.memberCellName,
                            { color: colors.foreground },
                          ]}
                        >
                          {isSelf
                            ? t("networks.youLabel")
                            : m.profile.displayName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* Info tab */}
          {activeTab === "info" && (
            <View style={styles.infoGap}>
              {/* Description */}
              {!!network.description && (
                <View
                  style={[
                    styles.infoCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.infoCardText,
                      { color: colors.foreground },
                    ]}
                  >
                    {network.description}
                  </Text>
                </View>
              )}

              {/* Details card */}
              <View
                style={[
                  styles.infoCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.infoRow}>
                  <View
                    style={[
                      styles.catChip,
                      { backgroundColor: catColor + "18" },
                    ]}
                  >
                    <Feather
                      name={catIcon as never}
                      size={13}
                      color={catColor}
                    />
                    <Text style={[styles.catChipText, { color: catColor }]}>
                      {catLabel}
                    </Text>
                  </View>
                </View>
                {!!network.neighborhoodName && (
                  <View style={[styles.infoRow, { marginTop: 10 }]}>
                    <Feather
                      name="map-pin"
                      size={14}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.infoLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {network.neighborhoodName}
                    </Text>
                  </View>
                )}
                {network.requiresApproval && (
                  <View style={[styles.infoRow, { marginTop: 10 }]}>
                    <Feather
                      name="lock"
                      size={14}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.infoLabel,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {t("networks.approvalRequiredBadge")}
                    </Text>
                  </View>
                )}
                <View style={[styles.infoRow, { marginTop: 10 }]}>
                  <Feather
                    name="users"
                    size={14}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.infoLabel,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {t("networks.members_other", {
                      count: network.memberCount,
                    })}
                  </Text>
                </View>
              </View>

              {/* Join / Leave / Pending */}
              {!isAdmin &&
                (isActive ? (
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
                  <View
                    style={[
                      styles.actionBtn,
                      { backgroundColor: colors.muted },
                    ]}
                  >
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
                ))}

              {/* Invite code */}
              {network.inviteCode && (isAdmin || isActive) && (
                <View
                  style={[
                    styles.inviteSection,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.inviteHeader}>
                    <Feather name="link" size={16} color={colors.primary} />
                    <Text
                      style={[
                        styles.inviteTitle,
                        { color: colors.foreground },
                      ]}
                    >
                      {t("networks.inviteCodeTitle")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.inviteSub,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {t("networks.inviteCodeSub")}
                  </Text>
                  <Pressable
                    style={[
                      styles.codeBox,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={handleCopyCode}
                  >
                    <Text style={[styles.codeText, { color: colors.foreground }]}>
                      {network.inviteCode}
                    </Text>
                    <Feather
                      name="copy"
                      size={16}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                  <Pressable
                    style={[
                      styles.shareCodeBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={handleShareInvite}
                  >
                    <Feather name="share-2" size={16} color="#fff" />
                    <Text style={styles.shareCodeBtnText}>
                      {t("networks.shareInviteLink")}
                    </Text>
                  </Pressable>
                  {isAdmin && (
                    <Pressable
                      style={[
                        styles.regenerateBtn,
                        { borderColor: colors.border },
                      ]}
                      onPress={handleRegenerateCode}
                      disabled={regenerateCodeMutation.isPending}
                    >
                      <Feather
                        name="refresh-cw"
                        size={14}
                        color={colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.regenerateBtnText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {t("networks.regenerateCodeTitle")}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  // ── Skeleton ─────────────────────────────────────────────────────────────
  skeletonHero: { overflow: "hidden" },
  skeletonCircle: { width: 34, height: 34, borderRadius: 17 },
  skeletonIcon: { width: 80, height: 80, borderRadius: 22 },
  skeletonLine: { height: 14, borderRadius: 7 },
  skeletonPill: { width: 100, height: 28, borderRadius: 14 },

  // ── Hero ─────────────────────────────────────────────────────────────────
  hero: { paddingBottom: 28, overflow: "hidden" },
  heroNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  heroNavBtn: { padding: 6, borderRadius: 20 },
  heroIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    borderWidth: 1,
    marginBottom: 12,
  },
  heroName: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  heroCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 8,
  },
  heroCountText: { fontFamily: "Inter_500Medium", fontSize: 13 },

  // ── Tab bar ───────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    position: "relative",
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
  },
  tabLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    borderRadius: 1,
  },

  // ── Tab content ───────────────────────────────────────────────────────────
  tabContent: { padding: 16 },

  // ── Feed ─────────────────────────────────────────────────────────────────
  feedEmptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    padding: 40,
    gap: 10,
  },
  feedEmptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    marginTop: 4,
  },
  feedEmptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Members ───────────────────────────────────────────────────────────────
  pendingSection: { marginBottom: 24, gap: 10 },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  countBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  membersList: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  pendingName: { fontFamily: "Inter_500Medium", fontSize: 15 },
  approveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  approveBtnText: { fontFamily: "Inter_500Medium", fontSize: 13, color: "#fff" },
  memberGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  memberCell: {
    width: "25%",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 4,
  },
  memberCellRole: { fontFamily: "Inter_500Medium", fontSize: 10 },
  memberCellName: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
  },

  // ── Info ─────────────────────────────────────────────────────────────────
  infoGap: { gap: 12 },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  infoCardText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { fontFamily: "Inter_400Regular", fontSize: 14 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  catChipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  actionBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  leaveBtn: { borderWidth: 1 },
  actionBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },

  // ── Invite code ───────────────────────────────────────────────────────────
  inviteSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  inviteHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  inviteTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  inviteSub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  codeText: { fontFamily: "Inter_600SemiBold", fontSize: 20, letterSpacing: 4 },
  shareCodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  shareCodeBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  regenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  regenerateBtnText: { fontFamily: "Inter_500Medium", fontSize: 13 },
});
