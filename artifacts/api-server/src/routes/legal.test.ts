import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  chain: {
    select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(), limit: vi.fn(),
  },
}));
vi.mock("@workspace/db", () => ({
  db: mocks.chain,
  venueOwnerProfilesTable: { placeId: "place", isApproved: "approved", applicationStatus: "status" },
  venueEventsTable: {
    id: "eventId",
    title: "eventTitle",
    startsAt: "eventStartsAt",
    imageUrl: "eventImageUrl",
    placeId: "eventPlaceId",
    isPublished: "eventIsPublished",
    isHidden: "eventIsHidden",
    visibility: "eventVisibility",
  },
}));
import legalRouter from "./legal";
const app = express();
app.use(legalRouter);
const venue = {
  placeName: "River & Park", tagline: "A place to visit",
  qrToken: "test-token", coverPhotoUrl: null,
};
beforeEach(() => { mocks.chain.limit.mockResolvedValue([venue]); });

describe("hotspot installation handoff page", () => {
  it.each([
    ["iPhone", "https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926"],
    ["iPad", "https://apps.apple.com/vn/app/met-city-social-hubs/id6764364926"],
    ["Android", "https://play.google.com/store/apps/details?id=app.met.founders"],
  ])("sends %s visitors directly to the matching app store", async (ua, storeUrl) => {
    const res = await request(app).get("/v/place-123?t=test-token").set("User-Agent", ua);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(storeUrl);
    expect(res.headers["cache-control"]).toContain("no-store");
  });

  it("keeps the check-in context for desktop visitors", async () => {
    const res = await request(app).get("/v/place-123?t=test-token").set("User-Agent", "Desktop");

    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
    expect(res.text).toContain("River &amp; Park");
    expect(res.text).toContain("met:///v/place-123?t=test-token");
    expect(res.text).toContain("Return to this browser page");
    expect(res.text).toContain("Installing alone does not check you in");
    expect(res.text).toContain("apps.apple.com");
    expect(res.text).toContain("play.google.com");
  });
  it("rejects a rotated QR without claiming a check-in", async () => {
    const res = await request(app).get("/v/place-123?t=old-token");
    expect(res.status).toBe(400);
    expect(res.text).toContain("Invalid check-in link");
  });
  it("does not render venue-controlled HTML", async () => {
    mocks.chain.limit.mockResolvedValue([{ ...venue, placeName: "<script>alert(1)</script>" }]);
    const res = await request(app).get("/v/place-123?t=test-token");
    expect(res.text).not.toContain("<script>alert(1)</script>");
    expect(res.text).toContain("&lt;script&gt;");
  });
});

describe("event invitation installation handoff page", () => {
  const token = "a".repeat(43);

  it("offers an explicit continue action after installation without auto-opening the invite", async () => {
    const res = await request(app).get(`/event-invite/${token}`);

    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.text).toContain(
      "If Met is already installed, tap Continue. Otherwise, install it using the store button for your device, then return to this page and tap Continue to open your invitation.",
    );
    expect(res.text).toContain(
      `<a href="met:///event-invite/${token}">Continue to your invitation in Met</a>`,
    );
    expect(res.text).toContain("Install from the App Store");
    expect(res.text).toContain("Install from Google Play");
    expect(res.text).toContain('<meta name="referrer" content="no-referrer" />');
    expect(res.text).not.toContain(`referrer=${token}`);
    expect(res.text).toContain("open the original invitation link again");
    expect(res.text).toContain("Passcode-protected invitations will still ask for their passcode in Met.");
    expect(res.text).not.toContain("window.location");
    expect(res.text).not.toContain("<meta http-equiv=\"refresh\"");
  });

  it("rejects malformed invitation tokens without rendering a continue link", async () => {
    const res = await request(app).get("/event-invite/not-a-valid-token");

    expect(res.status).toBe(404);
    expect(res.text).toContain("Invitation not found.");
    expect(res.text).not.toContain("met:///event-invite/");
  });
});

describe("public privacy policy", () => {
  it("serves the canonical policy with current visibility and review disclosures", async () => {
    const res = await request(app).get("/privacy");

    expect(res.status).toBe(200);
    expect(res.headers.location).toBeUndefined();
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("Nearby visibility is an optional setting.");
    expect(res.text).toContain("detect your phone over Bluetooth");
    expect(res.text).toContain("GPS coordinates are not shared through this visibility feature.");
    expect(res.text).toContain("Turning visibility off does not erase information already shared");
    expect(res.text).toContain("approval is not a security or privacy guarantee.");
    expect(res.text).not.toContain("military-grade");
  });
});

