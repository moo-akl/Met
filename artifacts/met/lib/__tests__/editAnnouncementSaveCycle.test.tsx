/**
 * Tests for the announcement edit save cycle.
 *
 * Verifies:
 *   • The announcements list renders cards with the correct title / body
 *   • Tapping a card calls router.push with all the expected params
 *   • The edit screen pre-fills title, body, and isPinned from router params
 *   • Saving a change calls updateVenueAnnouncement with the new values
 *   • A successful save shows the "Announcement updated!" alert and, when
 *     the user taps "Done", calls router.back()
 *   • The list reflects an update after re-fetching (API returns new data)
 */

import React from "react";
import { Alert } from "react-native";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Shared state between the two screen mocks
// ---------------------------------------------------------------------------

const mockBack = jest.fn();
const mockPush = jest.fn();

// useLocalSearchParams is dynamic — tests override this before rendering
let mockParams: Record<string, string> = {};

// ---------------------------------------------------------------------------
// Mocks — hoisted by Babel
// ---------------------------------------------------------------------------

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => mockParams,
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
    rightAction,
  }: {
    title: string;
    rightAction?: React.ReactNode;
  }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").createElement(
      "View",
      { testID: "venue-owner-header" },
      title,
      rightAction ?? null,
    ),
}));

// Venue owner hook — returns a basic profile with a placeId
jest.mock("@/hooks/useVenueOwner", () => ({
  useVenueOwner: () => ({
    profile: { placeId: "place-abc" },
    isLoading: false,
    error: null,
  }),
}));

// Image picker (not under test here, just needs to be present)
jest.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "Images" },
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

// ---------------------------------------------------------------------------
// API mock
// ---------------------------------------------------------------------------

const mockGetVenueAnnouncements = jest.fn();
const mockUpdateVenueAnnouncement = jest.fn();
const mockDeleteVenueAnnouncement = jest.fn();
const mockUploadVenueAnnouncementImage = jest.fn();

jest.mock("@/lib/api/client", () => ({
  api: {
    getVenueAnnouncements: (...args: unknown[]) =>
      mockGetVenueAnnouncements(...args),
    updateVenueAnnouncement: (...args: unknown[]) =>
      mockUpdateVenueAnnouncement(...args),
    deleteVenueAnnouncement: (...args: unknown[]) =>
      mockDeleteVenueAnnouncement(...args),
    uploadVenueAnnouncementImage: (...args: unknown[]) =>
      mockUploadVenueAnnouncementImage(...args),
  },
  ApiError: class ApiError extends Error {},
}));

// ---------------------------------------------------------------------------
// Import screens AFTER mocks
// ---------------------------------------------------------------------------

import VenueOwnerAnnouncementsScreen from "@/app/venue-owner/announcements/index";
import EditVenueAnnouncementScreen from "@/app/venue-owner/announcements/[id]";

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

function findByTestId(
  root: renderer.ReactTestRenderer,
  testID: string,
): renderer.ReactTestInstance | undefined {
  const all = root.root.findAll((n) => n.props.testID === testID);
  return all[0];
}

/** Find the Save Changes button: last Pressable that has both onPress and disabled. */
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

/** Find announcement card Pressables (those that navigate to [id]). */
function findCardPressables(
  root: renderer.ReactTestRenderer,
): renderer.ReactTestInstance[] {
  // Cards are Pressable nodes whose onPress calls router.push
  // We find all Pressable-like nodes that have a style array (cards use style functions)
  return root.root.findAll(
    (n) =>
      typeof n.props.onPress === "function" &&
      // The delete button inside each card lacks a `style` function — cards
      // use a style callback `({ pressed }) => [...]`, so typeof style is "function"
      typeof n.props.style === "function",
  );
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
// Common announcement fixture
// ---------------------------------------------------------------------------

const ANNOUNCEMENT = {
  id: 42,
  title: "Happy Hour Extended",
  body: "Drinks half-price until 9pm every Friday!",
  imageUrl: null as string | null,
  isPinned: false,
  createdAt: "2026-08-01T00:00:00.000Z",
};

const ANNOUNCEMENT_PINNED = {
  id: 43,
  title: "Grand Reopening",
  body: "We are back and better than ever!",
  imageUrl: "https://example.com/img.jpg",
  isPinned: true,
  createdAt: "2026-08-02T00:00:00.000Z",
};

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateVenueAnnouncement.mockResolvedValue({});
  mockGetVenueAnnouncements.mockResolvedValue({
    announcements: [ANNOUNCEMENT, ANNOUNCEMENT_PINNED],
  });
  mockParams = {};
});

// ===========================================================================
// 1. Announcements list — rendering
// ===========================================================================

