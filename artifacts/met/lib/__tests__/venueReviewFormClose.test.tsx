/**
 * Integration tests — review form closes after a guest submits their rating.
 *
 * These tests render the actual VenueProfileScreen from app/venue/[placeId].tsx
 * with its API, auth/QR state, navigation, and Alert dependencies mocked.
 * A regression in the real component — e.g. removing setReviewStars(0),
 * changing the conditional that hides the form, or breaking the API
 * integration — will make this suite fail even though the proxy-only tests
 * would remain green.
 *
 * Flow exercised:
 *   1. QR-verified guest arrives at a venue screen (screen loads OK)
 *   2. Guest taps a star → comment input + Submit button become visible
 *   3. Guest taps "Submit review" → mocked API resolves
 *   4. Star-picker form controls disappear from the real render tree
 *   5. Saved-review summary row (testID="review-existing-summary") appears
 */

import React from "react";
import { Alert } from "react-native";
import renderer, { act } from "react-test-renderer";

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

// Expo Router — provide navigation primitives used by VenueProfileScreen
const mockRouterBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockRouterBack }),
  useLocalSearchParams: () => ({ placeId: "place-test-123" }),
  // useFocusEffect is a no-op in tests: isQrVerified is already true from
  // the getQrVerified mock, so there's nothing the focus callback needs to do.
  // Calling it synchronously during render would trigger setIsQrVerified and
  // cause an infinite re-render loop.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useFocusEffect: (_cb: () => void) => { /* no-op */ },
}));

// Safe-area insets — not relevant to the review flow
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

// App context — authenticated user
jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: "guest-uid-1" }),
}));

// expo-image — just render a plain View so the tree is stable
jest.mock("expo-image", () => ({
  Image: (props: Record<string, unknown>) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").createElement("View", { testID: props.testID ?? "expo-image" }),
}));

// expo-linear-gradient — stub
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").createElement("View", {}, children),
}));

// SheetHandle — stub
jest.mock("@/components/SheetHandle", () => ({
  SheetHandle: () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").createElement("View", { testID: "sheet-handle" }),
}));

// VenueEventCard — stub
jest.mock("@/components/VenueEventCard", () => ({
  VenueEventCard: () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").createElement("View", { testID: "venue-event-card" }),
}));

// QR verification state — guest is already QR-verified for our test place
jest.mock("@/lib/qrVerificationState", () => ({
  getQrVerified: (placeId: string) => placeId === "place-test-123",
  markQrVerified: jest.fn(),
  subscribeQrVerification: (_cb: (id: string) => void) => () => undefined,
}));

// ---------------------------------------------------------------------------
// API mock — controlled per-test via the jest.fn() references below
// ---------------------------------------------------------------------------

const mockGetVenueOwnerProfile = jest.fn();
const mockGetVenueEvents       = jest.fn();
const mockGetVenueRewards      = jest.fn();
const mockGetVenueAnnouncements = jest.fn();
const mockGetLeaderboard       = jest.fn();
const mockGetVenueReviews      = jest.fn();
const mockGetMyVenueReview     = jest.fn();
const mockSubmitVenueReview    = jest.fn();
const mockHubQrVerify          = jest.fn();

jest.mock("@/lib/api/client", () => ({
  api: {
    getVenueOwnerProfile:    (...a: unknown[]) => mockGetVenueOwnerProfile(...a),
    getVenueEvents:          (...a: unknown[]) => mockGetVenueEvents(...a),
    getVenueRewards:         (...a: unknown[]) => mockGetVenueRewards(...a),
    getVenueAnnouncements:   (...a: unknown[]) => mockGetVenueAnnouncements(...a),
    getLeaderboard:          (...a: unknown[]) => mockGetLeaderboard(...a),
    getVenueReviews:         (...a: unknown[]) => mockGetVenueReviews(...a),
    getMyVenueReview:        (...a: unknown[]) => mockGetMyVenueReview(...a),
    submitVenueReview:       (...a: unknown[]) => mockSubmitVenueReview(...a),
    hubQrVerify:             (...a: unknown[]) => mockHubQrVerify(...a),
  },
  ApiError: class ApiError extends Error {
    constructor(message: string, public status = 0, public body: unknown = null) {
      super(message);
    }
  },
}));

