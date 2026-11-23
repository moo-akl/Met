import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { api, ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n";
import { ensureMyCode } from "@/lib/referrals";
import type { Profile } from "@/lib/types";

export function AccountRecoveryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();
  const {
    authedUid,
    accountLifecycle,
    refreshAccountLifecycle,
    setProfile,
    setPermissionsCompleted,
    signOutAndClear,
  } = useApp();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recoverable = accountLifecycle.status === "pending_deletion";
  const purgeDate = useMemo(() => {
    if (!accountLifecycle.purgeAfter) return null;
    const date = new Date(accountLifecycle.purgeAfter);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
  }, [accountLifecycle.purgeAfter]);

  const restore = async () => {
    if (!authedUid || working) return;
    setWorking(true);
    setError(null);
    try {
      await api.recoverAccount({ uid: authedUid });
      await refreshAccountLifecycle();
      try {
        const remote = await api.getMyProfile({ uid: authedUid });
        const incomplete = !remote.photoUrl || !remote.displayName.trim();
        const restored: Profile = {
          id: remote.uid,
          name: remote.displayName,
          bio: remote.bio ?? "",
          photoUri: remote.photoUrl ?? "",
          socials: remote.socials ?? {},
          interests: remote.interests ?? [],
          verified: !incomplete,
          isVisible: remote.isVisible ?? false,
          photoVerifiedAt: incomplete ? undefined : Date.now(),
          extraPhotos: [],
          incomplete: incomplete || undefined,
        };
        await setProfile(restored);
        await setPermissionsCompleted(!incomplete);
        await ensureMyCode().catch(() => {});
        router.replace(
          incomplete ? "/onboarding?completeProfile=1" : "/(tabs)",
        );
      } catch (profileError) {
        if (profileError instanceof ApiError && profileError.status === 404) {
          router.replace("/onboarding");
        } else {
          throw profileError;
        }
      }
    } catch (restoreError) {
      setError(
        restoreError instanceof ApiError && restoreError.status === 410
          ? t("accountRecovery.expiredBody")
          : t("accountRecovery.restoreFailed"),
      );
    } finally {
      setWorking(false);
    }
  };

  const signOut = async () => {
    setWorking(true);
    await signOutAndClear();
    router.replace("/onboarding");
    setWorking(false);
  };

  const expired = accountLifecycle.status !== "pending_deletion";
  const purgeFailed = accountLifecycle.status === "purge_failed";
  const topInset = Math.max(insets.top, 20);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: topInset + 24 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather
          name={expired ? "shield" : "clock"}
          size={28}
          color={colors.primary}
        />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {purgeFailed
          ? t("accountRecovery.purgeFailedTitle")
          : expired
            ? t("accountRecovery.expiredTitle")
            : t("accountRecovery.title")}
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {purgeFailed
          ? t("accountRecovery.purgeFailedBody")
          : expired
            ? t("accountRecovery.expiredBody")
            : t("accountRecovery.body", { date: purgeDate ?? t("accountRecovery.dateUnknown") })}
      </Text>
      {accountLifecycle.firestoreSyncPending ? (
        <Text style={[styles.syncNote, { color: colors.mutedForeground }]}>
          {t("accountRecovery.syncPending")}
        </Text>
      ) : null}
      {error ? (
        <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
      ) : null}
      {recoverable ? (
        <PrimaryButton
          label={working ? t("accountRecovery.restoring") : t("accountRecovery.restore")}
          onPress={() => void restore()}
          disabled={working}
          style={styles.primary}
        />
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={working}
        onPress={() => void signOut()}
        style={({ pressed }) => [
          styles.secondary,
          { borderColor: colors.border, opacity: pressed || working ? 0.65 : 1 },
        ]}
      >
        {working ? <ActivityIndicator color={colors.primary} /> : null}
        <Text style={[styles.secondaryText, { color: colors.foreground }]}>
          {t("accountRecovery.signOut")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 23,
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 360,
  },
  syncNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 12,
    maxWidth: 340,
  },
  error: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
    marginTop: 14,
  },
  primary: { alignSelf: "stretch", marginTop: 28 },
  secondary: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    marginTop: 12,
    alignSelf: "stretch",
  },
  secondaryText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
