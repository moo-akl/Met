import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";

const mockRouter = { back: jest.fn() };
const mockRestore = jest.fn();
const mockSubscription = {
  plusOffering: {},
  proOffering: null,
  isLoading: false,
  tier: "free",
  isSubscriptionReady: true,
  isProSubscriber: false,
  isPlusSubscriber: false,
  purchase: jest.fn().mockResolvedValue(undefined),
  isPurchasing: false,
  restore: mockRestore,
  isRestoring: false,
  purchaseError: null,
  isRevenueCatIdentityReady: true,
  revenueCatIdentityStatus: "ready",
  hasAuthenticatedAccount: true,
  retryRevenueCatIdentity: jest.fn().mockResolvedValue(undefined),
  subscriptionStatus: "inactive",
  refetch: jest.fn(),
};
const mockPackage = {
  product: {
    price: 2.99,
    currencyCode: "USD",
    identifier: "plus-monthly",
    priceString: "$2.99",
  },
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#fff",
    border: "#ddd",
    card: "#fff",
    destructive: "#c00",
    foreground: "#111",
    muted: "#eee",
    mutedForeground: "#666",
    primary: "#080",
  }),
}));

jest.mock("@/components/MetGradient", () => ({
  LinearGradient: ({ children }: { children: unknown }) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, null, children);
  },
}));

jest.mock("@/lib/tiktok", () => ({
  tiktokTrackPurchase: jest.fn(),
  tiktokTrackViewContent: jest.fn(),
}));

jest.mock("@/lib/revenuecat", () => ({
  findMonthlyPackage: () => mockPackage,
  findYearlyPackage: () => mockPackage,
  isRevenueCatTestMode: () => false,
  useSubscription: () => mockSubscription,
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: () => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text);
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import PaywallScreen from "@/app/paywall";

beforeEach(() => {
  mockSubscription.isRevenueCatIdentityReady = true;
  mockSubscription.isSubscriptionReady = true;
  mockSubscription.revenueCatIdentityStatus = "ready";
  mockSubscription.hasAuthenticatedAccount = true;
  mockRestore.mockReset();
});

it("shows a retryable restore error and clears it after a successful retry", async () => {
  mockRestore
    .mockRejectedValueOnce(new Error("Store connection unavailable"))
    .mockResolvedValueOnce(undefined);
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<PaywallScreen />);
  });

  await act(async () => {
    await renderer.root.findByProps({ testID: "paywall-restore-button" }).props.onPress();
  });
  expect(
    renderer.root.findByProps({ testID: "paywall-restore-error" }).props.children,
  ).toContain("tap Restore purchases to try again");

  await act(async () => {
    await renderer.root.findByProps({ testID: "paywall-restore-button" }).props.onPress();
  });
  expect(
    renderer.root.findAllByProps({ testID: "paywall-restore-error" }),
  ).toHaveLength(0);
  expect(mockRestore).toHaveBeenCalledTimes(2);
});

it("does not expose purchase or restore actions before the account is linked", async () => {
  mockSubscription.isRevenueCatIdentityReady = false;
  mockSubscription.isSubscriptionReady = false;
  mockSubscription.revenueCatIdentityStatus = "loading";
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<PaywallScreen />);
  });

  const identityText = renderer.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .filter((child): child is string => typeof child === "string")
    .join(" ");
  expect(identityText).toContain("Verifying your account");
  expect(renderer.root.findAllByProps({ testID: "paywall-purchase-button" })).toHaveLength(0);
  expect(renderer.root.findAllByProps({ testID: "paywall-restore-button" })).toHaveLength(0);
});
