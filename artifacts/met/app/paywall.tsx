import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "@/components/MetGradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PurchasesOffering, PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  findMonthlyPackage,
  findYearlyPackage,
  isRevenueCatTestMode,
  useSubscription,
} from "@/lib/revenuecat";

type PaidTier = "plus" | "pro";
type Billing = "monthly" | "yearly";

const FALLBACK_PRICES: Record<PaidTier, Record<Billing, { price: string; yearly12: number; monthly1: number }>> = {
  plus: {
    monthly: { price: "$1.99", yearly12: 23.88, monthly1: 1.99 },
    yearly: { price: "$18.00", yearly12: 18.0, monthly1: 1.5 },
  },
  pro: {
    monthly: { price: "$3.49", yearly12: 41.88, monthly1: 3.49 },
    yearly: { price: "$35.00", yearly12: 35.0, monthly1: 2.92 },
  },
};

type ColorPalette = ReturnType<typeof useColors>;

type FeatureMatrix = {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  free: string | true | false;
  plus: string | true | false;
  pro: string | true | false;
};

const FEATURES: FeatureMatrix[] = [
  {
    icon: "users",
    label: "Daily encounters",
    free: "20",
    plus: "Unlimited",
    pro: "Unlimited",
  },
  {
    icon: "image",
    label: "Profile photos",
    free: "1",
    plus: "3 (1 main + 2)",
    pro: "6 (1 main + 5)",
  },
  {
    icon: "send",
    label: "Reveal requests",
    free: "4 / day",
    plus: "Unlimited",
    pro: "Unlimited",
  },
  {
    icon: "message-circle",
    label: "Opening messages",
    free: false,
    plus: "1 / day",
    pro: "2 / day",
  },
  {
    icon: "clock",
    label: "Full encounter history",
    free: false,
    plus: true,
    pro: true,
  },
  {
    icon: "eye",
    label: "Read receipts",
    free: false,
    plus: true,
    pro: true,
  },
  {
    icon: "repeat",
    label: "Frequent paths",
    free: false,
    plus: true,
    pro: true,
  },
  {
    icon: "lock",
    label: "Privacy mode",
    free: false,
    plus: true,
    pro: true,
  },
  {
    icon: "check-circle",
    label: "Verified badge",
    free: false,
    plus: true,
    pro: true,
  },
  {
    icon: "trending-up",
    label: "Boost — rank higher in others' encounters",
    free: false,
    plus: false,
    pro: true,
  },
  {
    icon: "user-check",
    label: "See who viewed your profile",
    free: false,
    plus: false,
    pro: true,
  },
  {
    icon: "star",
    label: "Premium gold badge",
    free: false,
    plus: false,
    pro: true,
  },
];

