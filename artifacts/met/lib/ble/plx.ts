// Defensive loader for `react-native-ble-plx`.
//
// The package has a native module that is NOT linked in Expo Go (and
// is unavailable in Hermes web bundles). Importing it directly would
// crash on app startup in those environments, so we lazy-require it
// inside a try/catch and surface a `null` to the caller. Every BLE
// callsite must check for `null` and short-circuit.

import { Platform } from "react-native";

export interface PlxModule {
  BleManager: new (opts?: { restoreStateIdentifier?: string }) => PlxManager;
  State: {
    PoweredOn: "PoweredOn";
    PoweredOff: "PoweredOff";
    Unauthorized: "Unauthorized";
    Unsupported: "Unsupported";
    Resetting: "Resetting";
    Unknown: "Unknown";
  };
}

export interface PlxDevice {
  id: string;
  name: string | null;
  localName: string | null;
  rssi: number | null;
  serviceUUIDs: string[] | null;
  serviceData: Record<string, string> | null;
  manufacturerData: string | null;
}

export interface PlxManager {
  startDeviceScan(
    uuids: string[] | null,
    options: { allowDuplicates?: boolean; scanMode?: number } | null,
    listener: (
      err: { message: string } | null,
      device: PlxDevice | null,
    ) => void,
  ): void;
  stopDeviceScan(): void;
  state(): Promise<string>;
  onStateChange(
    cb: (state: string) => void,
    emitCurrent: boolean,
  ): { remove: () => void };
  destroy(): void;
}

let cached: PlxModule | null | undefined;

export function loadPlx(): PlxModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === "web") {
    cached = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-ble-plx") as PlxModule;
    if (!mod || !mod.BleManager) {
      cached = null;
      return null;
    }
    cached = mod;
    return mod;
  } catch (err) {
    console.warn(
      "[ble] react-native-ble-plx unavailable (Expo Go?) — scanning disabled",
      err,
    );
    cached = null;
    return null;
  }
}
