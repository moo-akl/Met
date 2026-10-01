// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VenueApply from "./VenueApply";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("venue application search", () => {
  it("selects a public Places result and advances from step 2 to step 3", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [{
          placeId: "place-applicant",
          placeName: "Corner Social",
          address: "42 Main Street, London",
          lat: 51.5,
          lng: -0.12,
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <VenueApply />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText("Your full name"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText("Your email address"), { target: { value: "jane@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Next →" }));
    expect(screen.getByText(/Step 2 of 5 — Find your venue/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next →" }).hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText("Search for your venue"), { target: { value: "Corner" } });
    const result = await screen.findByRole("button", { name: /Corner Social.*42 Main Street, London/ });
    expect(fetchMock).toHaveBeenCalledWith("/api/venue-owner/places-public/search?query=Corner");
    fireEvent.click(result);

    expect(screen.getByText("✓ Corner Social")).toBeTruthy();
    expect(screen.getByText("42 Main Street, London")).toBeTruthy();
    const next = screen.getByRole("button", { name: "Next →" });
    expect(next.hasAttribute("disabled")).toBe(false);
    fireEvent.click(next);
    await waitFor(() => expect(screen.getByText(/Step 3 of 5 — About your venue/)).toBeTruthy());
    expect(screen.getByLabelText(/Tagline/)).toBeTruthy();
    expect(screen.getByLabelText(/Description/)).toBeTruthy();
  });
});