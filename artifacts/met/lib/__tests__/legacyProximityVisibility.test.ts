jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock("@/lib/api/client", () => ({
  api: {
    isConfigured: jest.fn(() => true),
    updatePresence: jest.fn(),
    nearbyPresence: jest.fn(),
    getProfile: jest.fn(),
    logEncounter: jest.fn(),
  },
}));

import * as Location from "expo-location";
import { api } from "@/lib/api/client";
import {
  startProximity,
  stopProximity,
} from "@/lib/proximity/presence";

const listener = jest.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  (api.isConfigured as jest.Mock).mockReturnValue(true);
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    status: "granted",
  });
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
    coords: { latitude: 37, longitude: -122, accuracy: 5 },
  });
  (api.updatePresence as jest.Mock).mockResolvedValue(undefined);
  (api.nearbyPresence as jest.Mock).mockResolvedValue([]);
  (api.getProfile as jest.Mock).mockResolvedValue({
    uid: "peer",
    displayName: "Peer",
    photoUrl: null,
    bio: null,
    socials: {},
    isVisible: true,
  });
  (api.logEncounter as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  stopProximity();
});

describe("legacy GPS visibility", () => {
  it("does not start when the user is hidden", async () => {
    const result = await startProximity({
      uid: "user",
      isVisible: false,
      listener,
    });

    expect(result).toEqual({ started: false, reason: "User is hidden" });
    expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(api.updatePresence).not.toHaveBeenCalled();
    expect(api.nearbyPresence).not.toHaveBeenCalled();
  });

  it("invalidates a start that is waiting for location permission", async () => {
    const permission = deferred<{ status: string }>();
    (Location.getForegroundPermissionsAsync as jest.Mock).mockReturnValue(
      permission.promise,
    );

    const pendingStart = startProximity({
      uid: "user",
      isVisible: true,
      listener,
    });
    stopProximity();
    permission.resolve({ status: "granted" });

    await expect(pendingStart).resolves.toEqual({
      started: false,
      reason: "Superseded by newer start/stop",
    });
    expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("does not create new encounters for a peer who is no longer visible", async () => {
    (api.nearbyPresence as jest.Mock).mockResolvedValue([
      { uid: "hidden-peer", distanceM: 10, updatedAt: "now" },
    ]);
    (api.getProfile as jest.Mock).mockResolvedValue({
      uid: "hidden-peer",
      displayName: "Hidden peer",
      photoUrl: null,
      bio: null,
      socials: {},
      isVisible: false,
    });

    await startProximity({ uid: "user", isVisible: true, listener });
    for (let i = 0; i < 30; i += 1) await Promise.resolve();

    expect(api.getProfile).toHaveBeenCalled();
    expect(api.logEncounter).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("abandons a delayed nearby query when Hide stops discovery", async () => {
    const pendingNearby = deferred<
      { uid: string; distanceM: number; updatedAt: string }[]
    >();
    (api.nearbyPresence as jest.Mock).mockReturnValue(pendingNearby.promise);

    await startProximity({ uid: "user", isVisible: true, listener });
    for (let i = 0; i < 20 && !api.nearbyPresence.mock.calls.length; i += 1) {
      await Promise.resolve();
    }
    expect(api.nearbyPresence).toHaveBeenCalled();

    stopProximity();
    pendingNearby.resolve([
      { uid: "peer", distanceM: 10, updatedAt: "now" },
    ]);
    for (let i = 0; i < 20; i += 1) await Promise.resolve();

    expect(api.getProfile).not.toHaveBeenCalled();
    expect(api.logEncounter).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not begin a delayed presence write after Hide invalidates location lookup", async () => {
    const pendingPosition = deferred<{
      coords: { latitude: number; longitude: number; accuracy: number };
    }>();
    (Location.getCurrentPositionAsync as jest.Mock).mockReturnValue(
      pendingPosition.promise,
    );

    await startProximity({ uid: "user", isVisible: true, listener });
    stopProximity();
    pendingPosition.resolve({
      coords: { latitude: 37, longitude: -122, accuracy: 5 },
    });
    for (let i = 0; i < 20; i += 1) await Promise.resolve();

    expect(api.updatePresence).not.toHaveBeenCalled();
    expect(api.nearbyPresence).not.toHaveBeenCalled();
  });

  it("aborts a presence write already in flight when Hide stops the service", async () => {
    const pendingPresence = deferred<unknown>();
    (api.updatePresence as jest.Mock).mockReturnValue(pendingPresence.promise);

    await startProximity({ uid: "user", isVisible: true, listener });
    for (let i = 0; i < 20 && !api.updatePresence.mock.calls.length; i += 1) {
      await Promise.resolve();
    }
    expect(api.updatePresence).toHaveBeenCalledTimes(1);

    stopProximity();
    const options = (api.updatePresence as jest.Mock).mock.calls[0][0];
    expect(options.signal.aborted).toBe(true);
    pendingPresence.resolve(undefined);
    for (let i = 0; i < 12; i += 1) await Promise.resolve();

    expect(api.updatePresence).toHaveBeenCalledTimes(1);
    expect(listener).not.toHaveBeenCalled();
  });
});