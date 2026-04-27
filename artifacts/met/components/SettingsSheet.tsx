import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import { useColors } from "@/hooks/useColors";
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

type SheetView = "menu" | "blocked" | "notifications" | "about" | "language";

// External "About Met" links. Leave empty to hide the row entirely so we
// don't ship a broken link. Fill RATE_URL_* in once you have the real
// App Store / Play Store listings.
const TERMS_URL =
  "https://doc-hosting.flycricket.io/met-terms-conditions/de6cbb09-1b5f-4203-aba7-c70fe3fa4932/terms";
const RATE_URL_IOS = "";
const RATE_URL_ANDROID = "";

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

function formatVerifiedDate(ts: number, lang: string): string {
  try {
    return new Date(ts).toLocaleDateString(lang, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "recently";
  }
}

export function SettingsSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const webBot = Platform.OS === "web" ? 34 : 0;
  const { t, lang } = useT();
  const {
    profile,
    setProfile,
    blockedEncounters,
    setBlocked,
    resetAll,
    preferences,
    updatePreferences,
    markPhotoVerified,
  } = useApp();
  const { tier, promoPlusActive } = useSubscription();
  const referrals = useReferrals();
  const router = useRouter();
  const isVisible = profile?.isVisible ?? true;
  const [rtlNotice, setRtlNotice] = useState(false);

  const onPickLanguage = async (code: LangCode) => {
    const { rtlChanged } = await setLanguage(code);
    if (rtlChanged) {
      // Stay on the language view so the user actually sees the restart notice
      // we render below the picker; on native, an app reload is required for
      // RTL/LTR layout to fully take effect.
      setRtlNotice(true);
    } else {
      setView("menu");
      setRtlNotice(false);
    }
  };

  const toggleVisible = async (next: boolean) => {
    if (!profile) return;
    await setProfile({ ...profile, isVisible: next });
  };

  const [view, setView] = useState<SheetView>("menu");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [signOutInfo, setSignOutInfo] = useState(false);
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [cleanupMenuOpen, setCleanupMenuOpen] = useState(false);

  const close = () => {
    setView("menu");
    setConfirmDelete(false);
    setReverifying(false);
    setSignOutInfo(false);
    setRangeMenuOpen(false);
    setCleanupMenuOpen(false);
    setRtlNotice(false);
    onClose();
  };

  const appVersion =
    (Constants.expoConfig?.version as string | undefined) ?? "1.0.0";

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
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
    }
  })();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + webBot + 20,
            },
          ]}
        >
          <View style={styles.handle} />

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
                    backgroundColor: tier === "pro" ? "#1B7A23" : "#3DCC44",
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
                  onValueChange={toggleVisible}
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
                  "English"
                }
                onPress={() => setView("language")}
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

              {signOutInfo ? (
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
                    {t("settings.signOutSoonTitle")}
                  </Text>
                  <Text
                    style={[styles.confirmSub, { color: colors.mutedForeground }]}
                  >
                    {t("settings.signOutSoonBody")}
                  </Text>
                  <Pressable
                    onPress={() => setSignOutInfo(false)}
                    style={({ pressed }) => [
                      styles.confirmBtn,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.confirmBtnText, { color: "#FFFFFF" }]}>
                      {t("common.ok")}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={() => setSignOutInfo(true)}
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
                        // resetAll wipes profile/encounters/preferences/perm
                        // flag. ProfileGate redirects to onboarding when
                        // profile becomes null, so no manual nav needed.
                        await resetAll();
                        close();
                      }}
                      style={({ pressed }) => [
                        styles.confirmBtn,
                        {
                          backgroundColor: colors.destructive,
                          borderColor: colors.destructive,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[styles.confirmBtnText, { color: "#FFFFFF" }]}
                      >
                        {t("settings.deleteAccountConfirmAction")}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setConfirmDelete(true)}
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
                  updatePreferences({ notifyRecurringMeets: v })
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
          ) : (
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
                onPress={() =>
                  openLink(
                    "https://doc-hosting.flycricket.io/met-privacy-policy/fdc825e1-4bde-43aa-9e6f-cd4b9860f90d/privacy",
                  )
                }
                colors={colors}
              />
              {TERMS_URL ? (
                <AboutLink
                  icon="file-text"
                  label={t("settings.aboutTerms")}
                  onPress={() => openLink(TERMS_URL)}
                  colors={colors}
                />
              ) : null}
              <AboutLink
                icon="mail"
                label={t("settings.aboutContact")}
                onPress={() => openLink("mailto:metapp.contact@gmail.com")}
                colors={colors}
              />
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
          )}
        </Pressable>
      </Pressable>

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
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  sub: string;
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
    backgroundColor: "#D1D5DB",
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
    backgroundColor: "#3DCC44",
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
});
