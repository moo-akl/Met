/**
 * Social-surface gate. Incomplete (QR-first, private) profiles see a
 * completion prompt instead of people / chat / network UI. Profile,
 * settings (logout, account deletion), private QR check-in and venue
 * browsing are never wrapped by this gate.
 */
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  COMPLETE_PROFILE_HREF,
  isIncompleteProfile,
} from "@/lib/profileCompletion";

export function useIsSocialLocked(): boolean {
  const { profile } = useApp();
  return isIncompleteProfile(profile);
}

export function CompleteProfilePrompt({ showBack = false }: { showBack?: boolean }) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const topPad = (Platform.OS === "web" ? 67 : insets.top) + 12;
  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]} testID="complete-profile-gate">
      {showBack ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)" as never))}
          hitSlop={12}
          accessibilityRole="button"
          style={styles.back}
        >
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </Pressable>
      ) : null}
      <View style={styles.center}>
        <View style={[styles.icon, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="user-plus" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{t("profileGate.title")}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{t("profileGate.body")}</Text>
        <PrimaryButton
          label={t("profileGate.cta")}
          onPress={() => router.push(COMPLETE_PROFILE_HREF as never)}
          style={styles.cta}
        />
      </View>
    </View>
  );
}

/** Compact banner for mixed surfaces such as Home. */
export function CompleteProfileBanner({ topInset = 0 }: { topInset?: number }) {
  const colors = useColors();
  const router = useRouter();
  const { t } = useT();
  const locked = useIsSocialLocked();
  if (!locked) return null;
  return (
    <View style={{ paddingTop: topInset }}>
    <Pressable
      onPress={() => router.push(COMPLETE_PROFILE_HREF as never)}
      style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}
      accessibilityRole="button"
      testID="complete-profile-banner"
    >
      <Feather name="user-plus" size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.bannerTitle, { color: colors.foreground }]}>{t("profileGate.bannerTitle")}</Text>
        <Text style={[styles.bannerBody, { color: colors.mutedForeground }]}>{t("profileGate.bannerBody")}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
    </View>
  );
}

/** Wrap a social screen so incomplete profiles see the prompt instead. */
export function withSocialGate<P extends object>(
  Screen: React.ComponentType<P>,
  opts: { showBack?: boolean } = {},
) {
  function Gated(props: P) {
    const locked = useIsSocialLocked();
    if (locked) return <CompleteProfilePrompt showBack={opts.showBack} />;
    return <Screen {...props} />;
  }
  Gated.displayName = `SocialGated(${Screen.displayName ?? Screen.name ?? "Screen"})`;
  return Gated;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  back: { alignSelf: "flex-start" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  icon: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter_700Bold", fontSize: 22, textAlign: "center" },
  body: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 320 },
  cta: { alignSelf: "stretch", marginTop: 8 },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1,
    borderRadius: 14, padding: 14, marginHorizontal: 16, marginVertical: 8,
  },
  bannerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  bannerBody: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
});