export default function PaywallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    plusOffering,
    proOffering,
    isLoading,
    tier,
    isProSubscriber,
    isPlusSubscriber,
    purchase,
    isPurchasing,
    restore,
    isRestoring,
    purchaseError,
    refetch,
  } = useSubscription();

  // Default selection: Pro pre-selected if the user is already on Plus (the
  // upgrade path), otherwise Plus. Stays reactive to late RevenueCat
  // resolution but stops once the user has manually picked a tier.
  const [selectedTier, setSelectedTier] = useState<PaidTier>(
    isPlusSubscriber && !isProSubscriber ? "pro" : "plus",
  );
  const tierManuallySet = useRef(false);
  useEffect(() => {
    if (tierManuallySet.current) return;
    if (isPlusSubscriber && !isProSubscriber) setSelectedTier("pro");
  }, [isPlusSubscriber, isProSubscriber]);

  const pickTier = (t: PaidTier) => {
    tierManuallySet.current = true;
    setSelectedTier(t);
  };

  const [billing, setBilling] = useState<Billing>("yearly");

  const offeringFor = (t: PaidTier): PurchasesOffering | null =>
    t === "pro" ? proOffering : plusOffering;

  const packageFor = (
    t: PaidTier,
    b: Billing,
  ): PurchasesPackage | null => {
    const off = offeringFor(t);
    return b === "yearly" ? findYearlyPackage(off) : findMonthlyPackage(off);
  };

  const selectedPackage = packageFor(selectedTier, billing);

  const priceLabelFor = (
    t: PaidTier,
    b: Billing,
  ): { price: string; perMonth: string } => {
    const pkg = packageFor(t, b);
    const fb = FALLBACK_PRICES[t][b];
    if (!pkg) {
      if (b === "yearly") {
        const perMonth = `$${fb.monthly1.toFixed(2)} / mo`;
        return { price: fb.price, perMonth };
      }
      return { price: fb.price, perMonth: "Billed monthly" };
    }
    const total = pkg.product.price;
    const cur = pkg.product.currencyCode || "USD";
    if (b === "yearly") {
      const perMonthAmt = total / 12;
      let perMonth: string;
      try {
        perMonth = `${new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: cur,
        }).format(perMonthAmt)} / mo`;
      } catch {
        perMonth = `${perMonthAmt.toFixed(2)} / mo`;
      }
      return { price: pkg.product.priceString, perMonth };
    }
    return { price: pkg.product.priceString, perMonth: "Billed monthly" };
  };

  const yearlySavingsFor = (t: PaidTier): string | null => {
    const m = packageFor(t, "monthly");
    const y = packageFor(t, "yearly");
    if (!m?.product.price || !y?.product.price) {
      const fb = FALLBACK_PRICES[t];
      const yearlyAsMonthly = fb.monthly.monthly1 * 12;
      const saved = Math.round(
        ((yearlyAsMonthly - fb.yearly.yearly12) / yearlyAsMonthly) * 100,
      );
      return saved > 0 ? `Save ${saved}%` : null;
    }
    const yearlyAsMonthly = m.product.price * 12;
    const saved = Math.round(
      ((yearlyAsMonthly - y.product.price) / yearlyAsMonthly) * 100,
    );
    return saved > 0 ? `Save ${saved}%` : null;
  };

  const ctaLabel = useMemo(() => {
    if (isProSubscriber) return "You're on Met Pro";
    if (isPlusSubscriber && selectedTier === "plus") return "You're on Met Plus";
    if (!selectedPackage) return "Plan unavailable";
    const { price } = priceLabelFor(selectedTier, billing);
    const tierName = selectedTier === "pro" ? "Met Pro" : "Met Plus";
    return `Start ${tierName} — ${price} / ${billing === "yearly" ? "year" : "month"}`;
  }, [isProSubscriber, isPlusSubscriber, selectedTier, billing, selectedPackage]);

  const ctaDisabled =
    isProSubscriber ||
    (isPlusSubscriber && selectedTier === "plus") ||
    !selectedPackage ||
    isPurchasing;

  const testMode = isRevenueCatTestMode();
  const [confirmTest, setConfirmTest] = useState(false);

  const runPurchase = async () => {
    if (!selectedPackage) return;
    try {
      await purchase(selectedPackage);
      setTimeout(() => router.back(), 300);
    } catch (err) {
      console.warn("Purchase failed", err);
    }
  };

  const startPurchase = () => {
    if (ctaDisabled) return;
    if (testMode) {
      setConfirmTest(true);
      return;
    }
    void runPurchase();
  };

  const confirmPurchase = async () => {
    setConfirmTest(false);
    await runPurchase();
  };

  const close = () => router.back();

  const heroBg: [string, string] =
    selectedTier === "pro" ? ["#1B7A23", "#0F4D17"] : ["#3DCC44", "#2BA331"];
  const heroPillIcon: React.ComponentProps<typeof Feather>["name"] =
    selectedTier === "pro" ? "star" : "zap";
  const heroPillLabel = selectedTier === "pro" ? "Met Pro" : "Met Plus";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={heroBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.brandPill}>
            <Feather
              name={heroPillIcon}
              size={14}
              color={selectedTier === "pro" ? "#1B7A23" : "#3DCC44"}
            />
            <Text style={styles.brandPillText}>{heroPillLabel}</Text>
          </View>
          <Pressable onPress={close} hitSlop={12}>
            <Feather name="x" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        <Text style={styles.heroTitle}>
          {selectedTier === "pro"
            ? "Stand out, message more,\nsee who's checking you out."
            : "Connect with everyone\nyou cross paths with."}
        </Text>
        <Text style={styles.heroSub}>
          {selectedTier === "pro"
            ? "Everything in Plus, plus Boost, profile views, and the gold badge."
            : "Unlimited reveals, full history, and your verified badge."}
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 240,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Tier toggle */}
        <View style={[styles.tierToggle, { backgroundColor: colors.muted }]}>
          {(["plus", "pro"] as PaidTier[]).map((t) => {
            const isActive = selectedTier === t;
            const label = t === "pro" ? "Met Pro" : "Met Plus";
            return (
              <Pressable
                key={t}
                onPress={() => pickTier(t)}
                style={[
                  styles.tierToggleBtn,
                  {
                    backgroundColor: isActive
                      ? t === "pro"
                        ? "#1B7A23"
                        : colors.primary
                      : "transparent",
                  },
                ]}
              >
                <Feather
                  name={t === "pro" ? "star" : "zap"}
                  size={14}
                  color={isActive ? "#FFFFFF" : colors.foreground}
                />
                <Text
                  style={[
                    styles.tierToggleText,
                    { color: isActive ? "#FFFFFF" : colors.foreground },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Billing cards */}
        <View style={styles.planRow}>
          {(["monthly", "yearly"] as Billing[]).map((b) => {
            const { price, perMonth } = priceLabelFor(selectedTier, b);
            const pkg = packageFor(selectedTier, b);
            const savings = b === "yearly" ? yearlySavingsFor(selectedTier) : null;
            return (
              <PlanCard
                key={b}
                label={b === "yearly" ? "Yearly" : "Monthly"}
                price={price}
                sub={perMonth}
                badge={savings}
                selected={billing === b}
                disabled={!pkg}
                onPress={() => setBilling(b)}
                accentColor={
                  selectedTier === "pro" ? "#1B7A23" : colors.primary
                }
                colors={colors}
              />
            );
          })}
        </View>

        {/* Feature comparison table */}
        <View
          style={[
            styles.tableCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colFeature, { color: colors.mutedForeground }]}>
              What you get
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                styles.colTier,
                { color: colors.mutedForeground },
              ]}
            >
              Free
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                styles.colTier,
                { color: colors.primary },
              ]}
            >
              Plus
            </Text>
            <Text
              style={[
                styles.tableHeaderCell,
                styles.colTier,
                { color: "#1B7A23" },
              ]}
            >
              Pro
            </Text>
          </View>
          {FEATURES.map((f, idx) => (
            <View
              key={f.label}
              style={[
                styles.tableRow,
                idx !== FEATURES.length - 1
                  ? { borderBottomWidth: 1, borderBottomColor: colors.border }
                  : null,
              ]}
            >
              <View style={[styles.colFeature, styles.featureCell]}>
                <Feather
                  name={f.icon}
                  size={14}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[styles.featureLabel, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {f.label}
                </Text>
              </View>
              <Cell value={f.free} colors={colors} />
              <Cell value={f.plus} colors={colors} accent={colors.primary} />
              <Cell value={f.pro} colors={colors} accent="#1B7A23" />
            </View>
          ))}
        </View>

        <Text style={[styles.legal, { color: colors.mutedForeground }]}>
          {testMode
            ? "Sandbox mode — no real charge. On a real device the purchase goes through Apple or Google."
            : "Subscriptions auto-renew until cancelled. Manage anytime in your store account."}
        </Text>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        {tier === "pro" ? (
          <View style={styles.subscribedBox}>
            <Feather name="star" size={20} color="#F5B700" />
            <Text style={[styles.subscribedText, { color: colors.foreground }]}>
              You&rsquo;re on Met Pro. Thanks for going all in!
            </Text>
            <Pressable
              onPress={close}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: "#1B7A23",
                  opacity: pressed ? 0.85 : 1,
                  marginTop: 6,
                },
              ]}
            >
              <Text style={styles.ctaText}>Done</Text>
            </Pressable>
          </View>
        ) : isLoading ? (
          <Text style={[styles.legal, { color: colors.mutedForeground }]}>
            Loading plans…
          </Text>
        ) : !plusOffering && !proOffering ? (
          <Pressable onPress={refetch} style={{ alignItems: "center", gap: 4 }}>
            <Text style={[styles.legal, { color: colors.destructive }]}>
              Plans aren&rsquo;t available right now.
            </Text>
            <Text style={[styles.legal, { color: colors.primary, textDecorationLine: "underline" }]}>
              Tap to retry
            </Text>
          </Pressable>
        ) : (
          <>
            {purchaseError ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {(purchaseError as Error).message ||
                  "Purchase failed. Please try again."}
              </Text>
            ) : null}

            <Pressable
              onPress={startPurchase}
              disabled={ctaDisabled}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor:
                    selectedTier === "pro" ? "#1B7A23" : colors.primary,
                  opacity: ctaDisabled ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.ctaText}>
                {isPurchasing ? "Processing…" : ctaLabel}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => restore()}
              disabled={isRestoring}
              style={{ alignItems: "center", paddingVertical: 6 }}
            >
              <Text style={[styles.restore, { color: colors.mutedForeground }]}>
                {isRestoring ? "Restoring…" : "Restore purchases"}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <Modal
        visible={confirmTest}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmTest(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setConfirmTest(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="info" size={24} color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Test purchase
            </Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              You&rsquo;re running in test mode — no real charge. Confirm the
              {billing === "yearly" ? " yearly" : " monthly"}{" "}
              {selectedTier === "pro" ? "Met Pro" : "Met Plus"} plan?
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Pressable
                onPress={() => setConfirmTest(false)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.modalBtnText, { color: colors.foreground }]}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmPurchase}
                style={({ pressed }) => [
                  styles.modalBtn,
                  {
                    backgroundColor:
                      selectedTier === "pro" ? "#1B7A23" : colors.primary,
                    borderColor:
                      selectedTier === "pro" ? "#1B7A23" : colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                  Confirm
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function PlanCard({
  label,
  price,
  sub,
  badge,
  selected,
  disabled,
  onPress,
  colors,
  accentColor,
}: {
  label: string;
  price: string;
  sub: string;
  badge: string | null;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: ColorPalette;
  accentColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.planCard,
        {
          backgroundColor: selected ? "rgba(61, 204, 68, 0.10)" : colors.muted,
          borderColor: selected ? accentColor : colors.border,
          borderWidth: selected ? 2 : 1,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.planHeader}>
        <Text style={[styles.planLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: accentColor }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.planPrice, { color: colors.foreground }]}>
        {price}
      </Text>
      <Text style={[styles.planSub, { color: colors.mutedForeground }]}>
        {sub}
      </Text>
    </Pressable>
  );
}

function Cell({
  value,
  colors,
  accent,
}: {
  value: string | true | false;
  colors: ColorPalette;
  accent?: string;
}) {
  if (value === true) {
    return (
      <View style={styles.colTier}>
        <Feather name="check" size={16} color={accent ?? colors.primary} />
      </View>
    );
  }
  if (value === false) {
    return (
      <View style={styles.colTier}>
        <Feather name="x" size={16} color={colors.mutedForeground} />
      </View>
    );
  }
  return (
    <Text
      style={[
        styles.cellText,
        styles.colTier,
        { color: accent ?? colors.foreground },
      ]}
      numberOfLines={1}
    >
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 8,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  brandPillText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: "#14532D",
    letterSpacing: 1,
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: "#FFFFFF",
    lineHeight: 30,
  },
  heroSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 19,
  },
  tierToggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    gap: 4,
  },
  tierToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tierToggleText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  legal: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  planRow: {
    flexDirection: "row",
    gap: 10,
  },
  planCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    gap: 4,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planLabel: { fontFamily: "Inter_700Bold", fontSize: 14 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
  },
  planPrice: { fontFamily: "Inter_700Bold", fontSize: 20, marginTop: 4 },
  planSub: { fontFamily: "Inter_400Regular", fontSize: 11 },
  cta: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  ctaText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  restore: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  subscribedBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  subscribedText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  modalSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  modalBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  tableCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  tableHeaderCell: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
  },
  colFeature: { flex: 2.4 },
  colTier: { flex: 1, alignItems: "center", textAlign: "center" },
  featureCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  cellText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
});
