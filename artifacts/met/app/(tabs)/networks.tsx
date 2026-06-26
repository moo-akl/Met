import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/EmptyState";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  useGetMyNetworks,
  useListNetworks,
  type NetworkListEntry,
} from "@workspace/api-client-react";

type Category = "university" | "work" | "neighborhood" | "custom";

const CATEGORIES: Array<{ key: Category | null; labelKey: string }> = [
  { key: null, labelKey: "networks.categoryAll" },
  { key: "university", labelKey: "networks.categoryUniversity" },
  { key: "work", labelKey: "networks.categoryWork" },
  { key: "neighborhood", labelKey: "networks.categoryNeighborhood" },
  { key: "custom", labelKey: "networks.categoryCustom" },
];

const PENDING_COLOR = "#f59e0b";

function MembershipBadge({
  membership,
  colors,
  t,
}: {
  membership: NetworkListEntry["myMembership"];
  colors: ReturnType<typeof useColors>;
  t: (k: string) => string;
}) {
  if (!membership) return null;
  const isAdmin = membership.role === "admin";
  const isPending = membership.status === "pending";
  const label = isAdmin
    ? t("networks.adminBadge")
    : isPending
      ? t("networks.pendingBadge")
      : t("networks.joinedBadge");
  const bg = isPending ? PENDING_COLOR : colors.primary;
  return (
    <View style={[styles.badge, { backgroundColor: bg + "22" }]}>
      <Text style={[styles.badgeText, { color: bg }]}>{label}</Text>
    </View>
  );
}

function NetworkCard({
  network,
  onPress,
  colors,
  t,
}: {
  network: NetworkListEntry;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const catIcons: Record<Category, string> = {
    university: "book",
    work: "briefcase",
    neighborhood: "map-pin",
    custom: "users",
  };
  const icon = catIcons[network.category as Category] ?? "users";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={onPress}
    >
      <View
        style={[styles.cardIcon, { backgroundColor: colors.primary + "18" }]}
      >
        <Feather name={icon as never} size={20} color={colors.primary} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text
            style={[styles.cardName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {network.name}
          </Text>
          <MembershipBadge
            membership={network.myMembership}
            colors={colors}
            t={t}
          />
        </View>
        {!!network.description && (
          <Text
            style={[styles.cardDesc, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {network.description}
          </Text>
        )}
        <View style={styles.cardMetaRow}>
          <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
            {t("networks.members_other", { count: network.memberCount })}
            {network.neighborhoodName ? `  ·  ${network.neighborhoodName}` : ""}
          </Text>
          {network.requiresApproval && !network.myMembership && (
            <View
              style={[
                styles.approvalBadge,
                { backgroundColor: colors.muted },
              ]}
            >
              <Feather
                name="lock"
                size={10}
                color={colors.mutedForeground}
              />
              <Text
                style={[styles.approvalText, { color: colors.mutedForeground }]}
              >
                {t("networks.approvalRequiredBadge")}
              </Text>
            </View>
          )}
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function NetworksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();

  const [tab, setTab] = useState<"mine" | "discover">("mine");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const {
    data: myNetworks,
    isLoading: myLoading,
    refetch: myRefetch,
    isRefetching: myRefetching,
  } = useGetMyNetworks();

  const {
    data: discoverNetworks,
    isLoading: discoverLoading,
    refetch: discoverRefetch,
    isRefetching: discoverRefetching,
  } = useListNetworks({
    category: category ?? undefined,
    q: debouncedQuery.trim() || undefined,
  });

  useFocusEffect(
    useCallback(() => {
      if (tab === "mine") {
        myRefetch();
      } else {
        discoverRefetch();
      }
    }, [tab, myRefetch, discoverRefetch]),
  );

  const isLoading = tab === "mine" ? myLoading : discoverLoading;
  const isRefreshing = tab === "mine" ? myRefetching : discoverRefetching;
  const networks = (tab === "mine" ? myNetworks : discoverNetworks) ?? [];

  const handleRefresh = useCallback(() => {
    if (tab === "mine") myRefetch();
    else discoverRefetch();
  }, [tab, myRefetch, discoverRefetch]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("networks.headerTitle")}
        actions={[
          {
            icon: "plus",
            onPress: () => router.push("/network/create" as never),
          },
        ]}
      />

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["mine", "discover"] as const).map((key) => {
          const label =
            key === "mine" ? t("networks.myNetworks") : t("networks.discover");
          const active = tab === key;
          return (
            <Pressable
              key={key}
              style={[
                styles.tabBtn,
                active && {
                  borderBottomColor: colors.primary,
                  borderBottomWidth: 2,
                },
              ]}
              onPress={() => setTab(key)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? colors.primary : colors.mutedForeground },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Search + category (Discover only) */}
      {tab === "discover" && (
        <View
          style={[
            styles.filtersWrap,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder={t("networks.searchPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!query && (
              <Pressable onPress={() => setQuery("")}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {CATEGORIES.map(({ key, labelKey }) => {
              const active = category === key;
              return (
                <Pressable
                  key={String(key)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setCategory(key)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? "#fff" : colors.mutedForeground },
                    ]}
                  >
                    {t(labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : networks.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyWrap}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <EmptyState
            icon={tab === "mine" ? "users" : "search"}
            title={t(
              tab === "mine"
                ? "networks.emptyMyTitle"
                : "networks.emptyDiscoverTitle",
            )}
            description={t(
              tab === "mine"
                ? "networks.emptyMyBody"
                : "networks.emptyDiscoverBody",
            )}
          />
          {tab === "mine" && (
            <Pressable
              style={[styles.createBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/network/create" as never)}
            >
              <Text style={styles.createBtnText}>
                {t("networks.createButton")}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 16 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {(networks as NetworkListEntry[]).map((n) => (
            <NetworkCard
              key={n.id}
              network={n}
              colors={colors}
              t={t}
              onPress={() =>
                router.push({
                  pathname: "/network/[id]",
                  params: { id: String(n.id) },
                } as never)
              }
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  filtersWrap: { paddingTop: 12, paddingBottom: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    padding: 0,
  },
  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  list: { paddingTop: 8, paddingHorizontal: 16, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardName: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 15 },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardMeta: { fontFamily: "Inter_400Regular", fontSize: 12 },
  approvalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  approvalText: { fontFamily: "Inter_400Regular", fontSize: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  createBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  createBtnText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
