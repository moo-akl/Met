/**
 * Tests for the in-app Permissions screen (app/permissions.tsx).
 *
 * Covers:
 * - Mount-time silent status check: non-prompting "get" APIs are called on
 *   mount so rows open with correct granted/denied state instead of "idle".
 * - permissionsCompleted=false: X close button is absent, button label is
 *   "Continue" (first-time flow).
 * - permissionsCompleted=true: X close button is present, button label is
 *   "Done" (opened from Settings).
 * - X close button calls router.back() immediately.
 * - Done button calls router.back() when permissionsCompleted=true.
 * - AppState foreground-resume triggers recheckDenied on denied entries.
 */

import React from "react";
import {
  render,
  screen,
  act,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { AppState, type NativeEventSubscription } from "react-native";

// ── Hoisted mock variables (babel-jest-hoist safe) ───────────────────────────

// eslint-disable-next-line no-var
var mockGetForegroundPermissions = jest.fn();
// eslint-disable-next-line no-var
var mockGetCameraPermissions = jest.fn();
// eslint-disable-next-line no-var
var mockGetNotificationsPermissions = jest.fn();
// eslint-disable-next-line no-var
var mockRouterBack = jest.fn();
// eslint-disable-next-line no-var
var mockRouterReplace = jest.fn();
// eslint-disable-next-line no-var
var mockSetPermissionsCompleted = jest.fn().mockResolvedValue(undefined);

// Use an object so the useApp mock always reads the current value.
// eslint-disable-next-line no-var
var mockAppState = { permissionsCompleted: false };

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return {
    Feather: ({ name, testID }: { name: string; testID?: string }) => (
      <View testID={testID ?? `feather-${name}`} />
    ),
    MaterialCommunityIcons: ({ name }: { name: string }) => (
      <View testID={`mci-${name}`} />
    ),
  };
});

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: (...args: unknown[]) =>
    mockGetForegroundPermissions(...args),
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
}));

jest.mock("expo-camera", () => ({
  Camera: {
    getCameraPermissionsAsync: (...args: unknown[]) =>
      mockGetCameraPermissions(...args),
    requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  },
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: (...args: unknown[]) =>
    mockGetNotificationsPermissions(...args),
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockRouterBack, replace: mockRouterReplace }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("@/lib/ble/plx", () => ({
  loadPlx: () => null, // no BLE in Jest
}));

jest.mock("@/lib/ble", () => ({
  isAdvertisingAvailable: jest.fn().mockResolvedValue(false),
}));

jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    get permissionsCompleted() {
      return mockAppState.permissionsCompleted;
    },
    setPermissionsCompleted: (...args: unknown[]) =>
      mockSetPermissionsCompleted(...args),
    authedUid: "uid-test",
  }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#ffffff",
    card: "#f8f8f8",
    foreground: "#000000",
    mutedForeground: "#666666",
    muted: "#eeeeee",
    border: "#dddddd",
    primary: "#00aa00",
    actionButton: "#888888",
  }),
}));

jest.mock("@/lib/i18n", () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/PermissionDisclosureDialog", () => {
  const { View } = require("react-native");
  return {
    PermissionDisclosureDialog: () => (
      <View testID="disclosure-dialog" />
    ),
  };
});

jest.mock("@/components/PrimaryButton", () => {
  const { Pressable, Text } = require("react-native");
  return {
    PrimaryButton: ({
      label,
      onPress,
    }: {
      label: string;
      onPress: () => void;
    }) => (
      <Pressable testID="primary-btn" onPress={onPress}>
        <Text testID="primary-btn-label">{label}</Text>
      </Pressable>
    ),
  };
});

