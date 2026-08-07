/**
 * Tests for the venue event edit screen — image pick/upload/remove flow.
 *
 * Verifies:
 *   • Rendering with an existing imageUrl shows the thumbnail + "✕ Remove" button
 *   • Pressing "✕ Remove" clears the image so the picker button reappears
 *   • A successful pick → upload sets the imageUrl and shows the thumbnail
 *   • handleSave sends the current imageUrl (non-empty) to the server
 *   • handleSave sends null imageUrl when the image has been removed
 *   • Upload failure shows an alert and leaves the form usable
 *   • Permission denial shows an alert and skips the upload
 */

import React from "react";
import { Alert } from "react-native";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — factories hoisted by Babel; use require() inside for out-of-scope
// ---------------------------------------------------------------------------

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: "owner-uid-123" }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({ primary: "#6C63FF" }),
}));

jest.mock("@/components/VenueOwnerHeader", () => ({
  VenueOwnerHeader: ({ title }: { title: string }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").createElement("View", { testID: "venue-owner-header" }, title),
}));

jest.mock("@/components/DateTimePicker", () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DateTimePicker: () => require("react").createElement("View", { testID: "date-time-picker" }),
}));

// expo-image-picker — controlled via module-level variables
const mockRequestPermission = jest.fn();
const mockLaunchImageLibrary = jest.fn();

jest.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "Images" },
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockRequestPermission(...args),
  launchImageLibraryAsync: (...args: unknown[]) =>
    mockLaunchImageLibrary(...args),
}));

// api client
const mockUploadVenueEventImage = jest.fn();
const mockUpdateVenueEvent = jest.fn();

jest.mock("@/lib/api/client", () => ({
  api: {
    uploadVenueEventImage: (...args: unknown[]) =>
      mockUploadVenueEventImage(...args),
    updateVenueEvent: (...args: unknown[]) =>
      mockUpdateVenueEvent(...args),
  },
  ApiError: class ApiError extends Error {},
}));

// ---------------------------------------------------------------------------
// Param factory — screen reads these via useLocalSearchParams()
// ---------------------------------------------------------------------------

let mockParams: Record<string, string> = {};

// ---------------------------------------------------------------------------
// Import screen AFTER mocks are in place
// ---------------------------------------------------------------------------

import EditVenueEventScreen from "@/app/venue-owner/events/[id]";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FUTURE = new Date(Date.now() + 86400000).toISOString();

/** Spy on Alert.alert once for the suite. */
let alertSpy: jest.SpyInstance;

beforeAll(() => {
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterAll(() => {
  alertSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateVenueEvent.mockResolvedValue({});
  mockUploadVenueEventImage.mockResolvedValue({ url: "https://example.com/uploaded.jpg" });
  mockRequestPermission.mockResolvedValue({ granted: true });
  mockLaunchImageLibrary.mockResolvedValue({ canceled: true });
  mockParams = { id: "42", title: "My Event", startsAt: FUTURE };
});

// ---------------------------------------------------------------------------
// Tree helpers — work on the JSON snapshot for structure checks
// ---------------------------------------------------------------------------

function findInJson(
  node: renderer.ReactTestRendererJSON | null,
  predicate: (n: renderer.ReactTestRendererJSON) => boolean,
): renderer.ReactTestRendererJSON[] {
  if (!node) return [];
  const results: renderer.ReactTestRendererJSON[] = [];
  if (predicate(node)) results.push(node);
  for (const child of node.children ?? []) {
    if (typeof child !== "string") {
      results.push(...findInJson(child, predicate));
    }
  }
  return results;
}

function hasRemoveButton(root: renderer.ReactTestRenderer): boolean {
  return findInJson(
    root.toJSON() as renderer.ReactTestRendererJSON,
    (n) => n.props?.accessibilityLabel === "Remove cover image",
  ).length > 0;
}

function hasPickerButton(root: renderer.ReactTestRenderer): boolean {
  return findInJson(
    root.toJSON() as renderer.ReactTestRendererJSON,
    (n) => !!n.children?.includes("＋ Add Cover Photo"),
  ).length > 0;
}

function hasImageUri(root: renderer.ReactTestRenderer, uri: string): boolean {
  return findInJson(
    root.toJSON() as renderer.ReactTestRendererJSON,
    (n) => n.props?.source?.uri === uri,
  ).length > 0;
}

/**
 * Find a Pressable (instance tree node) whose rendered children contain a
 * Text node with the given string.
 */
/**
 * The save button is the last Pressable with onPress + disabled that is not
 * a picker or remove button. This positional approach is robust regardless of
 * whether toJSON() works on composite components in the test renderer.
 */
function findSaveButton(
  root: renderer.ReactTestRenderer,
): renderer.ReactTestInstance | undefined {
  const candidates = root.root.findAll(
    (n) =>
      n.props.onPress !== undefined &&
      n.props.disabled !== undefined &&
      n.props.accessibilityLabel !== "Remove cover image",
  );
  return candidates[candidates.length - 1];
}

/**
 * Find the Pressable that is the image picker button (disabled prop present,
 * no accessibilityLabel for Remove).
 */
function findPickerPressable(
  root: renderer.ReactTestRenderer,
): renderer.ReactTestInstance | undefined {
  return root.root.findAll(
    (n) =>
      n.props.onPress !== undefined &&
      n.props.disabled !== undefined &&
      n.props.accessibilityLabel !== "Remove cover image",
  )[0];
}

function findRemovePressable(
  root: renderer.ReactTestRenderer,
): renderer.ReactTestInstance | undefined {
  return root.root.findAll(
    (n) => n.props.accessibilityLabel === "Remove cover image",
  )[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("event edit screen — image present on load", () => {
  beforeEach(() => {
    mockParams = {
      id: "42",
      title: "My Event",
      startsAt: FUTURE,
      imageUrl: "https://example.com/existing.jpg",
    };
  });

  it("shows the thumbnail when imageUrl param is set", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueEventScreen />); });

    expect(hasImageUri(root, "https://example.com/existing.jpg")).toBe(true);
    expect(hasRemoveButton(root)).toBe(true);
    expect(hasPickerButton(root)).toBe(false);
  });

  it("clears the image and shows the picker after pressing Remove", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueEventScreen />); });

    const removeBtn = findRemovePressable(root);
    await act(async () => {
      (removeBtn!.props.onPress as () => void)();
      await Promise.resolve();
    });

    expect(hasRemoveButton(root)).toBe(false);
    expect(hasPickerButton(root)).toBe(true);
  });

  it("sends null imageUrl to the server after the image is removed", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueEventScreen />); });

    // Remove the image
    const removeBtn = findRemovePressable(root);
    await act(async () => {
      (removeBtn!.props.onPress as () => void)();
      await Promise.resolve();
    });

    // Press Save
    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUpdateVenueEvent).toHaveBeenCalledWith(
      expect.anything(),
      42,
      expect.objectContaining({ imageUrl: null }),
    );
  });
});

