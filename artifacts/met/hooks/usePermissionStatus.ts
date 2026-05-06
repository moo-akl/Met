import { useEffect, useRef, useState } from "react";
import { AppState, PermissionsAndroid, Platform } from "react-native";

import * as Location from "expo-location";

export type PermStatus = "granted" | "denied" | "unknown";

export interface PermissionStatus {
  locationOk: boolean;
  bluetoothOk: boolean;
  checked: boolean;
}

async function checkLocation(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

async function checkBluetooth(): Promise<boolean> {
  if (Platform.OS === "android") {
    try {
      if ((Platform.Version as number) >= 31) {
        const scan = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        );
        const connect = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        );
        return scan && connect;
      }
      return true;
    } catch {
      return true;
    }
  }

  if (Platform.OS === "ios") {
    try {
      const { loadPlx } = await import("@/lib/ble/plx");
      const plx = loadPlx();
      if (!plx) return true;
      const manager = new plx.BleManager();
      const granted = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          try {
            sub.remove();
          } catch {}
          manager.destroy();
          resolve(true);
        }, 3000);
        const sub = manager.onStateChange((s) => {
          if (
            s === plx.State.PoweredOn ||
            s === plx.State.PoweredOff
          ) {
            clearTimeout(timer);
            sub.remove();
            try {
              manager.destroy();
            } catch {}
            resolve(true);
          } else if (
            s === plx.State.Unauthorized ||
            s === plx.State.Unsupported
          ) {
            clearTimeout(timer);
            sub.remove();
            try {
              manager.destroy();
            } catch {}
            resolve(false);
          }
        }, true);
      });
      return granted;
    } catch {
      return true;
    }
  }

  return true;
}

export function usePermissionStatus(): PermissionStatus {
  const [state, setState] = useState<PermissionStatus>({
    locationOk: true,
    bluetoothOk: true,
    checked: false,
  });

  const checkAll = useRef(async () => {
    const [locationOk, bluetoothOk] = await Promise.all([
      checkLocation(),
      checkBluetooth(),
    ]);
    setState({ locationOk, bluetoothOk, checked: true });
  });

  useEffect(() => {
    void checkAll.current();

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void checkAll.current();
      }
    });

    return () => sub.remove();
  }, []);

  return state;
}
