/**
 * Tests for the venue announcement edit screen — image pick/upload/remove flow.
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
// Mocks — hoisted by Babel; use require() inside for out-of-scope references
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
  useApp: () => ({ authedUid: "owner-uid-456" }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({ primary: "#6C63FF" }),
}));

jest.mock("@/components/VenueOwnerHeader", () => ({
  VenueOwnerHeader: ({ title }: { title: string }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").createElement("View", { testID: "venue-owner-header" }, title),
}));

const mockRequestPermission = jest.fn();
const mockLaunchImageLibrary = jest.fn();

jest.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "Images" },
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
    mockRequestPermission(...args),
  launchImageLibraryAsync: (...args: unknown[]) =>
    mockLaunchImageLibrary(...args),
}));

const mockUploadVenueAnnouncementImage = jest.fn();
const mockUpdateVenueAnnouncement = jest.fn();

jest.mock("@/lib/api/client", () => ({
  api: {
    uploadVenueAnnouncementImage: (...args: unknown[]) =>
      mockUploadVenueAnnouncementImage(...args),
    updateVenueAnnouncement: (...args: unknown[]) =>
      mockUpdateVenueAnnouncement(...args),
  },
  ApiError: class ApiError extends Error {},
}));

// ---------------------------------------------------------------------------
// Param factory
// ---------------------------------------------------------------------------

let mockParams: Record<string, string> = {};

// ---------------------------------------------------------------------------
// Import screen AFTER mocks
// ---------------------------------------------------------------------------

import EditVenueAnnouncementScreen from "@/app/venue-owner/announcements/[id]";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  mockUpdateVenueAnnouncement.mockResolvedValue({});
  mockUploadVenueAnnouncementImage.mockResolvedValue({
    url: "https://example.com/uploaded-ann.jpg",
  });
  mockRequestPermission.mockResolvedValue({ granted: true });
  mockLaunchImageLibrary.mockResolvedValue({ canceled: true });
  mockParams = { id: "10", title: "Happy Hour", body: "Extended tonight!" };
});

// ---------------------------------------------------------------------------
// Tree helpers
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
    (n) => n.props?.accessibilityLabel === "Remove image",
  ).length > 0;
}

function hasPickerButton(root: renderer.ReactTestRenderer): boolean {
  return findInJson(
    root.toJSON() as renderer.ReactTestRendererJSON,
    (n) => !!n.children?.includes("＋ Add Image"),
  ).length > 0;
}

function hasImageUri(root: renderer.ReactTestRenderer, uri: string): boolean {
  return findInJson(
    root.toJSON() as renderer.ReactTestRendererJSON,
    (n) => n.props?.source?.uri === uri,
  ).length > 0;
}

/**
 * The save button is the last Pressable with onPress + disabled that is not
 * the Remove button. Positional approach avoids toJSON() issues on composite
 * components in the test renderer.
 */
function findSaveButton(
  root: renderer.ReactTestRenderer,
): renderer.ReactTestInstance | undefined {
  const candidates = root.root.findAll(
    (n) =>
      n.props.onPress !== undefined &&
      n.props.disabled !== undefined &&
      n.props.accessibilityLabel !== "Remove image",
  );
  return candidates[candidates.length - 1];
}

function findPickerPressable(
  root: renderer.ReactTestRenderer,
): renderer.ReactTestInstance | undefined {
  return root.root.findAll(
    (n) =>
      n.props.onPress !== undefined &&
      n.props.disabled !== undefined &&
      n.props.accessibilityLabel !== "Remove image",
  )[0];
}

function findRemovePressable(
  root: renderer.ReactTestRenderer,
): renderer.ReactTestInstance | undefined {
  return root.root.findAll(
    (n) => n.props.accessibilityLabel === "Remove image",
  )[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("announcement edit screen — image present on load", () => {
  beforeEach(() => {
    mockParams = {
      id: "10",
      title: "Happy Hour",
      body: "Extended tonight!",
      imageUrl: "https://example.com/existing-ann.jpg",
    };
  });

  it("shows the thumbnail when imageUrl param is set", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    expect(hasImageUri(root, "https://example.com/existing-ann.jpg")).toBe(true);
    expect(hasRemoveButton(root)).toBe(true);
    expect(hasPickerButton(root)).toBe(false);
  });

  it("clears the image and shows the picker after pressing Remove", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

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
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const removeBtn = findRemovePressable(root);
    await act(async () => {
      (removeBtn!.props.onPress as () => void)();
      await Promise.resolve();
    });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUpdateVenueAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      10,
      expect.objectContaining({ imageUrl: null }),
    );
  });

  it("sends the existing imageUrl when saved without changes", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUpdateVenueAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      10,
      expect.objectContaining({ imageUrl: "https://example.com/existing-ann.jpg" }),
    );
  });
});

describe("announcement edit screen — no image on load", () => {
  it("shows the picker button and no thumbnail when imageUrl param is absent", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    expect(hasPickerButton(root)).toBe(true);
    expect(hasRemoveButton(root)).toBe(false);
  });

  it("sets the thumbnail and hides the picker after a successful upload", async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ base64: "xyz789", mimeType: "image/png" }],
    });
    mockUploadVenueAnnouncementImage.mockResolvedValue({
      url: "https://example.com/new-ann.jpg",
    });

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const pickerBtn = findPickerPressable(root);
    await act(async () => {
      await (pickerBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUploadVenueAnnouncementImage).toHaveBeenCalledWith(
      { uid: "owner-uid-456" },
      { base64: "xyz789", contentType: "image/png" },
    );
    expect(hasImageUri(root, "https://example.com/new-ann.jpg")).toBe(true);
    expect(hasRemoveButton(root)).toBe(true);
    expect(hasPickerButton(root)).toBe(false);
  });

  it("sends the uploaded imageUrl to the server on save", async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ base64: "xyz789", mimeType: "image/png" }],
    });
    mockUploadVenueAnnouncementImage.mockResolvedValue({
      url: "https://example.com/new-ann.jpg",
    });

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

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

    expect(mockUpdateVenueAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      10,
      expect.objectContaining({ imageUrl: "https://example.com/new-ann.jpg" }),
    );
  });

  it("shows an upload-failed alert when the upload API throws", async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    mockLaunchImageLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ base64: "xyz789", mimeType: "image/jpeg" }],
    });
    mockUploadVenueAnnouncementImage.mockRejectedValue(new Error("timeout"));

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const pickerBtn = findPickerPressable(root);
    await act(async () => {
      await (pickerBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(alertSpy).toHaveBeenCalledWith("Upload failed", expect.any(String));
    expect(hasRemoveButton(root)).toBe(false);
  });

  it("shows a permission-required alert and does not open the picker when denied", async () => {
    mockRequestPermission.mockResolvedValue({ granted: false });

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const pickerBtn = findPickerPressable(root);
    await act(async () => {
      await (pickerBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(alertSpy).toHaveBeenCalledWith("Permission required", expect.any(String));
    expect(mockLaunchImageLibrary).not.toHaveBeenCalled();
  });
});

describe("announcement edit screen — save payload", () => {
  it("sends null imageUrl when no image is set", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUpdateVenueAnnouncement).toHaveBeenCalledWith(
      { uid: "owner-uid-456" },
      10,
      expect.objectContaining({ imageUrl: null, title: "Happy Hour", body: "Extended tonight!" }),
    );
  });
});
