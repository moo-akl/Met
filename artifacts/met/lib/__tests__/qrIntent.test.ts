jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store[k] ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: jest.fn(async (k: string) => {
        delete store[k];
      }),
      __reset: () => {
        store = {};
      },
    },
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  clearQrIntent,
  decodeQrIntent,
  isQrIntentExpired,
  loadQrIntent,
  parseQrIntentFromUrl,
  QR_INTENT_TTL_MS,
  qrIntentHref,
  runQrVerifyOnce,
  saveQrIntent,
} from "@/lib/qrIntent";
import {
  buildMinimalProfile,
  decideProfileGateRoute,
  isIncompleteProfile,
  pickMinimalDisplayName,
} from "@/lib/profileCompletion";
import type { Profile } from "@/lib/types";

beforeEach(() => {
  (AsyncStorage as unknown as { __reset: () => void }).__reset();
});

describe("parseQrIntentFromUrl", () => {
  it("parses https universal links", () => {
    expect(parseQrIntentFromUrl("https://met-app.org/v/ChIJabc123?t=tok_9")).toEqual({
      placeId: "ChIJabc123",
      token: "tok_9",
    });
    expect(parseQrIntentFromUrl("https://metapp.replit.app/v/P1/?x=1&t=abc")).toEqual({
      placeId: "P1",
      token: "abc",
    });
  });
  it("parses met:// scheme forms", () => {
    expect(parseQrIntentFromUrl("met:///v/P2?t=xyz")).toEqual({ placeId: "P2", token: "xyz" });
    expect(parseQrIntentFromUrl("met://v/P3?t=xyz")).toEqual({ placeId: "P3", token: "xyz" });
  });
  it("accepts only Met-owned hosts", () => {
    expect(parseQrIntentFromUrl("https://www.met-app.org/v/P?t=a")).not.toBeNull();
    expect(parseQrIntentFromUrl("https://evil.example/v/P?t=a")).toBeNull();
    expect(parseQrIntentFromUrl("https://met-app.org.evil.example/v/P?t=a")).toBeNull();
    expect(parseQrIntentFromUrl("http://met-app.org/v/P?t=a")).toBeNull();
    expect(parseQrIntentFromUrl("https://met-app.org/x/v/P?t=a")).toBeNull();
    expect(parseQrIntentFromUrl("otherapp://v/P?t=a")).toBeNull();
  });
  it("rejects missing token or unrelated urls", () => {
    expect(parseQrIntentFromUrl("https://met-app.org/v/P1")).toBeNull();
    expect(parseQrIntentFromUrl("https://met-app.org/venue/P1?t=a")).toBeNull();
    expect(parseQrIntentFromUrl("met://r/ABC234")).toBeNull();
    expect(parseQrIntentFromUrl(null)).toBeNull();
    expect(parseQrIntentFromUrl("https://met-app.org/v/bad%20id?t=a")).toBeNull();
  });
});

describe("expiry + decoding", () => {
  it("expires after one hour", () => {
    const i = { placeId: "P", token: "t", createdAt: 1_000 };
    expect(isQrIntentExpired(i, 1_000 + QR_INTENT_TTL_MS)).toBe(false);
    expect(isQrIntentExpired(i, 1_001 + QR_INTENT_TTL_MS)).toBe(true);
  });
  it("rejects malformed storage", () => {
    expect(decodeQrIntent("not json")).toBeNull();
    expect(decodeQrIntent(JSON.stringify({ placeId: "P" }))).toBeNull();
  });
});

describe("storage", () => {
  it("saves, loads and clears", async () => {
    await saveQrIntent("P", "t", null, 5_000);
    expect(await loadQrIntent(null, 6_000)).toMatchObject({ placeId: "P", token: "t", createdAt: 5_000 });
    await clearQrIntent();
    expect(await loadQrIntent(null, 6_000)).toBeNull();
  });
  it("drops expired intents on load", async () => {
    await saveQrIntent("P", "t", null, 0);
    expect(await loadQrIntent(null, QR_INTENT_TTL_MS + 1)).toBeNull();
    expect(await AsyncStorage.getItem("met:pending-qr-intent:v1")).toBeNull();
  });
  it("discards intents bound to a different account", async () => {
    await saveQrIntent("P", "t", "uid-a", 0);
    expect(await loadQrIntent("uid-b", 10)).toBeNull();
  });
  it("keeps unbound intents for whoever signs in", async () => {
    await saveQrIntent("P", "t", null, 0);
    expect(await loadQrIntent("uid-b", 10)).not.toBeNull();
  });
  it("does not reset createdAt for duplicate saves", async () => {
    await saveQrIntent("P", "t", null, 100);
    const again = await saveQrIntent("P", "t", null, 200);
    expect(again?.createdAt).toBe(100);
  });
  it("builds route href", () => {
    expect(qrIntentHref({ placeId: "P 1", token: "a" })).toBe("/v/P%201?t=a");
  });
});

describe("runQrVerifyOnce", () => {
  it("dedupes concurrent verify calls", async () => {
    const run = jest.fn(() => new Promise<string>((r) => setTimeout(() => r("ok"), 5)));
    const [a, b] = await Promise.all([
      runQrVerifyOnce("P", "t", run),
      runQrVerifyOnce("P", "t", run),
    ]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(a).toBe("ok");
    expect(b).toBe("ok");
  });
});

describe("runQrVerifyOnce per account", () => {
  it("does not share a promise across accounts", async () => {
    const run = jest.fn(() => new Promise<string>((r) => setTimeout(() => r("ok"), 5)));
    await Promise.all([
      runQrVerifyOnce("P", "t", run, "uid-a"),
      runQrVerifyOnce("P", "t", run, "uid-b"),
      runQrVerifyOnce("P", "t", run, "uid-a"),
    ]);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("profile gate branching", () => {
  const complete: Profile = {
    id: "u", name: "Ana", bio: "", photoUri: "https://x/p.jpg", socials: {}, verified: true, isVisible: false,
  };
  const minimal = buildMinimalProfile("u", "Met visitor");

  it("never redirects away from /v", () => {
    expect(decideProfileGateRoute({ root: "v", authedUid: null, profile: null, permissionsCompleted: false })).toBeNull();
  });
  it("sends profile-less users to onboarding", () => {
    expect(decideProfileGateRoute({ root: "(tabs)", authedUid: null, profile: null, permissionsCompleted: false })).toBe("/onboarding");
  });
  it("lets incomplete profiles browse without the permissions redirect", () => {
    expect(isIncompleteProfile(minimal)).toBe(true);
    expect(decideProfileGateRoute({ root: "(tabs)", authedUid: "u", profile: minimal, permissionsCompleted: false })).toBeNull();
  });
  it("keeps the permissions flow for complete profiles", () => {
    expect(decideProfileGateRoute({ root: "(tabs)", authedUid: "u", profile: complete, permissionsCompleted: false })).toBe("/permissions");
    expect(decideProfileGateRoute({ root: "(tabs)", authedUid: "u", profile: complete, permissionsCompleted: true })).toBeNull();
  });
  it("picks a neutral display name", () => {
    expect(pickMinimalDisplayName(null)).toBe("Met visitor");
    expect(pickMinimalDisplayName("Apple User")).toBe("Met visitor");
    expect(pickMinimalDisplayName(" Lina ")).toBe("Lina");
    expect(minimal.photoUri).toBe("");
    expect(minimal.verified).toBe(false);
  });
});