describe("venue event detail links", () => {
  it("includes event and invite paths in iOS universal-link association", async () => {
    const res = await request(app).get("/.well-known/apple-app-site-association");

    expect(res.status).toBe(200);
    expect(res.body.applinks.details[0].paths).toContain("/connect/*");
    expect(res.body.applinks.details[0].paths).toContain("/event-details/*");
    expect(res.body.applinks.details[0].paths).toContain("/event-invite/*");
    expect(res.body.applinks.details[0].paths).toContain("/event-check-in/*");
  });

  it("routes a shared event URL to the event, not the venue check-in", async () => {
    mocks.chain.where.mockClear();
    mocks.chain.limit.mockResolvedValueOnce([{
      title: "Lantern Dinner",
      startsAt: new Date("2026-01-03T08:00:00.000Z"),
      imageUrl: "https://cdn.example.test/lantern-dinner.jpg",
      venueName: "River & Park",
    }]);

    const res = await request(app).get("/event-details/venue/123");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain('<meta property="og:title" content="Lantern Dinner" />');
    expect(res.text).toContain('<meta property="og:url" content="https://met-app.org/event-details/venue/123" />');
    expect(res.text).toContain("Sat, Jan 3, 2026, 8:00 AM UTC · River &amp; Park");
    expect(res.text).toContain('<meta property="og:image" content="https://cdn.example.test/lantern-dinner.jpg" />');
    expect(res.text).toContain('<meta name="twitter:image" content="https://cdn.example.test/lantern-dinner.jpg" />');
    expect(res.text).toContain("Open this event in Met to RSVP.");
    expect(res.text).toContain("met:///event-details/venue/123");
    expect(res.text).not.toContain("met:///v/");

    const [whereExpression] = mocks.chain.where.mock.calls[0] ?? [];
    const query = new PgDialect().sqlToQuery(whereExpression);
    expect(query.params).toEqual(
      expect.arrayContaining([123, true, false, "public", "approved"]),
    );
  });

  it("serves fresh metadata at each versioned share URL and preserves the cache key", async () => {
    mocks.chain.limit
      .mockResolvedValueOnce([{
        title: "Old Event Name",
        startsAt: new Date("2026-01-03T08:00:00.000Z"),
        imageUrl: "https://cdn.example.test/old-image.jpg",
        venueName: "River & Park",
      }])
      .mockResolvedValueOnce([{
        title: "Updated Event Name",
        startsAt: new Date("2026-02-04T10:30:00.000Z"),
        imageUrl: "https://cdn.example.test/new-image.jpg",
        venueName: "Harbor Hall",
      }]);

    const oldPreview = await request(app).get(
      "/event-details/venue/123?preview=1700000000000",
    );
    const updatedPreview = await request(app).get(
      "/event-details/venue/123?preview=1700000000001",
    );

    expect(oldPreview.text).toContain('content="Old Event Name"');
    expect(oldPreview.text).toContain("old-image.jpg");
    expect(updatedPreview.text).toContain(
      '<meta property="og:url" content="https://met-app.org/event-details/venue/123?preview=1700000000001" />',
    );
    expect(updatedPreview.text).toContain('content="Updated Event Name"');
    expect(updatedPreview.text).toContain(
      "Wed, Feb 4, 2026, 10:30 AM UTC · Harbor Hall",
    );
    expect(updatedPreview.text).toContain("new-image.jpg");
    expect(updatedPreview.headers["cache-control"]).toContain("no-store");
  });

  it("escapes event copy and falls back from an unsafe event image URL", async () => {
    mocks.chain.limit.mockResolvedValueOnce([{
      title: "<script>Party</script>",
      startsAt: new Date("2026-01-03T08:00:00.000Z"),
      imageUrl: "javascript:alert(1)",
      venueName: "River & Park",
    }]);

    const res = await request(app).get("/event-details/venue/123");

    expect(res.status).toBe(200);
    expect(res.text).toContain("&lt;script&gt;Party&lt;/script&gt;");
    expect(res.text).not.toContain("<script>Party</script>");
    expect(res.text).toContain("https://met-app.org/opengraph.jpg");
    expect(res.text).not.toContain("javascript:alert(1)");
  });

  it("does not expose preview metadata for a missing, deleted, or ineligible event", async () => {
    mocks.chain.limit.mockResolvedValueOnce([]);

    const res = await request(app).get("/event-details/venue/123");

    expect(res.status).toBe(404);
    expect(res.text).toContain("Event unavailable");
    expect(res.text).not.toContain("og:title");
    expect(res.text).not.toContain("og:image");
  });

  it.each(["member", "venue", "other"])("rejects unsupported or malformed event path %s", async (eventType) => {
    const path = eventType === "venue"
      ? "/event-details/venue/not-an-id"
      : `/event-details/${eventType}/123`;
    const res = await request(app).get(path);

    expect(res.status).toBe(404);
  });
});

describe("event invitation link associations", () => {
  it("serves the Android app association for Met", async () => {
    const res = await request(app).get("/.well-known/assetlinks.json");

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "app.met.founders",
      },
    });
  });
});