describe("announcements list — rendering", () => {
  it("shows both announcement titles after the API responds", async () => {
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<VenueOwnerAnnouncementsScreen />);
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(findTextNodes(root, "Happy Hour Extended").length).toBeGreaterThan(0);
    expect(findTextNodes(root, "Grand Reopening").length).toBeGreaterThan(0);
  });

  it("shows announcement body text", async () => {
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<VenueOwnerAnnouncementsScreen />);
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(
      findTextNodes(root, "Drinks half-price until 9pm every Friday!").length,
    ).toBeGreaterThan(0);
  });

  it("calls getVenueAnnouncements with the owner uid and placeId", async () => {
    await act(async () => {
      renderer.create(<VenueOwnerAnnouncementsScreen />);
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockGetVenueAnnouncements).toHaveBeenCalledWith(
      { uid: "owner-uid-1" },
      "place-abc",
    );
  });
});

// ===========================================================================
// 2. Tapping a card navigates with the correct params
// ===========================================================================

describe("announcements list — card navigation", () => {
  it("pushes the edit route with correct id, title, body and isPinned on tap", async () => {
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<VenueOwnerAnnouncementsScreen />);
      await new Promise<void>((r) => setImmediate(r));
    });

    const cards = findCardPressables(root);
    // First card corresponds to ANNOUNCEMENT (id=42)
    await act(async () => {
      (cards[0].props.onPress as () => void)();
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/venue-owner/announcements/[id]",
        params: expect.objectContaining({
          id: "42",
          title: "Happy Hour Extended",
          body: "Drinks half-price until 9pm every Friday!",
          isPinned: "false",
        }),
      }),
    );
  });

  it("passes imageUrl as an empty string when the announcement has no image", async () => {
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<VenueOwnerAnnouncementsScreen />);
      await new Promise<void>((r) => setImmediate(r));
    });

    const cards = findCardPressables(root);
    await act(async () => {
      (cards[0].props.onPress as () => void)();
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ imageUrl: "" }),
      }),
    );
  });

  it("passes the real imageUrl when the announcement has one", async () => {
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<VenueOwnerAnnouncementsScreen />);
      await new Promise<void>((r) => setImmediate(r));
    });

    const cards = findCardPressables(root);
    // Second card = ANNOUNCEMENT_PINNED (id=43, has imageUrl)
    await act(async () => {
      (cards[1].props.onPress as () => void)();
      await Promise.resolve();
    });

    expect(mockPush).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          id: "43",
          imageUrl: "https://example.com/img.jpg",
          isPinned: "true",
        }),
      }),
    );
  });
});

// ===========================================================================
// 3. Edit screen — pre-fill from params
// ===========================================================================

describe("edit screen — pre-fill from params", () => {
  beforeEach(() => {
    mockParams = {
      id: "42",
      title: "Happy Hour Extended",
      body: "Drinks half-price until 9pm every Friday!",
      imageUrl: "",
      isPinned: "false",
    };
  });

  it("pre-fills the title TextInput with the param value", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const titleInput = root.root.findAll(
      (n) => n.props.value === "Happy Hour Extended",
    );
    expect(titleInput.length).toBeGreaterThan(0);
  });

  it("pre-fills the body TextInput with the param value", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const bodyInput = root.root.findAll(
      (n) => n.props.value === "Drinks half-price until 9pm every Friday!",
    );
    expect(bodyInput.length).toBeGreaterThan(0);
  });

  it("initialises isPinned from the param", () => {
    mockParams = { ...mockParams, isPinned: "true" };

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    // The Switch component's value prop reflects isPinned state
    const switchNode = root.root.findAll((n) => n.props.value === true && n.props.onValueChange !== undefined);
    expect(switchNode.length).toBeGreaterThan(0);
  });

  it("shows 'Save Changes' button text", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    expect(findTextNodes(root, "Save Changes").length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 4. Save — API call with correct payload
// ===========================================================================

describe("edit screen — save sends correct payload", () => {
  beforeEach(() => {
    mockParams = {
      id: "42",
      title: "Happy Hour Extended",
      body: "Drinks half-price until 9pm every Friday!",
      imageUrl: "",
      isPinned: "false",
    };
  });

  it("calls updateVenueAnnouncement with the announcement id and trimmed fields", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUpdateVenueAnnouncement).toHaveBeenCalledWith(
      { uid: "owner-uid-1" },
      42,
      expect.objectContaining({
        title: "Happy Hour Extended",
        body: "Drinks half-price until 9pm every Friday!",
        imageUrl: null,
        isPinned: false,
      }),
    );
  });

  it("sends the updated title when it is changed before saving", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    // Simulate typing a new title
    const titleInput = root.root.findAll(
      (n) => n.props.value === "Happy Hour Extended",
    )[0];
    await act(async () => {
      (titleInput.props.onChangeText as (t: string) => void)("Happy Hour Extended — All Week!");
      await Promise.resolve();
    });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUpdateVenueAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      42,
      expect.objectContaining({ title: "Happy Hour Extended — All Week!" }),
    );
  });

  it("sends the updated body when it is changed before saving", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const bodyInput = root.root.findAll(
      (n) => n.props.value === "Drinks half-price until 9pm every Friday!",
    )[0];
    await act(async () => {
      (bodyInput.props.onChangeText as (t: string) => void)("Now every night until 10pm!");
      await Promise.resolve();
    });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUpdateVenueAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      42,
      expect.objectContaining({ body: "Now every night until 10pm!" }),
    );
  });

  it("sends isPinned:true when the pin toggle is switched on", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const switchNode = root.root.findAll(
      (n) => n.props.value === false && n.props.onValueChange !== undefined,
    )[0];
    await act(async () => {
      (switchNode.props.onValueChange as (v: boolean) => void)(true);
      await Promise.resolve();
    });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockUpdateVenueAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      42,
      expect.objectContaining({ isPinned: true }),
    );
  });
});

