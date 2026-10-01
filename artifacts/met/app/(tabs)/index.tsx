import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import * as Updates from "expo-updates";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  DevSettings,
  Easing,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "expo-image";
import Svg, { Circle, Path } from "react-native-svg";
import { LinearGradient as LG } from "expo-linear-gradient";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/Avatar";
import { HeatmapMap } from "@/components/HeatmapMap";
import { api, type VenueOwnerProfile } from "@/lib/api/client";
import { HubStatusBadge } from "@/components/HubStatusBadge";
import { GridOverlay } from "@/components/GridOverlay";
import { PermissionDisclosureDialog } from "@/components/PermissionDisclosureDialog";
import { RequestsSheet } from "@/components/RequestsSheet";
import { MyRankings } from "@/components/MyRankings";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import { useCountUp } from "@/hooks/useCountUp";
import { usePermissionReminders } from "@/hooks/usePermissionReminders";
import { usePermissionStatus } from "@/hooks/usePermissionStatus";
import { useVisibility } from "@/hooks/useVisibility";
import { useWeeklyRankings } from "@/hooks/useWeeklyRankings";
import {
  type LangCode,
  getLanguage,
  setLanguage,
  SUPPORTED_LANGUAGES,
  useT,
} from "@/lib/i18n";
import { DISCOVERY_RANGE_METERS } from "@/lib/storage";
import { useHubCheckin } from "@/hooks/useHubCheckin";
import {
  isStoreScreenshotDemo,
  STORE_DEMO_PLACE_ID,
  STORE_DEMO_PLACE_NAME,
  STORE_DEMO_VENUES,
} from "@/lib/storeVenueDemo";

// ─── Aurora Glass palette ─────────────────────────────────────────────────────
const AG_BG          = "#050814";
const AG_CARD        = "rgba(255,255,255,0.05)" as const;
const AG_BORDER      = "rgba(255,255,255,0.1)"  as const;
const AG_PURPLE      = "#A855F7";
const AG_CYAN        = "#06B6D4";
const AG_TEXT        = "#FFFFFF";
const AG_MUTED       = "rgba(255,255,255,0.6)"  as const;
const AG_MUTED_SOLID = "rgba(255,255,255,0.35)" as const;

