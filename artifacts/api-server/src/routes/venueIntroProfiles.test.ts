import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db, venueIntroProfilesTable } from "@workspace/db";
import { createVenueIntroProfilesRouter } from "./venueIntroProfiles.js";

const app = express();
app.use(express.json());
app.use(createVenueIntroProfilesRouter((req, res, next) => {
  if (req.headers["x-test-admin"] !== "yes") {
    res.status(401).json({ message: "Sign in" });
    return;
  }
  next();
}));

const venueName = `Intro profile test ${randomUUID()}`;
const createdKeys: string[] = [];
const input = {
  venueName,
  coverCopy: "A tailored cover introduction for this venue.",
  slide2Heading: "Discover this venue",
  slide2Copy: "Guests can find the venue, save it, and plan a visit.",
  slide3Heading: "Connect visits and memories",
  slide3Copy: "On-site check-ins give guests a place to leave a note or photo.",
};

describe.skipIf(!process.env.DATABASE_URL)("venue introduction profiles", () => {
  afterAll(async () => {
    if (createdKeys.length > 0) {
      await db
        .delete(venueIntroProfilesTable)
        .where(inArray(venueIntroProfilesTable.key, createdKeys));
    }
  });

  it("lists the built-in profiles publicly and requires admin access for changes", async () => {
    const listing = await request(app).get("/venue-intro-profiles").expect(200);
    expect(listing.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "hardRockBali", venueName: "Hard Rock Cafe Bali" }),
      ]),
    );
    await request(app).post("/admin/venue-intro-profiles").send(input).expect(401);
    await request(app)
      .put("/admin/venue-intro-profiles/hardRockBali")
      .send(input)
      .expect(401);
  });

  it("rejects missing or whitespace-only copy before saving", async () => {
    await request(app)
      .post("/admin/venue-intro-profiles")
      .set("x-test-admin", "yes")
      .send({ ...input, venueName: "   " })
      .expect(400);
    await request(app)
      .post("/admin/venue-intro-profiles")
      .set("x-test-admin", "yes")
      .send({ ...input, slide3Copy: "" })
      .expect(400);
  });

  it("creates, lists, edits, and rejects duplicate venue profiles", async () => {
    const created = await request(app)
      .post("/admin/venue-intro-profiles")
      .set("x-test-admin", "yes")
      .send(input)
      .expect(201);
    createdKeys.push(created.body.key);
    expect(created.body).toMatchObject(input);
    expect(created.body.key).toContain("intro-profile-test");

    const listing = await request(app).get("/venue-intro-profiles").expect(200);
    expect(listing.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: created.body.key,
          venueName,
          coverCopy: input.coverCopy,
        }),
      ]),
    );

    await request(app)
      .post("/admin/venue-intro-profiles")
      .set("x-test-admin", "yes")
      .send({ ...input, venueName: `  ${venueName.toUpperCase()}  ` })
      .expect(409);

    const editedInput = {
      ...input,
      venueName: `${venueName} Updated`,
      slide2Heading: "Find the latest venue story",
    };
    const edited = await request(app)
      .put(`/admin/venue-intro-profiles/${encodeURIComponent(created.body.key)}`)
      .set("x-test-admin", "yes")
      .send(editedInput)
      .expect(200);
    expect(edited.body).toMatchObject(editedInput);

    const updatedListing = await request(app).get("/venue-intro-profiles").expect(200);
    expect(updatedListing.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: created.body.key,
          venueName: editedInput.venueName,
          slide2Heading: editedInput.slide2Heading,
        }),
      ]),
    );
  });
});
