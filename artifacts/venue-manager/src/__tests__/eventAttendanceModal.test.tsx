import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VenueManagerEvent } from "@workspace/api-client-react";

const posterExportMocks = vi.hoisted(() => ({
  createPosterExportBlob: vi.fn(),
  downloadBlob: vi.fn(),
}));

vi.mock("../lib/posterExport", () => posterExportMocks);
vi.mock("../lib/firebaseAuth", () => ({
  metAuthError: (error: unknown) => (error as Error).message,
  metChangePassword: vi.fn(),
  metPasswordCreate: vi.fn(),
  metPasswordEnroll: vi.fn(),
  metPasswordSignIn: vi.fn(),
  metRefreshVerification: vi.fn(),
  metResetPassword: vi.fn(),
  metSendVerification: vi.fn(),
  metSignOut: vi.fn(),
  metSocialSignIn: vi.fn(),
}));
vi.mock("react-qr-code", () => ({ default: () => null }));

import { EventAttendanceModal } from "../App";

const event: VenueManagerEvent = {
  id: 314,
  title: "Community workshop",
  startsAt: "2035-06-12T16:00:00.000Z",
  reminderOffsetsHours: [24, 2],
  isPublished: true,
  visibility: "public",
};

const attendee = {
  uid: "guest-checked-in",
  displayName: "Rory Checked",
  photoUrl: null,
  checkInMethod: "qr" as const,
  checkedInAt: "2035-06-12T16:02:00.000Z",
  checkedInByUid: null,
  manualReason: null,
};

const rsvps = [
  { uid: "guest-going", displayName: "Alex Going", photoUrl: null, status: "going" as const },
  { uid: "guest-maybe", displayName: "Sam Maybe", photoUrl: null, status: "maybe" as const },
  { uid: "guest-not-going", displayName: "Taylor Not Going", photoUrl: null, status: "not_going" as const },
  { uid: attendee.uid, displayName: attendee.displayName, photoUrl: null, status: "going" as const },
];

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

describe("venue event attendance RSVP panel", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("filters and searches every RSVP status while keeping RSVP choices read-only", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/attendees")) {
        return jsonResponse({
          attendees: [attendee],
          rsvps,
          corrections: [],
          notificationRuns: [],
        });
      }
      if (url.endsWith("/check-in-qr")) {
        return jsonResponse({ url: "https://example.test/event-check-in" });
      }
      return { ok: false, json: async () => ({ message: "Unexpected request" }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EventAttendanceModal
        event={event}
        businessId={22}
        csrfToken="test-csrf"
        onClose={vi.fn()}
      />,
    );

    const goingFilter = screen.getByTestId("button-event-rsvp-filter-going");
    const maybeFilter = screen.getByTestId("button-event-rsvp-filter-maybe");
    const notGoingFilter = screen.getByTestId("button-event-rsvp-filter-not_going");
    const search = screen.getByRole("searchbox", { name: "Search event RSVPs" });

    await screen.findByTestId("row-event-rsvp-guest-not-going");
    expect(screen.getByTestId("button-event-rsvp-filter-all")).toHaveTextContent("All responses · 4");
    expect(goingFilter).toHaveTextContent("Going · 2");
    expect(maybeFilter).toHaveTextContent("Maybe · 1");
    expect(notGoingFilter).toHaveTextContent("Not going · 1");
    expect(screen.getByTestId("row-event-rsvp-guest-checked-in")).toBeInTheDocument();
    expect(screen.getByTestId("button-rotate-event-checkin-qr")).toBeInTheDocument();
    expect(screen.getByTestId("button-print-event-checkin-poster")).toBeInTheDocument();
    expect(screen.getByText("Checked-in attendees · 1")).toBeInTheDocument();
    expect(screen.getByTestId("button-undo-checkin-guest-checked-in")).toBeInTheDocument();

    const rsvpGroup = screen.getByTestId("group-event-rsvp-filters").parentElement!;
    for (const row of screen.getAllByTestId(/^row-event-rsvp-/)) {
      expect(within(row).queryByRole("button", { name: /edit|change|remove|delete|cancel|update/i }))
        .not.toBeInTheDocument();
    }

    fireEvent.click(goingFilter);
    expect(goingFilter).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("row-event-rsvp-guest-going")).toBeInTheDocument();
    expect(screen.queryByTestId("row-event-rsvp-guest-maybe")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-manual-checkin-guest-going")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "aLeX" } });
    expect(screen.getByTestId("row-event-rsvp-guest-going")).toBeInTheDocument();
    expect(screen.queryByTestId("row-event-rsvp-guest-checked-in")).not.toBeInTheDocument();

    fireEvent.click(maybeFilter);
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByTestId("row-event-rsvp-guest-maybe")).toBeInTheDocument();
    expect(screen.queryByTestId("row-event-rsvp-guest-going")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-manual-checkin-guest-maybe")).toBeInTheDocument();

    fireEvent.click(notGoingFilter);
    expect(screen.getByTestId("row-event-rsvp-guest-not-going")).toBeInTheDocument();
    expect(screen.queryByTestId("button-manual-checkin-guest-not-going")).not.toBeInTheDocument();
    expect(screen.queryByText("No RSVP responses yet.")).not.toBeInTheDocument();

    expect(rsvpGroup).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => /\/rsvps?/.test(String(url)))).toBe(false);
    expect(fetchMock.mock.calls.some(([, init]) => /^(PUT|PATCH|DELETE)$/i.test(init?.method ?? ""))).toBe(false);
  });

  it("downloads the full event RSVP and check-in list, independent of visible filters", async () => {
    posterExportMocks.downloadBlob.mockReset();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/attendees")) {
        return jsonResponse({
          attendees: [attendee],
          rsvps,
          corrections: [],
          notificationRuns: [],
        });
      }
      if (url.endsWith("/check-in-qr")) {
        return jsonResponse({ url: "https://example.test/event-check-in" });
      }
      return { ok: false, json: async () => ({ message: "Unexpected request" }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EventAttendanceModal
        event={event}
        businessId={22}
        csrfToken="test-csrf"
        onClose={vi.fn()}
      />,
    );

    const exportButton = await screen.findByTestId("button-export-event-rsvps");
    await waitFor(() => expect(exportButton).toBeEnabled());
    fireEvent.click(screen.getByTestId("button-event-rsvp-filter-going"));
    fireEvent.click(exportButton);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/venue-manager/businesses/22/events/314/attendees",
      { credentials: "include" },
    );
    expect(posterExportMocks.downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, fileName] = posterExportMocks.downloadBlob.mock.calls[0] as [
      Blob,
      string,
    ];
    expect(fileName).toBe("event-314-rsvps.csv");
    expect(blob.type).toBe("text/csv;charset=utf-8");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("does not allow export when the protected attendance request is rejected", async () => {
    posterExportMocks.downloadBlob.mockReset();
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ message: "You are not authorized to manage this venue." }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EventAttendanceModal
        event={event}
        businessId={22}
        csrfToken="test-csrf"
        onClose={vi.fn()}
      />,
    );

    const exportButton = await screen.findByTestId("button-export-event-rsvps");
    await waitFor(() => expect(exportButton).toBeDisabled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/venue-manager/businesses/22/events/314/attendees",
      { credentials: "include" },
    );
    fireEvent.click(exportButton);
    expect(posterExportMocks.downloadBlob).not.toHaveBeenCalled();
  });
});
