/**
 * Tests that the tier field written to a met_people Firestore doc is mapped
 * into the corresponding Encounter object in AppContext state — the full
 * round-trip: Firestore snapshot → subscribeToMetPeople listener →
 * AppContext encounters state.
 *
 * Covers:
 * - tier: "pro" in a met_people snapshot patches the matching encounter
 * - tier: "plus" in a met_people snapshot patches the matching encounter
 * - tier field is omitted when the snapshot doc has no tier
 * - tier patch is a no-op when the encounter tier is already current
 */

// ---------------------------------------------------------------------------
// In-memory AsyncStorage mock — must be hoisted before all imports.
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
  getCurrentUserEmail: jest.fn().mockResolvedValue(null),
  subscribeToAuthState: jest.fn(() => jest.fn()),
}));

jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: {
    logIn: jest.fn().mockResolvedValue(undefined),
    logOut: jest.fn().mockResolvedValue(undefined),
    setEmail: jest.fn().mockResolvedValue(undefined),
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
    isConfigured: jest.fn().mockReturnValue(true),
    upsertMyProfile: jest.fn().mockResolvedValue(undefined),
    uploadProfilePhoto: jest.fn().mockResolvedValue({ photoUrl: "" }),
    removeConnection: jest.fn().mockResolvedValue(undefined),
    getRevealRequests: jest.fn().mockResolvedValue({ inbox: [], outbox: [] }),
    registerPushToken: jest.fn().mockResolvedValue(undefined),
    getProfile: jest.fn().mockResolvedValue({
      displayName: "Peer User",
      photoUrl: "",
      bio: "",
      socials: {},
    }),
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

// subscribeToMetPeople implementation is set per-test via mockImplementation.
jest.mock("@/lib/firestore/encounters", () => ({
  subscribeToMetPeople: jest.fn().mockResolvedValue(() => {}),
  subscribeToRemovals: jest.fn().mockResolvedValue(() => {}),
  subscribeToRequestsChange: jest.fn().mockResolvedValue(() => {}),
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

jest.mock("@/lib/venueOwnerIntent", () => ({
  clearVenueOwnerIntent: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import React from "react";
import TestRenderer from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as authLib from "@/lib/auth";
import * as encountersMod from "@/lib/firestore/encounters";
import type { MetPersonDoc } from "@/lib/firestore/encounters";
import type { Encounter } from "@/lib/types";

import { AppProvider, useApp } from "@/contexts/AppContext";

// ---------------------------------------------------------------------------
// Type alias
// ---------------------------------------------------------------------------

type MetPeopleListener = (people: MetPersonDoc[]) => void;

// ---------------------------------------------------------------------------
// Per-test state (reset in beforeEach)
// ---------------------------------------------------------------------------

let capturedAuthCallback: ((uid: string | null) => void) | null = null;
let capturedMetPeopleListener: MetPeopleListener | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENCOUNTERS_KEY = "met:encounters:v1";

const store = (AsyncStorage as unknown as { _store: Record<string, string> })
  ._store;

function clearStore() {
  Object.keys(store).forEach((k) => delete store[k]);
}

function seedEncounters(encs: Encounter[]) {
  store[ENCOUNTERS_KEY] = JSON.stringify(encs);
}

function makeEncounter(id: string): Encounter {
  return {
    id,
    realName: "Test Person",
    photoUri: "",
    bio: "",
    socials: {},
    encounterCount: 1,
    firstSeenAt: 1000,
    lastSeenAt: 1000,
    lastDistanceM: 5,
    lastLocation: "In the room",
    status: "encounter",
  };
}

// ---------------------------------------------------------------------------
// TestConsumer — exposes encounters from context.
// ---------------------------------------------------------------------------

type EncountersCapture = { value: Encounter[] };

function TestConsumer({ capture }: { capture: EncountersCapture }) {
  const ctx = useApp();
  capture.value = ctx.encounters;
  return null;
}

// ---------------------------------------------------------------------------
// Main test helper
// ---------------------------------------------------------------------------

/**
 * Renders AppProvider, fires the auth-state callback with the given uid so
 * authedUid is set, then flushes microtasks so the subscribeToMetPeople
 * effect fires. Returns both a live encounter-capture ref and the captured
 * listener.
 */
async function renderAppAndAwaitListener(
  uid: string,
): Promise<{ capture: EncountersCapture; listener: MetPeopleListener }> {
  capturedMetPeopleListener = null;

  (encountersMod.subscribeToMetPeople as jest.Mock).mockImplementation(
    (_uid: string, listener: MetPeopleListener) => {
      capturedMetPeopleListener = listener;
      return Promise.resolve(() => {});
    },
  );

  const capture: EncountersCapture = { value: [] };

  // Step 1: Mount the tree. Effects fire during act(), including
  // subscribeToAuthState which stores capturedAuthCallback.
  await TestRenderer.act(async () => {
    TestRenderer.create(
      <AppProvider>
        <TestConsumer capture={capture} />
      </AppProvider>,
    );
  });

  // Step 2: Fire the auth callback so setAuthedUid(uid) is called,
  // triggering the subscribeToMetPeople effect on the next render.
  await TestRenderer.act(async () => {
    if (!capturedAuthCallback) {
      throw new Error(
        "subscribeToAuthState was never called — AppProvider did not mount correctly",
      );
    }
    capturedAuthCallback(uid);
  });

  // Step 3: Flush microtasks so the async IIFE inside the effect reaches
  // the subscribeToMetPeople(uid, listener) call (which happens before
  // the first await inside that IIFE).
  await TestRenderer.act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  if (!capturedMetPeopleListener) {
    throw new Error(
      "subscribeToMetPeople was not called — check authedUid and api.isConfigured()",
    );
  }

  return { capture, listener: capturedMetPeopleListener };
}

// ---------------------------------------------------------------------------
// beforeEach / afterEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearStore();
  jest.clearAllMocks();
  capturedAuthCallback = null;
  capturedMetPeopleListener = null;

  // Re-apply defaults cleared by clearAllMocks.
  (authLib.subscribeToAuthState as jest.Mock).mockImplementation(
    (cb: (uid: string | null) => void) => {
      capturedAuthCallback = cb;
      return jest.fn();
    },
  );
  (authLib.getCurrentUserEmail as jest.Mock).mockResolvedValue(null);

  const apiMod = jest.requireMock("@/lib/api/client") as {
    api: {
      isConfigured: jest.Mock;
      upsertMyProfile: jest.Mock;
      uploadProfilePhoto: jest.Mock;
      getRevealRequests: jest.Mock;
      getProfile: jest.Mock;
      registerPushToken: jest.Mock;
      removeConnection: jest.Mock;
    };
  };
  apiMod.api.isConfigured.mockReturnValue(true);
  apiMod.api.upsertMyProfile.mockResolvedValue(undefined);
  apiMod.api.uploadProfilePhoto.mockResolvedValue({ photoUrl: "" });
  apiMod.api.getRevealRequests.mockResolvedValue({ inbox: [], outbox: [] });
  apiMod.api.getProfile.mockResolvedValue({
    displayName: "Peer User",
    photoUrl: "",
    bio: "",
    socials: {},
  });
  apiMod.api.registerPushToken.mockResolvedValue(undefined);
  apiMod.api.removeConnection.mockResolvedValue(undefined);

  (encountersMod.subscribeToMetPeople as jest.Mock).mockResolvedValue(
    () => {},
  );
  (encountersMod.subscribeToRemovals as jest.Mock).mockResolvedValue(
    () => {},
  );
  (encountersMod.subscribeToRequestsChange as jest.Mock).mockResolvedValue(
    () => {},
  );
});

afterEach(() => {
  clearStore();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AppContext met_people subscription — tier field mapping", () => {
  it('patches tier: "pro" onto a matching existing encounter', async () => {
    seedEncounters([makeEncounter("peer-uid-1")]);

    const { capture, listener } = await renderAppAndAwaitListener("me-uid");

    await TestRenderer.act(async () => {
      listener([
        {
          otherUid: "peer-uid-1",
          lastMet: 1000,
          metCount: 1,
          location: null,
          tier: "pro",
        },
      ]);
    });

    const enc = capture.value.find((e) => e.id === "peer-uid-1");
    expect(enc).toBeDefined();
    expect(enc?.tier).toBe("pro");
  });

  it('patches tier: "plus" onto a matching existing encounter', async () => {
    seedEncounters([makeEncounter("peer-uid-2")]);

    const { capture, listener } = await renderAppAndAwaitListener("me-uid");

    await TestRenderer.act(async () => {
      listener([
        {
          otherUid: "peer-uid-2",
          lastMet: 2000,
          metCount: 1,
          location: null,
          tier: "plus",
        },
      ]);
    });

    const enc = capture.value.find((e) => e.id === "peer-uid-2");
    expect(enc).toBeDefined();
    expect(enc?.tier).toBe("plus");
  });

  it("leaves tier undefined when the snapshot doc carries no tier field", async () => {
    seedEncounters([makeEncounter("peer-uid-3")]);

    const { capture, listener } = await renderAppAndAwaitListener("me-uid");

    await TestRenderer.act(async () => {
      listener([
        {
          otherUid: "peer-uid-3",
          lastMet: 3000,
          metCount: 1,
          location: null,
          // no tier field
        },
      ]);
    });

    const enc = capture.value.find((e) => e.id === "peer-uid-3");
    expect(enc).toBeDefined();
    expect(enc?.tier).toBeUndefined();
  });

  it("preserves tier: \"pro\" when the snapshot doc reports the same tier", async () => {
    const enc = { ...makeEncounter("peer-uid-4"), tier: "pro" as const };
    seedEncounters([enc]);

    const { capture, listener } = await renderAppAndAwaitListener("me-uid");

    await TestRenderer.act(async () => {
      listener([
        {
          otherUid: "peer-uid-4",
          lastMet: 4000,
          metCount: 1,
          location: null,
          tier: "pro",
        },
      ]);
    });

    // The tier must not be cleared or changed when the snapshot matches.
    const result = capture.value.find((e) => e.id === "peer-uid-4");
    expect(result).toBeDefined();
    expect(result?.tier).toBe("pro");
  });
});
