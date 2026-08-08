/**
 * Venue Owner Dashboard — in-app management hub.
 *
 * Shows a quick-stats summary and navigation cards to every management
 * section: Events, Rewards, Announcements, Edit Profile, and the public
 * venue page.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Sharing from "expo-sharing";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { api, type VenueOwnerDashboard } from "@/lib/api/client";

// ── Section card definition ─────────────────────────────────────────────────
type ManagementSection = {
  icon: string;
  label: string;
  sub: string;
  route: string;
  accent: string;
};

const SECTIONS: ManagementSection[] = [
  { icon: "📅", label: "Events", sub: "Create & manage events", route: "/venue-owner/events", accent: "#818CF8" },
  { icon: "🎁", label: "Rewards", sub: "Run reward campaigns", route: "/venue-owner/rewards", accent: "#34D399" },
  { icon: "📢", label: "Announcements", sub: "Post updates to guests", route: "/venue-owner/announcements", accent: "#FBBF24" },
  { icon: "✏️", label: "Edit Profile", sub: "Name, photos, description", route: "/venue-owner/profile/edit", accent: "#F472B6" },
];

export default function VenueOwnerDashboardScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile: application, isLoading, error } = useVenueOwner();
  const [dashboard, setDashboard] = useState<VenueOwnerDashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const qrSvgRef = useRef<{ toDataURL?: (cb: (data: string) => void) => void } | null>(null);

  const handleInviteStaff = async () => {
    if (!authedUid || inviteLoading) return;
    setInviteLoading(true);
    const name = application?.businessName ?? application?.placeName ?? "Your Venue";
    try {
      const result = await api.createStaffInvite({ uid: authedUid });
      await Share.share({
        message: `Join ${name}'s team on Met and help manage the venue!\n\nRegister here: ${result.registrationUrl}`,
        url: result.registrationUrl,
        title: `Join ${name} on Met`,
      });
    } catch {
      Alert.alert("Couldn't generate invite", "Please try again in a moment.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleOpenQrKit = () => setShowQrModal(true);

  // Load quick stats
  useEffect(() => {
    if (!authedUid || isLoading || !application?.isApproved) return;
    api.getVenueOwnerDashboard({ uid: authedUid })
      .then(setDashboard)
      .catch(() => { /* stats are non-critical */ })
      .finally(() => setDashLoading(false));
  }, [authedUid, isLoading, application?.isApproved]);

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  const venueName = application?.businessName ?? application?.placeName ?? "Your Venue";
  const totalCheckIns = dashboard?.checkInTrend?.reduce((sum, d) => sum + d.count, 0) ?? 0;
  const upcomingEvents = (dashboard?.eventRsvpCounts ?? []).filter(
    (e) => new Date(e.startsAt) > new Date(),
  ).length;
  const hasActiveReward = dashboard?.activeReward != null;

  return (
    <View style={[styles.root, { backgroundColor: "#0F0F12" }]}>
      <VenueOwnerHeader
        title="Venue Manager"
        onBack={() => router.replace("/(tabs)/profile" as never)}
        backLabel="Back"
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Venue identity card ── */}
        <View style={styles.identityCard}>
          <View style={styles.identityLeft}>
            <Text style={styles.venueName} numberOfLines={1}>{venueName}</Text>
            {application?.placeName && application.placeName !== application.businessName && (
              <Text style={styles.placeName} numberOfLines={1}>{application.placeName}</Text>
            )}
          </View>
          <View style={[styles.approvedBadge, { backgroundColor: "#16A34A20", borderColor: "#16A34A50" }]}>
            <Text style={[styles.approvedBadgeText, { color: "#4ADE80" }]}>✓ Approved</Text>
          </View>
        </View>

        {/* ── Quick stats ── */}
        {!dashLoading && (
          <View style={styles.statsRow}>
            <StatTile value={String(totalCheckIns)} label="Check-ins (30d)" color="#818CF8" />
            <StatTile value={String(upcomingEvents)} label="Upcoming events" color="#34D399" />
            <StatTile value={hasActiveReward ? "Active" : "None"} label="Reward" color="#FBBF24" />
          </View>
        )}
        {dashLoading && (
          <View style={styles.statsLoading}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.3)" />
          </View>
        )}

        {/* ── Management sections ── */}
        <Text style={styles.sectionHeading}>MANAGE</Text>
        <View style={styles.grid}>
          {SECTIONS.map((section) => (
            <Pressable
              key={section.route}
              onPress={() => router.push(section.route as never)}
              style={({ pressed }) => [
                styles.navCard,
                { backgroundColor: "#1A1A1E", borderColor: "rgba(255,255,255,0.07)", opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <View style={[styles.navIcon, { backgroundColor: section.accent + "18" }]}>
                <Text style={styles.navEmoji}>{section.icon}</Text>
              </View>
              <Text style={styles.navLabel}>{section.label}</Text>
              <Text style={styles.navSub} numberOfLines={2}>{section.sub}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Staff & Tools ── */}
        <Text style={styles.sectionHeading}>TOOLS</Text>
        <View style={{ gap: 10, marginBottom: 8 }}>
          <Pressable
            onPress={handleInviteStaff}
            disabled={inviteLoading}
            style={({ pressed }) => [
              styles.toolCard,
              { opacity: pressed || inviteLoading ? 0.7 : 1 },
            ]}
          >
            <View style={[styles.toolIcon, { backgroundColor: "#A78BFA18" }]}>
              <Text style={styles.navEmoji}>👥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toolLabel}>{inviteLoading ? "Generating link…" : "Invite Staff"}</Text>
              <Text style={styles.toolSub}>Share a one-time registration link via WhatsApp or SMS</Text>
            </View>
            <Text style={[styles.chevron, { color: "#A78BFA" }]}>›</Text>
          </Pressable>

          <Pressable
            onPress={handleOpenQrKit}
            style={({ pressed }) => [
              styles.toolCard,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <View style={[styles.toolIcon, { backgroundColor: "#34D39918" }]}>
              <Text style={styles.navEmoji}>🖨️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toolLabel}>QR Check-in Kit</Text>
              <Text style={styles.toolSub}>Print a table tent with your venue's check-in QR code</Text>
            </View>
            <Text style={[styles.chevron, { color: "#34D399" }]}>›</Text>
          </Pressable>
        </View>

        {/* ── View as guest ── */}
        <Text style={styles.sectionHeading}>VENUE PAGE</Text>
        <Pressable
          onPress={() => router.push(`/venue/${application?.placeId ?? ""}` as never)}
          style={({ pressed }) => [
            styles.venuePageCard,
            { borderColor: colors.primary + "40", opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={[styles.venuePageIcon, { backgroundColor: colors.primary + "15" }]}>
            <Text style={styles.venuePageEmoji}>👁</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.venuePageLabel}>View public page</Text>
            <Text style={styles.venuePageSub}>See exactly how guests discover {venueName}</Text>
          </View>
          <Text style={[styles.chevron, { color: colors.primary }]}>›</Text>
        </Pressable>
      </ScrollView>

      {/* ── QR Check-in Kit Modal ── */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQrModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}
          onPress={() => setShowQrModal(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{
              backgroundColor: "#1A1A1E",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 28,
              alignItems: "center",
              gap: 14,
            }}>
              {/* Grab handle */}
              <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2 }} />

              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 18 }}>
                Check-in QR Kit
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center" }}>
                Display at your venue so guests can check in with their camera
              </Text>

              {/* QR code on white background */}
              <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16 }}>
                <QRCode
                  getRef={(ref) => { qrSvgRef.current = ref as typeof qrSvgRef.current; }}
                  value={api.getVenueCheckInUrl(application?.placeId ?? "placeholder")}
                  size={220}
                  color="#111"
                  backgroundColor="#fff"
                />
              </View>

              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: "Inter_400Regular" }}>
                {venueName}
              </Text>

              {/* Save / share QR as photo */}
              <Pressable
                onPress={() => {
                  if (!qrSvgRef.current?.toDataURL) {
                    Alert.alert("Not ready", "QR not yet rendered — try again.");
                    return;
                  }
                  qrSvgRef.current.toDataURL(async (base64: string) => {
                    try {
                      const FS = await import("expo-file-system/legacy");
                      const path =
                        (FS.cacheDirectory ?? "") +
                        `checkin-qr-${Date.now()}.png`;
                      await FS.writeAsStringAsync(path, base64, {
                        encoding: FS.EncodingType.Base64,
                      });
                      await Sharing.shareAsync(path, {
                        mimeType: "image/png",
                        dialogTitle: `${venueName} — Check-in QR`,
                        UTI: "public.png",
                      });
                    } catch {
                      Alert.alert("Couldn't save QR", "Please try again.");
                    }
                  });
                }}
                style={({ pressed }) => ({
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 13,
                  width: "100%",
                  alignItems: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>
                  Save QR as Photo
                </Text>
              </Pressable>

              <Pressable onPress={() => setShowQrModal(false)} style={{ paddingVertical: 6 }}>
                <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StatTile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={[styles.statTile, { borderColor: color + "25", backgroundColor: color + "0A" }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },

  // Identity card
  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1A1A1E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 16,
    marginBottom: 8,
  },
  identityLeft: { flex: 1, marginRight: 12 },
  venueName: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  placeName: { color: "rgba(255,255,255,0.45)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  approvedBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  approvedBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },

  // Stats
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  statsLoading: { height: 72, alignItems: "center", justifyContent: "center" },
  statTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },

  // Section heading
  sectionHeading: {
    color: "rgba(255,255,255,0.28)",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 4,
    paddingLeft: 2,
  },

  // Nav grid (2 columns)
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  navCard: {
    width: "47.5%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  navIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  navEmoji: { fontSize: 20 },
  navLabel: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  navSub: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },

  // View public page
  venuePageCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginBottom: 8,
  },
  venuePageIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  venuePageEmoji: { fontSize: 20 },
  venuePageLabel: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  venuePageSub: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  chevron: { fontSize: 24, fontFamily: "Inter_400Regular" },

  // Tool cards (full-width row layout)
  toolCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1E",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
    gap: 14,
  },
  toolIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  toolLabel: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  toolSub: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
});
