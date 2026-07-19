import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — registered before any module under test is imported.
// ---------------------------------------------------------------------------

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "test-uid" },
    loading: false,
    signInEmail: vi.fn(),
    signUpEmail: vi.fn(),
    signInGoogle: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("wouter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wouter")>();
  return {
    ...actual,
    Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    useLocation: () => ["/events", vi.fn()],
  };
});

// ---------------------------------------------------------------------------
// Imports after mocks.
// ---------------------------------------------------------------------------

import EventsPage from "./EventsPage";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const IMAGE_URL = "https://example.com/event-banner.jpg";

const eventWithImage = {
  eventId: 42,
  businessId: "biz-001",
  title: "Photo Event",
  description: "Come and join us!",
  imageUrl: IMAGE_URL,
  startTime: "2030-06-01T10:00:00.000Z",
  endTime: "2030-06-01T12:00:00.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
};

const eventWithoutImage = {
  eventId: 43,
  businessId: "biz-001",
  title: "No Image Event",
  description: null,
  imageUrl: null,
  startTime: "2030-07-01T10:00:00.000Z",
  endTime: "2030-07-01T12:00:00.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
};

const businessFixture = {
  businessId: "biz-001",
  ownerId: "test-uid",
  placeId: "place-xyz",
  name: "Alice's Coffee",
  description: null,
  logoUrl: null,
  mediaUrls: [],
  isActiveSubscription: true,
  subscriptionEndDate: null,
  salesAgentId: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  events: [eventWithImage, eventWithoutImage],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EventsPage — edit dialog imageUrl pre-fill", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.get).mockResolvedValue({ businesses: [businessFixture] });
  });

  it("pre-fills imageUrl when opening the edit dialog for an event that has one", async () => {
    render(<EventsPage />);

    // Wait for events to load.
    await waitFor(() => screen.getByText("Photo Event"));

    // Click the first edit (pencil) button — belongs to Photo Event.
    const editButtons = screen.getAllByTestId("edit-event-btn");
    fireEvent.click(editButtons[0]!);

    // The dialog should now be open with the imageUrl input pre-filled.
    const imageInput = await waitFor(() =>
      screen.getByPlaceholderText("https://example.com/event-photo.jpg")
    );
    expect((imageInput as HTMLInputElement).value).toBe(IMAGE_URL);
  });

  it("pre-fills imageUrl as empty string when the event has no image", async () => {
    vi.mocked(api.get).mockResolvedValue({
      businesses: [{ ...businessFixture, events: [eventWithoutImage] }],
    });

    render(<EventsPage />);

    await waitFor(() => screen.getByText("No Image Event"));

    const editButtons = screen.getAllByTestId("edit-event-btn");
    fireEvent.click(editButtons[0]!);

    const imageInput = await waitFor(() =>
      screen.getByPlaceholderText("https://example.com/event-photo.jpg")
    );
    expect((imageInput as HTMLInputElement).value).toBe("");
  });

  it("re-opens the edit dialog with the original imageUrl after closing without saving", async () => {
    render(<EventsPage />);

    await waitFor(() => screen.getByText("Photo Event"));

    // Open the edit dialog.
    const editButtons = screen.getAllByTestId("edit-event-btn");
    fireEvent.click(editButtons[0]!);

    const imageInput = await waitFor(() =>
      screen.getByPlaceholderText("https://example.com/event-photo.jpg")
    );
    expect((imageInput as HTMLInputElement).value).toBe(IMAGE_URL);

    // Clear the URL in the form (user starts editing then changes their mind).
    fireEvent.change(imageInput, { target: { value: "" } });
    expect((imageInput as HTMLInputElement).value).toBe("");

    // Cancel the dialog.
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Re-open the same event's edit dialog.
    await waitFor(() => screen.getByText("Photo Event"));
    const editButtonsAfter = screen.getAllByTestId("edit-event-btn");
    fireEvent.click(editButtonsAfter[0]!);

    // imageUrl must be restored from the event data, not from the cleared form state.
    const imageInputAfter = await waitFor(() =>
      screen.getByPlaceholderText("https://example.com/event-photo.jpg")
    );
    expect((imageInputAfter as HTMLInputElement).value).toBe(IMAGE_URL);
  });
});
