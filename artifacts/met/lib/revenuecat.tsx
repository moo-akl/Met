// RevenueCat connector — client-side subscription provider.
// Uses the RevenueCat integration's public API keys (EXPO_PUBLIC_REVENUECAT_*).
import React, { createContext, useContext } from "react";
import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReferrals } from "./referrals";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_PLUS_ENTITLEMENT = "plus";
export const REVENUECAT_PRO_ENTITLEMENT = "pro";
// Back-compat: existing imports still reference the old name.
export const REVENUECAT_ENTITLEMENT_IDENTIFIER = REVENUECAT_PLUS_ENTITLEMENT;

export const PLUS_OFFERING_IDENTIFIER = "default";
export const PRO_OFFERING_IDENTIFIER = "pro";

export type Tier = "free" | "plus" | "pro";

export function isRevenueCatTestMode() {
  return __DEV__ || Platform.OS === "web";
}

function getRevenueCatApiKey() {
  if (isRevenueCatTestMode()) {
    if (!REVENUECAT_TEST_API_KEY) {
      throw new Error("RevenueCat test API key not found");
    }
    return REVENUECAT_TEST_API_KEY;
  }
  if (Platform.OS === "ios") {
    if (!REVENUECAT_IOS_API_KEY) {
      throw new Error("RevenueCat iOS API key not found");
    }
    return REVENUECAT_IOS_API_KEY;
  }
  if (Platform.OS === "android") {
    if (!REVENUECAT_ANDROID_API_KEY) {
      throw new Error("RevenueCat Android API key not found");
    }
    return REVENUECAT_ANDROID_API_KEY;
  }
  throw new Error("RevenueCat: unsupported platform");
}

let initialized = false;

export function initializeRevenueCat() {
  if (initialized) return;
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) throw new Error("RevenueCat Public API Key not found");
  Purchases.setLogLevel(Purchases.LOG_LEVEL.WARN);
  Purchases.configure({ apiKey });
  initialized = true;
  console.log("Configured RevenueCat");
}

function deriveTier(info: CustomerInfo | undefined): Tier {
  if (!info) return "free";
  if (info.entitlements.active?.[REVENUECAT_PRO_ENTITLEMENT]) return "pro";
  if (info.entitlements.active?.[REVENUECAT_PLUS_ENTITLEMENT]) return "plus";
  return "free";
}

function useSubscriptionContext() {
  const queryClient = useQueryClient();
  // Local promotional Plus from the referral program. We OR this with the
  // RevenueCat entitlement so a real Pro/Plus subscriber is never demoted,
  // and a referral-rewarded user gets Plus-level access without a backend.
  const referrals = useReferrals();
  const promoPlusUntil =
    referrals.reward && referrals.reward.expiresAt > Date.now()
      ? referrals.reward.expiresAt
      : null;
  const promoPlusActive = promoPlusUntil !== null;

  const customerInfoQuery = useQuery<CustomerInfo>({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => Purchases.getCustomerInfo(),
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery<PurchasesOfferings>({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => Purchases.getOfferings(),
    staleTime: 5 * 60 * 1000,
    // Android's billing client takes a moment to connect after configure().
    // Retry up to 4 times with exponential back-off (1s, 2s, 4s, 8s) so a
    // transient "BillingClient not ready" error heals without user action.
    retry: 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: PurchasesPackage) => {
      const { customerInfo } = await Purchases.purchasePackage(
        packageToPurchase,
      );
      return customerInfo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["revenuecat", "customer-info"],
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => Purchases.restorePurchases(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["revenuecat", "customer-info"],
      });
    },
  });

  // Tri-state readiness so we never send a paid user to the paywall during
  // cold-start latency. `tier` is "free" by default, but `isSubscriptionReady`
  // tells callers whether that "free" is a real verdict yet.
  const subscriptionStatus: "unknown" | "active" | "inactive" =
    customerInfoQuery.data === undefined
      ? "unknown"
      : customerInfoQuery.data.entitlements.active?.[
            REVENUECAT_PLUS_ENTITLEMENT
          ] !== undefined ||
          customerInfoQuery.data.entitlements.active?.[
            REVENUECAT_PRO_ENTITLEMENT
          ] !== undefined
        ? "active"
        : "inactive";

  const rcTier: Tier = deriveTier(customerInfoQuery.data);
  // Promo can only ever upgrade free → plus. Real Pro stays Pro.
  const tier: Tier =
    rcTier === "pro" ? "pro" : promoPlusActive ? "plus" : rcTier;
  const isSubscribed = subscriptionStatus === "active" || promoPlusActive;
  const isProSubscriber = tier === "pro";
  const isPlusSubscriber = tier === "plus" || tier === "pro";
  const isSubscriptionReady =
    subscriptionStatus !== "unknown" || promoPlusActive;

  const offerings = offeringsQuery.data;
  const plusOffering: PurchasesOffering | null =
    offerings?.all?.[PLUS_OFFERING_IDENTIFIER] ?? offerings?.current ?? null;
  const proOffering: PurchasesOffering | null =
    offerings?.all?.[PRO_OFFERING_IDENTIFIER] ?? null;

  return {
    customerInfo: customerInfoQuery.data,
    offerings,
    currentOffering: offeringsQuery.data?.current ?? null,
    plusOffering,
    proOffering,
    subscriptionStatus,
    tier,
    isSubscribed,
    isProSubscriber,
    isPlusSubscriber,
    isSubscriptionReady,
    promoPlusUntil,
    promoPlusActive,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    error: customerInfoQuery.error ?? offeringsQuery.error,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    purchaseError: purchaseMutation.error,
    refetch: () => {
      customerInfoQuery.refetch();
      offeringsQuery.refetch();
    },
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx)
    throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}

export function findMonthlyPackage(
  offering: PurchasesOffering | null | undefined,
): PurchasesPackage | null {
  if (!offering) return null;
  return (
    offering.monthly ??
    offering.availablePackages.find(
      (p) => p.identifier === "$rc_monthly" || p.packageType === "MONTHLY",
    ) ??
    null
  );
}

export function findYearlyPackage(
  offering: PurchasesOffering | null | undefined,
): PurchasesPackage | null {
  if (!offering) return null;
  return (
    offering.annual ??
    offering.availablePackages.find(
      (p) => p.identifier === "$rc_annual" || p.packageType === "ANNUAL",
    ) ??
    null
  );
}
