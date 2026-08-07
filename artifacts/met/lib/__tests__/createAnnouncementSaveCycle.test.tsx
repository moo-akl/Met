/**
 * Tests for the new-announcement create save cycle.
 *
 * Verifies:
 *   • The form starts with empty title, body, and isPinned=false
 *   • The submit button is disabled when title or body is empty
 *   • Filling in title + body enables the submit button
 *   • Submitting calls createVenueAnnouncement with the correct payload
 *   • A successful save shows the "Announcement posted!" alert and, when
 *     the user taps "Done", calls router.back()
 *   • A failed save shows an error alert and does NOT call router.back()
 */

import React from "react";
import { Alert } from "react-native";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — hoisted by Babel
// ---------------------------------------------------------------------------

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({}),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: "owner-uid-1" }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({ primary: "#6C63FF" }),
}));

jest.mock("@/components/VenueOwnerHeader", () => ({
  VenueOwnerHeader: ({
    title,
    onBack,
    backLabel,
  }: {
    title: string;
    onBack?: () => void;
    backLabel?: string;
  }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").createElement(
      "View",
      { testID: "venue-owner-header" },
      title,
      backLabel ?? null,
    ),
}));

// Image picker — not under test here
jest.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "Images" },
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: false }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

// ---------------------------------------------------------------------------
// API mock
// ---------------------------------------------------------------------------

const mockCreateVenueAnnouncement = jest.fn();
const mockUploadVenueAnnouncementImage = jest.fn();

jest.mock("@/lib/api/client", () => ({
  api: {
    createVenueAnnouncement: (...args: unknown[]) =>
      mockCreateVenueAnnouncement(...args),
    uploadVenueAnnouncementImage: (...args: unknown[]) =>
      mockUploadVenueAnnouncementImage(...args),
  },
  ApiError: class ApiError extends Error {},
}));

// ---------------------------------------------------------------------------
// Import screen AFTER mocks
// ---------------------------------------------------------------------------

import NewVenueAnnouncementScreen from "@/app/venue-owner/announcements/new";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type JsonNode = renderer.ReactTestRendererJSON;

function findInJson(
  node: JsonNode | null,
  predicate: (n: JsonNode) => boolean,
): JsonNode[] {
  if (!node) return [];
  const results: JsonNode[] = [];
  if (predicate(node)) results.push(node);
  for (const child of node.children ?? []) {
    if (typeof child !== "string") results.push(...findInJson(child, predicate));
  }
  return results;
}

function findTextNodes(root: renderer.ReactTestRenderer, text: string): JsonNode[] {
  return findInJson(
    root.toJSON() as JsonNode,
    (n) => Array.isArray(n.children) && n.children.includes(text),
  );
}

/**
 * Find the submit button: last Pressable that has both onPress and disabled
 * (excluding the "Remove image" button).
 */
function findSubmitButton(
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

// ---------------------------------------------------------------------------
// Alert spy
// ---------------------------------------------------------------------------

let alertSpy: jest.SpyInstance;

beforeAll(() => {
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterAll(() => {
  alertSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateVenueAnnouncement.mockResolvedValue({});
});

// ===========================================================================
// 1. Initial form state
// ===========================================================================

describe("new announcement screen — initial state", () => {
  it("renders with an empty title input", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    // Find TextInput nodes whose value is the empty string (title and body)
    const emptyInputs = root.root.findAll(
      (n) => n.props.value === "" && n.props.onChangeText !== undefined,
    );
    expect(emptyInputs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders with an empty body input", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    // body uses multiline={true}
    const bodyInput = root.root.findAll(
      (n) => n.props.multiline === true && n.props.value === "",
    );
    expect(bodyInput.length).toBeGreaterThan(0);
  });

  it("starts with isPinned false (Switch value is false)", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    const switchNode = root.root.findAll(
      (n) => n.props.value === false && n.props.onValueChange !== undefined,
    );
    expect(switchNode.length).toBeGreaterThan(0);
  });

  it("shows 'Post Announcement' button text", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    expect(findTextNodes(root, "Post Announcement").length).toBeGreaterThan(0);
  });

  it("has the submit button disabled when title and body are both empty", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    const submitBtn = findSubmitButton(root);
    expect(submitBtn).toBeDefined();
    expect(submitBtn!.props.disabled).toBe(true);
  });
});

