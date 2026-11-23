import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppState, type AppStateStatus } from "react-native";
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from "react-native-purchases";

const mockAppState = {
  authedUid: "uid-a",
  accountLifecycle: { status: "active", accountId: "account-a" },
  revenueCatIdentity: {
    status: "ready",
    uid: "uid-a",
    accountId: "account-a",
  },
  refreshAccountLifecycle: jest.fn().mockResolvedValue(undefined),
};
jest.mock("@/contexts/AppContext", () => ({
  useApp: () => mockAppState,
}));

jest.mock("@/lib/referrals", () => ({
  useReferrals: () => ({ reward: null }),
}));

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
}));

import {
  SubscriptionProvider,
  useSubscription,
} from "@/lib/revenuecat";

const mockPurchases = jest.requireMock("react-native-purchases").default as {
  getCustomerInfo: jest.Mock;
  getOfferings: jest.Mock;
  purchasePackage: jest.Mock;
  restorePurchases: jest.Mock;
  addCustomerInfoUpdateListener: jest.Mock;
  removeCustomerInfoUpdateListener: jest.Mock;
};
let appStateChangeListener: ((state: AppStateStatus) => void) | null = null;

function customerInfo(entitlements: Record<string, unknown> = {}) {
  return { entitlements: { active: entitlements } } as CustomerInfo;
}