const CHECKIN_CTA_KEY = "met:checkin_cta_last_shown";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function StoreDemoHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { isDark } = useTheme();
  const light = !isDark;
  const compact = light && height <= 700;

  const openVenue = (placeId: string) =>
    router.push({
      pathname: "/venue/[placeId]",
      params: { placeId, demo: "1", storeDemo: "venue" },
    } as never);

  return (
    <View style={[storeDemoHomeStyles.page, light && storeDemoLightStyles.page]}>
      <AppHeader title="Home" scanActive={false} actions={[]} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          storeDemoHomeStyles.content,
          light && storeDemoLightStyles.content,
          compact && storeDemoCompactStyles.content,
          { paddingBottom: insets.bottom + 110 },
        ]}
      >
        <View style={[storeDemoHomeStyles.intro, light && storeDemoLightStyles.intro, compact && storeDemoCompactStyles.intro]}>
          <View style={[storeDemoHomeStyles.sampleBadge, light && storeDemoLightStyles.sampleBadge, compact && storeDemoCompactStyles.sampleBadge]}>
            <Feather name="activity" size={11} color={light ? "#246B54" : "#A78BFA"} />
            <Text style={[storeDemoHomeStyles.sampleBadgeText, light && storeDemoLightStyles.sampleBadgeText]}>SAMPLE MET NETWORK</Text>
          </View>
          <Text style={[storeDemoHomeStyles.title, light && storeDemoLightStyles.title, compact && storeDemoCompactStyles.title]}>A world connected through places.</Text>
          <Text style={[storeDemoHomeStyles.subtitle, light && storeDemoLightStyles.subtitle, compact && storeDemoCompactStyles.subtitle]}>
            Discover community energy through participating venues.
          </Text>
        </View>

        <View style={[storeDemoHomeStyles.mapCard, light && storeDemoLightStyles.mapCard, compact && storeDemoCompactStyles.mapCard]}>
          <View style={[storeDemoHomeStyles.mapHeader, light && storeDemoLightStyles.mapHeader, compact && storeDemoCompactStyles.mapHeader]}>
            <View>
              <Text style={[storeDemoHomeStyles.mapTitle, light && storeDemoLightStyles.mapTitle, compact && storeDemoCompactStyles.mapTitle]}>World heat map</Text>
              <Text style={[storeDemoHomeStyles.mapCaption, light && storeDemoLightStyles.mapCaption, compact && storeDemoCompactStyles.mapCaption]}>
                Aggregate activity across venue communities
              </Text>
            </View>
            <Feather name="globe" size={20} color={light ? "#246B54" : "#A78BFA"} />
          </View>
          <View style={[storeDemoHomeStyles.map, light && storeDemoLightStyles.map, compact && storeDemoCompactStyles.map]}>
            <Svg viewBox="0 0 360 165" preserveAspectRatio={compact ? "xMidYMid slice" : "xMidYMid meet"} style={storeDemoHomeStyles.worldMap}>
              <Path d="M37 40 51 27 72 19 91 23 101 17 116 25 124 38 118 47 106 48 104 59 95 63 90 77 80 89 73 82 68 72 55 69 49 61 39 58 31 48Z" fill={light ? "#CADBD6" : "#20374A"} stroke={light ? "#8CAEA5" : "#456178"} strokeWidth="1" />
              <Path d="m98 63 12 5 8 11 10 8-3 11 8 9-3 14-8 8-4 15-8 5-8-12-1-13-8-12 2-11-7-9 7-10Z" fill={light ? "#CADBD6" : "#20374A"} stroke={light ? "#8CAEA5" : "#456178"} strokeWidth="1" />
              <Path d="m96 16 9-8 14 3 5 8-7 7-13-1Z" fill={light ? "#CADBD6" : "#20374A"} stroke={light ? "#8CAEA5" : "#456178"} strokeWidth="1" />
              <Path d="m160 39 9-7 12 2 6 6-5 6-12-1-5 5-9-3Z" fill={light ? "#CADBD6" : "#20374A"} stroke={light ? "#8CAEA5" : "#456178"} strokeWidth="1" />
              <Path d="m178 53 14-5 17 3 8 10-5 12-8 9-3 15-11 13-7 18-8 6-7-14-4-15-7-13 3-15-5-11Z" fill={light ? "#CADBD6" : "#20374A"} stroke={light ? "#8CAEA5" : "#456178"} strokeWidth="1" />
              <Path d="m192 30 13-8 19 2 12-5 18 6 17-2 16 7 14 1 10 9 16 3 9 9-9 7-14-5-12 3-10-5-12 4-13-4-8 8-15-1-10-7-15 1-9-8-15 2-9-7-16 4-7-7Z" fill={light ? "#CADBD6" : "#20374A"} stroke={light ? "#8CAEA5" : "#456178"} strokeWidth="1" />
              <Path d="m285 107 14-6 17 4 9 10-8 10-17 1-13-8Z" fill={light ? "#CADBD6" : "#20374A"} stroke={light ? "#8CAEA5" : "#456178"} strokeWidth="1" />
              <Path d="m324 91 4-2 3 7-4 6Z" fill={light ? "#CADBD6" : "#20374A"} stroke={light ? "#8CAEA5" : "#456178"} strokeWidth="1" />
              {[
                { x: 67, y: 58, color: "#A78BFA", radius: 13 },
                { x: 116, y: 64, color: "#F97360", radius: 9 },
                { x: 178, y: 47, color: "#34D399", radius: 10 },
                { x: 199, y: 74, color: "#F97360", radius: 13 },
                { x: 241, y: 58, color: "#A78BFA", radius: 9 },
                { x: 280, y: 65, color: "#22D3EE", radius: 12 },
                { x: 254, y: 96, color: "#34D399", radius: 8 },
                { x: 301, y: 113, color: "#F97360", radius: 8 },
              ].map((spot, index) => (
                <React.Fragment key={index}>
                  <Circle cx={spot.x} cy={spot.y} r={spot.radius * 1.8} fill={light ? ["#635AA4", "#B05D47", "#26785B", "#B05D47", "#635AA4", "#197B94", "#26785B", "#B05D47"][index] : spot.color} opacity={light ? 0.23 : 0.13} />
                  <Circle cx={spot.x} cy={spot.y} r={spot.radius * 0.58} fill={light ? ["#635AA4", "#B05D47", "#26785B", "#B05D47", "#635AA4", "#197B94", "#26785B", "#B05D47"][index] : spot.color} opacity={light ? 1 : 0.9} />
                  <Circle cx={spot.x} cy={spot.y} r={2.2} fill={light ? "#FAF8F2" : "#F8FAFC"} />
                </React.Fragment>
              ))}
            </Svg>
            <Text style={[storeDemoHomeStyles.region, light && storeDemoLightStyles.region, { left: "12%", top: "43%" }]}>AMERICAS</Text>
            <Text style={[storeDemoHomeStyles.region, light && storeDemoLightStyles.region, { left: "43%", top: "31%" }]}>EUROPE</Text>
            <Text style={[storeDemoHomeStyles.region, light && storeDemoLightStyles.region, { right: "9%", top: "40%" }]}>ASIA PACIFIC</Text>
          </View>
          <Text style={[storeDemoHomeStyles.disclaimer, light && storeDemoLightStyles.disclaimer, compact && storeDemoCompactStyles.disclaimer]}>
            Sample aggregate venue activity — no individual live locations.
          </Text>
        </View>

        <View style={[storeDemoHomeStyles.sectionHeading, light && storeDemoLightStyles.sectionHeading, compact && storeDemoCompactStyles.sectionHeading]}>
          <View>
            <Text style={[storeDemoHomeStyles.sectionTitle, light && storeDemoLightStyles.sectionTitle, compact && storeDemoCompactStyles.sectionTitle]}>Featured venues</Text>
            <Text style={[storeDemoHomeStyles.sectionSub, light && storeDemoLightStyles.sectionSub, compact && storeDemoCompactStyles.sectionSub]}>Sample places · this week’s community activity</Text>
          </View>
          <Feather name="arrow-up-right" size={17} color={light ? "#507467" : "#94A3B8"} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[storeDemoHomeStyles.venueCarousel, light && storeDemoLightStyles.venueCarousel, compact && storeDemoCompactStyles.venueCarousel]}>
          {STORE_DEMO_VENUES.map((venue, index) => (
            <Pressable
              key={venue.placeId}
              onPress={() => openVenue(venue.placeId)}
              style={({ pressed }) => [storeDemoHomeStyles.venueCard, light && storeDemoLightStyles.venueCard, compact && storeDemoCompactStyles.venueCard, pressed && { opacity: 0.75 }]}
            >
              <View style={[storeDemoHomeStyles.venueIcon, light && storeDemoLightStyles.venueIcon, compact && storeDemoCompactStyles.venueIcon, { backgroundColor: light ? ["#F3E8D7", "#E7E7F5", "#DFEEE7"][index] : `${venue.color}24` }]}>
                <Feather
                  name={index === 0 ? "coffee" : index === 1 ? "shopping-bag" : "book-open"}
                  size={16}
                  color={light ? ["#895A25", "#5A57A0", "#246B54"][index] : venue.color}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[storeDemoHomeStyles.venueName, light && storeDemoLightStyles.venueName, compact && storeDemoCompactStyles.venueName]}>{venue.placeName}</Text>
                <Text numberOfLines={1} style={[storeDemoHomeStyles.venueMeta, light && storeDemoLightStyles.venueMeta, compact && storeDemoCompactStyles.venueMeta]}>{venue.neighborhood} · demo</Text>
              </View>
              <Text style={[storeDemoHomeStyles.venueCount, light && storeDemoLightStyles.venueCount]}>{venue.weeklyActivity}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/qr-scan",
              params: { demo: "1", storeDemo: "checkin", placeId: STORE_DEMO_PLACE_ID, placeName: STORE_DEMO_PLACE_NAME },
            } as never)
          }
          style={({ pressed }) => [storeDemoHomeStyles.checkinButton, light && storeDemoLightStyles.checkinButton, compact && storeDemoCompactStyles.checkinButton, pressed && { opacity: 0.8 }]}
        >
          <Feather name="maximize" size={15} color={light ? "#F6F7F0" : "#07101A"} />
          <Text style={[storeDemoHomeStyles.checkinButtonText, light && storeDemoLightStyles.checkinButtonText]}>Check in at a venue</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Conditional palette — Aurora Glass in dark mode, theme tokens in light mode
  const bg     = isDark ? AG_BG    : colors.background;
  const card   = isDark ? AG_CARD  : colors.card;
  const border = isDark ? AG_BORDER : "rgba(0,0,0,0.08)";
  const text   = isDark ? AG_TEXT  : colors.text;
  const muted  = isDark ? AG_MUTED : colors.mutedForeground;
  const router = useRouter();
  const { t } = useT();
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [reloadingLang, setReloadingLang] = useState(false);
  const currentLang = getLanguage();

  const onPickLanguage = (code: LangCode) => {
    if (reloadingLang || code === currentLang) return;
    Alert.alert(
      t("language.confirmTitle"),
      SUPPORTED_LANGUAGES.find((s) => s.code === code)?.native ?? code,
      [
        { text: t("profile.cancelBtn"), style: "cancel" },
        { text: t("language.confirmRestart"), onPress: () => void applyLanguage(code) },
      ],
    );
  };

  const applyLanguage = async (code: LangCode) => {
    setReloadingLang(true);
    setLangPickerOpen(false);
    let rtlChanged = false;
    try {
      ({ rtlChanged } = await setLanguage(code));
    } catch {
      setReloadingLang(false);
      return;
    }
    setTimeout(() => void reloadApp(rtlChanged), 1200);
  };

  const reloadApp = async (_rtlChanged: boolean) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try { window.location.reload(); return; } catch {}
    } else {
      try { await Updates.reloadAsync(); return; } catch {}
      try { DevSettings.reload(); return; } catch {}
    }
    setReloadingLang(false);
  };

  const { encounters, preferences, authedUid } = useApp();

  const { hubState, cooldownMinutes, pendingVenues, confirmVenue, cancelVenueSelection, attemptCheckin } =
    useHubCheckin();

  const [checkinCtaVisible, setCheckinCtaVisible] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(CHECKIN_CTA_KEY).then((raw) => {
      if (!raw) { setCheckinCtaVisible(true); return; }
      setCheckinCtaVisible(Date.now() - Number(raw) >= SIX_HOURS_MS);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleCheckinPress = useCallback(() => {
    void AsyncStorage.setItem(CHECKIN_CTA_KEY, String(Date.now()));
    setCheckinCtaVisible(false);
    attemptCheckin();
  }, [attemptCheckin]);

  const { data: weeklyRankings, isLoading: rankingsLoading, error: rankingsError, refetch: refetchRankings } = useWeeklyRankings();
  const { isVisible, toggle: toggleVisibility } = useVisibility();
  const [requestsOpen, setRequestsOpen] = useState(false);
  const rangeM = DISCOVERY_RANGE_METERS[preferences.discoveryRange];

  // Tick every 60 s so the "today" window slides forward without a new encounter.
  const [_now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [mapReady, setMapReady] = useState(false);
  const mapMountedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!authedUid || mapMountedRef.current) return;
      let cancelled = false;
      const task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) {
          mapMountedRef.current = true;
          setMapReady(true);
        }
      });
      return () => {
        cancelled = true;
        task.cancel();
      };
    }, [authedUid]),
  );

  const { locationOk, bluetoothOk, checked } = usePermissionStatus();
  const permsMissing = checked && (!locationOk || !bluetoothOk);
  const {
    reminder,
    dismiss: dismissReminder,
    openSettings: openReminderSettings,
  } = usePermissionReminders();

  useEffect(() => {
    if (Platform.OS !== "web" || !__DEV__) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("openSheet") === "requests") setRequestsOpen(true);
  }, []);

  const incoming = useMemo(
    () => encounters.filter((e) => e.status === "request_received"),
    [encounters],
  );

  const weekly = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newPeople = encounters.filter((e) => e.firstSeenAt >= weekAgo).length;
    const repeats = encounters.filter(
      (e) => e.encounterCount > 1 && e.lastSeenAt >= weekAgo,
    ).length;
    return { newPeople, repeats };
  }, [encounters]);

  const withinRange = useMemo(
    () => encounters.filter((e) => e.lastDistanceM <= rangeM).length,
    [encounters, rangeM],
  );

  const animatedWithin = useCountUp(isVisible ? withinRange : 0, 700);

  const livePulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isVisible) { livePulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, { toValue: 0.25, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(livePulse, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isVisible, livePulse]);

  useFocusEffect(
    useCallback(() => {
      if (!authedUid) return;
      refetchRankings();
    }, [authedUid]),
  );

  const vibe = isVisible ? deriveVibe(withinRange) : null;
  const webBot = Platform.OS === "web" ? 34 : 0;

  if (isStoreScreenshotDemo("home")) return <StoreDemoHomeScreen />;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* ── Aurora ambient glow blobs (dark mode only) ──────────────── */}
      {isDark && (
        <>
          <LinearGradient
            colors={["rgba(168,85,247,0.28)", "rgba(168,85,247,0.08)", "transparent"]}
            style={styles.auroraBlob1}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(6,182,212,0.2)", "rgba(6,182,212,0.06)", "transparent"]}
            style={styles.auroraBlob2}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(99,102,241,0.18)", "rgba(99,102,241,0.04)", "transparent"]}
            style={styles.auroraBlob3}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            pointerEvents="none"
          />
        </>
      )}

      <GridOverlay />
      <AppHeader
        title={t("appHeader.titleHome")}
        scanActive={isVisible}
        visibility={{ isVisible, onToggle: toggleVisibility }}
        actions={[{ icon: "globe", onPress: () => setLangPickerOpen(true) }]}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + webBot + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Permission warning banner ──────────────────────────────── */}
        {permsMissing ? (
          <Pressable
            onPress={() => router.push("/permissions")}
            accessibilityRole="button"
            accessibilityLabel="Bluetooth and Location permissions needed. Tap to open Settings."
            style={({ pressed }) => [
              styles.banner,
              { backgroundColor: "rgba(249,115,22,0.1)", borderColor: "rgba(249,115,22,0.4)", opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={[styles.permAlertIcon, { backgroundColor: "rgba(249,115,22,0.2)" }]}>
              <Feather name="alert-triangle" size={18} color="#F97316" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.bannerTitle, { color: "#FED7AA" }]}>
                {!locationOk && !bluetoothOk ? "Location & Bluetooth off" : !locationOk ? "Location off" : "Bluetooth off"}
              </Text>
              <Text style={[styles.bannerSub, { color: "rgba(253,186,116,0.8)" }]}>
                Met can't detect nearby people without{" "}
                {!locationOk && !bluetoothOk ? "Location & Bluetooth" : !locationOk ? "Location" : "Bluetooth"}
                . Tap to open Settings.
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#F97316" />
          </Pressable>
        ) : null}

        <PermissionDisclosureDialog
          visible={reminder?.visible ?? false}
          kind={reminder?.kind ?? "location"}
          mode="reminder"
          onAccept={openReminderSettings}
          onDismiss={dismissReminder}
        />

        {/* ── Incoming requests banner ───────────────────────────────── */}
        {incoming.length > 0 ? (
          <Pressable
            onPress={() => setRequestsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t(
              incoming.length === 1 ? "home.bannerA11y_one" : "home.bannerA11y_other",
              { count: incoming.length },
            )}
            style={({ pressed }) => [
              styles.banner,
              { backgroundColor: card, borderColor: AG_PURPLE, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <View style={styles.bannerAvatars}>
              {incoming.slice(0, 3).map((e, i) => (
                <View
                  key={e.id}
                  style={[styles.avatarStack, { marginLeft: i === 0 ? 0 : -10, borderColor: bg, zIndex: 10 - i }]}
                >
                  <Avatar uri={e.photoUri} size={32} />
                </View>
              ))}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: text }]}>
                {t(
                  incoming.length === 1 ? "home.peopleWantReveal_one" : "home.peopleWantReveal_other",
                  { count: incoming.length },
                )}
              </Text>
              <Text style={[styles.bannerSub, { color: muted }]}>{t("home.tapToReview")}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={AG_PURPLE} />
          </Pressable>
        ) : null}

        {/* ── Beacon status pill ────────────────────────────────────── */}
        <View style={styles.beaconPillRow}>
          <View style={[styles.beaconPill, { backgroundColor: card, borderColor: isVisible ? "rgba(168,85,247,0.4)" : border }]}>
            {isVisible ? (
              <View style={styles.liveDotWrap}>
                <Animated.View style={[styles.liveDotPing, { opacity: livePulse }]} />
                <View style={styles.liveDotCore} />
              </View>
            ) : (
              <View style={[styles.liveDotCore, { backgroundColor: isDark ? AG_MUTED_SOLID : colors.mutedForeground }]} />
            )}
            <Text style={[styles.beaconLabel, { color: isVisible ? "#D8B4FE" : muted }]}>
              {isVisible ? t("home.beaconActive") : t("home.beaconOff")}
            </Text>
          </View>
        </View>

        {/* ── Hero number ───────────────────────────────────────────── */}
        <View style={styles.heroSection}>
          {isVisible ? (
            <>
              <Text style={[styles.heroNumber, { color: isDark ? AG_PURPLE : colors.primary }]}>{animatedWithin}</Text>
              <Text style={[styles.heroSub, { color: muted }]}>
                {t("home.peopleWithinSuffix", {
                  label: t(withinRange === 1 ? "home.person" : "home.people"),
                  m: rangeM,
                })}
              </Text>
            </>
          ) : (
            <Text style={[styles.heroOffline, { color: text }]}>{t("home.invisibleHeadline")}</Text>
          )}

          {vibe && isVisible ? (
            <View style={[styles.vibePill, { backgroundColor: "rgba(6,182,212,0.1)", borderColor: "rgba(6,182,212,0.25)" }]}>
              <Feather name={vibe.icon} size={12} color={AG_CYAN} />
              <Text style={[styles.vibeText, { color: AG_CYAN }]}>{t(vibe.labelKey)}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Live heatmap ──────────────────────────────────────────── */}
        <View style={styles.heatmapSection}>
          {mapReady && <HeatmapMap style={{ flex: 1 }} onVenuePress={(pid) => router.push({ pathname: "/venue/[placeId]", params: { placeId: pid } } as never)} />}
        </View>

        {/* ── Quick actions grid ────────────────────────────────────── */}
        <View style={styles.quickActionsRow}>
          <Pressable
            onPress={handleCheckinPress}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.quickActionCard,
              { backgroundColor: card, borderColor: border, opacity: pressed ? 0.82 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: "rgba(6,182,212,0.15)" }]}>
              <Feather name="map-pin" size={20} color={AG_CYAN} />
            </View>
            <Text style={[styles.quickActionLabel, { color: text }]}>{t("home.checkInCta")}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              if (hubState?.placeId) {
                router.push(`/leaderboard/${hubState.placeId}`);
              } else {
                Alert.alert("Check in first", "Check in to a venue to view its leaderboard.");
              }
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.quickActionCard,
              { backgroundColor: card, borderColor: border, opacity: pressed ? 0.82 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: "rgba(168,85,247,0.15)" }]}>
              <Feather name="award" size={20} color={AG_PURPLE} />
            </View>
            <Text style={[styles.quickActionLabel, { color: text }]}>Leaderboard</Text>
          </Pressable>
        </View>

        {/* ── This Week ────────────────────────────────────────────── */}
        <View style={[styles.weeklyCard, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.sectionLabel, { color: muted }]}>{t("home.thisWeek")}</Text>
          <View style={styles.weeklyRow}>
            <Pressable
              onPress={() => router.push({ pathname: "/(tabs)/recent", params: { filter: "new" } })}
              accessibilityRole="button"
              accessibilityLabel={t("home.newPeopleA11y", { count: weekly.newPeople })}
              style={({ pressed }) => [
                styles.weeklyCell,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <Text style={[styles.weeklyValue, { color: text }]}>{weekly.newPeople}</Text>
              <Text style={[styles.weeklyLabel, { color: muted }]}>
                {t(weekly.newPeople === 1 ? "home.newPerson_one" : "home.newPerson_other")}
              </Text>
              <View style={styles.weeklyChev}>
                <Feather name="chevron-right" size={14} color={muted} />
              </View>
            </Pressable>
            <View style={[styles.weeklyDivider, { backgroundColor: border }]} />
            <Pressable
              onPress={() => router.push({ pathname: "/(tabs)/recent", params: { filter: "repeats" } })}
              accessibilityRole="button"
              accessibilityLabel={t("home.crossedAgainA11y", { count: weekly.repeats })}
              style={({ pressed }) => [
                styles.weeklyCell,
                { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <Text style={[styles.weeklyValue, { color: text }]}>{weekly.repeats}</Text>
              <Text style={[styles.weeklyLabel, { color: muted }]}>{t("home.crossedAgainLabel")}</Text>
              <View style={styles.weeklyChev}>
                <Feather name="chevron-right" size={14} color={muted} />
              </View>
            </Pressable>
          </View>
          <Text style={[styles.weeklyHint, { color: muted, borderTopColor: border }]}>
            {weekly.newPeople === 0 && weekly.repeats === 0
              ? t("home.weeklyHintQuiet")
              : t("home.weeklyHintActive")}
          </Text>
        </View>

        {/* ── My Rankings ──────────────────────────────────────────── */}
        <MyRankings
          data={weeklyRankings ?? []}
          isLoading={rankingsLoading}
          error={rankingsError}
          onRetry={() => refetchRankings()}
        />

        {/* ── Hub Status Badge ─────────────────────────────────────── */}
        <HubStatusBadge
          hubState={hubState}
          cooldownMinutes={cooldownMinutes}
          pendingVenues={pendingVenues}
          confirmVenue={confirmVenue}
          cancelVenueSelection={cancelVenueSelection}
        />

        {/* ── Referral / Beacon setup CTA ───────────────────────────── */}
        {permsMissing ? (
          <Pressable
            onPress={() => router.push("/permissions")}
            accessibilityRole="button"
            accessibilityLabel="Set up your beacon — tap to enable permissions"
            style={({ pressed }) => [
              styles.referralCard,
              { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
            ]}
          >
            <LinearGradient
              colors={["rgba(249,115,22,0.3)", "rgba(239,68,68,0.2)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[styles.referralIconWrap, { backgroundColor: "rgba(249,115,22,0.2)" }]}>
              <Feather name="radio" size={16} color="#FB923C" />
            </View>
            <Text style={[styles.referralTitle, { color: text, flex: 1 }]}>Set up your beacon</Text>
            <Feather name="chevron-right" size={16} color="#FB923C" />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push("/referrals")}
            accessibilityRole="button"
            accessibilityLabel={t("home.referralCtaTitle")}
            style={({ pressed }) => [
              styles.referralCard,
              { borderColor: border, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
            ]}
          >
            <LinearGradient
              colors={["rgba(168,85,247,0.35)", "rgba(6,182,212,0.25)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[styles.referralIconWrap, { backgroundColor: "rgba(168,85,247,0.2)" }]}>
              <Feather name="gift" size={16} color={AG_PURPLE} />
            </View>
            <Text style={[styles.referralTitle, { color: text, flex: 1 }]}>
              {t("home.referralCtaTitle")}
            </Text>
            <Feather name="arrow-right" size={16} color={AG_PURPLE} />
          </Pressable>
        )}
      </ScrollView>

      <RequestsSheet visible={requestsOpen} onClose={() => setRequestsOpen(false)} />

      <Modal
        visible={langPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLangPickerOpen(false)}
      >
        <View style={styles.langBackdrop}>
          <Pressable style={{ flex: 1 }} onPress={() => setLangPickerOpen(false)} />
          <View style={[styles.langSheet, { backgroundColor: isDark ? "#0F0F1A" : colors.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.langHandle, { backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)" }]} />
            <View style={styles.langHeader}>
              <Text style={[styles.langTitle, { color: text }]}>{t("language.title")}</Text>
              <Pressable onPress={() => setLangPickerOpen(false)} hitSlop={12}>
                <Feather name="x" size={22} color={text} />
              </Pressable>
            </View>
            <Text style={[styles.langSub, { color: muted }]}>{t("language.subtitle")}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
              {SUPPORTED_LANGUAGES.map((opt) => {
                const active = opt.code === currentLang;
                return (
                  <Pressable
                    key={opt.code}
                    onPress={() => onPickLanguage(opt.code)}
                    style={({ pressed }) => [
                      styles.langRow,
                      {
                        backgroundColor: active ? "rgba(168,85,247,0.2)" : isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                        borderColor: active ? AG_PURPLE : border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.langRowIcon, { backgroundColor: active ? "rgba(168,85,247,0.15)" : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
                      <Feather name="globe" size={16} color={active ? AG_PURPLE : muted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.langRowLabel, { color: active ? "#D8B4FE" : text }]}>{opt.native}</Text>
                      <Text style={[styles.langRowSub, { color: muted }]}>
                        {opt.label}{opt.rtl ? "  •  RTL" : ""}
                      </Text>
                    </View>
                    {active && <Feather name="check" size={18} color={AG_PURPLE} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

function deriveVibe(count: number): {
  labelKey: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  fg: string;
  bg: string;
  border: string;
} {
  if (count === 0) {
    return { labelKey: "home.quietZone", icon: "moon",  fg: "#475569", bg: "#F1F5F9", border: "#CBD5E1" };
  }
  if (count <= 3) {
    return { labelKey: "home.fewSouls",  icon: "user",  fg: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD" };
  }
  return     { labelKey: "home.livelyHere", icon: "zap", fg: "#B45309", bg: "#FEF3C7", border: "#FCD34D" };
}

const storeDemoHomeStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#050814" },
  content: { paddingHorizontal: 14, paddingTop: 8, gap: 9 },
  intro: { gap: 4, paddingBottom: 0 },
  sampleBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(167,139,250,.12)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,.22)",
  },
  sampleBadgeText: { color: "#C4B5FD", fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.9 },
  title: { color: "#F8FAFC", fontSize: 20, lineHeight: 25, fontFamily: "Inter_700Bold" },
  subtitle: { color: "#9AA7BC", fontSize: 10, lineHeight: 14, fontFamily: "Inter_400Regular" },
  mapCard: {
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
    padding: 10,
    gap: 6,
  },
  mapHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mapTitle: { color: "#F8FAFC", fontSize: 12, fontFamily: "Inter_700Bold" },
  mapCaption: { color: "#8591A6", fontSize: 8, marginTop: 2, fontFamily: "Inter_400Regular" },
  map: {
    height: 154,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0B1727",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,.12)",
  },
  worldMap: { width: "100%", height: "100%" },
  region: {
    position: "absolute",
    color: "rgba(203,213,225,.72)",
    fontSize: 6,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.7,
  },
  disclaimer: { color: "#78869C", fontSize: 8, lineHeight: 11, fontFamily: "Inter_400Regular" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 0 },
  sectionTitle: { color: "#F8FAFC", fontSize: 13, fontFamily: "Inter_700Bold" },
  sectionSub: { color: "#78869C", fontSize: 8, marginTop: 2, fontFamily: "Inter_400Regular" },
  venueCarousel: { gap: 8, paddingRight: 14 },
  venueCard: {
    width: 166,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,.045)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
  },
  venueIcon: { width: 27, height: 27, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  venueName: { color: "#F8FAFC", fontSize: 9, fontFamily: "Inter_600SemiBold" },
  venueMeta: { color: "#8591A6", fontSize: 7, marginTop: 2, fontFamily: "Inter_400Regular" },
  venueCount: { color: "#E2E8F0", fontSize: 10, fontFamily: "Inter_700Bold" },
  checkinButton: {
    minHeight: 44,
    borderRadius: 13,
    backgroundColor: "#A78BFA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 2,
  },
  checkinButtonText: { color: "#07101A", fontSize: 12, fontFamily: "Inter_700Bold" },
});

// The store preview gets its own daylight treatment; the live Home screen and
// the established dark preview retain their existing visual language.
const storeDemoLightStyles = StyleSheet.create({
  page: { backgroundColor: "#F4F6F0" },
  content: { paddingHorizontal: 18, paddingTop: 18, gap: 17 },
  intro: { gap: 9, paddingBottom: 7 },
  sampleBadge: {
    backgroundColor: "#E1EFE5",
    borderColor: "#BBD9C6",
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  sampleBadgeText: { color: "#246B54", fontSize: 9, letterSpacing: 1.25 },
  title: {
    color: "#19332E",
    fontSize: 29,
    lineHeight: 34,
    letterSpacing: -0.8,
    maxWidth: 330,
  },
  subtitle: { color: "#516B61", fontSize: 12, lineHeight: 18, maxWidth: 295 },
  mapCard: {
    backgroundColor: "#FFFDF8",
    borderColor: "#D8E5DC",
    borderRadius: 23,
    padding: 14,
    gap: 11,
    shadowColor: "#355B48",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 2,
  },
  mapHeader: { paddingHorizontal: 2, paddingTop: 2 },
  mapTitle: { color: "#19332E", fontSize: 16, letterSpacing: -0.3 },
  mapCaption: { color: "#577267", fontSize: 10, marginTop: 4 },
  map: {
    height: 175,
    backgroundColor: "#E9F3F0",
    borderColor: "#C4DBD4",
    borderRadius: 15,
  },
  region: { color: "#385D56", fontSize: 7, letterSpacing: 0.8 },
  disclaimer: { color: "#5D746B", fontSize: 9, lineHeight: 13, paddingHorizontal: 2 },
  sectionHeading: { marginTop: 5, paddingHorizontal: 2 },
  sectionTitle: { color: "#19332E", fontSize: 17, letterSpacing: -0.35 },
  sectionSub: { color: "#5D746B", fontSize: 10, marginTop: 4 },
  venueCarousel: { gap: 10, paddingRight: 18, paddingBottom: 4 },
  venueCard: {
    width: 205,
    minHeight: 66,
    gap: 10,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: "#FFFDF8",
    borderColor: "#D8E5DC",
  },
  venueIcon: { width: 36, height: 36, borderRadius: 11 },
  venueName: { color: "#19332E", fontSize: 11 },
  venueMeta: { color: "#5D746B", fontSize: 9, marginTop: 4 },
  venueCount: { color: "#246B54", fontSize: 12 },
  checkinButton: {
    minHeight: 51,
    borderRadius: 15,
    backgroundColor: "#246B54",
    marginTop: 2,
    shadowColor: "#246B54",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 2,
  },
  checkinButtonText: { color: "#F6F7F0", fontSize: 13 },
});

// Short Android store viewports have substantially less space below AppHeader.
// Tighten only the light demo, so the map, two venue previews and CTA can
// share the first frame without shrinking the full-size Apple composition.
const storeDemoCompactStyles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 8, gap: 6 },
  intro: { gap: 3, paddingBottom: 1 },
  sampleBadge: { paddingHorizontal: 8, paddingVertical: 3 },
  title: { fontSize: 22, lineHeight: 25, letterSpacing: -0.5, maxWidth: 320 },
  subtitle: { fontSize: 10, lineHeight: 13, maxWidth: 330 },
  mapCard: { padding: 9, gap: 4, borderRadius: 17 },
  mapHeader: { paddingTop: 0 },
  mapTitle: { fontSize: 13 },
  mapCaption: { fontSize: 9, marginTop: 1 },
  map: { height: 111, borderRadius: 10 },
  disclaimer: { fontSize: 8, lineHeight: 10 },
  sectionHeading: { marginTop: 1 },
  sectionTitle: { fontSize: 14 },
  sectionSub: { fontSize: 8, marginTop: 1 },
  venueCarousel: { gap: 7, paddingBottom: 0 },
  venueCard: { width: 157, minHeight: 46, paddingHorizontal: 7, paddingVertical: 5, gap: 6, borderRadius: 11 },
  venueIcon: { width: 26, height: 26, borderRadius: 8 },
  venueName: { fontSize: 9 },
  venueMeta: { fontSize: 7, marginTop: 1 },
  checkinButton: { minHeight: 37, borderRadius: 11, marginTop: 0 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AG_BG },

  // ── Aurora ambient blobs ───────────────────────────────────────────────────
  auroraBlob1: {
    position: "absolute", width: 340, height: 340, borderRadius: 170,
    top: -100, left: -100,
  },
  auroraBlob2: {
    position: "absolute", width: 280, height: 280, borderRadius: 140,
    top: 100, right: -80,
  },
  auroraBlob3: {
    position: "absolute", width: 400, height: 400, borderRadius: 200,
    bottom: 80, left: 0,
  },

  // ── Banners ────────────────────────────────────────────────────────────────
  banner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 20, marginTop: 16,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1,
  },
  permAlertIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  bannerAvatars: { flexDirection: "row", alignItems: "center" },
  avatarStack: { borderRadius: 20, borderWidth: 2 },
  bannerTitle: { fontFamily: "Inter_700Bold", fontSize: 14 },
  bannerSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },

  // ── Beacon pill ───────────────────────────────────────────────────────────
  beaconPillRow: { alignItems: "center", marginTop: 24, marginBottom: 4 },
  beaconPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  liveDotWrap: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  liveDotPing: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: AG_PURPLE },
  liveDotCore: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: AG_PURPLE },
  beaconLabel: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 3 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroSection: { alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  heroNumber: { fontFamily: "Inter_700Bold", fontSize: 80, lineHeight: 88, color: AG_PURPLE },
  heroSub:    { fontFamily: "Inter_400Regular", fontSize: 16, color: AG_MUTED, marginTop: 4 },
  heroOffline: { fontFamily: "Inter_700Bold", fontSize: 20, lineHeight: 28, color: AG_TEXT, marginTop: 16, textAlign: "center" },
  vibePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, marginTop: 12,
  },
  vibeText: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" },

  // ── Heatmap ───────────────────────────────────────────────────────────────
  heatmapSection: {
    marginHorizontal: 12,
    height: 340,
    borderRadius: 170, // full circle — half of the 340px height
    marginTop: 16,
    borderWidth: 1, borderColor: AG_BORDER,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  // ── Quick actions ─────────────────────────────────────────────────────────
  quickActionsRow: { flexDirection: "row", marginHorizontal: 20, marginTop: 14, gap: 12 },
  quickActionCard: {
    flex: 1, alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 18,
    borderRadius: 20, borderWidth: 1, borderColor: AG_BORDER,
    backgroundColor: AG_CARD,
  },
  quickActionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  quickActionLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: AG_TEXT },

  // ── This Week card ────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 2,
    textTransform: "uppercase", color: AG_MUTED, marginBottom: 14,
  },
  weeklyCard: {
    marginHorizontal: 20, marginTop: 14, padding: 18,
    borderRadius: 20, borderWidth: 1, borderColor: AG_BORDER,
    backgroundColor: AG_CARD,
  },
  weeklyRow: { flexDirection: "row", alignItems: "stretch" },
  weeklyCell: { flex: 1, alignItems: "flex-start", gap: 4, paddingVertical: 4, paddingRight: 4, position: "relative" },
  weeklyChev: { position: "absolute", top: 6, right: 0, opacity: 0.6 },
  weeklyDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: 14, backgroundColor: AG_BORDER },
  weeklyValue: { fontFamily: "Inter_700Bold", fontSize: 28, color: AG_TEXT },
  weeklyLabel: { fontFamily: "Inter_400Regular", fontSize: 12, color: AG_MUTED },
  weeklyHint: {
    fontFamily: "Inter_400Regular", fontSize: 12, color: AG_MUTED, fontStyle: "italic",
    marginTop: 14, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: AG_BORDER,
  },

  // ── Referral CTA ──────────────────────────────────────────────────────────
  referralCard: {
    marginHorizontal: 20, marginTop: 14,
    borderRadius: 16, borderWidth: 1, borderColor: AG_BORDER,
    paddingVertical: 14, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
    overflow: "hidden",
  },
  referralIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  referralTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },

  // ── Language picker ───────────────────────────────────────────────────────
  langBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  langSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, maxHeight: "80%" },
  langHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 16 },
  langHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  langTitle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  langSub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 },
  langRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  langRowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  langRowLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  langRowSub: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 1 },
});
