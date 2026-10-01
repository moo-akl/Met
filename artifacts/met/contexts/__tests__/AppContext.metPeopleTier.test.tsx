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
    constructor(message: string, status: number, body: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
  api: {
    isConfigured: jest.fn().mockReturnValue(true),
    getMyProfile: jest.fn().mockResolvedValue(undefined),
    upsertMyProfile: jest.fn().mockResolvedValue(undefined),
    uploadProfilePhoto: jest.fn().mockResolvedValue({ photoUrl: "" }),
    removeConnection: jest.fn().mockResolvedValue(undefined),
    sendReveal: jest.fn().mockResolvedValue({ updatedAt: "2026-01-01T00:00:00.000Z" }),
    listInboundReveals: jest.fn().mockResolvedValue([]),
    listOutboundReveals: jest.fn().mockResolvedValue([]),
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
  stopBleProximity: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/firestore/presence", () => ({
  startFirestoreProximity: jest.fn().mockResolvedValue({ started: false }),
  stopFirestoreProximity: jest.fn(),
  suppressFirestorePresence: jest.fn().mockResolvedValue(true),
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
import { Alert } from "react-native";
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
const mountedRenderers = new Set<TestRenderer.ReactTestRenderer>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENCOUNTERS_KEY = "met:encounters:v1";
const PROFILE_KEY = "met:profile:v1";

const store = (AsyncStorage as unknown as { _store: Record<string, string> })
  ._store;

function clearStore() {
  Object.keys(store).forEach((k) => delete store[k]);
}

function seedEncounters(encs: Encounter[]) {
  store[ENCOUNTERS_KEY] = JSON.stringify(encs);
}

function seedProfile(isVisible: boolean) {
  store[PROFILE_KEY] = JSON.stringify({
    id: "me-uid",
    name: "Local User",
    bio: "",
    photoUri: "https://example.com/photo.png",
    socials: {},
    verified: true,
    isVisible,
  });
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

type VisibilityCapture = {
  profile: ReturnType<typeof useApp>["profile"];
  ready: boolean;
};

type DiscoveryCapture = {
  profile: ReturnType<typeof useApp>["profile"];
  encounters: Encounter[];
  setProfile: ReturnType<typeof useApp>["setProfile"];
  sendRevealRequest: ReturnType<typeof useApp>["sendRevealRequest"];
};

function VisibilityConsumer({ capture }: { capture: VisibilityCapture }) {
  const ctx = useApp();
  capture.profile = ctx.profile;
  capture.ready = ctx.ready;
  return null;
}

function DiscoveryConsumer({ capture }: { capture: DiscoveryCapture }) {
  const ctx = useApp();
  capture.profile = ctx.profile;
  capture.encounters = ctx.encounters;
  capture.setProfile = ctx.setProfile;
  capture.sendRevealRequest = ctx.sendRevealRequest;
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
    const renderer = TestRenderer.create(
      <AppProvider>
        <TestConsumer capture={capture} />
      </AppProvider>,
    );
    mountedRenderers.add(renderer);
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

async function renderVisibleDiscoveryConsumer(): Promise<{
  capture: DiscoveryCapture;
  listener: MetPeopleListener;
}> {
  seedProfile(true);
  const apiMod = jest.requireMock("@/lib/api/client") as {
    api: {
      getMyProfile: jest.Mock;
      upsertMyProfile: jest.Mock;
      getProfile: jest.Mock;
    };
  };
  apiMod.api.getMyProfile.mockResolvedValue({
    uid: "me-uid",
    displayName: "Local User",
    photoUrl: "https://example.com/photo.png",
    bio: "",
    socials: {},
    interests: null,
    isVisible: true,
    visibilityVersion: "version-1",
  });
  apiMod.api.upsertMyProfile.mockResolvedValue({ isVisible: true });
  (encountersMod.subscribeToMetPeople as jest.Mock).mockImplementation(
    (_uid: string, listener: MetPeopleListener) => {
      capturedMetPeopleListener = listener;
      return Promise.resolve(() => {});
    },
  );
  const capture: DiscoveryCapture = {
    profile: null,
    encounters: [],
    setProfile: async () => {},
    sendRevealRequest: async () => {},
  };

  await TestRenderer.act(async () => {
    const renderer = TestRenderer.create(
      <AppProvider>
        <DiscoveryConsumer capture={capture} />
      </AppProvider>,
    );
    mountedRenderers.add(renderer);
  });
  await TestRenderer.act(async () => {
    if (!capturedAuthCallback) {
      throw new Error("subscribeToAuthState was never called");
    }
    capturedAuthCallback("me-uid");
    for (let i = 0; i < 60; i += 1) await Promise.resolve();
  });
  if (!capturedMetPeopleListener || capture.profile?.isVisible !== true) {
    throw new Error("Visible profile did not finish startup reconciliation");
  }
  return { capture, listener: capturedMetPeopleListener };
}

function makeMetPerson(otherUid: string): MetPersonDoc {
  return {
    otherUid,
    lastMet: 1234,
    metCount: 1,
    location: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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
      getMyProfile: jest.Mock;
      upsertMyProfile: jest.Mock;
      uploadProfilePhoto: jest.Mock;
      getRevealRequests: jest.Mock;
      sendReveal: jest.Mock;
      getProfile: jest.Mock;
      listInboundReveals: jest.Mock;
      listOutboundReveals: jest.Mock;
      registerPushToken: jest.Mock;
      removeConnection: jest.Mock;
    };
  };
  apiMod.api.isConfigured.mockReturnValue(true);
  apiMod.api.getMyProfile.mockResolvedValue(undefined);
  apiMod.api.upsertMyProfile.mockResolvedValue(undefined);
  apiMod.api.uploadProfilePhoto.mockResolvedValue({ photoUrl: "" });
  apiMod.api.getRevealRequests.mockResolvedValue({ inbox: [], outbox: [] });
  apiMod.api.sendReveal.mockResolvedValue({
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  apiMod.api.listInboundReveals.mockResolvedValue([]);
  apiMod.api.listOutboundReveals.mockResolvedValue([]);
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
  for (const renderer of mountedRenderers) {
    TestRenderer.act(() => renderer.unmount());
  }
  mountedRenderers.clear();
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

describe("AppContext met_people deferred profile synthesis", () => {
  it("does not synthesize or notify when Hide wins while a profile fetch is pending", async () => {
    const apiMod = jest.requireMock("@/lib/api/client") as {
      api: { getProfile: jest.Mock };
    };
    const pendingProfile = deferred<{
      displayName: string;
      photoUrl: string;
      bio: string;
      socials: Record<string, string>;
      isVisible: boolean;
    }>();
    apiMod.api.getProfile.mockReturnValue(pendingProfile.promise);
    const notifications = jest.requireMock("@/lib/notifications") as {
      presentEncounterNotification: jest.Mock;
    };
    notifications.presentEncounterNotification.mockClear();
    const { capture, listener } = await renderVisibleDiscoveryConsumer();

    await TestRenderer.act(async () => {
      listener([makeMetPerson("delayed-peer")]);
      for (let i = 0; i < 20 && !apiMod.api.getProfile.mock.calls.length; i += 1) {
        await Promise.resolve();
      }
    });
    expect(apiMod.api.getProfile).toHaveBeenCalledWith(
      { uid: "me-uid" },
      "delayed-peer",
    );

    await TestRenderer.act(async () => {
      await capture.setProfile({ ...capture.profile!, isVisible: false });
    });
    await TestRenderer.act(async () => {
      pendingProfile.resolve({
        displayName: "Delayed Peer",
        photoUrl: "https://example.com/peer.png",
        bio: "",
        socials: {},
        isVisible: true,
      });
      for (let i = 0; i < 40; i += 1) await Promise.resolve();
    });

    expect(capture.encounters.some((encounter) => encounter.id === "delayed-peer"))
      .toBe(false);
    expect(notifications.presentEncounterNotification).not.toHaveBeenCalled();
  });

  it("does not synthesize or notify when the peer leaves the current snapshot during a fetch", async () => {
    const apiMod = jest.requireMock("@/lib/api/client") as {
      api: { getProfile: jest.Mock };
    };
    const pendingProfile = deferred<{
      displayName: string;
      photoUrl: string;
      bio: string;
      socials: Record<string, string>;
      isVisible: boolean;
    }>();
    apiMod.api.getProfile.mockReturnValue(pendingProfile.promise);
    const notifications = jest.requireMock("@/lib/notifications") as {
      presentEncounterNotification: jest.Mock;
    };
    notifications.presentEncounterNotification.mockClear();
    const { capture, listener } = await renderVisibleDiscoveryConsumer();

    await TestRenderer.act(async () => {
      listener([makeMetPerson("removed-peer")]);
      for (let i = 0; i < 20 && !apiMod.api.getProfile.mock.calls.length; i += 1) {
        await Promise.resolve();
      }
      listener([]);
    });
    expect(apiMod.api.getProfile).toHaveBeenCalledWith(
      { uid: "me-uid" },
      "removed-peer",
    );

    await TestRenderer.act(async () => {
      pendingProfile.resolve({
        displayName: "Removed Peer",
        photoUrl: "https://example.com/peer.png",
        bio: "",
        socials: {},
        isVisible: true,
      });
      for (let i = 0; i < 40; i += 1) await Promise.resolve();
    });

    expect(capture.encounters.some((encounter) => encounter.id === "removed-peer"))
      .toBe(false);
    expect(notifications.presentEncounterNotification).not.toHaveBeenCalled();
  });
});

describe("AppContext reveal request creation", () => {
  it("creates a request through the authenticated API before updating local state", async () => {
    seedEncounters([makeEncounter("reveal-peer")]);
    const apiMod = jest.requireMock("@/lib/api/client") as {
      api: { sendReveal: jest.Mock };
    };
    apiMod.api.sendReveal.mockResolvedValue({
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const { capture } = await renderVisibleDiscoveryConsumer();

    await TestRenderer.act(async () => {
      await capture.sendRevealRequest("reveal-peer", "  hello  ");
    });

    expect(apiMod.api.sendReveal).toHaveBeenCalledWith(
      { uid: "me-uid" },
      { recipientUid: "reveal-peer", message: "hello" },
    );
    expect(
      capture.encounters.find((encounter) => encounter.id === "reveal-peer")
        ?.status,
    ).toBe("request_sent");
    expect(encountersMod.writeRevealResponse).not.toHaveBeenCalled();
  });

  it("surfaces an offline API failure without leaving a phantom request", async () => {
    seedEncounters([makeEncounter("offline-peer")]);
    const apiMod = jest.requireMock("@/lib/api/client") as {
      api: { sendReveal: jest.Mock };
    };
    apiMod.api.sendReveal.mockRejectedValue(new Error("offline"));
    const { capture } = await renderVisibleDiscoveryConsumer();
    let failure: unknown;

    await TestRenderer.act(async () => {
      try {
        await capture.sendRevealRequest("offline-peer", "hello");
      } catch (err) {
        failure = err;
      }
    });

    expect(failure).toEqual(new Error("offline"));
    expect(
      capture.encounters.find((encounter) => encounter.id === "offline-peer")
        ?.status,
    ).toBe("encounter");
    expect(encountersMod.writeRevealResponse).not.toHaveBeenCalled();
  });
});

describe("AppContext visibility startup reconciliation", () => {
  it("keeps a locally hidden profile hidden when the server still reports visible", async () => {
    seedProfile(false);
    const apiMod = jest.requireMock("@/lib/api/client") as {
      api: {
        getMyProfile: jest.Mock;
        upsertMyProfile: jest.Mock;
      };
    };
    apiMod.api.getMyProfile.mockResolvedValue({
      uid: "me-uid",
      displayName: "Local User",
      photoUrl: "https://example.com/photo.png",
      bio: "",
      socials: {},
      interests: null,
      isVisible: true,
      visibilityVersion: "version-1",
    });
    apiMod.api.upsertMyProfile.mockResolvedValue({ isVisible: false });
    const capture: VisibilityCapture = { profile: null, ready: false };

    await TestRenderer.act(async () => {
      const renderer = TestRenderer.create(
        <AppProvider>
          <VisibilityConsumer capture={capture} />
        </AppProvider>,
      );
      mountedRenderers.add(renderer);
    });
    await TestRenderer.act(async () => {
      if (!capturedAuthCallback) {
        throw new Error("subscribeToAuthState was never called");
      }
      capturedAuthCallback("me-uid");
      for (let i = 0; i < 40; i += 1) await Promise.resolve();
    });

    expect(capture.profile?.isVisible).toBe(false);
    expect(apiMod.api.upsertMyProfile).toHaveBeenCalledWith(
      { uid: "me-uid" },
      expect.objectContaining({ isVisible: false }),
    );
    expect(apiMod.api.upsertMyProfile).not.toHaveBeenCalledWith(
      { uid: "me-uid" },
      expect.objectContaining({ isVisible: true }),
    );
  });

  it("fails closed and reports unresolved account-wide hiding after a failed read", async () => {
    seedProfile(true);
    const apiMod = jest.requireMock("@/lib/api/client") as {
      api: {
        getMyProfile: jest.Mock;
        upsertMyProfile: jest.Mock;
      };
    };
    apiMod.api.getMyProfile.mockRejectedValue(new Error("offline"));
    apiMod.api.upsertMyProfile
      .mockRejectedValueOnce(new Error("remote hide unavailable"))
      .mockResolvedValue({ isVisible: false });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const capture: VisibilityCapture = { profile: null, ready: false };

    await TestRenderer.act(async () => {
      const renderer = TestRenderer.create(
        <AppProvider>
          <VisibilityConsumer capture={capture} />
        </AppProvider>,
      );
      mountedRenderers.add(renderer);
    });
    await TestRenderer.act(async () => {
      if (!capturedAuthCallback) {
        throw new Error("subscribeToAuthState was never called");
      }
      capturedAuthCallback("me-uid");
      for (let i = 0; i < 40; i += 1) await Promise.resolve();
    });

    expect(capture.ready).toBe(true);
    expect(capture.profile?.isVisible).toBe(false);
    expect(apiMod.api.getMyProfile).toHaveBeenCalledWith({ uid: "me-uid" });
    expect(apiMod.api.upsertMyProfile).toHaveBeenCalledWith(
      { uid: "me-uid" },
      expect.objectContaining({ isVisible: false }),
    );
    expect(alertSpy).toHaveBeenCalledWith(
      "You're hidden on this device",
      expect.stringContaining("account's remote visibility may still be active"),
    );

    alertSpy.mockRestore();
  });
});
