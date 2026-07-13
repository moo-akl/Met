/**
 * SubscriptionModal
 *
 * Inline bottom-sheet that shows Plus / Pro tiers when a free user hits a
 * limit or presses the Upgrade button. Tapping a plan routes to the full
 * paywall screen where the actual RevenueCat purchase happens.
 *
 * The modal intentionally contains no purchase logic — it is a lightweight
 * teaser / feature comparison. Real purchases stay in app/paywall.tsx.
 */

import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** Optional reason text shown at top, e.g. "You've reached your daily view limit." */
  reason?: string;
}

const PLUS_FEATURES = [
  "subscription.featureUnlimitedViews",
  "subscription.featurePlusBadge",
  "subscription.featureEncounters",
] as const;

const PRO_FEATURES = [
  "subscription.featureUnlimitedViews",
  "subscription.featurePlusBadge",
  "subscription.featureEncounters",
  "subscription.featureRadarSpotlight",
  "subscription.featureProBadge",
] as const;

export function SubscriptionModal({ visible, onDismiss, reason }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { t } = useT();

  const handleUpgrade = () => {
    onDismiss();
    router.push("/paywall");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {t("subscription.modalTitle")}
              </Text>
              {reason ? (
                <Text style={[styles.reason, { color: colors.mutedForeground }]}>
                  {reason}
                </Text>
              ) : (
                <Text style={[styles.reason, { color: colors.mutedForeground }]}>
                  {t("subscription.modalSubtitle")}
                </Text>
              )}
            </View>
            <Pressable onPress={onDismiss} hitSlop={8}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Plan cards */}
          <View style={styles.cards}>
            {/* Plus */}
            <View
              style={[
                styles.card,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <View style={styles.planHeader}>
                <View style={[styles.planBadge, { backgroundColor: "#3DCC44" }]}>
                  <Feather name="check" size={11} color="#fff" />
                </View>
                <Text style={[styles.planName, { color: colors.foreground }]}>
                  Met Plus
                </Text>
                <Text style={[styles.planPrice, { color: colors.mutedForeground }]}>
                  {t("subscription.plusPrice")}
                </Text>
              </View>
              {PLUS_FEATURES.map((key) => (
                <FeatureRow key={key} label={t(key)} colors={colors} />
              ))}
            </View>

            {/* Pro */}
            <View
              style={[
                styles.card,
                styles.proCard,
                { backgroundColor: colors.background, borderColor: "#F5B700" },
              ]}
            >
              <View
                style={[styles.proBadgeRow]}
              >
                <View style={[styles.planBadge, { backgroundColor: "#F5B700" }]}>
                  <Feather name="star" size={11} color="#fff" />
                </View>
                <Text style={[styles.planName, { color: colors.foreground }]}>
                  Met Pro
                </Text>
                <View style={[styles.popularPill, { backgroundColor: "#F5B70022" }]}>
                  <Text style={[styles.popularText, { color: "#9C7A00" }]}>
                    {t("subscription.popular")}
                  </Text>
                </View>
              </View>
              <Text style={[styles.planPrice, { color: colors.mutedForeground, marginBottom: 8 }]}>
                {t("subscription.proPrice")}
              </Text>
              {PRO_FEATURES.map((key) => (
                <FeatureRow
                  key={key}
                  label={t(key)}
                  colors={colors}
                  highlight={key === "subscription.featureRadarSpotlight" || key === "subscription.featureProBadge"}
                />
              ))}
            </View>
          </View>

          {/* CTA */}
          <Pressable
            onPress={handleUpgrade}
            style={[styles.cta, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
          >
            <Text style={styles.ctaText}>{t("subscription.cta")}</Text>
          </Pressable>

          <Pressable onPress={onDismiss} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
              {t("subscription.maybeLater")}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FeatureRow({
  label,
  colors,
  highlight = false,
}: {
  label: string;
  colors: ReturnType<typeof useColors>;
  highlight?: boolean;
}) {
  return (
    <View style={styles.featureRow}>
      <Feather
        name="check"
        size={13}
        color={highlight ? "#F5B700" : "#3DCC44"}
      />
      <Text
        style={[
          styles.featureText,
          {
            color: highlight ? colors.foreground : colors.mutedForeground,
            fontFamily: highlight ? "Inter_600SemiBold" : "Inter_400Regular",
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    gap: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: -0.2,
  },
  reason: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 3,
  },
  cards: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 4,
  },
  proCard: {
    borderWidth: 2,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  proBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  planBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  planName: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    flex: 1,
  },
  planPrice: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  popularPill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  popularText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  featureText: {
    fontSize: 12,
    flex: 1,
  },
  cta: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  ctaText: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: "#fff",
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
});
