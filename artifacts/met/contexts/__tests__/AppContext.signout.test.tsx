/**
 * Tests that signOutAndClear and resetAll wipe all per-device flags from
 * AsyncStorage so a second user on the same device always starts fresh.
 *
 * Covers:
 * - signOutAndClear: met:interestsDragHintDismissed:v1 is absent after call
 * - signOutAndClear: met:disclosure:location:v1 is absent after call
 * - signOutAndClear: met:disclosure:bluetooth:v1 is absent after call
 * - resetAll: met:interestsDragHintDismissed:v1 is absent after call
 * - resetAll: met:disclosure:location:v1 is absent after call
 * - resetAll: met:disclosure:bluetooth:v1 is absent after call
 */

// ---------------------------------------------------------------------------
// In-memory AsyncStorage mock — hoisted before all imports.
// ---------------------------------------------------------------------------

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    _store: store,
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
  };
});

// ---------------------------------------------------------------------------
// Stub out every heavy native / Firebase dependency.
// ---------------------------------------------------------------------------

jest.mock("@/lib/auth", () => ({
  signOut: jest.fn().mockResolvedValue(undefined),
  deleteUserAccount: jest.fn().mockResolvedValue(undefined),
  subscribeToAuthState: jest.fn(() => jest.fn()),
}));

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    logOut: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/lib/referrals", () => ({
  clearReferrals: jest.fn().mockResolvedValue(undefined),
  initReferrals: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/seed", () => ({
  buildSeedEncounters: jest.fn().mockReturnValue([]),
}));

jest.mock("@/lib/api/client", () => ({
  __esModule: true,
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      super("ApiError");
      this.status = status;
      this.body = body;
    }
  },
  api: {
    isConfigured: jest.fn().mockReturnValue(false),
    upsertMyProfile: jest.fn().mockResolvedValue(undefined),
    uploadProfilePhoto: jest.fn().mockResolvedValue({ photoUrl: "" }),
    removeConnection: jest.fn().mockResolvedValue(undefined),
    getRevealRequests: jest.fn().mockResolvedValue({ inbox: [], outbox: [] }),
    registerPushToken: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/lib/proximity/presence", () => ({
  startProximity: jest.fn().mockResolvedValue({ started: false }),
  stopProximity: jest.fn(),
}));

jest.mock("@/lib/ble", () => ({
  startBleProximity: jest.fn().mockResolvedValue({ started: false }),
  stopBleProximity: jest.fn(),
}));

jest.mock("@/lib/firestore/presence", () => ({
  startFirestoreProximity: jest.fn().mockResolvedValue({ started: false }),
  stopFirestoreProximity: jest.fn(),
}));

jest.mock("@/lib/firestore/encounters", () => ({
  subscribeToMetPeople: jest.fn().mockReturnValue(jest.fn()),
  subscribeToRemovals: jest.fn().mockReturnValue(jest.fn()),
  subscribeToRequestsChange: jest.fn().mockReturnValue(jest.fn()),
  writeRemoval: jest.fn().mockResolvedValue(undefined),
  writeRevealResponse: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/notifications", () => ({
  presentEncounterNotification: jest.fn().mockResolvedValue(undefined),
  presentRevealAcceptedNotification: jest.fn().mockResolvedValue(undefined),
  presentRevealRequestNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/firestore/cooldown", () => ({
  clearCooldownsFor: jest.fn().mockResolvedValue(undefined),
  isInCooldown: jest.fn().mockResolvedValue(false),
  markCooldown: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/i18n", () => ({
  getLanguage: jest.fn().mockReturnValue("en"),
}));

// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import React from "react";
import TestRenderer from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppProvider, useApp } from "@/contexts/AppContext";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DRAG_HINT_KEY = "met:interestsDragHintDismissed:v1";
const DISCLOSURE_LOCATION_KEY = "met:disclosure:location:v1";
const DISCLOSURE_BLUETOOTH_KEY = "met:disclosure:bluetooth:v1";

/** Direct reference to the in-memory store from the mock factory. */
const store = (AsyncStorage as unknown as { _store: Record<string, string> })
  ._store;

/** Wipe the in-memory store. */
function clearStore() {
  Object.keys(store).forEach((k) => delete store[k]);
}