// ===========================================================================
// 2. Submit button enabled state
// ===========================================================================

describe("new announcement screen — submit button enablement", () => {
  it("remains disabled when only title is filled", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    const titleInput = root.root.findAll(
      (n) => n.props.value === "" && n.props.onChangeText !== undefined && !n.props.multiline,
    )[0];
    await act(async () => {
      (titleInput.props.onChangeText as (t: string) => void)("Happy Hour Extended!");
      await Promise.resolve();
    });

    const submitBtn = findSubmitButton(root);
    expect(submitBtn!.props.disabled).toBe(true);
  });

  it("remains disabled when only body is filled", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    const bodyInput = root.root.findAll(
      (n) => n.props.multiline === true && n.props.value === "",
    )[0];
    await act(async () => {
      (bodyInput.props.onChangeText as (t: string) => void)("Drinks half-price until 9pm!");
      await Promise.resolve();
    });

    const submitBtn = findSubmitButton(root);
    expect(submitBtn!.props.disabled).toBe(true);
  });

  it("becomes enabled when both title and body are filled", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    const titleInput = root.root.findAll(
      (n) => n.props.value === "" && n.props.onChangeText !== undefined && !n.props.multiline,
    )[0];
    const bodyInput = root.root.findAll(
      (n) => n.props.multiline === true && n.props.value === "",
    )[0];

    await act(async () => {
      (titleInput.props.onChangeText as (t: string) => void)("Happy Hour Extended!");
      await Promise.resolve();
    });
    await act(async () => {
      (bodyInput.props.onChangeText as (t: string) => void)("Drinks half-price until 9pm!");
      await Promise.resolve();
    });

    const submitBtn = findSubmitButton(root);
    expect(submitBtn!.props.disabled).toBe(false);
  });
});

// ===========================================================================
// 3. Submit — calls createVenueAnnouncement with correct payload
// ===========================================================================

