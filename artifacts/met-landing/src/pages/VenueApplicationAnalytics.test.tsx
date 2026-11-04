// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  getVenueApplicationSource,
} from "../lib/analytics";
import VenueApply from "./VenueApply";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete window.umami;
  window.history.replaceState({}, "", "/");
});

function makeFetchMock() {
  let submissionAttempts = 0;

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/venue-owner/places-public/search")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          places: [{
            placeId: "place-met",
            placeName: "Corner Social",
            address: "42 Main Street",
            lat: 51.5,
            lng: -0.12,
          }],
        }),
      } as Response;
    }

    if (url === "/api/venue-owner/apply") {
      submissionAttempts += 1;
      if (submissionAttempts === 1) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ message: "Please try again." }),
        } as Response;
      }
      return { ok: true, status: 201, json: async () => ({}) } as Response;
    }

    throw new Error(`Unexpected request: ${url}`);
  });

  return fetchMock;
}

async function advanceApplicationToReview() {
  fireEvent.change(screen.getByLabelText("Your full name"), {
    target: { value: "Jane Doe" },
  });
  fireEvent.change(screen.getByLabelText("Your email address"), {
    target: { value: "jane@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next →" }));

  fireEvent.change(screen.getByLabelText("Search for your venue"), {
    target: { value: "Corner" },
  });
  fireEvent.click(
    await screen.findByRole("button", {
      name: /Corner Social.*42 Main Street/,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Next →" }));
  fireEvent.click(screen.getByRole("button", { name: "Next →" }));

  fireEvent.change(screen.getByLabelText("Document link"), {
    target: { value: "https://example.com/ownership.pdf" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review →" }));
  await screen.findByRole("button", { name: "Submit application" });
}

describe("venue application analytics", () => {
  it("tracks a form start and only tracks submission after the server accepts it", async () => {
    const track = vi.fn();
    window.umami = { track };
    window.history.replaceState({}, "", "/apply?source=hero");
    vi.stubGlobal("fetch", makeFetchMock());

    render(
      <QueryClientProvider client={new QueryClient()}>
        <VenueApply />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith("venue_application_started", {
        source: "hero",
      }),
    );
    await advanceApplicationToReview();

    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    await screen.findByRole("alert");
    expect(track).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Submit application" }));
    await screen.findByText("Application received.");

    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenNthCalledWith(2, "venue_application_submitted", {
      source: "hero",
    });
  });

  it("ignores unrecognized query values instead of sending them to analytics", () => {
    expect(
      getVenueApplicationSource("?source=someone%40example.com"),
    ).toBe("direct");
    expect(getVenueApplicationSource("?source=venue_section")).toBe(
      "venue_section",
    );
  });
});
