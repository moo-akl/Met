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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openCreateDialog() {
  await waitFor(() => screen.getByRole("button", { name: /new event/i }));
  fireEvent.click(screen.getByRole("button", { name: /new event/i }));
  await waitFor(() => screen.getByRole("heading", { name: /create event/i }));
}

// ---------------------------------------------------------------------------
// Image URL validation guard tests
// ---------------------------------------------------------------------------

describe("EventsPage — image URL validation guard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.get).mockResolvedValue({ businesses: [businessFixture] });
  });

  it("blocks submission and shows an error when the image URL fails to load", async () => {
    render(<EventsPage />);
    await openCreateDialog();

    const imageInput = screen.getByPlaceholderText("https://example.com/event-photo.jpg");
    fireEvent.change(imageInput, {
      target: { value: "https://broken.example.com/not-an-image.jpg" },
    });

    const previewImg = await waitFor(() => screen.getByAltText("Event cover preview"));
    fireEvent.error(previewImg);

    await waitFor(() => screen.getByText(/this url doesn't point to a valid image/i));

    const form = document.querySelector("form");
    fireEvent.submit(form!);

    await waitFor(() =>
      screen.getByText(/cover image url could not be loaded/i)
    );

    expect(api.post).not.toHaveBeenCalled();
  });

  it("allows submission when the image URL loads successfully", async () => {
    const newEvent = {
      eventId: 99,
      businessId: "biz-001",
      title: "Test Event",
      description: "",
      imageUrl: "https://example.com/valid-photo.jpg",
      startTime: "2030-08-01T14:00:00.000Z",
      endTime: "2030-08-01T16:00:00.000Z",
      createdAt: new Date().toISOString(),
    };
    vi.mocked(api.post).mockResolvedValue(newEvent);

    render(<EventsPage />);
    await openCreateDialog();

    fireEvent.change(screen.getByPlaceholderText("e.g. Happy Hour, Live Music"), {
      target: { value: "Test Event" },
    });

    const imageInput = screen.getByPlaceholderText("https://example.com/event-photo.jpg");
    fireEvent.change(imageInput, {
      target: { value: "https://example.com/valid-photo.jpg" },
    });

    const previewImg = await waitFor(() => screen.getByAltText("Event cover preview"));
    fireEvent.load(previewImg);

    await waitFor(() => {
      const imgStatusText = document.querySelector('[alt="Event cover preview"]');
      expect(imgStatusText).toBeTruthy();
    });

    const datetimeInputs = document.querySelectorAll('input[type="datetime-local"]');
    fireEvent.change(datetimeInputs[0]!, { target: { value: "2030-08-01T14:00" } });
    fireEvent.change(datetimeInputs[1]!, { target: { value: "2030-08-01T16:00" } });

    const form = document.querySelector("form");
    fireEvent.submit(form!);

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith(
      expect.stringContaining("/events"),
      expect.objectContaining({ imageUrl: "https://example.com/valid-photo.jpg" })
    );
  });
});

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