// ---------------------------------------------------------------------------
// Import the REAL screen — must come AFTER all jest.mock() calls
// ---------------------------------------------------------------------------

// eslint-disable-next-line import/first
import VenueProfileScreen from "@/app/venue/[placeId]";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_PROFILE = {
  id: 1,
  ownerUid: "owner-uid-1",
  placeId: "place-test-123",
  placeName: "The Test Bar",
  businessName: "Test Bar Ltd",
  tagline: null,
  description: null,
  coverPhotoUrl: null,
  logoUrl: null,
  lat: null,
  lng: null,
  verificationDocUrl: null,
  registrationNotes: null,
  isApproved: true,
  isVerified: true,
  rejectionReason: null,
  applicationStatus: "approved" as const,
  submittedAt: null,
  reviewedAt: null,
  approvedAt: "2026-01-01T00:00:00.000Z",
  rejectedAt: null,
  withdrawnAt: null,
  expiredAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  phone: null,
  websiteUrl: null,
  publicEmail: null,
  openingHours: null,
};

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
// beforeEach — default mock implementations
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // fetchAll: all endpoints resolve with empty/minimal data
  mockGetVenueOwnerProfile.mockResolvedValue({ profile: MINIMAL_PROFILE });
  mockGetVenueEvents.mockResolvedValue({ events: [] });
  mockGetVenueRewards.mockResolvedValue({ rewards: [] });
  mockGetVenueAnnouncements.mockResolvedValue({ announcements: [] });
  mockGetLeaderboard.mockResolvedValue([]);
  mockGetVenueReviews.mockResolvedValue({ reviews: [], averageRating: null, total: 0 });

  // No prior review by default
  mockGetMyVenueReview.mockResolvedValue({ review: null });

  // submitVenueReview — overridden per test
  mockSubmitVenueReview.mockResolvedValue({
    review: { starRating: 4, comment: null },
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type JsonNode = renderer.ReactTestRendererJSON;

function findByTestId(
  node: JsonNode | JsonNode[] | null,
  testID: string,
): JsonNode[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap((n) => findByTestId(n, testID));
  const results: JsonNode[] = [];
  if (node.props?.testID === testID) results.push(node);
  for (const child of node.children ?? []) {
    if (typeof child !== "string") {
      results.push(...findByTestId(child as JsonNode, testID));
    }
  }
  return results;
}

function hasNode(root: renderer.ReactTestRenderer, testID: string): boolean {
  return findByTestId(root.toJSON() as JsonNode, testID).length > 0;
}

/**
 * Render the real VenueProfileScreen and drain all async effects so the
 * component moves past its loading spinner and shows the venue content.
 */
async function renderScreen(): Promise<renderer.ReactTestRenderer> {
  let root!: renderer.ReactTestRenderer;
  await act(async () => {
    root = renderer.create(<VenueProfileScreen />);
    // Two setImmediate rounds: first drains the fetchAll + getMyVenueReview
    // Promise.all, second ensures all resulting setState calls have flushed.
    await new Promise<void>((r) => setImmediate(r));
    await new Promise<void>((r) => setImmediate(r));
  });
  return root;
}

/** Tap a numbered star (1–5) on the real screen and flush state updates. */
async function tapStar(
  root: renderer.ReactTestRenderer,
  star: number,
): Promise<void> {
  await act(async () => {
    const nodes = root.root.findAll((n) => n.props.testID === `review-star-${star}`);
    if (nodes.length === 0) throw new Error(`review-star-${star} not found`);
    nodes[0].props.onPress();
    await Promise.resolve();
  });
}

/** Tap the Submit / Update review button and drain the API call. */
async function tapSubmit(root: renderer.ReactTestRenderer): Promise<void> {
  await act(async () => {
    const nodes = root.root.findAll((n) => n.props.testID === "review-submit-btn");
    if (nodes.length === 0) throw new Error("review-submit-btn not found");
    nodes[0].props.onPress();
    await new Promise<void>((r) => setImmediate(r));
  });
}

// ---------------------------------------------------------------------------
// 1. Screen loads and the review section is accessible to QR-verified guests
// ---------------------------------------------------------------------------

describe("review section is visible for QR-verified guests", () => {
  it("renders the star picker after the screen has loaded", async () => {
    const root = await renderScreen();
    expect(hasNode(root, "review-stars-row")).toBe(true);
  });

  it("does not show the comment input or submit button before any star is tapped", async () => {
    const root = await renderScreen();
    expect(hasNode(root, "review-comment-input")).toBe(false);
    expect(hasNode(root, "review-submit-btn")).toBe(false);
  });

  it("shows the comment input and submit button after tapping a star", async () => {
    const root = await renderScreen();
    await tapStar(root, 4);
    expect(hasNode(root, "review-comment-input")).toBe(true);
    expect(hasNode(root, "review-submit-btn")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Core: form closes after a successful submission
// ---------------------------------------------------------------------------

describe("review form closes after a successful submission", () => {
  it("removes the comment input from the real render tree after submit", async () => {
    const root = await renderScreen();
    await tapStar(root, 4);

    expect(hasNode(root, "review-comment-input")).toBe(true);

    await tapSubmit(root);

    expect(hasNode(root, "review-comment-input")).toBe(false);
  });

  it("removes the submit button from the real render tree after submit", async () => {
    const root = await renderScreen();
    await tapStar(root, 4);
    await tapSubmit(root);

    expect(hasNode(root, "review-submit-btn")).toBe(false);
  });

  it("shows the read-only summary row after a successful submit", async () => {
    mockSubmitVenueReview.mockResolvedValue({
      review: { starRating: 4, comment: null },
    });

    const root = await renderScreen();
    await tapStar(root, 4);
    await tapSubmit(root);

    expect(hasNode(root, "review-existing-summary")).toBe(true);
  });

  it("summary row contains the star rating returned by the API", async () => {
    mockSubmitVenueReview.mockResolvedValue({
      review: { starRating: 3, comment: null },
    });

    const root = await renderScreen();
    await tapStar(root, 3);
    await tapSubmit(root);

    const summaryNodes = findByTestId(root.toJSON() as JsonNode, "review-existing-summary");
    expect(summaryNodes.length).toBe(1);
    const text = summaryNodes[0].children?.join("") ?? "";
    expect(text).toContain("★★★☆☆");
  });

  it("summary row includes the comment when one was returned by the API", async () => {
    mockSubmitVenueReview.mockResolvedValue({
      review: { starRating: 5, comment: "Loved it" },
    });

    const root = await renderScreen();
    await tapStar(root, 5);
    await tapSubmit(root);

    const summaryNodes = findByTestId(root.toJSON() as JsonNode, "review-existing-summary");
    const text = summaryNodes[0].children?.join("") ?? "";
    expect(text).toContain('"Loved it"');
  });

  it("calls Alert.alert with the success message after submit", async () => {
    const root = await renderScreen();
    await tapStar(root, 4);
    await tapSubmit(root);

    expect(alertSpy).toHaveBeenCalledWith("Thanks!", "Your review has been saved.");
  });

  it("calls submitVenueReview with the correct placeId and star rating", async () => {
    const root = await renderScreen();
    await tapStar(root, 5);
    await tapSubmit(root);

    expect(mockSubmitVenueReview).toHaveBeenCalledWith(
      { uid: "guest-uid-1" },
      expect.objectContaining({ placeId: "place-test-123", starRating: 5 }),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. A prior review is shown as the summary on load, and the form
//    re-closes correctly after an update
// ---------------------------------------------------------------------------

describe("form closes after updating an existing review", () => {
  beforeEach(() => {
    // Guest already has a saved review
    mockGetMyVenueReview.mockResolvedValue({
      review: { starRating: 5, comment: "Originally great" },
    });
    mockSubmitVenueReview.mockResolvedValue({
      review: { starRating: 2, comment: "Changed my mind" },
    });
  });

  it("pre-fills the edit form with the prior rating on load (comment input visible)", async () => {
    // When a prior review exists, the component calls setReviewStars(review.starRating)
    // which opens the edit form (reviewStars > 0 → comment input + submit button visible).
    // The read-only summary is only shown AFTER submit resets reviewStars back to 0.
    const root = await renderScreen();
    expect(hasNode(root, "review-comment-input")).toBe(true);
    expect(hasNode(root, "review-submit-btn")).toBe(true);
    // Summary must not appear while the edit form is open
    expect(hasNode(root, "review-existing-summary")).toBe(false);
  });

  it("closes the form and shows updated summary after updating the rating", async () => {
    const root = await renderScreen();

    // Open the edit form by selecting new stars
    await tapStar(root, 2);
    expect(hasNode(root, "review-comment-input")).toBe(true);

    // Submit the update
    await tapSubmit(root);

    expect(hasNode(root, "review-comment-input")).toBe(false);
    expect(hasNode(root, "review-submit-btn")).toBe(false);
    expect(hasNode(root, "review-existing-summary")).toBe(true);
  });

  it("summary reflects the new rating after an update", async () => {
    const root = await renderScreen();
    await tapStar(root, 2);
    await tapSubmit(root);

    const summaryNodes = findByTestId(root.toJSON() as JsonNode, "review-existing-summary");
    const text = summaryNodes[0].children?.join("") ?? "";
    expect(text).toContain("★★☆☆☆");
  });
});

// ---------------------------------------------------------------------------
// 4. Error path: form stays open when the API call fails
// ---------------------------------------------------------------------------

describe("form stays open after a failed submission", () => {
  it("keeps the comment input visible when submitVenueReview rejects", async () => {
    mockSubmitVenueReview.mockRejectedValue(new Error("Network error"));

    const root = await renderScreen();
    await tapStar(root, 4);
    expect(hasNode(root, "review-comment-input")).toBe(true);

    await tapSubmit(root);

    expect(hasNode(root, "review-comment-input")).toBe(true);
    expect(hasNode(root, "review-submit-btn")).toBe(true);
    expect(hasNode(root, "review-existing-summary")).toBe(false);
  });

  it("shows the failure alert when submitVenueReview rejects", async () => {
    mockSubmitVenueReview.mockRejectedValue(new Error("Network error"));

    const root = await renderScreen();
    await tapStar(root, 4);
    await tapSubmit(root);

    expect(alertSpy).toHaveBeenCalledWith("Couldn't save", "Please try again.");
  });
});

// ---------------------------------------------------------------------------
// 5. In-flight guard: label says "Saving…" while the call is pending
// ---------------------------------------------------------------------------

describe("submit button label while the API call is in-flight", () => {
  it("shows 'Saving…' while submitVenueReview is pending, then closes the form", async () => {
    let resolveSubmit!: (v: { review: { starRating: number; comment: null } }) => void;
    const submitPromise = new Promise<{ review: { starRating: number; comment: null } }>(
      (r) => { resolveSubmit = r; },
    );
    mockSubmitVenueReview.mockReturnValue(submitPromise);

    const root = await renderScreen();
    await tapStar(root, 5);

    // Kick off submit without resolving yet
    act(() => {
      const nodes = root.root.findAll((n) => n.props.testID === "review-submit-btn");
      nodes[0].props.onPress();
    });

    // While pending, the label must read "Saving…"
    const labelNodes = findByTestId(root.toJSON() as JsonNode, "review-submit-label");
    expect(labelNodes.length).toBe(1);
    expect(labelNodes[0].children?.join("")).toBe("Saving…");

    // Resolve the API call — form must close
    await act(async () => {
      resolveSubmit({ review: { starRating: 5, comment: null } });
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(hasNode(root, "review-comment-input")).toBe(false);
    expect(hasNode(root, "review-existing-summary")).toBe(true);
  });
});
