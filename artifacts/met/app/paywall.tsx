import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import {
  findMonthlyPackage,
  findYearlyPackage,
  isRevenueCatTestMode,
  useSubscription,
} from "@/lib/revenuecat";

const FEATURES: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; sub: string }[] = [
  {
    icon: "send",
    title: "Unlimited reveal requests",
    sub: "Free is capped at 3 per week.",
  },
  {
    icon: "clock",
    title: "Full encounter history",
    sub: "See everyone you've crossed paths with — not just the last 24h.",
  },
  {
    icon: "eye",
    title: "Read receipts on requests",
    sub: "Know when someone has seen your reveal request.",
  },
  {
    icon: "repeat",
    title: "Frequent paths",
    sub: "Surface people you've crossed multiple times.",
  },
  {
    icon: "lock",
    title: "Privacy mode",
    sub: "Hide your name from non-connections until they reveal first.",
  },
];

export default function PaywallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    currentOffering,
    isLoading,
    isSubscribed,
    purchase,
    isPurchasing,
    restore,
    isRestoring,
    purchaseError,
  } = useSubscription();

  const monthly = findMonthlyPackage(currentOffering);
  const yearly = findYearlyPackage(currentOffering);

  const [selected, setSelected] = useState<"monthly" | "yearly">("yearly");
  const selectedPackage: PurchasesPackage | null =
    selected === "monthly" ? monthly : yearly;

  const monthlyPrice = monthly?.product.priceString ?? "—";
  const yearlyPrice = yearly?.product.priceString ?? "—";

  const monthlyPerMonth = monthly?.product.priceString
    ? `${monthly.product.priceString} / month`
    : "Monthly billing";
  const yearlyPerMonth = yearly?.product
    ? (() => {
        const total = yearly.product.price;
        const perMonth = total / 12;
        const cur = yearly.product.currencyCode || "USD";
        try {
          return `${new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: cur,
          }).format(perMonth)} / month`;
        } catch {
          return `${perMonth.toFixed(2)} / month`;
        }
      })()
    : "Annual billing";

  const yearlySavings = (() => {
    if (!monthly?.product.price || !yearly?.product.price) return null;
    const yearlyAsMonthly = monthly.product.price * 12;
    const saved = Math.round(
      ((yearlyAsMonthly - yearly.product.price) / yearlyAsMonthly) * 100,
    );
    return saved > 0 ? `Save ${saved}%` : null;
  })();

  const testMode = isRevenueCatTestMode();
  const [confirmTest, setConfirmTest] = useState(false);

  const runPurchase = async () => {
    if (!selectedPackage) return;
    try {
      await purchase(selectedPackage);
      setTimeout(() => router.back(), 300);
    } catch (err) {
      // surfaced via purchaseError
      console.warn("Purchase failed", err);
    }
  };

  const startPurchase = () => {
    if (!selectedPackage) return;
    if (testMode) {
      // In test mode the confirmation modal makes the sandbox UX explicit.
      // In production we go straight to the store sheet (Apple/Google handle
      // the real confirmation UI).
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#3DCC44", "#2BA331"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.brandPill}>
            <Feather name="zap" size={14} color="#3DCC44" />
            <Text style={styles.brandPillText}>Met Plus</Text>
          </View>
          <Pressable onPress={close} hitSlop={12}>
            <Feather name="x" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        <Text style={styles.heroTitle}>
          Connect with everyone{"\n"}you cross paths with.
        </Text>
        <Text style={styles.heroSub}>
          Unlock unlimited reveals, full history, and privacy controls.
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 220,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {FEATURES.map((f) => (
          <View
            key={f.title}
            style={[
              styles.featureRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[styles.featureIcon, { backgroundColor: "#DCFCE7" }]}
            >
              <Feather name={f.icon} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.featureTitle, { color: colors.foreground }]}>
                {f.title}
              </Text>
              <Text
                style={[styles.featureSub, { color: colors.mutedForeground }]}
              >
                {f.sub}
              </Text>
            </View>
          </View>
        ))}

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
        {isSubscribed ? (
          <View style={styles.subscribedBox}>
            <Feather name="check-circle" size={20} color={colors.primary} />
            <Text
              style={[styles.subscribedText, { color: colors.foreground }]}
            >
              You&rsquo;re on Met Plus. Thanks for supporting Met!
            </Text>
            <Pressable
              onPress={close}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: colors.primary,
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
        ) : !monthly && !yearly ? (
          <Text style={[styles.legal, { color: colors.destructive }]}>
            Plans aren&rsquo;t available right now. Pull to refresh.
          </Text>
        ) : (
          <>
            <View style={styles.planRow}>
              <PlanCard
                label="Monthly"
                price={monthlyPrice}
                sub={monthlyPerMonth}
                badge={null}
                selected={selected === "monthly"}
                disabled={!monthly}
                onPress={() => setSelected("monthly")}
                colors={colors}
              />
              <PlanCard
                label="Yearly"
                price={yearlyPrice}
                sub={yearlyPerMonth}
                badge={yearlySavings}
                selected={selected === "yearly"}
                disabled={!yearly}
                onPress={() => setSelected("yearly")}
                colors={colors}
              />
            </View>

            {purchaseError ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {(purchaseError as Error).message ||
                  "Purchase failed. Please try again."}
              </Text>
            ) : null}

            <Pressable
              onPress={startPurchase}
              disabled={!selectedPackage || isPurchasing}
              style={({ pressed }) => [
                styles.cta,
                {
                  backgroundColor: colors.primary,
                  opacity: !selectedPackage || isPurchasing
                    ? 0.6
                    : pressed
                      ? 0.85
                      : 1,
                },
              ]}
            >
              <Text style={styles.ctaText}>
                {isPurchasing
                  ? "Processing…"
                  : selected === "yearly"
                    ? `Start Plus — ${yearlyPrice} / year`
                    : `Start Plus — ${monthlyPrice} / month`}
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
              {selected === "yearly" ? " yearly" : " monthly"} plan to unlock Plus?
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
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
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
}: {
  label: string;
  price: string;
  sub: string;
  badge: string | null;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.planCard,
        {
          backgroundColor: selected ? "#DCFCE7" : colors.muted,
          borderColor: selected ? colors.primary : colors.border,
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
          <View
            style={[styles.badge, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.planPrice, { color: colors.foreground }]}>{price}</Text>
      <Text style={[styles.planSub, { color: colors.mutedForeground }]}>
        {sub}
      </Text>
    </Pressable>
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
    fontSize: 26,
    color: "#FFFFFF",
    lineHeight: 32,
  },
  heroSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  featureSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  legal: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
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
});
