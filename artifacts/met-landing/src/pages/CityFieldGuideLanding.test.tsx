// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CityFieldGuideLanding from "./CityFieldGuideLanding";

afterEach(() => {
  cleanup();
  delete window.ttq;
  delete window.umami;
});

describe("Met homepage calls to action", () => {
  it("keeps venue application and venue details links on their intended routes", () => {
    render(<CityFieldGuideLanding />);

    const applicationLinks = [
      ["link-nav-apply", "header"],
      ["link-hero-venue-apply", "hero"],
      ["link-venue-apply", "venue_section"],
    ] as const;
    for (const [testId, source] of applicationLinks) {
      const href = new URL(
        screen.getByTestId(testId).getAttribute("href")!,
        window.location.origin,
      );
      expect(href.pathname).toBe("/apply");
      expect(href.searchParams.get("source")).toBe(source);
    }

    expect(screen.getByTestId("link-venue-details").getAttribute("href")).toBe(
      "/venues",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "How do I register my venue?" }),
    );
    const faqHref = new URL(
      screen
        .getByRole("link", { name: "venue application form" })
        .getAttribute("href")!,
      window.location.origin,
    );
    expect(faqHref.pathname).toBe("/apply");
    expect(faqHref.searchParams.get("source")).toBe("faq");
  });

  it("keeps store destinations and TikTok download event metadata", () => {
    const track = vi.fn();
    window.ttq = { track, page: vi.fn() };

    render(<CityFieldGuideLanding />);

    const appStoreLink = screen.getByTestId("link-download-app-store");
    const googlePlayLink = screen.getByTestId("link-download-google-play");

    expect(appStoreLink.getAttribute("href")).toBe(
      "https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926",
    );
    expect(googlePlayLink.getAttribute("href")).toBe(
      "https://play.google.com/store/apps/details?id=app.met.founders",
    );

    // Prevent jsdom from attempting external navigation while exercising the real click handlers.
    appStoreLink.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    googlePlayLink.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(appStoreLink);
    fireEvent.click(googlePlayLink);

    expect(track).toHaveBeenNthCalledWith(1, "ClickButton", {
      content_id: "app_download_ios",
      content_name: "Download Met — App Store",
      content_category: "app_download",
      description: "guest_section",
    });
    expect(track).toHaveBeenNthCalledWith(2, "ClickButton", {
      content_id: "app_download_android",
      content_name: "Download Met — Google Play",
      content_category: "app_download",
      description: "guest_section",
    });
  });
});
