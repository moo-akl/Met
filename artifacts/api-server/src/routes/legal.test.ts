import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  chain: {
    select: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(), limit: vi.fn(),
  },
}));
vi.mock("@workspace/db", () => ({
  db: mocks.chain,
  venueOwnerProfilesTable: { placeId: "place", isApproved: "approved", applicationStatus: "status" },
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