describe("event edit screen — no image on load", () => {
  it("shows the picker button and no thumbnail when imageUrl param is absent", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueEventScreen />); });

    expect(hasPickerButton(root)).toBe(true);
    expect(hasRemoveButton(root)).toBe(false);
  });

  it("sets the thumbnail and hides the picker after a successful upload", async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ base64: "abc123", mimeType: "image/jpeg" }],
    });
    mockUploadVenueEventImage.mockResolvedValue({ url: "https://example.com/new.jpg" });

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueEventScreen />); });

    const pickerBtn = findPickerPressable(root);
    await act(async () => {
      await (pickerBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUploadVenueEventImage).toHaveBeenCalledWith(
      { uid: "owner-uid-123" },
      { base64: "abc123", contentType: "image/jpeg" },
    );
    expect(hasImageUri(root, "https://example.com/new.jpg")).toBe(true);
    expect(hasRemoveButton(root)).toBe(true);
    expect(hasPickerButton(root)).toBe(false);
  });

  it("sends the uploaded imageUrl to the server on save", async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ base64: "abc123", mimeType: "image/jpeg" }],
    });
    mockUploadVenueEventImage.mockResolvedValue({ url: "https://example.com/new.jpg" });

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueEventScreen />); });

    const pickerBtn = findPickerPressable(root);
    await act(async () => {
      await (pickerBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUpdateVenueEvent).toHaveBeenCalledWith(
      expect.anything(),
      42,
      expect.objectContaining({ imageUrl: "https://example.com/new.jpg" }),
    );
  });

  it("shows an upload-failed alert when the upload API throws", async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ base64: "abc123", mimeType: "image/jpeg" }],
    });
    mockUploadVenueEventImage.mockRejectedValue(new Error("network error"));

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueEventScreen />); });

    const pickerBtn = findPickerPressable(root);
    await act(async () => {
      await (pickerBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(alertSpy).toHaveBeenCalledWith("Upload failed", expect.any(String));
    expect(hasRemoveButton(root)).toBe(false);
  });

  it("shows a permission-required alert and does not open the picker when permission is denied", async () => {
    mockRequestPermission.mockResolvedValue({ granted: false });

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueEventScreen />); });

    const pickerBtn = findPickerPressable(root);
    await act(async () => {
      await (pickerBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(alertSpy).toHaveBeenCalledWith("Permission required", expect.any(String));
    expect(mockLaunchImageLibrary).not.toHaveBeenCalled();
  });
});

describe("event edit screen — save payload", () => {
  it("sends null imageUrl when no image is set and saves successfully", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueEventScreen />); });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUpdateVenueEvent).toHaveBeenCalledWith(
      { uid: "owner-uid-123" },
      42,
      expect.objectContaining({ imageUrl: null, title: "My Event" }),
    );
  });

  it("sends the imageUrl when one was already set via params", async () => {
    mockParams = {
      id: "42",
      title: "My Event",
      startsAt: FUTURE,
      imageUrl: "https://cdn.example.com/banner.jpg",
    };

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueEventScreen />); });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUpdateVenueEvent).toHaveBeenCalledWith(
      expect.anything(),
      42,
      expect.objectContaining({ imageUrl: "https://cdn.example.com/banner.jpg" }),
    );
  });
});