jest.mock("@/lib/notifications", () => ({
  requestNotificationPermission: jest.fn().mockResolvedValue(false),
  registerAndUploadPushToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/storage", () => ({
  saveDisclosureAccepted: jest.fn().mockResolvedValue(undefined),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Default: every permission check returns undetermined so rows stay "idle".
 * Call this before tests that don't care about statuses.
 */
function setDefaultPermissionResponses() {
  mockGetForegroundPermissions.mockResolvedValue({
    granted: false,
    status: "undetermined",
  });
  mockGetCameraPermissions.mockResolvedValue({
    granted: false,
    status: "undetermined",
  });
  mockGetNotificationsPermissions.mockResolvedValue({
    granted: false,
    status: "undetermined",
  });
}

/** Render the screen and flush all pending effects and state updates. */
async function renderScreen() {
  await act(async () => {
    render(<PermissionsScreen />);
    // Yield the microtask queue so async useEffect state updates (permission
    // checks) complete inside this act() call and don't bleed into the next
    // test.
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}

// Import under test AFTER all mocks are defined.
// eslint-disable-next-line import/order
import PermissionsScreen from "../permissions";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PermissionsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppState.permissionsCompleted = false;
    mockSetPermissionsCompleted.mockResolvedValue(undefined);
    setDefaultPermissionResponses();
  });

  // ── 1. Mount-time silent status checks ─────────────────────────────────────

  it("calls non-prompting get APIs on mount to pre-fill statuses", async () => {
    await renderScreen();

    expect(mockGetForegroundPermissions).toHaveBeenCalledTimes(1);
    expect(mockGetCameraPermissions).toHaveBeenCalledTimes(1);
    expect(mockGetNotificationsPermissions).toHaveBeenCalledTimes(1);
  });

  it("shows granted status labels when all get-APIs report granted", async () => {
    mockGetForegroundPermissions.mockResolvedValue({
      granted: true,
      status: "granted",
    });
    mockGetCameraPermissions.mockResolvedValue({
      granted: true,
      status: "granted",
    });
    mockGetNotificationsPermissions.mockResolvedValue({
      granted: true,
      status: "granted",
    });

    await renderScreen();

    // The component renders "permissions.statusGranted" for each granted row.
    const grantedLabels = screen.getAllByText("permissions.statusGranted");
    // At minimum location, camera, notifications are granted — 3 rows.
    expect(grantedLabels.length).toBeGreaterThanOrEqual(3);
  });

  it("shows Open Settings label for denied permissions", async () => {
    mockGetForegroundPermissions.mockResolvedValue({
      granted: false,
      status: "denied",
    });
    mockGetCameraPermissions.mockResolvedValue({
      granted: false,
      status: "denied",
    });
    mockGetNotificationsPermissions.mockResolvedValue({
      granted: false,
      status: "denied",
    });

    await renderScreen();

    const openSettingsLabels = screen.getAllByText(
      "permissions.statusOpenSettings",
    );
    expect(openSettingsLabels.length).toBeGreaterThanOrEqual(3);
  });

  // ── 2. permissionsCompleted=false (first-time flow) ─────────────────────────

  it("does not render the X close button when permissionsCompleted is false", async () => {
    mockAppState.permissionsCompleted = false;
    await renderScreen();

    expect(screen.queryByTestId("close-btn")).toBeNull();
  });

  it("shows Continue label on the primary button when permissionsCompleted is false", async () => {
    mockAppState.permissionsCompleted = false;
    await renderScreen();

    expect(
      screen.getByTestId("primary-btn-label").props.children,
    ).toBe("permissions.continue");
  });

  it("calls replace('/(tabs)') when Continue pressed and permissionsCompleted is false", async () => {
    mockAppState.permissionsCompleted = false;
    await renderScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId("primary-btn"));
    });

    expect(mockSetPermissionsCompleted).toHaveBeenCalledWith(true);
    expect(mockRouterReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  // ── 3. permissionsCompleted=true (opened from Settings) ────────────────────

  it("renders the X close button when permissionsCompleted is true", async () => {
    mockAppState.permissionsCompleted = true;
    await renderScreen();

    expect(screen.getByTestId("close-btn")).toBeTruthy();
  });

  it("shows Done label on the primary button when permissionsCompleted is true", async () => {
    mockAppState.permissionsCompleted = true;
    await renderScreen();

    expect(
      screen.getByTestId("primary-btn-label").props.children,
    ).toBe("common.done");
  });

  it("calls router.back() when X close button is pressed", async () => {
    mockAppState.permissionsCompleted = true;
    await renderScreen();

    fireEvent.press(screen.getByTestId("close-btn"));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it("calls router.back() when Done button pressed and permissionsCompleted is true", async () => {
    mockAppState.permissionsCompleted = true;
    await renderScreen();

    await act(async () => {
      fireEvent.press(screen.getByTestId("primary-btn"));
    });

    expect(mockSetPermissionsCompleted).toHaveBeenCalledWith(true);
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  // ── 4. AppState foreground-resume re-checks denied entries ─────────────────

  it("re-checks denied permissions when app returns to foreground", async () => {
    // Location is denied initially.
    mockGetForegroundPermissions.mockResolvedValue({
      granted: false,
      status: "denied",
    });
    mockGetCameraPermissions.mockResolvedValue({
      granted: false,
      status: "denied",
    });
    mockGetNotificationsPermissions.mockResolvedValue({
      granted: false,
      status: "denied",
    });

    // Capture the AppState listener before rendering.
    let capturedListener: ((state: string) => void) | null = null;
    const addEventListenerSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, handler) => {
        capturedListener = handler as (state: string) => void;
        return { remove: jest.fn() } as unknown as NativeEventSubscription;
      });

    await renderScreen();

    // Mount-time check fires once.
    expect(mockGetForegroundPermissions).toHaveBeenCalledTimes(1);

    // Simulate the user granting location in OS Settings and returning.
    mockGetForegroundPermissions.mockResolvedValue({
      granted: true,
      status: "granted",
    });

    // Simulate the device going to background first (so the ref tracks it),
    // then returning to active — which is the Settings round-trip pattern.
    await act(async () => {
      capturedListener?.("background");
    });
    await act(async () => {
      capturedListener?.("active");
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // recheckDenied should have called getForegroundPermissionsAsync again.
    expect(mockGetForegroundPermissions).toHaveBeenCalledTimes(2);

    addEventListenerSpy.mockRestore();
  });
});
