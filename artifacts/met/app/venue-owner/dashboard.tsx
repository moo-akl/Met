/**
 * Venue Owner Dashboard — in-app management hub.
 *
 * Two visual themes controlled by the global ThemeContext:
 *   dark  → Aurora  (deep gradient + glassmorphism)
 *   light → Signal  (white editorial, magazine-cover typography)
 *
 * All business logic (stats, QR kit, staff invite) is shared between themes.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { api, type VenueOwnerDashboard } from "@/lib/api/client";

// ─── Nav sections ─────────────────────────────────────────────────────────────
const SECTIONS = [
  { icon: "👥", label: "Guests",        sub: "See who's coming back — connect personally", route: "/venue-owner/guests",           glowColor: "rgba(96,165,250,0.5)"  },
  { icon: "📅", label: "Events",        sub: "Create & manage events",                     route: "/venue-owner/events",            glowColor: "rgba(167,139,250,0.5)" },
  { icon: "🎁", label: "Rewards",       sub: "Run reward campaigns",                       route: "/venue-owner/rewards",           glowColor: "rgba(52,211,153,0.5)"  },
  { icon: "📢", label: "Announcements", sub: "Post updates to guests",                     route: "/venue-owner/announcements",     glowColor: "rgba(251,191,36,0.5)"  },
  { icon: "✏️", label: "Edit Profile",  sub: "Name, photos, description",                  route: "/venue-owner/profile/edit",      glowColor: "rgba(244,114,182,0.5)" },
];

const GREEN = "#00E87A"; // Signal accent

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function VenueOwnerDashboardScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile: application, isLoading } = useVenueOwner();

  const [dashboard, setDashboard] = useState<VenueOwnerDashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrUrlLoading, setQrUrlLoading] = useState(false);
  const qrSvgRef = useRef<{ toDataURL?: (cb: (data: string) => void) => void } | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────
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

  const handleOpenQrKit = async () => {
    setShowQrModal(true);
    if (qrUrl || !authedUid) return;
    setQrUrlLoading(true);
    try {
      const result = await api.getVenueOwnerQr({ uid: authedUid });
      setQrUrl(result.qrUrl);
    } catch {
      Alert.alert("Couldn't load QR", "Please close and try again.");
    } finally {
      setQrUrlLoading(false);
    }
  };

  const handleSaveQr = () => {
    if (!qrSvgRef.current?.toDataURL) {
      Alert.alert("Not ready", "QR not yet rendered — try again.");
      return;
    }
    qrSvgRef.current.toDataURL(async (base64: string) => {
      try {
        const FS = await import("expo-file-system/legacy");
        const path = (FS.cacheDirectory ?? "") + `checkin-qr-${Date.now()}.png`;
        await FS.writeAsStringAsync(path, base64, { encoding: FS.EncodingType.Base64 });
        await Sharing.shareAsync(path, {
          mimeType: "image/png",
          dialogTitle: `${venueName} — Check-in QR`,
          UTI: "public.png",
        });
      } catch {
        Alert.alert("Couldn't save QR", "Please try again.");
      }
    });
  };

  // ── Stats ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authedUid || isLoading || !application?.isApproved) return;
    api.getVenueOwnerDashboard({ uid: authedUid })
      .then(setDashboard)
      .catch(() => {})
      .finally(() => setDashLoading(false));
  }, [authedUid, isLoading, application?.isApproved]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? "#0A0518" : "#FAFAF8", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={isDark ? "#34D399" : GREEN} />
      </View>
    );
  }

  const venueName = application?.businessName ?? application?.placeName ?? "Your Venue";
  const totalCheckIns = dashboard?.checkInTrend?.reduce((sum, d) => sum + d.count, 0) ?? 0;
  const upcomingEvents = (dashboard?.eventRsvpCounts ?? []).filter((e) => new Date(e.startsAt) > new Date()).length;
  const hasActiveReward = dashboard?.activeReward != null;
  const activeRewardName = dashboard?.activeReward?.title ?? "Loyalty campaign";

  const handleBack = () => router.replace("/(tabs)/profile" as never);

  return (
    <>
      {isDark
        ? <AuroraScreen
            venueName={venueName}
            insets={insets}
            totalCheckIns={totalCheckIns}
            upcomingEvents={upcomingEvents}
            hasActiveReward={hasActiveReward}
            activeRewardName={activeRewardName}
            dashLoading={dashLoading}
            inviteLoading={inviteLoading}
            onBack={handleBack}
            onNav={(route) => router.push(route as never)}
            onInviteStaff={handleInviteStaff}
            onOpenQrKit={handleOpenQrKit}
            onViewPage={() => router.push(`/venue/${application?.placeId ?? ""}` as never)}
          />
        : <SignalScreen
            venueName={venueName}
            insets={insets}
            totalCheckIns={totalCheckIns}
            upcomingEvents={upcomingEvents}
            hasActiveReward={hasActiveReward}
            dashLoading={dashLoading}
            inviteLoading={inviteLoading}
            onBack={handleBack}
            onNav={(route) => router.push(route as never)}
            onInviteStaff={handleInviteStaff}
            onOpenQrKit={handleOpenQrKit}
            onViewPage={() => router.push(`/venue/${application?.placeId ?? ""}` as never)}
          />
      }

      {/* ── QR Kit modal (shared) ── */}
      <QrModal
        visible={showQrModal}
        venueName={venueName}
        qrUrl={qrUrl}
        qrUrlLoading={qrUrlLoading}
        qrSvgRef={qrSvgRef}
        primaryColor={isDark ? "#34D399" : GREEN}
        onSave={handleSaveQr}
        onClose={() => setShowQrModal(false)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AURORA — dark theme
// ─────────────────────────────────────────────────────────────────────────────
type SharedProps = {
  venueName: string;
  insets: { top: number; bottom: number };
  totalCheckIns: number;
  upcomingEvents: number;
  hasActiveReward: boolean;
  dashLoading: boolean;
  inviteLoading: boolean;
  onBack: () => void;
  onNav: (route: string) => void;
  onInviteStaff: () => void;
  onOpenQrKit: () => void;
  onViewPage: () => void;
};

function AuroraScreen({
  venueName, insets, totalCheckIns, upcomingEvents, hasActiveReward,
  activeRewardName, dashLoading, inviteLoading,
  onBack, onNav, onInviteStaff, onOpenQrKit, onViewPage,
}: SharedProps & { activeRewardName: string }) {
  const STATS = [
    { value: dashLoading ? "—" : String(totalCheckIns), label: "Check-ins", sub: "this month", borderColor: "rgba(99,102,241,0.4)",  androidBorderColor: "rgba(99,102,241,0.8)",  glowColor: "rgba(99,102,241,0.25)" },
    { value: dashLoading ? "—" : String(upcomingEvents), label: "Events",     sub: "upcoming",   borderColor: "rgba(52,211,153,0.4)",   androidBorderColor: "rgba(52,211,153,0.8)",   glowColor: "rgba(52,211,153,0.2)"  },
    { value: dashLoading ? "—" : hasActiveReward ? "Live" : "None", label: "Reward", sub: "active", borderColor: "rgba(251,191,36,0.4)", androidBorderColor: "rgba(251,191,36,0.8)", glowColor: "rgba(251,191,36,0.2)" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0518" }}>
      {/* ── Aurora background blobs ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={["#1A0840", "#0A0518", "#060318"]}
          style={StyleSheet.absoluteFill}
        />
        {/* Purple blob top-left */}
        <View style={{ position: "absolute", top: -80, left: -60, width: 300, height: 300, borderRadius: 150, overflow: "hidden", opacity: 0.55 }}>
          <LinearGradient colors={["#6B1FBF", "transparent"]} style={{ flex: 1 }} />
        </View>
        {/* Teal blob top-right */}
        <View style={{ position: "absolute", top: 120, right: -80, width: 260, height: 220, borderRadius: 130, overflow: "hidden", opacity: 0.22 }}>
          <LinearGradient colors={["#10B981", "transparent"]} style={{ flex: 1 }} />
        </View>
        {/* Blue blob mid-left */}
        <View style={{ position: "absolute", top: 380, left: -50, width: 220, height: 220, borderRadius: 110, overflow: "hidden", opacity: 0.25 }}>
          <LinearGradient colors={["#3B82F6", "transparent"]} style={{ flex: 1 }} />
        </View>
        {/* Violet blob bottom */}
        <View style={{ position: "absolute", bottom: 100, right: -60, width: 240, height: 240, borderRadius: 120, overflow: "hidden", opacity: 0.18 }}>
          <LinearGradient colors={["#7C3AED", "transparent"]} style={{ flex: 1 }} />
        </View>
        {/* Bottom fade */}
        <LinearGradient
          colors={["transparent", "rgba(10,5,24,0.75)"]}
          style={[StyleSheet.absoluteFill, { top: "40%" }]}
        />
      </View>

      {/* ── Header ── */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 22, paddingBottom: 4 }}>
        <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 14, alignSelf: "flex-start" }}>
          <Feather name="arrow-left" size={16} color="rgba(200,180,255,0.5)" />
          <Text style={{ color: "rgba(200,180,255,0.5)", fontFamily: "Inter_500Medium", fontSize: 13 }}>Back</Text>
        </Pressable>
        <Text style={{ color: "rgba(200,180,255,0.45)", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Venue Manager
        </Text>
        <Text style={{ color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold", letterSpacing: -0.8, textShadowColor: "rgba(139,92,246,0.8)", textShadowRadius: 20, textShadowOffset: { width: 0, height: 0 } }}>
          {venueName}
        </Text>
        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(52,211,153,0.1)", borderWidth: 1, borderColor: "rgba(52,211,153,0.28)", borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start" }}>
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#34D399" }} />
          <Text style={{ color: "#34D399", fontFamily: "Inter_600SemiBold", fontSize: 11 }}>Approved venue</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 0 }}
      >
        {/* ── Glass stat orbs ── */}
        <View style={{ flexDirection: "row", gap: 9, marginTop: 18, marginBottom: 18 }}>
          {STATS.map((s) => (
            <View
              key={s.label}
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: Platform.OS === "android" ? 1.5 : 1,
                borderColor: Platform.OS === "android" ? s.androidBorderColor : s.borderColor,
                borderRadius: 18,
                paddingVertical: 14,
                paddingHorizontal: 8,
                alignItems: "center",
                // iOS glow — shadowColor is ignored on Android
                shadowColor: s.glowColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 1,
                shadowRadius: 12,
                elevation: 4,
              }}
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 20, letterSpacing: -0.5 }}>{s.value}</Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontFamily: "Inter_600SemiBold", fontSize: 11, marginTop: 4 }}>{s.label}</Text>
              <Text style={{ color: "rgba(255,255,255,0.28)", fontFamily: "Inter_400Regular", fontSize: 9, marginTop: 2 }}>{s.sub}</Text>
            </View>
          ))}
        </View>

        {/* ── Quick-action icon strip ── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 18 }}>
          {SECTIONS.map((s) => (
            <Pressable
              key={s.route}
              onPress={() => onNav(s.route)}
              style={({ pressed }) => ({
                alignItems: "center",
                gap: 6,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{
                width: 54, height: 54, borderRadius: 17,
                backgroundColor: "rgba(255,255,255,0.07)",
                borderWidth: Platform.OS === "android" ? 1.5 : 1,
                borderColor: Platform.OS === "android" ? s.glowColor : "rgba(255,255,255,0.12)",
                alignItems: "center", justifyContent: "center",
                // iOS glow — shadowColor is ignored on Android
                shadowColor: s.glowColor, shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 1, shadowRadius: 10, elevation: 3,
              }}>
                <Text style={{ fontSize: 22 }}>{s.icon}</Text>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Inter_600SemiBold", fontSize: 10 }}>
                {s.label.split(" ")[0]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Glass bottom card ── */}
        <GlassCard>
          {/* Active reward */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" }}>
            <Text style={{ color: "rgba(251,191,36,0.6)", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
              Active Reward
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15, letterSpacing: -0.2 }} numberOfLines={1}>
                  {hasActiveReward ? activeRewardName : "No active reward"}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 3 }}>
                  {hasActiveReward ? "Tap Rewards to manage" : "Start a campaign in Rewards"}
                </Text>
              </View>
              {hasActiveReward && (
                <View style={{ backgroundColor: "rgba(251,191,36,0.15)", borderWidth: 1, borderColor: "rgba(251,191,36,0.3)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: "#FBBF24", fontFamily: "Inter_700Bold", fontSize: 11 }}>● Live</Text>
                </View>
              )}
            </View>
          </View>

          {/* Tools + view page */}
          {[
            { icon: "👥", label: inviteLoading ? "Generating link…" : "Invite Staff", sub: "One-time registration link", accent: "#A78BFA", onPress: onInviteStaff },
            { icon: "🖨️", label: "QR Check-in Kit", sub: "Print a table tent for your venue", accent: "#34D399", onPress: onOpenQrKit },
            { icon: "👁",  label: "View public page", sub: "See how guests discover you", accent: "#60A5FA", onPress: onViewPage },
          ].map((item, i) => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 13,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(255,255,255,0.06)",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "rgba(255,255,255,0.88)", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{item.label}</Text>
                <Text style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 }}>{item.sub}</Text>
              </View>
              <Feather name="arrow-right" size={16} color={item.accent} />
            </Pressable>
          ))}
        </GlassCard>
      </ScrollView>
    </View>
  );
}

