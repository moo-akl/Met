export type BluetoothAvailability =
  | "unknown"
  | "on"
  | "off"
  | "unsupported";

export type BluetoothPermissionProbe = {
  settled: boolean;
  permission: "granted" | "denied" | null;
  availability: BluetoothAvailability;
};

export function classifyBluetoothAdapterState(
  state: string,
): BluetoothPermissionProbe {
  if (state === "PoweredOn") {
    return { settled: true, permission: "granted", availability: "on" };
  }
  if (state === "PoweredOff") {
    return { settled: true, permission: "granted", availability: "off" };
  }
  if (state === "Unauthorized") {
    return { settled: true, permission: "denied", availability: "unknown" };
  }
  if (state === "Unsupported") {
    return { settled: true, permission: null, availability: "unsupported" };
  }
  return { settled: false, permission: null, availability: "unknown" };
}
