import assert from "node:assert/strict";
import test from "node:test";
import { parseVenueIntroProfile } from "./venueIntroProfiles.ts";

const baseProfile = {
  key: "sample-venue",
  venueName: "Sample Venue",
  coverCopy: "A place where local visitors return.",
  slide2Heading: "Make every visit memorable",
  slide2Copy: "Give guests reasons to return between visits.",
  slide3Heading: "Build connections from real visits",
  slide3Copy: "Met helps venue teams reconnect with real visitors.",
};

test("accepts and trims editable venue category and location", () => {
  assert.deepEqual(
    parseVenueIntroProfile({
      ...baseProfile,
      venueCategory: "  Independent café  ",
      venueLocation: "  Bangkok, Thailand  ",
    }),
    {
      ...baseProfile,
      venueCategory: "Independent café",
      venueLocation: "Bangkok, Thailand",
    },
  );
});

test("keeps older profiles valid when the optional venue details are absent", () => {
  assert.deepEqual(parseVenueIntroProfile(baseProfile), baseProfile);
});

test("accepts the activation-only flow flag and rejects invalid flag values", () => {
  assert.deepEqual(
    parseVenueIntroProfile({ ...baseProfile, activationMode: true }),
    { ...baseProfile, activationMode: true },
  );
  assert.equal(
    parseVenueIntroProfile({ ...baseProfile, activationMode: "yes" }),
    null,
  );
});

test("rejects venue details that exceed the limits used by the editor", () => {
  assert.equal(
    parseVenueIntroProfile({
      ...baseProfile,
      venueCategory: "x".repeat(71),
      venueLocation: "Bangkok",
    }),
    null,
  );
  assert.equal(
    parseVenueIntroProfile({
      ...baseProfile,
      venueCategory: "Café",
      venueLocation: "x".repeat(101),
    }),
    null,
  );
});
