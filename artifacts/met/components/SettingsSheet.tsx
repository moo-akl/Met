import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import React, { useEffect, useState } from "react";
import {
  Alert,
  DevSettings,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { PhotoVerifier } from "@/components/PhotoVerifier";
import { TierBadge } from "@/components/TierBadge";
import { useApp } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { useVisibility } from "@/hooks/useVisibility";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import { getVenueOwnerDestination } from "@/lib/venueOwnerLifecycle";
import { type AccountInfo, getCurrentUserAccount } from "@/lib/auth";
import {
  type LangCode,
  setLanguage,
  SUPPORTED_LANGUAGES,
  useT,
} from "@/lib/i18n";
import { useReferrals } from "@/lib/referrals";
import { useSubscription } from "@/lib/revenuecat";
import {
  type AutoCleanupDays,
  type DiscoveryRange,
} from "@/lib/storage";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type SheetView =
  | "menu"
  | "blocked"
  | "notifications"
  | "about"
  | "language"
  | "privacy"
  | "terms";

// External "About Met" links. Leave empty to hide the row entirely so we
// don't ship a broken link. Fill RATE_URL_* in once you have the real
// App Store / Play Store listings.
const RATE_URL_IOS = "";
const RATE_URL_ANDROID = "";

const PRIVACY_POLICY = `Privacy Policy for Met
Last Updated: March 2026

At Met, we respect your privacy and are committed to protecting the personal data of our users. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.

1. Information We Collect
To provide our core "Nearby Encounter" services, we collect the following:

Account Information: Display name, profile photo, bio, and social media links you choose to provide.

Location Data: Precise GPS coordinates.

Bluetooth Data: Unique, non-identifiable numeric hashes (UID Hashes) used for device-to-device recognition via Bluetooth Low Energy (BLE).

Authentication Data: Email addresses and login credentials managed securely via Google Firebase.

2. Use of Background Location & Bluetooth (Core Disclosure)
Met's primary purpose is to help you discover people you have physically crossed paths with. To function correctly, Met collects location data and performs Bluetooth scanning even when the app is closed or not in use.

Why we need this: Without background access, the app cannot "detect" an encounter unless you have the app open in your hand at the exact moment you pass someone.

Proximity vs. History: We do not build a permanent map of your movements. Location data is used transiently to calculate proximity to other users and is only recorded as a static "Encounter" event (Time + Approximate Location) when a match is found.

User Control: You can disable background tracking at any time in your device settings, though this will prevent the app from recording new encounters.

3. How We Use Your Information
Facilitating Encounters: Matching your UID Hash with others in physical proximity.

Profile Display: Showing your chosen profile details to users you have "Met."

Safety & Blocking: Maintaining your "Blocked Users" list to ensure you remain invisible to specific individuals.

4. Data Sharing & Third-Party Services
We do not sell your personal or location data. We use the following secure sub-processors:

Google Play Services: For core Android functionality.

Google Firebase: For encrypted data storage, real-time database, and authentication.

5. Data Retention & Account Deletion
We only store data for as long as your account is active.

In-App Deletion: You may delete your account via the Profile Settings. This action permanently deletes your profile, location breadcrumbs, and encounter history from our active databases.

Web-Based Deletion: In compliance with Google Play requirements, if you have deleted the app and wish to request data removal, you may do so via our Data Deletion Request Form.

6. Security
Your data is encrypted in transit (SSL/TLS) and at rest using Google's enterprise-grade security infrastructure. We implement strict access controls to ensure your location data remains private.

7. Contact Us
For questions regarding this policy or your data, contact us at: metapp.contact@gmail.com`;

const TERMS_AND_CONDITIONS = `Terms & Conditions for Met
Last Updated: April 27, 2026

1. Introduction & Acceptance
By downloading or using the Met mobile application ("the App"), you agree to be bound by these Terms & Conditions. If you do not agree, do not use the App. These terms constitute a legally binding agreement between you and MetApp Founders.

2. Eligibility
Age: You must be at least 18 years old to use Met. By using the App, you represent and warrant that you meet this age requirement.

Verification: You agree to provide accurate information and may be required to complete AI-powered face verification to maintain account standing.

3. Description of Service: The "Social Radar"
Met is a social discovery platform that uses Background Location and Bluetooth Low Energy (BLE) to detect when users "cross paths" in the real world.

Encounters: An "Encounter" is recorded when two users are within a specific proximity.

Visibility: You can toggle your visibility at any time. When "Ghost Mode" is active, your location will not be broadcast to others.

4. Location & Background Data Usage
To provide the core "Social Radar" value, Met requires Always-On Location Access.

Purpose: We collect your location data even when the app is closed or not in use to facilitate proximity alerts and record encounters.

Privacy: We do not share your live, exact GPS coordinates with other users. We only notify users that an "Encounter" has occurred within a general proximity.

5. User Conduct & Safety
You agree NOT to use Met for:

Stalking, harassing, or intimidating any individual.

Impersonating others or creating "bot" accounts.

Scraping data or reverse-engineering the App's radar technology.

Real-World Safety: You are solely responsible for your interactions with other users. Met facilitates digital discovery but does not vet the physical safety of every user. Always meet in public, well-lit places.

6. Objectionable Content & Reporting
Met has a Zero-Tolerance Policy for objectionable content or abusive users.

UGC: You own the content you post, but you grant Met a license to display it.

Reporting: Users can report any profile for inappropriate behavior.

24-Hour Action: We commit to reviewing and taking action on reported content within 24 hours. We reserve the right to terminate accounts immediately for safety violations.

7. Limitation of Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, MET SHALL NOT BE LIABLE FOR ANY DAMAGES RESULTING FROM:

Physical or emotional harm arising from real-world meetings between users.

Unauthorized access to your location data resulting from device theft.

Any technical failure of the "Social Radar" to accurately detect proximity.

8. Account Termination
We reserve the right to suspend or delete your account at our sole discretion, without notice, if we believe you have violated these Terms or pose a safety risk to the community.

9. Changes to Terms
We may update these terms in 2026 to reflect new technology or regulations. Continued use of the App after changes constitutes acceptance of the new terms.

10. Contact Us
For support or to report a violation, contact: metapp.contact@gmail.com`;

function cleanupLabel(t: (k: string) => string, days: AutoCleanupDays): string {
  switch (days) {
    case 0:
      return t("settings.cleanupOff");
    case 30:
      return t("settings.cleanupAfter30");
    case 60:
      return t("settings.cleanupAfter60");
    case 90:
      return t("settings.cleanupAfter90");
    default:
      return String(days);
  }
}

function rangeLabel(t: (k: string) => string, r: DiscoveryRange): string {
  switch (r) {
    case "room":
      return t("settings.rangeRoom");
    case "nearby":
      return t("settings.rangeNearby");
    case "venue":
      return t("settings.rangeVenue");
    default:
      return String(r);
  }
}

function formatVerifiedDate(
  ts: number,
  lang: string,
  recentlyLabel: string,
): string {
  try {
    return new Date(ts).toLocaleDateString(lang, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return recentlyLabel;
  }
}

export function SettingsSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const { theme, toggleTheme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const webBot = Platform.OS === "web" ? 34 : 0;
  const { t, lang } = useT();
  const {
    profile,
    setProfile,
    authedUid,
    blockedEncounters,
    setBlocked,
    resetAll,
    signOutAndClear,
    preferences,
    updatePreferences,
    markPhotoVerified,
  } = useApp();

  // Wrapper that updates AsyncStorage preferences AND syncs them server-side
  // so the server can suppress unwanted push notifications.
  const updateNotifPrefs = (
    partial: Partial<Pick<typeof preferences, "notifyRecurringMeets" | "notifyChat">>,
  ) => {
    updatePreferences(partial);
    if (!authedUid) return;
    const serverPrefs: Parameters<typeof api.syncNotificationPrefs>[1] = {};
    if (partial.notifyRecurringMeets !== undefined)
      serverPrefs.notifyReencounter = partial.notifyRecurringMeets;
    if (partial.notifyChat !== undefined)
      serverPrefs.notifyChat = partial.notifyChat;
    if (Object.keys(serverPrefs).length > 0) {
      api.syncNotificationPrefs({ uid: authedUid }, serverPrefs).catch(() => {});
    }
  };
  const { tier, promoPlusActive } = useSubscription();
  const referrals = useReferrals();
  const router = useRouter();
  const {
    profile: venueOwnerProfile,
    isLoading: venueOwnerLoading,
    error: venueOwnerError,
  } = useVenueOwner();
  // App Store Review Guideline 5.1.2(i): the visibility toggle MUST go
  // through the shared `useVisibility` hook so the first-time consent
  // dialog fires for every hidden→visible transition (header pill AND
  // settings switch alike). Reading isVisible from the hook also keeps
  // the default in sync with the AppContext default of `false`.
  const { isVisible, toggle: toggleVisibility } = useVisibility();
  const [rtlNotice, setRtlNotice] = useState(false);
  const [reloading, setReloading] = useState(false);
  // The language the user has tapped but not yet confirmed. We show a small
  // restart-confirmation modal first so the language change isn't applied
  // accidentally — once confirmed we run the existing apply+reload logic.
  const [pendingLang, setPendingLang] = useState<LangCode | null>(null);

  const onPickLanguage = (code: LangCode) => {
    // Guard: ignore taps once the reload countdown is in flight, and skip a
    // no-op switch to the already-active language so we don't pop a confirm
    // modal for nothing.
    if (reloading || code === lang) return;
    setPendingLang(code);
  };

  const cancelPendingLang = () => {
    setPendingLang(null);
  };

  const confirmPendingLang = async () => {
    const code = pendingLang;
    if (!code || reloading) return;
    // Flip the single-flight guard *synchronously*, before any await, so a
    // rapid second tap on Restart can't kick off a second setLanguage call
    // or schedule a duplicate reload timer.
    setPendingLang(null);
    setReloading(true);
    let rtlChanged = false;
    try {
      ({ rtlChanged } = await setLanguage(code));
    } catch {
      // If persisting the language fails, undo the guard so the user can
      // retry. We don't surface the error here because setLanguage already
      // updates the in-memory locale and the picker will reflect the
      // current state on next render.
      setReloading(false);
      return;
    }
    if (rtlChanged) {
      setRtlNotice(true);
    }
    // Brief "Switching language…" overlay, then perform a real JS reload so
    // every cached string and the native layout direction picks up the new
    // locale cleanly. expo-updates is the production-grade path on iOS and
    // Android; DevSettings.reload is the dev-build / Expo Go fallback; on
    // web we just bounce window.location.
    setTimeout(() => {
      void reloadApp(rtlChanged);
    }, 1500);
  };

  const reloadApp = async (rtlChanged: boolean) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        window.location.reload();
        return;
      } catch {}
    } else {
      // Try expo-updates first (works in production builds and in Expo Go).
      // reloadAsync returns a Promise that may reject if the Updates module
      // is unavailable in this build, so we await + catch instead of relying
      // on a sync try/catch.
      try {
        await Updates.reloadAsync();
        return;
      } catch {}
      // Dev-client / Expo Go fallback.
      try {
        DevSettings.reload();
        return;
      } catch {}
    }
    // Last-ditch fallback: drop the overlay and return to the settings menu.
    // Strings update reactively, so the user still sees the new language; on
    // Arabic RTL flips we keep the picker open so the user sees the
    // restartNotice card asking them to relaunch manually.
    setReloading(false);
    if (!rtlChanged) {
      setView("menu");
    }
  };

  const [view, setView] = useState<SheetView>("menu");
  const [confirmDelete, setConfirmDelete] = useState(false);
  // null = not yet asked, true = keep venue profile, false = delete venue profile too
  const [keepVenueProfile, setKeepVenueProfile] = useState<boolean | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Signed-in account snapshot for the "Signed in as ..." row. Refreshed
  // every time the sheet opens — cheap (one Firebase getter) and ensures
  // the email shown matches the actual session even if it changed in a
  // background flow (token refresh, provider re-link, etc.).
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void getCurrentUserAccount().then((info) => {
      if (!cancelled) setAccountInfo(info);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Map the provider tag to its localized display label. Brand names
  // (Apple, Google) stay verbatim across all languages.
  const providerLabel = (() => {
    if (!accountInfo) return null;
    switch (accountInfo.provider) {
      case "apple":
        return t("settings.providerApple");
      case "google":
        return t("settings.providerGoogle");
      case "password":
        return t("settings.providerEmail");
      default:
        return null;
    }
  })();
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [cleanupMenuOpen, setCleanupMenuOpen] = useState(false);

  const close = () => {
    setView("menu");
    setConfirmDelete(false);
    setDeletingAccount(false);
    setReverifying(false);
    setSignOutConfirm(false);
    setSigningOut(false);
    setRangeMenuOpen(false);
    setCleanupMenuOpen(false);
    setRtlNotice(false);
    setPendingLang(null);
    onClose();
  };

  const appVersion =
    (Constants.expoConfig?.version as string | undefined) ?? "1.0.0";

  const openLink = (url: string) => {
    WebBrowser.openBrowserAsync(url).catch(() => {});
  };
  const openVenueManager = () => {
    router.push("/venue-owner/dashboard");
  };

  const headerTitle = (() => {
    switch (view) {
      case "menu":
        return t("settings.title");
      case "blocked":
        return t("settings.blockedTitle");
      case "notifications":
        return t("settings.notificationsTitle");
      case "about":
        return t("settings.aboutTitle");
      case "language":
        return t("language.title");
      case "privacy":
        return t("settings.aboutPrivacy");
      case "terms":
        return t("settings.aboutTerms");
    }
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={close} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + webBot + 20,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />

          <View style={styles.headerRow}>
            {view !== "menu" ? (
              <Pressable onPress={() => setView("menu")} hitSlop={12}>
                <Feather name="chevron-left" size={24} color={colors.foreground} />
              </Pressable>
            ) : (
              <View style={{ width: 24 }} />
            )}
            <Text style={[styles.title, { color: colors.foreground }]}>
              {headerTitle}
            </Text>
            <Pressable onPress={close} hitSlop={12}>
              <Feather name="x" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          {view === "menu" ? (
            <ScrollView
              style={{ maxHeight: 540 }}
              contentContainerStyle={{ gap: 10 }}
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                onPress={() => {
                  close();
                  setTimeout(() => router.push("/paywall"), 50);
                }}
                style={({ pressed }) => [
                  styles.plusRow,
                  {
                    borderColor: colors.primary,
                    backgroundColor: tier === "pro" ? colors.secondary : colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.plusIcon}>
                  <Feather
                    name={tier === "pro" ? "star" : "zap"}
                    size={18}
                    color="#FFFFFF"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={styles.plusTitle}>
                      {tier === "pro"
                        ? t("settings.planProActive")
                        : tier === "plus"
                          ? promoPlusActive
                            ? t("settings.planPlusViaReferral")
                            : t("settings.planPlusActive")
                          : t("settings.planUpgrade")}
                    </Text>
                    {tier !== "free" ? <TierBadge tier={tier} /> : null}
                  </View>
                  <Text style={styles.plusSub}>
                    {tier === "pro"
                      ? t("settings.planProSub")
                      : tier === "plus"
                        ? t("settings.planPlusSub")
                        : t("settings.planUpgradeSub")}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#FFFFFF" />
              </Pressable>

              <SectionLabel label={t("settings.sectionDiscovery")} colors={colors} />

              <View
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: colors.background },
                  ]}
                >
                  <Feather
                    name="radio"
                    size={18}
                    color={isVisible ? colors.primary : colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                    {t("settings.visibleOnRadar")}
                  </Text>
                  <Text
                    style={[styles.rowSub, { color: colors.mutedForeground }]}
                  >
                    {isVisible
                      ? t("settings.visibleOnRadarOn")
                      : t("settings.visibleOnRadarOff")}
                  </Text>
                </View>
                <Switch
                  value={isVisible}
                  onValueChange={() => {
                    // Delegate to the shared hook so the first-time
                    // consent dialog fires consistently. The Switch
                    // component fights us a bit because it eagerly
                    // flips its visual state — useVisibility.toggle
                    // re-syncs `profile.isVisible` either way (after
                    // user confirms or after they cancel), and the
                    // Switch is a controlled component bound to that
                    // value, so the visual state corrects itself on
                    // the next render.
                    void toggleVisibility();
                  }}
                  trackColor={{ false: "#D1D5DB", true: colors.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#D1D5DB"
                />
              </View>

              <NavRow
                icon="target"
                label={t("settings.discoveryRange")}
                sub={rangeLabel(t, preferences.discoveryRange)}
                onPress={() => setRangeMenuOpen(true)}
                colors={colors}
              />

              <SectionLabel label={t("settings.sectionPreferences")} colors={colors} />

              <NavRow
                icon="globe"
                label={t("settings.language")}
                sub={
                  SUPPORTED_LANGUAGES.find((s) => s.code === lang)?.native ??
                  t("language.deviceDefault")
                }
                onPress={() => setView("language")}
                colors={colors}
              />

              <NavRow
                icon={theme === "dark" ? "moon" : "sun"}
                label={t("settings.appearance")}
                sub={theme === "dark" ? t("settings.themeDark") : t("settings.themeLight")}
                onPress={() => toggleTheme()}
                colors={colors}
              />

              <NavRow
                icon="bell"
                label={t("settings.notifications")}
                sub={
                  preferences.notifyDailyRecap || preferences.notifyRecurringMeets
                    ? t("settings.notificationsOn")
                    : t("settings.notificationsOff")
                }
                onPress={() => setView("notifications")}
                colors={colors}
              />

              <NavRow
                icon="shield"
                label={t("settings.permissions")}
                sub={t("settings.permissionsSub")}
                onPress={() => {
                  // Navigate to the in-app permissions screen so the user can
                  // see the current granted/denied state for each permission
                  // and tap "Open Settings" for any that need to be changed.
                  // The permissions screen handles the OS Settings deep-link
                  // for denied rows, and shows an X close button when
                  // permissionsCompleted is true (i.e. opened from settings).
                  close();
                  setTimeout(() => router.push("/permissions"), 50);
                }}
                colors={colors}
              />

              <NavRow
                icon="archive"
                label={t("settings.autoCleanup")}
                sub={
                  preferences.autoCleanupDays === 0
                    ? t("settings.cleanupOff")
                    : t("settings.cleanupAfterDays", {
                        days: preferences.autoCleanupDays,
                      })
                }
                onPress={() => setCleanupMenuOpen(true)}
                colors={colors}
              />

              <SectionLabel label={t("settings.sectionAccount")} colors={colors} />

              {accountInfo ? (
                <View
                  style={[
                    styles.row,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <Feather
                      name={
                        accountInfo.provider === "password" ? "mail" : "user"
                      }
                      size={18}
                      color={colors.foreground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={[styles.rowLabel, { color: colors.foreground }]}
                      >
                        {t("settings.signedInAs")}
                      </Text>
                      {accountInfo.emailVerified ? (
                        <View
                          style={[
                            styles.verifiedDot,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Feather name="check" size={8} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.rowSub, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                      ellipsizeMode="middle"
                    >
                      {accountInfo.email ?? t("settings.noEmail")}
                    </Text>
                  </View>
                  {providerLabel ? (
                    <Text
                      style={[styles.rowAction, { color: colors.mutedForeground }]}
                    >
                      {providerLabel}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <NavRow
                icon="gift"
                label={t("settings.referrals")}
                sub={
                  referrals.reward
                    ? t("settings.referralsRewardEarned")
                    : t("settings.referralsProgress", {
                        count: referrals.count,
                      })
                }
                onPress={() => {
                  close();
                  setTimeout(() => router.push("/referrals"), 50);
                }}
                colors={colors}
              />

              {!venueOwnerLoading && !venueOwnerError ? (
                <Pressable
                  testID="venue-owner-profile-switcher"
                  onPress={() => {
                    close();
                    setTimeout(() => {
                      if (venueOwnerProfile?.isApproved) {
                        openVenueManager();
                      } else {
                        router.push(getVenueOwnerDestination(venueOwnerProfile));
                      }
                    }, 50);
                  }}
                  style={({ pressed }) => [
                    styles.venueCtaCard,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={styles.venueCtaIconWrap}>
                    <Feather name="home" size={20} color="#92400E" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.venueCtaLabel}>
                      {venueOwnerProfile
                        ? venueOwnerProfile.isApproved
                          ? "Open Venue Manager"
                          : t("settings.venueOwnerDashboard")
                        : t("settings.registerVenue")}
                    </Text>
                    <Text style={styles.venueCtaSub} numberOfLines={2}>
                      {venueOwnerProfile
                        ? venueOwnerProfile.isApproved
                          ? t("settings.venueOwnerApproved")
                          : venueOwnerProfile.applicationStatus === "rejected" ||
                              venueOwnerProfile.applicationStatus === "changes_requested"
                            ? t("settings.venueOwnerRejected")
                            : t("settings.venueOwnerPending")
                        : t("settings.registerVenueSub")}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color="#92400E" />
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => {
                  if (profile?.photoUri) setReverifying(true);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <Feather
                      name="check-circle"
                      size={18}
                      color={
                        profile?.verified ? colors.primary : colors.mutedForeground
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={[styles.rowLabel, { color: colors.foreground }]}
                      >
                        {t("settings.verifiedPhoto")}
                      </Text>
                      {profile?.verified ? (
                        <View
                          style={[
                            styles.verifiedDot,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Feather name="check" size={8} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.rowSub, { color: colors.mutedForeground }]}
                    >
                      {profile?.photoVerifiedAt
                        ? t("settings.verifiedPhotoLast", {
                            date: formatVerifiedDate(
                              profile.photoVerifiedAt,
                              lang,
                              t("common.recently"),
                            ),
                          })
                        : profile?.verified
                          ? t("settings.verifiedPhotoTapReverify")
                          : t("settings.verifiedPhotoTapVerify")}
                    </Text>
                  </View>
                  <Text style={[styles.rowAction, { color: colors.primary }]}>
                  {profile?.verified
                    ? t("settings.reverify")
                    : t("settings.verify")}
                </Text>
              </Pressable>

              <NavRow
                icon="slash"
                label={t("settings.blockedPeople")}
                sub={
                  blockedEncounters.length === 0
                    ? t("settings.noOneBlocked")
                    : t("settings.peopleBlocked", {
                        count: blockedEncounters.length,
                      })
                }
                onPress={() => setView("blocked")}
                colors={colors}
              />

              <NavRow
                icon="info"
                label={t("settings.aboutMet")}
                sub={t("settings.aboutVersion", { version: appVersion })}
                onPress={() => setView("about")}
                colors={colors}
              />

              {signOutConfirm ? (
                <View
                  style={[
                    styles.confirmCard,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.confirmTitle, { color: colors.foreground }]}
                  >
                    {t("settings.signOutConfirmTitle")}
                  </Text>
                  <Text
                    style={[styles.confirmSub, { color: colors.mutedForeground }]}
                  >
                    {t("settings.signOutConfirmBody")}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={() => setSignOutConfirm(false)}
                      disabled={signingOut}
                      style={({ pressed }) => [
                        styles.confirmBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: pressed || signingOut ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.confirmBtnText,
                          { color: colors.foreground },
                        ]}
                      >
                        {t("common.cancel")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        if (signingOut) return;
                        setSigningOut(true);
                        try {
                          // signOutAndClear wipes profile/encounters/prefs
                          // and signs out of Firebase. ProfileGate sees
                          // profile go null and routes to /onboarding, so
                          // no manual nav needed.
                          await signOutAndClear();
                          close();
                        } finally {
                          setSigningOut(false);
                        }
                      }}
                      style={({ pressed }) => [
                        styles.confirmBtn,
                        {
                          backgroundColor: colors.primary,
                          borderColor: colors.primary,
                          opacity: pressed || signingOut ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.confirmBtnText, { color: "#FFFFFF" }]}>
                        {t("settings.signOutConfirmAction")}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setSignOutConfirm(true)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <Feather
                      name="log-out"
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                      {t("settings.signOut")}
                    </Text>
                    <Text
                      style={[styles.rowSub, { color: colors.mutedForeground }]}
                    >
                      {t("settings.signOutSub")}
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              )}

              {confirmDelete ? (
                venueOwnerProfile != null && keepVenueProfile === null ? (
                  /* ── Step 1: Ask about venue profile ─────────────────── */
                  <View
                    style={[
                      styles.confirmCard,
                      { backgroundColor: colors.muted, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.confirmTitle, { color: colors.foreground }]}>
                      What about your venue profile?
                    </Text>
                    <Text style={[styles.confirmSub, { color: colors.mutedForeground }]}>
                      You have a venue on Met. Would you like to keep it or remove it along with your account?
                    </Text>
                    <View style={{ gap: 8 }}>
                      <Pressable
                        onPress={() => setKeepVenueProfile(true)}
                        style={({ pressed }) => [
                          styles.confirmBtn,
                          { flex: 1, backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Text style={[styles.confirmBtnText, { color: colors.foreground }]}>
                          Keep venue profile
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setKeepVenueProfile(false)}
                        style={({ pressed }) => [
                          styles.confirmBtn,
                          { flex: 1, backgroundColor: colors.destructive + "18", borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Text style={[styles.confirmBtnText, { color: colors.destructive }]}>
                          Delete venue profile too
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setConfirmDelete(false)}
                        style={({ pressed }) => [
                          styles.confirmBtn,
                          { flex: 1, backgroundColor: "transparent", borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Text style={[styles.confirmBtnText, { color: colors.mutedForeground }]}>
                          {t("common.cancel")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                /* ── Step 2: Final delete confirmation ───────────────── */
                <View
                  style={[
                    styles.confirmCard,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.destructive,
                    },
                  ]}
                >
                  <Text
                    style={[styles.confirmTitle, { color: colors.destructive }]}
                  >
                    {t("settings.deleteAccountConfirmTitle")}
                  </Text>
                  <Text
                    style={[styles.confirmSub, { color: colors.mutedForeground }]}
                  >
                    {t("settings.deleteAccountConfirmBody")}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={() => setConfirmDelete(false)}
                      style={({ pressed }) => [
                        styles.confirmBtn,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.confirmBtnText,
                          { color: colors.foreground },
                        ]}
                      >
                        {t("common.cancel")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        if (deletingAccount) return;
                        setDeletingAccount(true);
                        try {
                          // Wipe Postgres, Firestore, and Firebase Auth
                          // server-side first. If the call fails, surface
                          // an error and keep the account intact so the
                          // user can retry.
                          if (authedUid && api.isConfigured()) {
                            await api.deleteMe(
                              { uid: authedUid },
                              venueOwnerProfile != null
                                ? { deleteVenueProfile: keepVenueProfile === false }
                                : undefined,
                            );
                          }
                          // Clear local storage and sign out of Firebase.
                          // ProfileGate then routes to /onboarding.
                          await signOutAndClear();
                          close();
                        } catch {
                          setDeletingAccount(false);
                          Alert.alert(
                            "Couldn't delete account",
                            "Something went wrong. Please check your connection and try again.",
                          );
                        }
                      }}
                      disabled={deletingAccount}
                      style={({ pressed }) => [
                        styles.confirmBtn,
                        {
                          backgroundColor: colors.destructive,
                          borderColor: colors.destructive,
                          opacity: pressed || deletingAccount ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.confirmBtnText, { color: "#FFFFFF" }]}
                      >
                        {deletingAccount
                          ? t("settings.deleteAccountDeleting")
                          : t("settings.deleteAccountConfirmAction")}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                )
              ) : (
                <Pressable
                  onPress={() => { setConfirmDelete(true); setKeepVenueProfile(null); }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: "#FEE2E2",
                      borderColor: colors.destructive,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: "#FFFFFF" },
                    ]}
                  >
                    <Feather
                      name="trash-2"
                      size={18}
                      color={colors.destructive}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.rowLabel,
                        { color: colors.destructive },
                      ]}
                    >
                      {t("settings.deleteAccount")}
                    </Text>
                    <Text
                      style={[
                        styles.rowSub,
                        { color: colors.destructive, opacity: 0.85 },
                      ]}
                    >
                      {t("settings.deleteAccountSub")}
                    </Text>
                  </View>
                </Pressable>
              )}
            </ScrollView>
          ) : view === "blocked" ? (
            <ScrollView
              style={{ maxHeight: 360 }}
              contentContainerStyle={{ gap: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {blockedEncounters.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Feather name="check-circle" size={30} color={colors.primary} />
                  <Text
                    style={[styles.emptyTitle, { color: colors.foreground }]}
                  >
                    {t("settings.noBlockedTitle")}
                  </Text>
                  <Text
                    style={[styles.emptySub, { color: colors.mutedForeground }]}
                  >
                    {t("settings.noBlockedBody")}
                  </Text>
                </View>
              ) : (
                blockedEncounters.map((e) => (
                  <View
                    key={e.id}
                    style={[
                      styles.blockedRow,
                      {
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Avatar uri={e.photoUri} size={42} />
                    <Text
                      style={[styles.blockedName, { color: colors.foreground }]}
                    >
                      {e.realName}
                    </Text>
                    <Pressable
                      onPress={() => setBlocked(e.id, false)}
                      style={({ pressed }) => [
                        styles.unblockBtn,
                        {
                          backgroundColor: colors.primary,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text style={styles.unblockText}>
                        {t("settings.unblock")}
                      </Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          ) : view === "notifications" ? (
            <View style={{ gap: 10 }}>
              <ToggleRow
                icon="calendar"
                label={t("settings.dailyRecap")}
                sub={t("settings.dailyRecapSub")}
                value={preferences.notifyDailyRecap}
                onValueChange={(v) =>
                  updatePreferences({ notifyDailyRecap: v })
                }
                colors={colors}
              />
              <ToggleRow
                icon="repeat"
                label={t("settings.reencounterNudges")}
                sub={t("settings.reencounterNudgesSub")}
                value={preferences.notifyRecurringMeets}
                onValueChange={(v) =>
                  updateNotifPrefs({ notifyRecurringMeets: v })
                }
                colors={colors}
              />
              <ToggleRow
                icon="message-circle"
                label={t("settings.notifyChat")}
                sub={t("settings.notifyChatSub")}
                value={preferences.notifyChat}
                onValueChange={(v) =>
                  updateNotifPrefs({ notifyChat: v })
                }
                colors={colors}
              />
              <Text
                style={[styles.notesHint, { color: colors.mutedForeground }]}
              >
                {t("settings.notificationsFooter")}
              </Text>
            </View>
          ) : view === "language" ? (
            <ScrollView
              style={{ maxHeight: 540 }}
              contentContainerStyle={{ gap: 8 }}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={[styles.notesHint, { color: colors.mutedForeground }]}
              >
                {t("language.subtitle")}
              </Text>
              {SUPPORTED_LANGUAGES.map((opt) => {
                const active = opt.code === lang;
                return (
                  <Pressable
                    key={opt.code}
                    onPress={() => onPickLanguage(opt.code)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.rowIcon,
                        {
                          backgroundColor: active
                            ? "rgba(255,255,255,0.25)"
                            : colors.background,
                        },
                      ]}
                    >
                      <Feather
                        name="globe"
                        size={18}
                        color={active ? "#FFFFFF" : colors.foreground}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.rowLabel,
                          { color: active ? "#FFFFFF" : colors.foreground },
                        ]}
                      >
                        {opt.native}
                      </Text>
                      <Text
                        style={[
                          styles.rowSub,
                          {
                            color: active
                              ? "rgba(255,255,255,0.85)"
                              : colors.mutedForeground,
                          },
                        ]}
                      >
                        {opt.label}
                        {opt.rtl ? "  •  RTL" : ""}
                      </Text>
                    </View>
                    {active ? (
                      <Feather name="check" size={18} color="#FFFFFF" />
                    ) : null}
                  </Pressable>
                );
              })}
              {rtlNotice ? (
                <View
                  style={[
                    styles.confirmCard,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.confirmTitle, { color: colors.foreground }]}
                  >
                    {t("language.restartNoticeTitle")}
                  </Text>
                  <Text
                    style={[styles.confirmSub, { color: colors.mutedForeground }]}
                  >
                    {t("language.restartNoticeBody")}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          ) : view === "about" ? (
            <ScrollView
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ gap: 10 }}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  styles.aboutCard,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.aboutHeader}>
                  <View
                    style={[
                      styles.aboutLogo,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Feather name="users" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.aboutTitle, { color: colors.foreground }]}
                    >
                      Met
                    </Text>
                    <Text
                      style={[
                        styles.aboutVersion,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {t("settings.aboutVersion", { version: appVersion })}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.aboutTagline, { color: colors.mutedForeground }]}
                >
                  {t("settings.aboutTagline")}
                </Text>
              </View>

              <AboutLink
                icon="shield"
                label={t("settings.aboutPrivacy")}
                onPress={() => setView("privacy")}
                colors={colors}
              />
              <AboutLink
                icon="file-text"
                label={t("settings.aboutTerms")}
                onPress={() => setView("terms")}
                colors={colors}
              />
              <View
                style={[
                  styles.contactCard,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: colors.background }]}>
                  <Feather name="mail" size={18} color={colors.foreground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactLabel, { color: colors.foreground }]}>
                    {t("settings.aboutContact")}
                  </Text>
                  <Text style={[styles.contactEmail, { color: colors.mutedForeground }]}>
                    metapp.contact@gmail.com
                  </Text>
                </View>
              </View>
              {RATE_URL_IOS && RATE_URL_ANDROID ? (
                <AboutLink
                  icon="star"
                  label={t("settings.aboutRate")}
                  onPress={() =>
                    openLink(
                      Platform.OS === "ios" ? RATE_URL_IOS : RATE_URL_ANDROID,
                    )
                  }
                  colors={colors}
                />
              ) : null}
            </ScrollView>
          ) : view === "privacy" ? (
            <ScrollView
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ padding: 4, paddingBottom: 16 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              <Text style={[styles.legalText, { color: colors.foreground }]}>
                {PRIVACY_POLICY}
              </Text>
            </ScrollView>
          ) : view === "terms" ? (
            <ScrollView
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ padding: 4, paddingBottom: 16 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              <Text style={[styles.legalText, { color: colors.foreground }]}>
                {TERMS_AND_CONDITIONS}
              </Text>
            </ScrollView>
          ) : null}
        </View>
      </View>

      <ActionSheet
        visible={rangeMenuOpen}
        onClose={() => setRangeMenuOpen(false)}
        title={t("settings.discoveryRange")}
        message={t("settings.discoveryRangeMsg")}
        actions={(["room", "nearby", "venue"] as DiscoveryRange[]).map(
          (opt) => ({
            label:
              rangeLabel(t, opt) +
              (preferences.discoveryRange === opt ? "  ✓" : ""),
            icon:
              opt === "room" ? "home" : opt === "nearby" ? "map-pin" : "globe",
            onPress: () => updatePreferences({ discoveryRange: opt }),
          }),
        )}
      />

      <ActionSheet
        visible={cleanupMenuOpen}
        onClose={() => setCleanupMenuOpen(false)}
        title={t("settings.autoCleanup")}
        message={t("settings.autoCleanupMsg")}
        actions={([0, 30, 60, 90] as AutoCleanupDays[]).map((opt) => ({
          label:
            cleanupLabel(t, opt) +
            (preferences.autoCleanupDays === opt ? "  ✓" : ""),
          icon: opt === 0 ? "archive" : "clock",
          onPress: () => updatePreferences({ autoCleanupDays: opt }),
        }))}
      />

      <PhotoVerifier
        visible={reverifying}
        uri={reverifying ? (profile?.photoUri ?? null) : null}
        onCancel={() => setReverifying(false)}
        onVerified={async () => {
          await markPhotoVerified();
          setReverifying(false);
        }}
      />

      {pendingLang && !reloading ? (
        <Pressable
          style={styles.reloadOverlay}
          onPress={cancelPendingLang}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.reloadCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="refresh-cw" size={28} color={colors.primary} />
            <Text style={[styles.reloadTitle, { color: colors.foreground }]}>
              {t("language.confirmTitle")}
            </Text>
            <Text
              style={[styles.reloadBody, { color: colors.mutedForeground }]}
            >
              {t("language.confirmBody", {
                language:
                  SUPPORTED_LANGUAGES.find((s) => s.code === pendingLang)
                    ?.native ?? pendingLang,
              })}
            </Text>
            <View style={styles.confirmRow}>
              <Pressable
                onPress={cancelPendingLang}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.confirmBtnText,
                    { color: colors.foreground },
                  ]}
                >
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmPendingLang}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.confirmBtnText, { color: "#FFFFFF" }]}
                >
                  {t("language.confirmRestart")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      ) : null}

      {reloading ? (
        <View style={styles.reloadOverlay} pointerEvents="auto">
          <View
            style={[
              styles.reloadCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="globe" size={28} color={colors.primary} />
            <Text style={[styles.reloadTitle, { color: colors.foreground }]}>
              {t("language.reloadingTitle")}
            </Text>
            <Text
              style={[styles.reloadBody, { color: colors.mutedForeground }]}
            >
              {t("language.reloadingBody")}
            </Text>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

function SectionLabel({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
      {label}
    </Text>
  );
}

function NavRow({
  icon,
  label,
  sub,
  onPress,
  testID,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  sub: string;
  onPress: () => void;
  testID?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.muted,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.background }]}>
        <Feather name={icon} size={18} color={colors.foreground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        <Text
          style={[styles.rowSub, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {sub}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onValueChange,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  sub: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.muted, borderColor: colors.border },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.background }]}>
        <Feather
          name={icon}
          size={18}
          color={value ? colors.primary : colors.mutedForeground}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
          {sub}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#D1D5DB", true: colors.primary }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#D1D5DB"
      />
    </View>
  );
}

function AboutLink({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.muted,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.background }]}>
        <Feather name={icon} size={18} color={colors.foreground} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.foreground, flex: 1 }]}>
        {label}
      </Text>
      <Feather
        name="external-link"
        size={16}
        color={colors.mutedForeground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  reloadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  reloadCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
  },
  confirmRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    alignSelf: "stretch",
  },
  reloadTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    marginTop: 4,
    textAlign: "center",
  },
  reloadBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    gap: 14,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 17 },
  sectionLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  rowSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  rowAction: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  verifiedDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  confirmTitle: { fontFamily: "Inter_700Bold", fontSize: 15 },
  confirmSub: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  confirmBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  emptySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 19,
  },
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  blockedName: { fontFamily: "Inter_600SemiBold", fontSize: 15, flex: 1 },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  unblockText: { color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  plusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  plusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  plusTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },
  plusSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.92)",
    marginTop: 2,
  },
  notesHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    fontStyle: "italic",
    paddingHorizontal: 4,
  },
  aboutCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  aboutHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  aboutLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  aboutTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  aboutVersion: { fontFamily: "Inter_500Medium", fontSize: 12, marginTop: 2 },
  aboutTagline: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
  },
  legalText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  contactLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginBottom: 3,
  },
  contactEmail: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },

  // ── Venue registration CTA card (highlighted) ─────────────────────────────
  venueCtaCard: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1.5,
    borderColor: "#FED7AA",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  venueCtaIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  venueCtaLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#92400E",
  },
  venueCtaSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#B45309",
    lineHeight: 17,
  },
});
