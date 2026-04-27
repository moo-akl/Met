import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  REQUIRED_INVITES,
  simulateInvite,
  useReferrals,
} from "@/lib/referrals";

const SHARE_BASE_URL = "https://met.app/r"; // hypothetical universal-link host

function formatDate(ts: number, lang: string): string {
  try {
    return new Date(ts).toLocaleDateString(lang, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return new Date(ts).toDateString();
  }
}

export default function ReferralsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang } = useT();
  const router = useRouter();
  const { myCode, count, reward } = useReferrals();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const code = myCode ?? "------";
  const shareUrl = `${SHARE_BASE_URL}/${code}`;
  const shareMessage = t("referrals.shareMessage", {
    code,
    url: shareUrl,
  });

  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const onShare = async () => {
    try {
      if (Platform.OS === "web") {
        // Best-effort for the web preview: copy + Web Share API if available.
        // On native, Share.share() opens the OS share sheet directly.
        const nav = (
          globalThis as unknown as {
            navigator?: { share?: (data: { text: string }) => Promise<void> };
          }
        ).navigator;
        if (nav?.share) {
          await nav.share({ text: shareMessage });
        } else {
          await Clipboard.setStringAsync(shareMessage);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
        return;
      }
      await Share.share({ message: shareMessage });
    } catch {}
  };

  // The "Simulate a friend joining" demo button is intentionally a dev-only
  // affordance so the full reward UX is testable without a backend. It must
  // never ship in a release build (where it would be a self-unlock for Plus).
  const showSimulate = __DEV__;
  const onSimulate = async () => {
    if (!showSimulate) return;
    setBusy(true);
    try {
      await simulateInvite();
    } finally {
      setBusy(false);
    }
  };

  const slots = useMemo(
    () => Array.from({ length: REQUIRED_INVITES }, (_, i) => i < count),
    [count],
  );

  const earned = !!reward;
  const expiresLabel = reward
    ? t("referrals.rewardActiveUntil", {
        date: formatDate(reward.expiresAt, lang),
      })
    : "";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("referrals.title")}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: earned ? "#1B7A23" : colors.primary,
            },
          ]}
        >
          <View style={styles.heroBadge}>
            <Feather
              name={earned ? "award" : "gift"}
              size={28}
              color="#FFFFFF"
            />
          </View>
          <Text style={styles.heroTitle}>
            {earned
              ? t("referrals.rewardEarnedTitle")
              : t("referrals.heroTitle")}
          </Text>
          <Text style={styles.heroSub}>
            {earned
              ? t("referrals.rewardEarnedSub")
              : t("referrals.heroSub")}
          </Text>
          {earned ? (
            <View style={styles.heroActiveStrip}>
              <Feather name="zap" size={14} color="#FFFFFF" />
              <Text style={styles.heroActiveText}>{expiresLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Code */}
        <View
          style={[
            styles.codeCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>
            {t("referrals.yourCode")}
          </Text>
          <Pressable onPress={onCopy} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={[styles.codeValue, { color: colors.foreground }]}>
              {code}
            </Text>
          </Pressable>
          <Text style={[styles.codeHint, { color: colors.mutedForeground }]}>
            {copied ? t("common.copied") : t("referrals.tapToCopy")}
          </Text>
          <PrimaryButton
            label={t("referrals.shareButton")}
            onPress={onShare}
          />
        </View>

        {/* Progress */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t("referrals.progressTitle")}
          </Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            {t("referrals.progressLabel", { count })}
          </Text>
          <View style={styles.slots}>
            {slots.map((filled, i) => (
              <View
                key={i}
                style={[
                  styles.slot,
                  {
                    backgroundColor: filled ? colors.primary : colors.muted,
                    borderColor: filled ? colors.primary : colors.border,
                  },
                ]}
              >
                <Feather
                  name={filled ? "check" : "user"}
                  size={20}
                  color={filled ? "#FFFFFF" : colors.mutedForeground}
                />
              </View>
            ))}
          </View>
          {!earned ? (
            <Text style={[styles.lockedText, { color: colors.mutedForeground }]}>
              {t("referrals.rewardLockedSub")}
            </Text>
          ) : null}
        </View>

        {/* How it works */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t("referrals.howItWorks")}
          </Text>
          <Step n={1} text={t("referrals.step1")} colors={colors} />
          <Step n={2} text={t("referrals.step2")} colors={colors} />
          <Step n={3} text={t("referrals.step3")} colors={colors} />
        </View>

        {/* Rules */}
        <View
          style={[
            styles.section,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t("referrals.rules")}
          </Text>
          <Bullet text={t("referrals.rule1")} colors={colors} />
          <Bullet text={t("referrals.rule2")} colors={colors} />
          <Bullet text={t("referrals.rule3")} colors={colors} />
        </View>

        {/* Demo simulate button — dev-only so prod can't self-unlock Plus */}
        {showSimulate ? (
        <View
          style={[
            styles.section,
            {
              backgroundColor: colors.muted,
              borderColor: colors.border,
              borderStyle: "dashed",
            },
          ]}
        >
          <Pressable
            onPress={onSimulate}
            disabled={busy}
            style={({ pressed }) => [
              styles.simulateBtn,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                opacity: pressed || busy ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="user-plus" size={18} color={colors.foreground} />
            <Text style={[styles.simulateText, { color: colors.foreground }]}>
              {t("referrals.simulateButton")}
            </Text>
          </Pressable>
          <Text style={[styles.simulateHint, { color: colors.mutedForeground }]}>
            {t("referrals.simulateHint")}
          </Text>
        </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Step({
  n,
  text,
  colors,
}: {
  n: number;
  text: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.stepRow}>
      <View
        style={[
          styles.stepDot,
          { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}
      >
        <Text style={styles.stepDotText}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

function Bullet({
  text,
  colors,
}: {
  text: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, { backgroundColor: colors.mutedForeground }]} />
      <Text style={[styles.bulletText, { color: colors.foreground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
  },
  scroll: {
    padding: 16,
    gap: 14,
  },
  hero: {
    borderRadius: 20,
    padding: 22,
    gap: 12,
    alignItems: "center",
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    fontSize: 22,
    textAlign: "center",
    lineHeight: 28,
  },
  heroSub: {
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  heroActiveStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginTop: 4,
  },
  heroActiveText: {
    color: "#FFFFFF",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  codeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 8,
    alignItems: "center",
  },
  codeLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  codeValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    letterSpacing: 6,
  },
  codeHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginBottom: 10,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  sectionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  slots: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 6,
  },
  slot: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    fontStyle: "italic",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 4,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  stepText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 3,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
  },
  simulateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  simulateText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  simulateHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
  },
});