// ===========================================================================
// 5. Save success — alert shown and router.back() called
// ===========================================================================

describe("edit screen — successful save navigates back", () => {
  beforeEach(() => {
    mockParams = {
      id: "42",
      title: "Happy Hour Extended",
      body: "Drinks half-price until 9pm every Friday!",
      imageUrl: "",
      isPinned: "false",
    };
  });

  it("shows the 'Announcement updated!' alert on success", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "Announcement updated!",
      undefined,
      expect.arrayContaining([
        expect.objectContaining({ text: "Done" }),
      ]),
    );
  });

  it("calls router.back() when the user taps Done in the success alert", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    // Retrieve the "Done" button's onPress from the last Alert.alert call
    const lastCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    const buttons = lastCall[2] as Array<{ text: string; onPress?: () => void }>;
    const doneBtn = buttons.find((b) => b.text === "Done");

    expect(doneBtn).toBeDefined();
    doneBtn?.onPress?.();

    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("does not call router.back() before the user taps Done", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    // back() must NOT have been called yet (alert is still open)
    expect(mockBack).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// 6. List reflects update — re-fetch after returning from edit
// ===========================================================================

describe("announcements list — reflects updated data after re-fetch", () => {
  it("shows the new title after the API returns updated data on a subsequent mount", async () => {
    // First mount: original data
    mockGetVenueAnnouncements.mockResolvedValueOnce({
      announcements: [ANNOUNCEMENT],
    });

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<VenueOwnerAnnouncementsScreen />);
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(findTextNodes(root, "Happy Hour Extended").length).toBeGreaterThan(0);

    // Simulate returning from the edit screen: API now returns updated title
    mockGetVenueAnnouncements.mockResolvedValueOnce({
      announcements: [{ ...ANNOUNCEMENT, title: "Happy Hour Extended — All Week!" }],
    });

    // Unmount and remount (simulating navigation back to the list)
    act(() => { root.unmount(); });

    await act(async () => {
      root = renderer.create(<VenueOwnerAnnouncementsScreen />);
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(
      findTextNodes(root, "Happy Hour Extended — All Week!").length,
    ).toBeGreaterThan(0);
    // Old title no longer shown
    expect(findTextNodes(root, "Happy Hour Extended").length).toBe(0);
  });

  it("calls getVenueAnnouncements again on every mount", async () => {
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<VenueOwnerAnnouncementsScreen />);
      await new Promise<void>((r) => setImmediate(r));
    });

    act(() => { root.unmount(); });

    await act(async () => {
      root = renderer.create(<VenueOwnerAnnouncementsScreen />);
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(mockGetVenueAnnouncements).toHaveBeenCalledTimes(2);
  });
});

// ===========================================================================
// 7. Save failure — error alert, no navigation
// ===========================================================================

describe("edit screen — save failure handling", () => {
  beforeEach(() => {
    mockParams = {
      id: "42",
      title: "Happy Hour Extended",
      body: "Drinks half-price until 9pm every Friday!",
      imageUrl: "",
      isPinned: "false",
    };
  });

  it("shows an error alert and does not call router.back() when the API throws", async () => {
    mockUpdateVenueAnnouncement.mockRejectedValue(new Error("Network error"));

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<EditVenueAnnouncementScreen />); });

    const saveBtn = findSaveButton(root);
    await act(async () => {
      await (saveBtn!.props.onPress as () => Promise<void>)();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(alertSpy).toHaveBeenCalledWith("Error", expect.any(String));
    expect(mockBack).not.toHaveBeenCalled();
  });
});
