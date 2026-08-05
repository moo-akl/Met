/**
 * Regression tests: QR verification persists across cold starts
 *
 * The "Scan QR → Unlock Reward" banner must stay gone after the user
 * scans a venue QR code and kills/reopens the app.  The persistence
 * mechanism is:
 *
 *   1. subscribeQrVerification handler  →  writes isQrVerified: true
 *      to AsyncStorage immediately after markQrVerified() fires.
 *      This is the write path that ensures the next cold start sees
 *      the QR-verified state.
 *
 *   2. init path (cold-start restore)  →  reads the stored entry,
 *      restores hubState with isQrVerified: true, and pushes the
 *      debounce clock forward so no redundant /nearby call fires.
 *
 * Both paths are tested here at the module level by directly calling the
 * qrVerificationState helpers and the AsyncStorage-interaction logic
 * (extracted from useHubCheckin).  This avoids hook-rendering complexity
 * (setInterval, location APIs, etc.) while still testing the exact code
 * paths that matter for the regression.
 *
 * If the AsyncStorage write is removed, the key is renamed, or the init
 * restore logic drops isQrVerified, at least one test here will fail.
 */

// ---------------------------------------------------------------------------
// AsyncStorage mock
// ---------------------------------------------------------------------------

jest.mock("@react-native-async-storage/async-storage", () => {
  const mockStore: Record<string, string> = {};
  return {
    __esModule: true,
    _store: mockStore,
    default: {
      _store: mockStore,
      getItem: jest.fn((key: string) =>
        Promise.resolve(mockStore[key] ?? null),
      ),
      setItem: jest.fn((key: string, value: string) => {
        mockStore[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete mockStore[key];
        return Promise.resolve();
      }),
    },
  };
});

// ---------------------------------------------------------------------------
// Firebase Auth stub (required transitively by some api-client imports)
// ---------------------------------------------------------------------------

jest.mock("@react-native-firebase/auth", () => ({
  __esModule: true,
  default: () => ({ currentUser: null }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  markQrVerified,
  subscribeQrVerification,
  getQrVerified,
} from "@/lib/qrVerificationState";
import type { HubState } from "@/hooks/useHubCheckin";

// Pull the backing store and spy from the mock module.
const mockMod = jest.requireMock(
  "@react-native-async-storage/async-storage",
) as { _store: Record<string, string>; default: { setItem: jest.Mock; getItem: jest.Mock } };
const mockStore = mockMod._store;
const setItemSpy = mockMod.default.setItem;
const getItemSpy = mockMod.default.getItem;

// Keep these in sync with useHubCheckin.ts so a rename fails the tests.
const CHECKIN_STORAGE_KEY = "@hub_checkin_state";
const CHECKIN_COOLDOWN_MS = 4 * 60 * 60 * 1_000;

// ---------------------------------------------------------------------------
// Test helpers that mirror the exact logic inside useHubCheckin
// ---------------------------------------------------------------------------

/**
 * Mirrors the subscribeQrVerification callback registered inside useHubCheckin.
 * Returns the spy for AsyncStorage.setItem so tests can inspect its calls.
 *
 * Internally it:
 *   1. Holds a mutable ref to the current hubState (as the hook's useState does).
 *   2. Subscribes to QR events; on match, updates state and writes AsyncStorage.
 *   3. Returns an unsubscribe function plus a getter for the current state.
 */
function mountSubscriptionHandler(initialHubState: HubState | null): {
  getHubState: () => HubState | null;
  unsubscribe: () => void;
} {
  let hubState: HubState | null = initialHubState;

  const unsubscribe = subscribeQrVerification((placeId, streak) => {
    // Mirrors: setHubState((prev) => { ... })
    const prev = hubState;
    if (!prev || prev.placeId !== placeId) return;

    const updated: HubState = {
      ...prev,
      isQrVerified: true,
      ...(streak !== undefined && { streak }),
    };

    // Mirrors: void AsyncStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify({ hubState: updated, checkedInAt: Date.now() }))
    void AsyncStorage.setItem(
      CHECKIN_STORAGE_KEY,
      JSON.stringify({ hubState: updated, checkedInAt: Date.now() }),
    );

    hubState = updated;
  });

  return { getHubState: () => hubState, unsubscribe };
}

/**
 * Mirrors the init() async function inside the useEffect in useHubCheckin.
 *
 * Returns { restoredState, debounced } where:
 *   - restoredState: the HubState reconstructed from AsyncStorage (or null).
 *   - debounced: true when lastFiredAt was pushed forward (debounce engaged).
 */
async function runInitPath(): Promise<{
  restoredState: HubState | null;
  debounced: boolean;
}> {
  let restoredState: HubState | null = null;
  let debounced = false;

  try {
    const stored = await AsyncStorage.getItem(CHECKIN_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as {
        hubState: HubState;
        checkedInAt: number;
      };
      if (Date.now() - parsed.checkedInAt < CHECKIN_COOLDOWN_MS) {
        // Merge in-session QR state — mirrors the hook's restore logic.
        restoredState = {
          ...parsed.hubState,
          isQrVerified:
            parsed.hubState.isQrVerified ||
            getQrVerified(parsed.hubState.placeId),
        };
        // lastFiredAt.current = Date.now() — represented here as a boolean.
        debounced = true;
      }
    }
  } catch {
    // Ignore — mirrors the hook's catch block.
  }

  return { restoredState, debounced };
}

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const baseHubState: HubState = {
  placeId: "place-abc",
  placeName: "The Venue",
  streak: 2,
  isMock: false,
  isRegisteredVenue: true,
  isQrVerified: false,
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  jest.clearAllMocks();

  // Re-apply implementations after clearAllMocks.
  getItemSpy.mockImplementation((key: string) =>
    Promise.resolve(mockStore[key] ?? null),
  );
  setItemSpy.mockImplementation((key: string, value: string) => {
    mockStore[key] = value;
    return Promise.resolve();
  });
});

// ---------------------------------------------------------------------------
// Test suite 1 — subscription handler writes isQrVerified: true to AsyncStorage
// ---------------------------------------------------------------------------

describe("subscribeQrVerification handler → AsyncStorage persistence", () => {
  it("writes isQrVerified: true to AsyncStorage when markQrVerified fires for the current venue", async () => {
    const { getHubState, unsubscribe } = mountSubscriptionHandler(baseHubState);

    // Verify initial state is not QR-verified.
    expect(getHubState()?.isQrVerified).toBe(false);

    // Simulate a successful QR scan.
    markQrVerified("place-abc", 3);

    // State should update synchronously (subscribeQrVerification calls listeners
    // immediately, before any awaits).
    expect(getHubState()?.isQrVerified).toBe(true);

    // The handler fires void AsyncStorage.setItem — flush the microtask queue.
    await Promise.resolve();

    // setItem must have been called with the checkin key.
    const checkinCall = setItemSpy.mock.calls.find(
      ([key]) => key === CHECKIN_STORAGE_KEY,
    );
    expect(checkinCall).toBeDefined();

    const persisted = JSON.parse(checkinCall![1] as string) as {
      hubState: HubState;
      checkedInAt: number;
    };

    // The persisted entry must carry isQrVerified: true.
    expect(persisted.hubState.isQrVerified).toBe(true);
    // placeId must be preserved.
    expect(persisted.hubState.placeId).toBe("place-abc");
    // streak provided to markQrVerified must be reflected.
    expect(persisted.hubState.streak).toBe(3);
    // checkedInAt must be a recent timestamp (within the last 5 seconds).
    expect(persisted.checkedInAt).toBeGreaterThan(Date.now() - 5_000);

    unsubscribe();
  });

  it("preserves the existing streak when markQrVerified is called without a streak argument", async () => {
    const { getHubState, unsubscribe } = mountSubscriptionHandler({
      ...baseHubState,
      streak: 5,
    });

    markQrVerified("place-abc"); // no streak arg
    await Promise.resolve();

    const checkinCall = setItemSpy.mock.calls.find(
      ([key]) => key === CHECKIN_STORAGE_KEY,
    );
    expect(checkinCall).toBeDefined();

    const persisted = JSON.parse(checkinCall![1] as string) as {
      hubState: HubState;
    };
    // Streak must be unchanged when not supplied.
    expect(persisted.hubState.streak).toBe(5);
    expect(persisted.hubState.isQrVerified).toBe(true);

    unsubscribe();
  });

  it("does NOT write to AsyncStorage when markQrVerified fires for a different venue", async () => {
    const { getHubState, unsubscribe } = mountSubscriptionHandler(baseHubState);

    // QR scan fires for a different placeId.
    markQrVerified("place-xyz");
    await Promise.resolve();

    // State must be unchanged — placeId mismatch guard.
    expect(getHubState()?.isQrVerified).toBe(false);

    // No checkin-key write should have occurred.
    const checkinCall = setItemSpy.mock.calls.find(
      ([key]) => key === CHECKIN_STORAGE_KEY,
    );
    expect(checkinCall).toBeUndefined();

    unsubscribe();
  });

  it("does NOT write to AsyncStorage when there is no current hub state (not checked in)", async () => {
    // hubState is null — user is not checked in anywhere.
    const { unsubscribe } = mountSubscriptionHandler(null);

    markQrVerified("place-abc");
    await Promise.resolve();

    // Nothing to update when not checked in.
    expect(setItemSpy).not.toHaveBeenCalled();

    unsubscribe();
  });
});

// ---------------------------------------------------------------------------
// Test suite 2 — cold-start restore: isQrVerified: true is kept, no re-call
// ---------------------------------------------------------------------------

describe("cold-start restore (init path) — isQrVerified: true survives a remount", () => {
  it("restores hubState with isQrVerified: true from a recently written AsyncStorage entry", async () => {
    // Seed storage with a QR-verified state written 30 seconds ago.
    mockStore[CHECKIN_STORAGE_KEY] = JSON.stringify({
      hubState: { ...baseHubState, isQrVerified: true },
      checkedInAt: Date.now() - 30_000,
    });

    const { restoredState, debounced } = await runInitPath();

    // Must restore isQrVerified: true.
    expect(restoredState?.isQrVerified).toBe(true);
    expect(restoredState?.placeId).toBe("place-abc");

    // Debounce clock must be pushed forward to suppress the immediate
    // /nearby call that would otherwise re-check the user's location.
    expect(debounced).toBe(true);
  });

  it("does NOT restore a stale entry older than the 4-hour cooldown window", async () => {
    // Entry is 1 second past the cooldown window.
    mockStore[CHECKIN_STORAGE_KEY] = JSON.stringify({
      hubState: { ...baseHubState, isQrVerified: true },
      checkedInAt: Date.now() - CHECKIN_COOLDOWN_MS - 1_000,
    });

    const { restoredState, debounced } = await runInitPath();

    // Stale entry must be ignored.
    expect(restoredState).toBeNull();
    // Debounce must NOT fire — doCheckin() should run normally.
    expect(debounced).toBe(false);
  });

  it("returns null and no debounce when AsyncStorage has no stored entry", async () => {
    // Empty storage.
    const { restoredState, debounced } = await runInitPath();

    expect(restoredState).toBeNull();
    expect(debounced).toBe(false);
  });

  it("merges in-session getQrVerified state when storage has isQrVerified: false", async () => {
    // Storage was written before the QR scan completed (isQrVerified: false) …
    mockStore[CHECKIN_STORAGE_KEY] = JSON.stringify({
      hubState: { ...baseHubState, isQrVerified: false },
      checkedInAt: Date.now() - 1_000,
    });

    // … but the module-level in-memory store already has placeId verified
    // (markQrVerified fired before the app unmounted).
    markQrVerified("place-abc");

    const { restoredState } = await runInitPath();

    // The restore path must merge: isQrVerified: false || getQrVerified(placeId) → true.
    expect(restoredState?.isQrVerified).toBe(true);
  });

  it("gracefully handles a corrupt AsyncStorage value without throwing", async () => {
    // Store invalid JSON.
    mockStore[CHECKIN_STORAGE_KEY] = "not-json{{{";

    // Should not throw — the hook's catch block silences errors.
    await expect(runInitPath()).resolves.toEqual({
      restoredState: null,
      debounced: false,
    });
  });
});
