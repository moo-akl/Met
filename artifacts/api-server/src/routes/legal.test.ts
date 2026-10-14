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
  it.each(["iPhone", "Android", "Desktop"])("keeps the check-in context for %s", async (ua) => {
    const res = await request(app).get("/v/place-123?t=test-token").set("User-Agent", ua);
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