/** Pre-populate all three flag keys so a test can confirm they disappear. */
function seedFlags() {
  store[DRAG_HINT_KEY] = "1";
  store[DISCLOSURE_LOCATION_KEY] = "1";
  store[DISCLOSURE_BLUETOOTH_KEY] = "1";
}

// ---------------------------------------------------------------------------
// TestConsumer — captures signOutAndClear and resetAll from context.
// ---------------------------------------------------------------------------

type AppCallbacks = {
  signOutAndClear: (() => Promise<void>) | null;
  resetAll: (() => Promise<void>) | null;
};

function TestConsumer({ callbacks }: { callbacks: AppCallbacks }) {
  const ctx = useApp();
  callbacks.signOutAndClear = ctx.signOutAndClear;
  callbacks.resetAll = ctx.resetAll;
  return null;
}

/**
 * Renders AppProvider + TestConsumer using react-test-renderer so that
 * the synchronous act() call ensures the component tree is fully mounted
 * and the callbacks object is populated before we return.
 */
function renderApp(): AppCallbacks {
  const callbacks: AppCallbacks = { signOutAndClear: null, resetAll: null };
  TestRenderer.act(() => {
    TestRenderer.create(
      <AppProvider>
        <TestConsumer callbacks={callbacks} />
      </AppProvider>,
    );
  });
  return callbacks;
}

// ---------------------------------------------------------------------------
// signOutAndClear
// ---------------------------------------------------------------------------

describe("signOutAndClear — per-device flags are wiped", () => {
  beforeEach(() => {
    clearStore();
    seedFlags();
  });

  afterEach(() => {
    clearStore();
    jest.clearAllMocks();
  });

  it("removes met:interestsDragHintDismissed:v1", async () => {
    const callbacks = renderApp();
    await TestRenderer.act(async () => {
      await callbacks.signOutAndClear!();
    });
    expect(store[DRAG_HINT_KEY]).toBeUndefined();
  });

  it("removes met:disclosure:location:v1", async () => {
    const callbacks = renderApp();
    await TestRenderer.act(async () => {
      await callbacks.signOutAndClear!();
    });
    expect(store[DISCLOSURE_LOCATION_KEY]).toBeUndefined();
  });

  it("removes met:disclosure:bluetooth:v1", async () => {
    const callbacks = renderApp();
    await TestRenderer.act(async () => {
      await callbacks.signOutAndClear!();
    });
    expect(store[DISCLOSURE_BLUETOOTH_KEY]).toBeUndefined();
  });

  it("removes all three flags in a single call", async () => {
    const callbacks = renderApp();
    await TestRenderer.act(async () => {
      await callbacks.signOutAndClear!();
    });
    expect(store[DRAG_HINT_KEY]).toBeUndefined();
    expect(store[DISCLOSURE_LOCATION_KEY]).toBeUndefined();
    expect(store[DISCLOSURE_BLUETOOTH_KEY]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resetAll
// ---------------------------------------------------------------------------

describe("resetAll — per-device flags are wiped", () => {
  beforeEach(() => {
    clearStore();
    seedFlags();
  });

  afterEach(() => {
    clearStore();
    jest.clearAllMocks();
  });

  it("removes met:interestsDragHintDismissed:v1", async () => {
    const callbacks = renderApp();
    await TestRenderer.act(async () => {
      await callbacks.resetAll!();
    });
    expect(store[DRAG_HINT_KEY]).toBeUndefined();
  });

  it("removes met:disclosure:location:v1", async () => {
    const callbacks = renderApp();
    await TestRenderer.act(async () => {
      await callbacks.resetAll!();
    });
    expect(store[DISCLOSURE_LOCATION_KEY]).toBeUndefined();
  });

  it("removes met:disclosure:bluetooth:v1", async () => {
    const callbacks = renderApp();
    await TestRenderer.act(async () => {
      await callbacks.resetAll!();
    });
    expect(store[DISCLOSURE_BLUETOOTH_KEY]).toBeUndefined();
  });

  it("removes all three flags in a single call", async () => {
    const callbacks = renderApp();
    await TestRenderer.act(async () => {
      await callbacks.resetAll!();
    });
    expect(store[DRAG_HINT_KEY]).toBeUndefined();
    expect(store[DISCLOSURE_LOCATION_KEY]).toBeUndefined();
    expect(store[DISCLOSURE_BLUETOOTH_KEY]).toBeUndefined();
  });
});