/** Frosted glass card — BlurView on iOS, semi-transparent fallback on Android */
function GlassCard({ children }: { children: React.ReactNode }) {
  const content = (
    <View style={{
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.1)",
      borderRadius: 24,
      overflow: "hidden",
      marginBottom: 8,
      // Inner highlight
      shadowColor: "rgba(255,255,255,0.06)",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 1,
      shadowRadius: 0,
    }}>
      {children}
    </View>
  );

  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={18} tint="dark" style={{ borderRadius: 24, overflow: "hidden", marginBottom: 8 }}>
        <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderRadius: 24 }}>
          {children}
        </View>
      </BlurView>
    );
  }
  // Android: layered semi-transparent dark card approximating frosted glass.
  // BlurView falls back to a plain View on Android so we use a more opaque
  // dark background + a slightly lighter border to give the card visual depth.
  return (
    <View style={{ backgroundColor: "rgba(15,8,35,0.88)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)", borderRadius: 24, overflow: "hidden", marginBottom: 8 }}>
      {children}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL — light / editorial theme
// ─────────────────────────────────────────────────────────────────────────────
function SignalScreen({
  venueName, insets, totalCheckIns, upcomingEvents, hasActiveReward,
  dashLoading, inviteLoading,
  onBack, onNav, onInviteStaff, onOpenQrKit, onViewPage,
}: SharedProps) {
  const NAV_ITEMS = SECTIONS.map((s, i) => ({ ...s, index: i + 1 }));

  const STATS = [
    { value: dashLoading ? "—" : String(totalCheckIns), label: "Check-ins", flag: "30D" },
    { value: dashLoading ? "—" : String(upcomingEvents), label: "Events",    flag: "AHEAD" },
    { value: dashLoading ? "—" : hasActiveReward ? "1" : "0", label: "Reward", flag: "LIVE" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#FAFAF8" }}>
      {/* ── Eyebrow + back ── */}
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 4 }}>
        <Pressable onPress={onBack} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, flexDirection: "row", alignItems: "center", gap: 4 })}>
          <Feather name="arrow-left" size={16} color="rgba(0,0,0,0.35)" />
          <Text style={{ color: "rgba(0,0,0,0.35)", fontFamily: "Inter_500Medium", fontSize: 13 }}>Back</Text>
        </Pressable>
        <Text style={{ color: "rgba(0,0,0,0.3)", fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>
          Venue Manager
        </Text>
        {/* Approved pill */}
        <View style={{ backgroundColor: GREEN, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ color: "#0D0D0D", fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.5 }}>✓ APPROVED</Text>
        </View>
      </View>

      {/* ── HERO venue name ── */}
      <View style={{ paddingHorizontal: 22, paddingTop: 6, paddingBottom: 16, borderBottomWidth: 1.5, borderBottomColor: "rgba(0,0,0,0.08)" }}>
        <Text style={{ fontSize: 40, fontFamily: "Inter_700Bold", letterSpacing: -2, lineHeight: 42, color: "#0D0D0D", textTransform: "uppercase" }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
          {venueName}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN }} />
          <Text style={{ color: "rgba(0,0,0,0.38)", fontFamily: "Inter_400Regular", fontSize: 12 }}>Chelsea, London</Text>
        </View>
      </View>

      {/* ── Newspaper stats ── */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1.5, borderBottomColor: "rgba(0,0,0,0.08)" }}>
        {STATS.map((s, i) => (
          <View key={s.label} style={{ flex: 1, padding: 14, borderRightWidth: i < 2 ? 1.5 : 0, borderRightColor: "rgba(0,0,0,0.08)" }}>
            <Text style={{ fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -1.5, color: "#0D0D0D", lineHeight: 30 }}>{s.value}</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 5, marginTop: 5 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(0,0,0,0.48)" }}>{s.label}</Text>
              <Text style={{ fontSize: 8, fontFamily: "Inter_700Bold", color: GREEN, letterSpacing: 0.5 }}>{s.flag}</Text>
            </View>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        {/* ── MANAGE ── */}
        <View style={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 4 }}>
          <Text style={{ color: "rgba(0,0,0,0.28)", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 14 }}>
            Manage
          </Text>
          {NAV_ITEMS.map((item, i) => (
            <Pressable
              key={item.route}
              onPress={() => onNav(item.route)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(0,0,0,0.06)",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              {/* Index number */}
              <Text style={{ color: "rgba(0,0,0,0.12)", fontFamily: "Inter_700Bold", fontSize: 12, width: 24, letterSpacing: -0.3 }}>
                0{item.index}
              </Text>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.4, color: "#0D0D0D" }}>{item.label}</Text>
                <Text style={{ fontSize: 11, color: "rgba(0,0,0,0.36)", fontFamily: "Inter_400Regular", marginTop: 2 }}>{item.sub}</Text>
              </View>
              {/* Electric arrow */}
              <Feather name="arrow-right" size={18} color={GREEN} />
            </Pressable>
          ))}
        </View>

        {/* Divider */}
        <View style={{ height: 1.5, backgroundColor: "rgba(0,0,0,0.08)", marginHorizontal: 22, marginTop: 4, marginBottom: 18 }} />

        {/* ── TOOLS ── */}
        <View style={{ paddingHorizontal: 22, paddingBottom: 4 }}>
          <Text style={{ color: "rgba(0,0,0,0.28)", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 14 }}>
            Tools
          </Text>
          {[
            { label: inviteLoading ? "Generating link…" : "Invite Staff", sub: "One-time registration link via WhatsApp or SMS", onPress: onInviteStaff, isGreen: false },
            { label: "QR Check-in Kit", sub: "Print a table tent with your venue's check-in QR code", onPress: onOpenQrKit, isGreen: false },
            { label: "View public page →", sub: "See exactly how guests discover you", onPress: onViewPage, isGreen: true },
          ].map((item, i) => (
            <Pressable
              key={item.label}
              onPress={item.onPress}
              style={({ pressed }) => ({
                paddingVertical: 13,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(0,0,0,0.06)",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.3, color: item.isGreen ? GREEN : "#0D0D0D" }}>
                {item.label}
              </Text>
              <Text style={{ fontSize: 11, color: "rgba(0,0,0,0.36)", fontFamily: "Inter_400Regular", marginTop: 3 }}>
                {item.sub}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QR Modal (shared, always dark)
// ─────────────────────────────────────────────────────────────────────────────
function QrModal({
  visible, venueName, qrUrl, qrUrlLoading, qrSvgRef, primaryColor, onSave, onClose,
}: {
  visible: boolean;
  venueName: string;
  qrUrl: string | null;
  qrUrlLoading: boolean;
  qrSvgRef: React.MutableRefObject<{ toDataURL?: (cb: (data: string) => void) => void } | null>;
  primaryColor: string;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: "#1A1A1E", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, alignItems: "center", gap: 14 }}>
            <View style={{ width: 40, height: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 2 }} />
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 18 }}>Check-in QR Kit</Text>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center", fontFamily: "Inter_400Regular" }}>
              Display at your venue so guests can check in with their camera
            </Text>
            <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16, minHeight: 252, alignItems: "center", justifyContent: "center" }}>
              {qrUrlLoading || !qrUrl
                ? <ActivityIndicator size="large" color="#111" style={{ width: 220, height: 220 }} />
                : (
                  <QRCode
                    getRef={(ref) => { qrSvgRef.current = ref as typeof qrSvgRef.current; }}
                    value={qrUrl}
                    size={220}
                    color="#111"
                    backgroundColor="#fff"
                  />
                )
              }
            </View>
            <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontFamily: "Inter_400Regular" }}>{venueName}</Text>
            <Pressable
              onPress={onSave}
              style={({ pressed }) => ({ backgroundColor: primaryColor, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13, width: "100%", alignItems: "center", opacity: pressed ? 0.85 : 1 })}
            >
              <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16 }}>Save QR as Photo</Text>
            </Pressable>
            <Pressable onPress={onClose} style={{ paddingVertical: 6 }}>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, fontFamily: "Inter_400Regular" }}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
