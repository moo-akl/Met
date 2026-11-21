const mockDeletedField = { deleted: true };

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-location", () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock("@/lib/api/client", () => ({
  api: {
    isConfigured: jest.fn(() => true),
    recordEncounter: jest.fn(),
    getProfile: jest.fn(),
  },
}));
jest.mock("@/lib/firestore/client", () => ({
  getFirestoreModule: jest.fn(),
  getFirestoreSdk: jest.fn(() => {
    const constraint = (kind: string) => (...args: unknown[]) => ({ kind, args });
    return Promise.resolve({
      collection: (parent: { collection: (name: string) => unknown }, name: string) =>
        parent.collection(name),
      doc: (parent: { doc: (...path: unknown[]) => unknown }, ...path: unknown[]) =>
        parent.doc(...path),
      setDoc: (
        ref: { set: (data: unknown, options?: unknown) => Promise<void> },
        data: unknown,
        options?: unknown,
      ) => ref.set(data, options),
      updateDoc: (
        ref: { update: (data: unknown) => Promise<void> },
        data: unknown,
      ) => ref.update(data),
      query: (ref: Record<string, (...args: unknown[]) => unknown>, ...constraints: { kind: string; args: unknown[] }[]) =>
        constraints.reduce((current, item) => current[item.kind](...item.args) as Record<string, (...args: unknown[]) => unknown>, ref),
      orderBy: constraint("orderBy"),
      startAt: constraint("startAt"),
      endAt: constraint("endAt"),
      getDocs: (query: { get: () => Promise<unknown> }) => query.get(),
      GeoPoint: class GeoPoint {
        latitude: number;
        longitude: number;

        constructor(lat: number, lng: number) {
          this.latitude = lat;
          this.longitude = lng;
        }
      },
      deleteField: () => mockDeletedField,
      serverTimestamp: () => ({ serverTimestamp: true }),
    });
  }),
}));
jest.mock("@react-native-firebase/firestore", () => ({
  __esModule: true,
  GeoPoint: class GeoPoint {
    latitude: number;
    longitude: number;

    constructor(lat: number, lng: number) {
      this.latitude = lat;
      this.longitude = lng;
    }
  },
  deleteField: () => mockDeletedField,
  serverTimestamp: () => ({ serverTimestamp: true }),
}));

import * as Location from "expo-location";
import {
  clearFirestoreLocation,
  startFirestoreProximity,
  stopFirestoreProximity,
  suppressFirestorePresence,
} from "@/lib/firestore/presence";
import { api } from "@/lib/api/client";
import { getFirestoreModule } from "@/lib/firestore/client";

function makeFirestore(candidates: Record<string, unknown>[] = []) {
  const doc = {
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    collection: jest.fn(),
  };
  const query = {
    orderBy: jest.fn(() => query),
    startAt: jest.fn(() => query),
    endAt: jest.fn(() => query),
    get: jest.fn().mockResolvedValue({
      forEach: (callback: (doc: { id: string; data: () => unknown }) => void) =>
        candidates.forEach((data, index) =>
          callback({ id: `candidate-${index}`, data: () => data }),
        ),
    }),
  };
  const collection = {
    doc: jest.fn(() => doc),
    orderBy: jest.fn(() => query),
  };
  doc.collection.mockReturnValue(collection);
  return {
    db: { collection: jest.fn(() => collection) },
    doc,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const listener = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (api.isConfigured as jest.Mock).mockReturnValue(true);
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    status: "granted",
  });
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
    coords: { latitude: 37, longitude: -122 },
  });
  (api.getProfile as jest.Mock).mockResolvedValue({
    uid: "peer",
    displayName: "Peer",
    photoUrl: null,
    bio: null,
    socials: {},
    isVisible: true,
  });
});

afterEach(async () => {
  stopFirestoreProximity();
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
});