describe("new announcement screen — create sends correct payload", () => {
  it("calls createVenueAnnouncement with uid, trimmed title, body, null imageUrl, and isPinned:false", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    const titleInput = root.root.findAll(
      (n) => n.props.value === "" && n.props.onChangeText !== undefined && !n.props.multiline,
    )[0];
    const bodyInput = root.root.findAll(
      (n) => n.props.multiline === true && n.props.value === "",
    )[0];

    await act(async () => {
      (titleInput.props.onChangeText as (t: string) => void)("  Happy Hour Extended!  ");
      await Promise.resolve();
    });
    await act(async () => {
      (bodyInput.props.onChangeText as (t: string) => void)("  Drinks half-price until 9pm!  ");
      await Promise.resolve();
    });

    const submitBtn = findSubmitButton(root);
    await act(async () => {
      await (submitBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockCreateVenueAnnouncement).toHaveBeenCalledWith(
      { uid: "owner-uid-1" },
      expect.objectContaining({
        title: "Happy Hour Extended!",
        body: "Drinks half-price until 9pm!",
        imageUrl: null,
        isPinned: false,
      }),
    );
  });

  it("sends isPinned:true when the pin toggle is switched on before submitting", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    const titleInput = root.root.findAll(
      (n) => n.props.value === "" && n.props.onChangeText !== undefined && !n.props.multiline,
    )[0];
    const bodyInput = root.root.findAll(
      (n) => n.props.multiline === true && n.props.value === "",
    )[0];

    await act(async () => {
      (titleInput.props.onChangeText as (t: string) => void)("Grand Reopening");
      await Promise.resolve();
    });
    await act(async () => {
      (bodyInput.props.onChangeText as (t: string) => void)("We are back and better than ever!");
      await Promise.resolve();
    });

    const switchNode = root.root.findAll(
      (n) => n.props.value === false && n.props.onValueChange !== undefined,
    )[0];
    await act(async () => {
      (switchNode.props.onValueChange as (v: boolean) => void)(true);
      await Promise.resolve();
    });

    const submitBtn = findSubmitButton(root);
    await act(async () => {
      await (submitBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockCreateVenueAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ isPinned: true }),
    );
  });

  it("does not call createVenueAnnouncement when the form is incomplete", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    // Only fill in the title, leave body empty
    const titleInput = root.root.findAll(
      (n) => n.props.value === "" && n.props.onChangeText !== undefined && !n.props.multiline,
    )[0];
    await act(async () => {
      (titleInput.props.onChangeText as (t: string) => void)("Only a title");
      await Promise.resolve();
    });

    const submitBtn = findSubmitButton(root);
    // Button is disabled; calling onPress should be a no-op guarded by canSubmit
    await act(async () => {
      await (submitBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockCreateVenueAnnouncement).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 4. Successful create — alert shown, router.back() called on Done
// ===========================================================================

describe("new announcement screen — successful create navigates back", () => {
  async function fillAndSubmit(root: renderer.ReactTestRenderer) {
    const titleInput = root.root.findAll(
      (n) => n.props.value === "" && n.props.onChangeText !== undefined && !n.props.multiline,
    )[0];
    const bodyInput = root.root.findAll(
      (n) => n.props.multiline === true && n.props.value === "",
    )[0];

    await act(async () => {
      (titleInput.props.onChangeText as (t: string) => void)("Happy Hour Extended!");
      await Promise.resolve();
    });
    await act(async () => {
      (bodyInput.props.onChangeText as (t: string) => void)("Drinks half-price until 9pm!");
      await Promise.resolve();
    });

    const submitBtn = findSubmitButton(root);
    await act(async () => {
      await (submitBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });
  }

  it("shows the 'Announcement posted!' alert on success", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    await fillAndSubmit(root);

    expect(alertSpy).toHaveBeenCalledWith(
      "Announcement posted!",
      undefined,
      expect.arrayContaining([
        expect.objectContaining({ text: "Done" }),
      ]),
    );
  });

  it("calls router.back() when the user taps Done in the success alert", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    await fillAndSubmit(root);

    const lastCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    const buttons = lastCall[2] as Array<{ text: string; onPress?: () => void }>;
    const doneBtn = buttons.find((b) => b.text === "Done");

    expect(doneBtn).toBeDefined();
    doneBtn?.onPress?.();

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("does not call router.back() before the user taps Done", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    await fillAndSubmit(root);

    // back() must NOT have been called yet — alert is still open
    expect(mockBack).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 5. Failed create — error alert shown, no navigation
// ===========================================================================

describe("new announcement screen — failed create handling", () => {
  it("shows an error alert and does not call router.back() when the API throws", async () => {
    mockCreateVenueAnnouncement.mockRejectedValue(new Error("Network error"));

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<NewVenueAnnouncementScreen />); });

    const titleInput = root.root.findAll(
      (n) => n.props.value === "" && n.props.onChangeText !== undefined && !n.props.multiline,
    )[0];
    const bodyInput = root.root.findAll(
      (n) => n.props.multiline === true && n.props.value === "",
    )[0];

    await act(async () => {
      (titleInput.props.onChangeText as (t: string) => void)("Happy Hour Extended!");
      await Promise.resolve();
    });
    await act(async () => {
      (bodyInput.props.onChangeText as (t: string) => void)("Drinks half-price until 9pm!");
      await Promise.resolve();
    });

    const submitBtn = findSubmitButton(root);
    await act(async () => {
      await (submitBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(alertSpy).toHaveBeenCalledWith("Error", expect.any(String));
    expect(mockBack).not.toHaveBeenCalled();
  });
});
