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
import { useSubscription } from "@/lib/revenuecat";
import {
  DISCOVERY_RANGE_LABEL,
  type AutoCleanupDays,
  type DiscoveryRange,
} from "@/lib/storage";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type SheetView = "menu" | "blocked" | "notifications" | "about";

const CLEANUP_LABEL: Record<AutoCleanupDays, string> = {
  0: "Off — keep all encounters",
  30: "After 30 days",
  60: "After 60 days",
  90: "After 90 days",
};

function formatVerifiedDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
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
  const { tier } = useSubscription();
  const router = useRouter();
  const isVisible = profile?.isVisible ?? true;

  const toggleVisible = async (next: boolean) => {
    if (!profile) return;
    await setProfile({ ...profile, isVisible: next });
  };

  const [view, setView] = useState<SheetView>("menu");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [signOutInfo, setSignOutInfo] = useState(false);
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const [cleanupMenuOpen, setCleanupMenuOpen] = useState(false);

  const close = () => {
    setView("menu");
    setConfirmReset(false);
    setConfirmDelete(false);
    setReverifying(false);
    setSignOutInfo(false);
    setRangeMenuOpen(false);
    setCleanupMenuOpen(false);
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
        return "Settings";
      case "blocked":
        return "Blocked people";
      case "notifications":
        return "Notifications";
      case "about":
        return "About Met";
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
                        ? "Met Pro active"
                        : tier === "plus"
                          ? "Met Plus active"
                          : "Upgrade your plan"}
                    </Text>
                    {tier !== "free" ? <TierBadge tier={tier} /> : null}
                  </View>
                  <Text style={styles.plusSub}>
                    {tier === "pro"
                      ? "Boost, profile views, 6 photos, premium badge"
                      : tier === "plus"
                        ? "Tap to compare with Met Pro (6 photos, Boost)"
                        : "More reveals, opening messages, up to 6 photos, badges"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color="#FFFFFF" />
              </Pressable>

              <SectionLabel label="Discovery" colors={colors} />

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
                    Visible on Radar
                  </Text>
                  <Text
                    style={[styles.rowSub, { color: colors.mutedForeground }]}
                  >
                    {isVisible
                      ? "Your beacon is broadcasting nearby"
                      : "You're hidden from other Met users"}
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
                label="Discovery range"
                sub={DISCOVERY_RANGE_LABEL[preferences.discoveryRange]}
                onPress={() => setRangeMenuOpen(true)}
                colors={colors}
              />

              <SectionLabel label="Memory" colors={colors} />

              <NavRow
                icon="bell"
                label="Notifications"
                sub={
                  preferences.notifyDailyRecap || preferences.notifyRecurringMeets
                    ? "Daily recap & re-encounter nudges"
                    : "All push notifications off"
                }
                onPress={() => setView("notifications")}
                colors={colors}
              />

              <NavRow
                icon="archive"
                label="Auto-cleanup"
                sub={
                  preferences.autoCleanupDays === 0
                    ? "Off — keep all encounters"
                    : `Hide unconnected after ${preferences.autoCleanupDays} days`
                }
                onPress={() => setCleanupMenuOpen(true)}
                colors={colors}
              />

              <SectionLabel label="Account" colors={colors} />

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
                        Verified photo
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
                        ? `Last verified ${formatVerifiedDate(profile.photoVerifiedAt)}`
                        : profile?.verified
                          ? "Verified — tap to re-run face check"
                          : "Tap to run face check on your photo"}
                    </Text>
                  </View>
                  <Text style={[styles.rowAction, { color: colors.primary }]}>
                  {profile?.verified ? "Re-verify" : "Verify"}
                </Text>
              </Pressable>

              <NavRow
                icon="slash"
                label="Blocked people"
                sub={
                  blockedEncounters.length === 0
                    ? "No one blocked"
                    : `${blockedEncounters.length} ${
                        blockedEncounters.length === 1 ? "person" : "people"
                      } blocked`
                }
                onPress={() => setView("blocked")}
                colors={colors}
              />

              <NavRow
                icon="info"
                label="About Met"
                sub={`Version ${appVersion}`}
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
                    Sign out is coming soon
                  </Text>
                  <Text
                    style={[styles.confirmSub, { color: colors.mutedForeground }]}
                  >
                    Met currently runs on this device with no account. When
                    real accounts ship, you&rsquo;ll be able to sign out and
                    back in here.
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
                      OK
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
                      Sign out
                    </Text>
                    <Text
                      style={[styles.rowSub, { color: colors.mutedForeground }]}
                    >
                      Coming with full accounts
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={20}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              )}

              {confirmReset ? (
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
                    style={[styles.confirmTitle, { color: colors.foreground }]}
                  >
                    Reset profile?
                  </Text>
                  <Text
                    style={[styles.confirmSub, { color: colors.mutedForeground }]}
                  >
                    Your profile, encounter history, and preferences will be
                    cleared and sample encounters reseeded.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Pressable
                      onPress={() => setConfirmReset(false)}
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
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
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
                        style={[
                          styles.confirmBtnText,
                          { color: "#FFFFFF" },
                        ]}
                      >
                        Reset
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => setConfirmReset(true)}
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
                      name="refresh-ccw"
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
                      Reset profile
                    </Text>
                    <Text
                      style={[
                        styles.rowSub,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      Clear profile + reseed sample encounters
                    </Text>
                  </View>
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
                    Delete account?
                  </Text>
                  <Text
                    style={[styles.confirmSub, { color: colors.mutedForeground }]}
                  >
                    This wipes your profile, encounter history, connections,
                    and preferences from this device. You&rsquo;ll be returned
                    to the welcome screen and can start fresh. This cannot be
                    undone.
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
                        Cancel
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
                        Delete account
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
                      Delete account
                    </Text>
                    <Text
                      style={[
                        styles.rowSub,
                        { color: colors.destructive, opacity: 0.85 },
                      ]}
                    >
                      Permanently remove your profile from this device
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
                    No one is blocked
                  </Text>
                  <Text
                    style={[styles.emptySub, { color: colors.mutedForeground }]}
                  >
                    Blocked encounters and connections will show up here so you
                    can unblock them.
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
                      <Text style={styles.unblockText}>Unblock</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          ) : view === "notifications" ? (
            <View style={{ gap: 10 }}>
              <ToggleRow
                icon="calendar"
                label="Daily recap"
                sub="Morning summary like “Yesterday you crossed paths with 4 people; 1 was your second time.”"
                value={preferences.notifyDailyRecap}
                onValueChange={(v) =>
                  updatePreferences({ notifyDailyRecap: v })
                }
                colors={colors}
              />
              <ToggleRow
                icon="repeat"
                label="Re-encounter nudges"
                sub="Notify me when I cross paths with someone for the 3rd time or more."
                value={preferences.notifyRecurringMeets}
                onValueChange={(v) =>
                  updatePreferences({ notifyRecurringMeets: v })
                }
                colors={colors}
              />
              <Text
                style={[styles.notesHint, { color: colors.mutedForeground }]}
              >
                Met never sends marketing pushes — only the toggles above.
              </Text>
            </View>
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
                      Version {appVersion}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.aboutTagline, { color: colors.mutedForeground }]}
                >
                  Remember the human, not the follower count.
                </Text>
              </View>

              <AboutLink
                icon="shield"
                label="Privacy policy"
                onPress={() => openLink("https://met.app/privacy")}
                colors={colors}
              />
              <AboutLink
                icon="file-text"
                label="Terms of service"
                onPress={() => openLink("https://met.app/terms")}
                colors={colors}
              />
              <AboutLink
                icon="mail"
                label="Contact support"
                onPress={() => openLink("mailto:hello@met.app")}
                colors={colors}
              />
              <AboutLink
                icon="star"
                label="Rate Met"
                onPress={() =>
                  openLink(
                    Platform.OS === "ios"
                      ? "https://apps.apple.com/app/id000000000"
                      : "https://play.google.com/store/apps/details?id=app.met",
                  )
                }
                colors={colors}
              />
            </ScrollView>
          )}
        </Pressable>
      </Pressable>

      <ActionSheet
        visible={rangeMenuOpen}
        onClose={() => setRangeMenuOpen(false)}
        title="Discovery range"
        message="Who should appear under Recent and your nearby count?"
        actions={(["room", "nearby", "venue"] as DiscoveryRange[]).map(
          (opt) => ({
            label:
              DISCOVERY_RANGE_LABEL[opt] +
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
        title="Auto-cleanup"
        message="Hide unconnected encounters older than this. Connections and pending requests are never cleaned up."
        actions={([0, 30, 60, 90] as AutoCleanupDays[]).map((opt) => ({
          label:
            CLEANUP_LABEL[opt] +
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