describe("Firestore proximity visibility", () => {
  it("does not start location work for a hidden user", async () => {
    const firestore = makeFirestore();
    (getFirestoreModule as jest.Mock).mockResolvedValue(firestore.db);
    const result = await startFirestoreProximity({
      uid: "hidden-user",
      isVisible: false,
      listener,
    });
    for (let i = 0; i < 8; i += 1) await Promise.resolve();

    expect(result).toEqual({ started: false, reason: "User is hidden" });
    expect(getFirestoreModule).toHaveBeenCalled();
    expect(firestore.doc.set).toHaveBeenCalledWith(
      expect.objectContaining({
        isVisible: false,
        location: mockDeletedField,
        geohash: mockDeletedField,
      }),
      { merge: true },
    );
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("invalidates a start while the Firestore bridge is still initializing", async () => {
    const firestore = makeFirestore();
    const deferredFirestore = deferred<typeof firestore.db>();
    (getFirestoreModule as jest.Mock).mockReturnValue(deferredFirestore.promise);

    const pendingStart = startFirestoreProximity({
      uid: "user",
      isVisible: true,
      listener,
    });
    stopFirestoreProximity();
    deferredFirestore.resolve(firestore.db);

    await expect(pendingStart).resolves.toEqual({
      started: false,
      reason: "Superseded by newer start/stop",
    });
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it("sets hidden and removes only the public location fields", async () => {
    const firestore = makeFirestore();
    (getFirestoreModule as jest.Mock).mockResolvedValue(firestore.db);

    await expect(suppressFirestorePresence("user")).resolves.toBe(true);
    expect(firestore.doc.set).toHaveBeenCalledWith(
      {
        uid: "user",
        isVisible: false,
        location: mockDeletedField,
        geohash: mockDeletedField,
      },
      { merge: true },
    );

    await expect(clearFirestoreLocation("user")).resolves.toBe(true);
    expect(firestore.doc.update).toHaveBeenCalledWith({
      location: mockDeletedField,
      geohash: mockDeletedField,
    });
  });

  it("re-clears an in-flight location write after the service stops", async () => {
    const firestore = makeFirestore();
    const pendingWrite = deferred<void>();
    firestore.doc.set.mockReturnValueOnce(pendingWrite.promise);
    (getFirestoreModule as jest.Mock).mockResolvedValue(firestore.db);

    await expect(
      startFirestoreProximity({
        uid: "user",
        isVisible: true,
        listener,
      }),
    ).resolves.toEqual({ started: true });
    for (let i = 0; i < 16 && !firestore.doc.set.mock.calls.length; i += 1) {
      await Promise.resolve();
    }
    expect(firestore.doc.set).toHaveBeenCalled();

    stopFirestoreProximity();
    pendingWrite.resolve();
    for (let i = 0; i < 16; i += 1) await Promise.resolve();

    // One cleanup is issued by stop(); the second runs after the in-flight
    // stale write resolves, making the cleanup the final Firestore write.
    expect(firestore.doc.update).toHaveBeenCalledTimes(2);
  });

  it("fails closed when a Firestore discovery document omits visibility", async () => {
    const firestore = makeFirestore([
      {
        uid: "peer",
        location: { latitude: 37, longitude: -122 },
        geohash: "9q8yy",
      },
    ]);
    (getFirestoreModule as jest.Mock).mockResolvedValue(firestore.db);

    await startFirestoreProximity({
      uid: "user",
      isVisible: true,
      listener,
    });
    for (let i = 0; i < 30; i += 1) await Promise.resolve();

    expect(api.getProfile).not.toHaveBeenCalled();
    expect(api.recordEncounter).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not record or emit a candidate after Hide wins a delayed profile read", async () => {
    const firestore = makeFirestore([
      {
        uid: "peer",
        isVisible: true,
        location: { latitude: 37, longitude: -122 },
        geohash: "9q8yy",
      },
    ]);
    const pendingProfile = deferred<{
      uid: string;
      displayName: string;
      photoUrl: string | null;
      bio: string | null;
      socials: Record<string, string>;
      isVisible: boolean;
    }>();
    (getFirestoreModule as jest.Mock).mockResolvedValue(firestore.db);
    (api.getProfile as jest.Mock).mockReturnValue(pendingProfile.promise);

    await startFirestoreProximity({
      uid: "user",
      isVisible: true,
      listener,
    });
    for (let i = 0; i < 40 && !api.getProfile.mock.calls.length; i += 1) {
      await Promise.resolve();
    }
    expect(api.getProfile).toHaveBeenCalled();

    stopFirestoreProximity("user");
    pendingProfile.resolve({
      uid: "peer",
      displayName: "Peer",
      photoUrl: null,
      bio: null,
      socials: {},
      isVisible: true,
    });
    for (let i = 0; i < 20; i += 1) await Promise.resolve();

    expect(api.recordEncounter).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});