jest.mock("react-native", () => ({
  Platform: { OS: "ios", Version: "17.0" },
  PermissionsAndroid: {
    PERMISSIONS: { POST_NOTIFICATIONS: "postNotifications" },
    request: jest.fn(),
  },
}));
jest.mock("@/lib/ble/scanner", () => ({
  startBleScanner: jest.fn(() => Promise.resolve({ started: true })),
  stopBleScanner: jest.fn(),
}));
jest.mock("@/modules/expo-met-ble/src", () => ({
  startAdvertising: jest.fn(() => Promise.resolve(true)),
  stopAdvertising: jest.fn(() => Promise.resolve()),
  isAdvertisingAvailable: jest.fn(() => Promise.resolve(true)),
  setBackgroundMode: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/lib/ble/encode", () => ({
  uidToBleHash: jest.fn(() => Promise.resolve("identity-hash")),
}));
jest.mock("@/lib/ble/debug", () => ({
  recordSelf: jest.fn(),
  recordAdvertiserStart: jest.fn(),
}));

import {
  startAdvertising,
  stopAdvertising,
} from "@/modules/expo-met-ble/src";
import { startBleScanner, stopBleScanner } from "@/lib/ble/scanner";
import { startBleProximity, stopBleProximity } from "@/lib/ble";

const listener = jest.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  await stopBleProximity();
  jest.clearAllMocks();
  (startBleScanner as jest.Mock).mockResolvedValue({ started: true });
  (startAdvertising as jest.Mock).mockResolvedValue(true);
  (stopAdvertising as jest.Mock).mockResolvedValue(undefined);
});

afterEach(async () => {
  await stopBleProximity();
});

describe("BLE visibility", () => {
  it("stops discovery and never starts an identity beacon while hidden", async () => {
    const result = await startBleProximity({
      uid: "user",
      isVisible: false,
      listener,
    });

    expect(result.scanner).toEqual({
      started: false,
      reason: "User is hidden",
    });
    expect(result.advertiser).toEqual({
      started: false,
      reason: "User is hidden",
    });
    expect(startBleScanner).not.toHaveBeenCalled();
    expect(startAdvertising).not.toHaveBeenCalled();
    expect(stopAdvertising).toHaveBeenCalled();
    expect(stopBleScanner).toHaveBeenCalled();
  });

  it("stops both advertising and scanning when the user hides", async () => {
    await startBleProximity({ uid: "user", isVisible: true, listener });
    expect(startAdvertising).toHaveBeenCalledWith("user", "identity-hash");

    await startBleProximity({ uid: "user", isVisible: false, listener });

    expect(stopAdvertising).toHaveBeenCalled();
    expect(stopBleScanner).toHaveBeenCalled();
  });

  it("stops a pending advertiser start if the user hides before it completes", async () => {
    const pendingAdvertiser = deferred<boolean>();
    (startAdvertising as jest.Mock).mockReturnValueOnce(
      pendingAdvertiser.promise,
    );

    const showing = startBleProximity({
      uid: "user",
      isVisible: true,
      listener,
    });
    for (let i = 0; i < 8 && !startAdvertising.mock.calls.length; i += 1) {
      await Promise.resolve();
    }
    expect(startAdvertising).toHaveBeenCalled();

    const hiding = startBleProximity({
      uid: "user",
      isVisible: false,
      listener,
    });
    pendingAdvertiser.resolve(true);
    await Promise.all([showing, hiding]);

    expect(stopAdvertising).toHaveBeenCalled();
    expect(stopBleScanner).toHaveBeenCalled();
  });

  it("serializes Hide cleanup before a newer visible advertisement", async () => {
    const pendingStop = deferred<void>();
    (stopAdvertising as jest.Mock).mockReturnValueOnce(pendingStop.promise);

    const hiding = stopBleProximity();
    for (let i = 0; i < 8 && !stopAdvertising.mock.calls.length; i += 1) {
      await Promise.resolve();
    }
    expect(stopAdvertising).toHaveBeenCalledTimes(1);

    const showing = startBleProximity({
      uid: "user",
      isVisible: true,
      listener,
    });
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
    expect(startAdvertising).not.toHaveBeenCalled();

    pendingStop.resolve();
    const [, result] = await Promise.all([hiding, showing]);
    expect(result.advertiser.started).toBe(true);
    expect(startAdvertising).toHaveBeenCalledWith("user", "identity-hash");
    expect(stopAdvertising).toHaveBeenCalledTimes(1);
  });
});