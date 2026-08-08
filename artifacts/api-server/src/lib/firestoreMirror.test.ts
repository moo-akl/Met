import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted Firestore mock — captured before vi.mock() factory runs so tests
// can inspect individual batch.set() calls.
// ---------------------------------------------------------------------------

const batchMock = vi.hoisted(() => ({
  set: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));

/** Tracks every doc ref created via collection().doc() so tests can
 *  find the one that corresponds to uidA or uidB. */
const createdRefs: Array<{ path: string; ref: unknown }> = [];

const adminDbMock = vi.hoisted(() => {
  function makeDocRef(path: string) {
    const ref = {
      _path: path,
      collection: (sub: string) => makeDocRef(`${path}/${sub}`),
      doc: (id: string) => {
        const child = makeDocRef(`${path}/${id}`);
        createdRefs.push({ path: `${path}/${id}`, ref: child });
        return child;
      },
      get: vi.fn().mockResolvedValue({
        data: () => ({ metCount: 1, lastMet: { toDate: () => new Date() } }),
      }),
    };
    return ref;
  }

  const rootCollection = (name: string) => ({
    doc: (id: string) => {
      const ref = makeDocRef(`${name}/${id}`);
      createdRefs.push({ path: `${name}/${id}`, ref });
      return ref;
    },
  });

  return vi.fn(() => ({
    collection: rootCollection,
    batch: () => batchMock,
  }));
});

vi.mock("./firebaseAdmin", () => ({
  adminDb: adminDbMock,
  adminAuth: vi.fn(),
  adminStorage: vi.fn(),
  tryInitAdmin: vi.fn(),
}));

vi.mock("./logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// firebase-admin/firestore helpers used by the module under test.
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: () => "__serverTimestamp__",
    increment: (n: number) => ({ __increment: n }),
    arrayUnion: (...items: unknown[]) => ({ __arrayUnion: items }),
    arrayRemove: (...items: unknown[]) => ({ __arrayRemove: items }),
  },
  GeoPoint: class {
    constructor(
      public lat: number,
      public lng: number,
    ) {}
  },
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { recordSymmetricEncounter } from "./firestoreMirror";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  createdRefs.length = 0;
  batchMock.commit.mockResolvedValue(undefined);
});

describe("recordSymmetricEncounter — tier propagation", () => {
  /**
   * Helper: return the data written to a given set() call whose first
   * argument path ends with `…/met_people/<docId>`.
   */
  function setCallData(
    docId: string,
  ): Record<string, unknown> | undefined {
    const call = batchMock.set.mock.calls.find((args: unknown[]) => {
      const ref = args[0] as { _path?: string };
      return ref?._path?.endsWith(`/met_people/${docId}`);
    });
    return call ? (call[1] as Record<string, unknown>) : undefined;
  }

  it("writes tierB into uidA's met_people doc so uidA sees the peer ring", async () => {
    await recordSymmetricEncounter({
      uidA: "alice",
      uidB: "bob",
      tierA: "plus",
      tierB: "pro",
    });

    // uidA's doc is users/alice/met_people/bob
    const aData = setCallData("bob");
    expect(aData).toBeDefined();
    expect(aData!["tier"]).toBe("pro"); // bob's tier goes on alice's view
  });

  it("writes tierA into uidB's met_people doc so uidB sees the peer ring", async () => {
    await recordSymmetricEncounter({
      uidA: "alice",
      uidB: "bob",
      tierA: "plus",
      tierB: "pro",
    });

    // uidB's doc is users/bob/met_people/alice
    const bData = setCallData("alice");
    expect(bData).toBeDefined();
    expect(bData!["tier"]).toBe("plus"); // alice's tier goes on bob's view
  });

  it("omits the tier field from both docs when neither tier is supplied", async () => {
    await recordSymmetricEncounter({
      uidA: "alice",
      uidB: "bob",
    });

    const aData = setCallData("bob");
    const bData = setCallData("alice");

    expect(aData).toBeDefined();
    expect(bData).toBeDefined();
    expect(aData).not.toHaveProperty("tier");
    expect(bData).not.toHaveProperty("tier");
  });

  it("only writes the provided tier and leaves the other side without a tier override", async () => {
    // Only tierA supplied (caller is pro, peer tier unknown).
    await recordSymmetricEncounter({
      uidA: "alice",
      uidB: "bob",
      tierA: "pro",
    });

    // uidA's doc gets no tier (tierB not supplied).
    const aData = setCallData("bob");
    expect(aData).not.toHaveProperty("tier");

    // uidB's doc gets tierA (alice=pro).
    const bData = setCallData("alice");
    expect(bData!["tier"]).toBe("pro");
  });

  it("commits a single batched write covering both sides", async () => {
    await recordSymmetricEncounter({
      uidA: "alice",
      uidB: "bob",
      tierA: "plus",
      tierB: "free",
    });

    // Both sides written in one batch.commit().
    expect(batchMock.set).toHaveBeenCalledTimes(2);
    expect(batchMock.commit).toHaveBeenCalledTimes(1);
  });
});
