import { classifyBluetoothAdapterState } from "../ble/permissionState";

describe("classifyBluetoothAdapterState", () => {
  it("treats a powered-off radio as a granted permission with unavailable radio", () => {
    expect(classifyBluetoothAdapterState("PoweredOff")).toEqual({
      settled: true,
      permission: "granted",
      availability: "off",
    });
  });

  it("keeps unsupported hardware separate from permission denial", () => {
    expect(classifyBluetoothAdapterState("Unsupported")).toEqual({
      settled: true,
      permission: null,
      availability: "unsupported",
    });
  });

  it("treats an explicitly unauthorized adapter as a permission denial", () => {
    expect(classifyBluetoothAdapterState("Unauthorized")).toEqual({
      settled: true,
      permission: "denied",
      availability: "unknown",
    });
  });

  it("waits through transient adapter states", () => {
    expect(classifyBluetoothAdapterState("Resetting")).toEqual({
      settled: false,
      permission: null,
      availability: "unknown",
    });
  });
});
