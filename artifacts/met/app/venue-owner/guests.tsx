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
    <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
      <VenueOwnerHeader title="Guests" onBack={() => router.back()} />

      {/* Period filter */}
      <View style={styles.periodRow}>
        {(["all", "month", "week"] as Period[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={[
              styles.periodBtn,
              period === p && { backgroundColor: colors.primary + "22", borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.periodBtnText, period === p && { color: colors.primary }]}>
              {PERIOD_LABELS[p]}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <TextInput
          style={[styles.searchInput, { color: "#fff", borderColor: "rgba(255,255,255,0.1)" }]}
          placeholder="Search guests…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={search}
          onChangeText={handleSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Total count */}
      {!loading && (
        <Text style={styles.totalText}>
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
              <Text style={styles.emptyText}>
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
                { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.07)", opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={styles.rank}>#{item.rank}</Text>

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
                  <Text style={styles.guestName} numberOfLines={1}>{item.displayName}</Text>
                  {item.isPioneer && <Text style={styles.pioneerStar}>⭐</Text>}
                </View>
                <Text style={styles.guestMeta}>
                  {item.checkinCount} {item.checkinCount === 1 ? "visit" : "visits"}
                  {"  ·  "}
                  {formatLastSeen(item.lastCheckinAt)}
                </Text>
              </View>

              {sentUids.has(item.uid) ? (
                <Text style={[styles.sentBadge, { color: colors.primary }]}>Sent ✓</Text>
              ) : (
                <Text style={styles.chevron}>›</Text>
              )}
            </Pressable>
          )}
        />
      )}

      {/* Guest Profile Drawer */}
      <Modal
        visible={drawerVisible}
        transparent
        animationType="slide"
        onRequestClose={closeDrawer}
      >
        <Pressable style={styles.drawerBackdrop} onPress={closeDrawer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%" }}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={[styles.drawer, { paddingBottom: insets.bottom + 20 }]}>
                <View style={styles.drawerHandle} />

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
                    <Text style={styles.drawerName}>{selected.displayName}</Text>
                    {selected.isPioneer && (
                      <Text style={[styles.drawerPioneer, { color: "#FBBF24" }]}>⭐ Pioneer member</Text>
                    )}

                    {/* Visit stats */}
                    <Text style={styles.drawerStats}>
                      {selected.checkinCount} {selected.checkinCount === 1 ? "visit" : "visits"}
                      {"  ·  "}
                      Last seen {formatLastSeen(selected.lastCheckinAt)}
                    </Text>

                    {/* Bio */}
                    {!!selected.bio && (
                      <Text style={styles.drawerBio}>{selected.bio}</Text>
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
                        <Text style={styles.revealBtnText}>Send Reveal Request</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.composerWrap}>
                        <TextInput
                          style={[
                            styles.composerInput,
                            { color: "#fff", borderColor: "rgba(255,255,255,0.12)" },
                          ]}
                          placeholder="Add a personal note… (optional)"
                          placeholderTextColor="rgba(255,255,255,0.3)"
                          value={revealMessage}
                          onChangeText={setRevealMessage}
                          maxLength={240}
                          multiline
                          autoFocus
                        />
                        <Text style={styles.charCount}>{revealMessage.length}/240</Text>
                        <Pressable
                          onPress={handleSendReveal}
                          disabled={revealSending}
                          style={({ pressed }) => [
                            styles.revealBtn,
                            { backgroundColor: colors.primary, opacity: pressed || revealSending ? 0.7 : 1 },
                          ]}
                        >
                          <Text style={styles.revealBtnText}>
                            {revealSending ? "Sending…" : "Send Reveal Request"}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => { setComposerOpen(false); setRevealMessage(""); }}
                          style={styles.cancelWrap}
                        >
                          <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

function formatLastSeen(isoStr: string): string {
  const date = new Date(isoStr);
  const diffMs = Date.now() - date.getTime();
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
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 7,
    alignItems: "center",
  },
  periodBtnText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // Search
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    backgroundColor: "#1A1A1E",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },

  // Total
  totalText: {
    color: "rgba(255,255,255,0.35)",
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
    color: "rgba(255,255,255,0.3)",
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
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  pioneerStar: { fontSize: 12 },
  guestMeta: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  sentBadge: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  chevron: { color: "rgba(255,255,255,0.2)", fontSize: 22 },

  // Empty state
  emptyState: { alignItems: "center", paddingTop: 72 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 32,
  },

  // Drawer
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  drawer: {
    backgroundColor: "#1A1A1E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: "center",
  },
  drawerHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    marginBottom: 20,
  },
  drawerAvatarWrap: { marginBottom: 14 },
  drawerAvatar: { width: 88, height: 88, borderRadius: 44 },
  drawerAvatarInitial: { fontSize: 36, fontFamily: "Inter_700Bold" },
  drawerName: {
    color: "#fff",
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
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
    textAlign: "center",
  },
  drawerBio: {
    color: "rgba(255,255,255,0.65)",
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
  revealBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  composerWrap: { width: "100%", gap: 8, marginTop: 4 },
  composerInput: {
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "#111115",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    alignSelf: "flex-end",
  },
  cancelWrap: { alignItems: "center", paddingVertical: 8 },
  cancelText: { color: "rgba(255,255,255,0.3)", fontSize: 14, fontFamily: "Inter_400Regular" },
});