function makeHarness() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <SubscriptionProvider>{children}</SubscriptionProvider>
    </QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => {
  mockAppState.authedUid = "uid-a";
  mockAppState.accountLifecycle = { status: "active", accountId: "account-a" };
  mockAppState.revenueCatIdentity = {
    status: "ready",
    uid: "uid-a",
    accountId: "account-a",
  };
  mockPurchases.getCustomerInfo.mockResolvedValue(customerInfo());
  mockPurchases.getCustomerInfo.mockClear();
  mockPurchases.getOfferings.mockResolvedValue({
    current: null,
    all: {},
  } as PurchasesOfferings);
  mockPurchases.addCustomerInfoUpdateListener.mockClear();
  mockPurchases.removeCustomerInfoUpdateListener.mockClear();
  mockPurchases.purchasePackage.mockReset();
  mockPurchases.restorePurchases.mockReset();
  mockAppState.refreshAccountLifecycle.mockClear();
  appStateChangeListener = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation((eventType, listener) => {
    if (eventType === "change") {
      appStateChangeListener = listener as (state: AppStateStatus) => void;
    }
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("does not expose the previous account's tier while switching identities", async () => {
  let activeCustomerInfo = customerInfo({ plus: { isActive: true } });
  mockPurchases.getCustomerInfo.mockImplementation(async () => activeCustomerInfo);
  const { client, wrapper } = makeHarness();
  const hook = await renderHook(() => useSubscription(), { wrapper });

  await waitFor(() => expect(hook.result.current.tier).toBe("plus"));

  mockAppState.authedUid = "uid-b";
  mockAppState.accountLifecycle = { status: "active", accountId: "account-b" };
  mockAppState.revenueCatIdentity = {
    status: "loading",
    uid: "uid-b",
    accountId: "account-b",
  };
  activeCustomerInfo = customerInfo({ pro: { isActive: true } });
  await hook.rerender();
  expect(mockPurchases.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(
    mockPurchases.addCustomerInfoUpdateListener.mock.calls[0][0],
  );

  expect(hook.result.current.isRevenueCatIdentityReady).toBe(false);
  expect(hook.result.current.isSubscriptionReady).toBe(false);
  expect(hook.result.current.tier).toBe("free");

  mockAppState.revenueCatIdentity = {
    status: "ready",
    uid: "uid-b",
    accountId: "account-b",
  };
  await hook.rerender();
  await waitFor(() => expect(hook.result.current.tier).toBe("pro"));
  expect(client.getQueryData(["revenuecat", "customer-info", "account-a"])).toBeUndefined();
  expect(client.getQueryData(["revenuecat", "customer-info", "account-b"])).toBeDefined();

  mockAppState.authedUid = null;
  mockAppState.accountLifecycle = { status: "signed_out", accountId: null };
  mockAppState.revenueCatIdentity = {
    status: "signed_out",
    uid: null,
    accountId: null,
  };
  await hook.rerender();
  expect(hook.result.current.isRevenueCatIdentityReady).toBe(false);
  expect(client.getQueryData(["revenuecat", "customer-info", "account-b"])).toBeUndefined();
});

it("updates the active tier immediately when RevenueCat reports a renewal", async () => {
  const initialInfo = customerInfo({
    plus: { isActive: true, expirationDate: "2026-12-01T00:00:00.000Z" },
  });
  mockPurchases.getCustomerInfo.mockResolvedValue(initialInfo);
  const { client, wrapper } = makeHarness();
  const hook = await renderHook(() => useSubscription(), { wrapper });
  await waitFor(() => expect(hook.result.current.tier).toBe("plus"));
  await waitFor(() =>
    expect(mockPurchases.addCustomerInfoUpdateListener).toHaveBeenCalledTimes(1),
  );
  const listener = mockPurchases.addCustomerInfoUpdateListener.mock.calls[0][0] as (
    info: CustomerInfo,
  ) => void;
  const renewedInfo = customerInfo({
    plus: { isActive: true, expirationDate: "2027-01-01T00:00:00.000Z" },
  });

  await act(async () => {
    listener(renewedInfo);
  });

  await waitFor(() => expect(hook.result.current.customerInfo).toEqual(renewedInfo));
  expect(hook.result.current.tier).toBe("plus");
  expect(client.getQueryData(["revenuecat", "customer-info", "account-a"])).toEqual(
    renewedInfo,
  );
});

it.each([
  ["expiration", customerInfo()],
  ["cancellation", customerInfo()],
])("removes paid benefits immediately after %s", async (_transition, inactiveInfo) => {
  mockPurchases.getCustomerInfo.mockResolvedValue(
    customerInfo({ pro: { isActive: true } }),
  );
  const { client, wrapper } = makeHarness();
  const hook = await renderHook(() => useSubscription(), { wrapper });
  await waitFor(() => expect(hook.result.current.tier).toBe("pro"));
  await waitFor(() =>
    expect(mockPurchases.addCustomerInfoUpdateListener).toHaveBeenCalledTimes(1),
  );
  const listener = mockPurchases.addCustomerInfoUpdateListener.mock.calls[0][0] as (
    info: CustomerInfo,
  ) => void;

  await act(async () => {
    listener(inactiveInfo);
  });

  await waitFor(() => expect(hook.result.current.tier).toBe("free"));
  expect(hook.result.current.isSubscribed).toBe(false);
  expect(hook.result.current.subscriptionStatus).toBe("inactive");
  expect(hook.result.current.isSubscriptionReady).toBe(true);
  expect(client.getQueryData(["revenuecat", "customer-info", "account-a"])).toEqual(
    inactiveInfo,
  );
});

it("refreshes RevenueCat customer info when the app returns to the foreground", async () => {
  let activeCustomerInfo = customerInfo({ plus: { isActive: true } });
  mockPurchases.getCustomerInfo.mockImplementation(async () => activeCustomerInfo);
  const { wrapper } = makeHarness();
  const hook = await renderHook(() => useSubscription(), { wrapper });
  await waitFor(() => expect(hook.result.current.tier).toBe("plus"));
  await waitFor(() => expect(appStateChangeListener).not.toBeNull());
  const callsBeforeResume = mockPurchases.getCustomerInfo.mock.calls.length;
  activeCustomerInfo = customerInfo({ pro: { isActive: true } });

  await act(async () => {
    appStateChangeListener?.("active");
  });

  await waitFor(() => expect(hook.result.current.tier).toBe("pro"));
  expect(mockPurchases.getCustomerInfo.mock.calls.length).toBeGreaterThan(
    callsBeforeResume,
  );
});

it("refreshes customer info after a successful restore", async () => {
  let activeCustomerInfo = customerInfo();
  mockPurchases.getCustomerInfo.mockImplementation(async () => activeCustomerInfo);
  mockPurchases.restorePurchases.mockResolvedValue(customerInfo({ plus: { isActive: true } }));
  const { wrapper } = makeHarness();
  const hook = await renderHook(() => useSubscription(), { wrapper });

  await waitFor(() => expect(hook.result.current.isSubscriptionReady).toBe(true));
  activeCustomerInfo = customerInfo({ plus: { isActive: true } });
  const customerInfoCallsBeforeRestore = mockPurchases.getCustomerInfo.mock.calls.length;

  await act(async () => {
    await hook.result.current.restore();
  });

  await waitFor(() => expect(hook.result.current.tier).toBe("plus"));
  expect(mockPurchases.restorePurchases).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(mockPurchases.getCustomerInfo.mock.calls.length).toBeGreaterThan(
      customerInfoCallsBeforeRestore,
    ),
  );
});

it("rejects and exposes restore failures so the paywall can offer a retry", async () => {
  const failure = new Error("Store connection unavailable");
  mockPurchases.restorePurchases.mockRejectedValue(failure);
  const { wrapper } = makeHarness();
  const hook = await renderHook(() => useSubscription(), { wrapper });
  await waitFor(() => expect(hook.result.current.isSubscriptionReady).toBe(true));

  await act(async () => {
    await expect(hook.result.current.restore()).rejects.toThrow(
      "Store connection unavailable",
    );
  });

  expect(hook.result.current.restoreError).toBe(failure);
});

it("does not call the store until the signed-in account is linked", async () => {
  mockAppState.revenueCatIdentity = {
    status: "loading",
    uid: "uid-a",
    accountId: "account-a",
  };
  const { wrapper } = makeHarness();
  const hook = await renderHook(() => useSubscription(), { wrapper });

  await act(async () => {
    await expect(
      hook.result.current.purchase({} as PurchasesPackage),
    ).rejects.toThrow("Sign in before starting a purchase.");
    await expect(hook.result.current.restore()).rejects.toThrow(
      "Sign in before restoring purchases.",
    );
  });

  expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
  expect(mockPurchases.restorePurchases).not.toHaveBeenCalled();
});
