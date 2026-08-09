/**
 * Venue Owner Guests Screen
 *
 * Ranked leaderboard of guests who have checked in at the owner's venue.
 * Tap any guest to view their profile and send a reveal request directly
 * through the Met app.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { api, type VenueOwnerGuest } from "@/lib/api/client";

type Period = "all" | "month" | "week";

const PERIOD_LABELS: Record<Period, string> = {
  all: "All time",
  month: "This month",
  week: "This week",
};

export default function VenueOwnerGuestsScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isLoading: ownerLoading } = useVenueOwner();

  const [guests, setGuests] = useState<VenueOwnerGuest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [period, setPeriod] = useState<Period>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sentUids, setSentUids] = useState<Set<string>>(new Set());

  // Profile drawer
  const [selected, setSelected] = useState<VenueOwnerGuest | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [revealMessage, setRevealMessage] = useState("");
  const [revealSending, setRevealSending] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(text), 350);
  };

  // Pre-load already-sent reveals so we can show the correct state per guest
  useEffect(() => {
    if (!authedUid) return;
    api
      .listOutboundReveals({ uid: authedUid })
      .then((reveals) => setSentUids(new Set(reveals.map((r) => r.recipientUid))))
      .catch(() => { /* non-critical — UI degrades gracefully */ });
  }, [authedUid]);

  const fetchGuests = useCallback(
    async (reset: boolean) => {
      if (!authedUid) return;
      if (reset) setLoading(true);
      try {
        const result = await api.getVenueOwnerGuests({ uid: authedUid }, {
          period,
          search: debouncedSearch.trim() || undefined,
          limit: 30,
          offset: reset ? 0 : guests.length,
        });
        if (reset) {
          setGuests(result.guests);
        } else {
          setGuests((prev) => [...prev, ...result.guests]);
        }
        setTotal(result.total);
      } catch {
        if (reset) setGuests([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [authedUid, period, debouncedSearch],
  );

  useEffect(() => {
    if (!ownerLoading) void fetchGuests(true);
  }, [ownerLoading, fetchGuests]);

  const loadMore = () => {
    if (loadingMore || guests.length >= total) return;
    setLoadingMore(true);
    void fetchGuests(false);
  };

  const openGuest = (guest: VenueOwnerGuest) => {
    setSelected(guest);
    setComposerOpen(false);
    setRevealMessage("");
    setDrawerVisible(true);
  };

  const closeDrawer = () => {
    Keyboard.dismiss();
    setDrawerVisible(false);
  };

  const handleSendReveal = async () => {
    if (!authedUid || !selected || revealSending) return;
    setRevealSending(true);
    try {
      await api.sendReveal({ uid: authedUid }, {
        recipientUid: selected.uid,
        message: revealMessage.trim() || null,
      });
      setSentUids((prev) => new Set([...prev, selected.uid]));
      setComposerOpen(false);
      closeDrawer();
      Alert.alert(
        "Reveal sent ✓",
        `${selected.displayName} will see your request in their Met app.`,
      );
    } catch (e: unknown) {
      Alert.alert("Couldn't send", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setRevealSending(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <VenueOwnerHeader title="Guests" onBack={() => router.back()} />

      {/* Period filter */}
      <View style={styles.periodRow}>
        {(["all", "month", "week"] as Period[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={[
              styles.periodBtn,
              { borderColor: period === p ? colors.primary : colors.border },
              period === p && { backgroundColor: colors.primary + "22" },
            ]}
          >
            <Text style={[
              styles.periodBtnText,
              { color: period === p ? colors.primary : colors.mutedForeground },
            ]}>
              {PERIOD_LABELS[p]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={[styles.searchInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="Search guests…"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Total count */}
      {!loading && (
        <Text style={[styles.totalText, { color: colors.mutedForeground }]}>
          {total} {total === 1 ? "guest" : "guests"} checked in
        </Text>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={guests}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {debouncedSearch.trim()
                  ? "No guests match your search."
                  : "No check-ins recorded yet at your venue."}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openGuest(item)}
              style={({ pressed }) => [
                styles.guestRow,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.rank, { color: colors.mutedForeground }]}>#{item.rank}</Text>

              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                    {item.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.guestInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.guestName, { color: colors.foreground }]} numberOfLines={1}>{item.displayName}</Text>
                  {item.isPioneer && <Text style={styles.pioneerStar}>⭐</Text>}
                </View>
                <Text style={[styles.guestMeta, { color: colors.mutedForeground }]}>
                  {item.checkinCount} {item.checkinCount === 1 ? "visit" : "visits"}
                  {"  ·  "}
                  {formatLastSeen(item.lastCheckinAt)}
                </Text>
                {item.qrVerifiedCount > 0 ? (
                  <Text style={styles.qrBadge}>✓ Scanned QR</Text>
                ) : (
                  <Text style={[styles.proximityBadge, { color: colors.mutedForeground }]}>📡 Nearby only</Text>
                )}
              </View>

              {sentUids.has(item.uid) ? (
                <Text style={[styles.sentBadge, { color: colors.primary }]}>Sent ✓</Text>
              ) : (
                <Text style={[styles.chevron, { color: colors.mutedForeground }]}>›</Text>
              )}
            </Pressable>
          )}
        />
      )}

      {/* Guest Full Profile Sheet */}
      <Modal
        visible={drawerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDrawer}
      >
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.sheetTopBar, { borderBottomColor: colors.border }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Pressable style={styles.sheetCloseBtn} onPress={closeDrawer} hitSlop={12}>
              <Text style={[styles.sheetCloseTxt, { color: colors.mutedForeground }]}>✕</Text>
            </Pressable>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + 32 }]}
              showsVerticalScrollIndicator={false}
            >

                {selected && (
                  <>
                    {/* Avatar */}
                    <View style={styles.drawerAvatarWrap}>
                      {selected.photoUrl ? (
                        <Image source={{ uri: selected.photoUrl }} style={styles.drawerAvatar} />
                      ) : (
                        <View
                          style={[
                            styles.drawerAvatar,
                            styles.avatarFallback,
                            { backgroundColor: colors.primary + "20" },
                          ]}
                        >
                          <Text style={[styles.drawerAvatarInitial, { color: colors.primary }]}>
                            {selected.displayName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Name + pioneer */}
                    <Text style={[styles.drawerName, { color: colors.foreground }]}>{selected.displayName}</Text>
                    {selected.isPioneer && (
                      <Text style={[styles.drawerPioneer, { color: "#FBBF24" }]}>⭐ Pioneer member</Text>
                    )}

                    {/* Visit stats */}
                    <Text style={[styles.drawerStats, { color: colors.mutedForeground }]}>
                      {selected.checkinCount} {selected.checkinCount === 1 ? "visit" : "visits"}
                      {"  ·  "}
                      Last seen {formatLastSeen(selected.lastCheckinAt)}
                    </Text>

                    {/* QR / proximity badge */}
                    {selected.qrVerifiedCount > 0 ? (
                      <Text style={[styles.drawerQrBadge, { color: "#4ADE80" }]}>
                        ✓ Scanned QR code {selected.qrVerifiedCount === selected.checkinCount
                          ? "(all visits)"
                          : `(${selected.qrVerifiedCount} of ${selected.checkinCount} visits)`}
                      </Text>
                    ) : (
                      <Text style={[styles.drawerProximityBadge, { color: colors.mutedForeground }]}>
                        📡 Detected nearby — hasn't scanned QR yet
                      </Text>
                    )}

                    {/* Bio */}
                    {!!selected.bio && (
                      <Text style={[styles.drawerBio, { color: colors.secondaryForeground }]}>{selected.bio}</Text>
                    )}

                    {/* Interests */}
                    {selected.interests.length > 0 && (
                      <View style={styles.interestsWrap}>
                        {selected.interests.slice(0, 8).map((tag) => (
                          <View
                            key={tag}
                            style={[
                              styles.interestChip,
                              { backgroundColor: colors.primary + "18", borderColor: colors.primary + "35" },
                            ]}
                          >
                            <Text style={[styles.interestText, { color: colors.primary }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Reveal CTA */}
                    {sentUids.has(selected.uid) ? (
                      <View style={[styles.sentBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "35" }]}>
                        <Text style={[styles.sentBoxText, { color: colors.primary }]}>
                          ✓ Reveal request sent — they'll see it in their Met app
                        </Text>
                      </View>
                    ) : !composerOpen ? (
                      <Pressable
                        onPress={() => setComposerOpen(true)}
                        style={({ pressed }) => [
                          styles.revealBtn,
                          { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        <Text style={[styles.revealBtnText, { color: colors.primaryForeground }]}>Send Reveal Request</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.composerWrap}>
                        <TextInput
                          style={[
                            styles.composerInput,
                            { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted },
                          ]}
                          placeholder="Add a personal note… (optional)"
                          placeholderTextColor={colors.mutedForeground}
                          value={revealMessage}
                          onChangeText={setRevealMessage}
                          maxLength={240}
                          multiline
                          autoFocus
                        />
                        <Text style={[styles.charCount, { color: colors.mutedForeground }]}>{revealMessage.length}/240</Text>
                        <Pressable
                          onPress={handleSendReveal}
                          disabled={revealSending}
                          style={({ pressed }) => [
                            styles.revealBtn,
                            { backgroundColor: colors.primary, opacity: pressed || revealSending ? 0.7 : 1 },
                          ]}
                        >
                          <Text style={[styles.revealBtnText, { color: colors.primaryForeground }]}>
                            {revealSending ? "Sending…" : "Send Reveal Request"}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => { setComposerOpen(false); setRevealMessage(""); }}
                          style={styles.cancelWrap}
                        >
                          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function formatLastSeen(isoStr: string | null | undefined): string {
  if (!isoStr) return "recently";
  const date = new Date(isoStr);
  if (isNaN(date.getTime())) return "recently";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "recently";
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Period filter
  periodRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  periodBtn: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 7,
    alignItems: "center",
  },
  periodBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },

  // Total
  totalText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    paddingHorizontal: 18,
    paddingBottom: 6,
  },

  // Guest list
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  rank: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    width: 28,
    textAlign: "center",
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 18, fontFamily: "Inter_700Bold" },
  guestInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  guestName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  pioneerStar: { fontSize: 12 },
  guestMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  qrBadge: {
    color: "#4ADE80",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 3,
  },
  proximityBadge: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
  },
  sentBadge: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  chevron: { fontSize: 22 },

  // Empty state
  emptyState: { alignItems: "center", paddingTop: 72 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },

  // Full-screen profile sheet (pageSheet presentation)
  sheet: { flex: 1 },
  sheetTopBar: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: "relative",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  sheetCloseBtn: {
    position: "absolute",
    right: 16,
    top: 8,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseTxt: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: "center",
    width: "100%",
  },

  // Drawer (legacy — kept for inner content reuse)
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  drawer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: "center",
  },
  drawerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
  },
  drawerAvatarWrap: { marginBottom: 14 },
  drawerAvatar: { width: 88, height: 88, borderRadius: 44 },
  drawerAvatarInitial: { fontSize: 36, fontFamily: "Inter_700Bold" },
  drawerName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  drawerPioneer: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  drawerStats: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 6,
    textAlign: "center",
  },
  drawerQrBadge: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 10,
    textAlign: "center",
  },
  drawerProximityBadge: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
    textAlign: "center",
  },
  drawerBio: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  interestsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginBottom: 20,
  },
  interestChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  interestText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // Sent confirmation box
  sentBox: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  sentBoxText: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },

  // Reveal button + composer
  revealBtn: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  revealBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  composerWrap: { width: "100%", gap: 8, marginTop: 4 },
  composerInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    alignSelf: "flex-end",
  },
  cancelWrap: { alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
