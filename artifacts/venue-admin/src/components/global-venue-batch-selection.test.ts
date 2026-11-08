import assert from "node:assert/strict";
import test from "node:test";
import {
  capVenueProspectSelection,
  getNextTopFitVenueBatch,
} from "./global-venue-batch-selection.ts";

const prospects = Array.from({ length: 127 }, (_, index) => ({
  id: `venue-${index + 1}`,
  email: `venue-${index + 1}@example.com`,
  fitTier: index === 24 ? "strong" : "top",
}));

test("chooses the next 100 eligible top-fit prospects in source order, including later cohorts", () => {
  const queue = getNextTopFitVenueBatch(
    prospects,
    [" VENUE-2@example.com "],
    [{ recipientEmail: "venue-1@example.com" }, { recipientEmail: "venue-3@example.com" }],
  );
  assert.equal(queue.length, 100);
  assert.deepEqual(queue.slice(0, 3).map(({ id }) => id), ["venue-4", "venue-5", "venue-6"]);
  assert.ok(queue.every(({ fitTier }) => fitTier === "top"));
});

test("hard-caps requested selections at 100 in prospect order regardless of request size", () => {
  const selected = capVenueProspectSelection(
    prospects,
    prospects.map(({ id }) => id),
  );
  assert.equal(selected.length, 100);
  assert.deepEqual(selected.map(({ id }) => id), prospects.slice(0, 100).map(({ id }) => id));
  assert.equal(capVenueProspectSelection(prospects, prospects.map(({ id }) => id), 3).length, 3);
});

test("does not put contact-form-only or held prospects in an email batch", () => {
  const notEmailReady = [
    { id: "form-only", email: "", fitTier: "top" },
    { id: "closed", email: "closed@example.com", fitTier: "top", outreachHoldReason: "Venue is currently closed." },
  ];

  assert.deepEqual(getNextTopFitVenueBatch(notEmailReady, [], []), []);
});

test("blocks manually selected recipients with an exact confirmed sent history", () => {
  const candidates = [
    { id: "already-sent", email: "hello@venue.example", fitTier: "top" },
    { id: "bounced-after-send", email: "bounced@venue.example", fitTier: "top" },
    { id: "failed", email: "retry@venue.example", fitTier: "top" },
    { id: "suppressed", email: "blocked@venue.example", fitTier: "top" },
    { id: "held", email: "held@venue.example", fitTier: "top", outreachHoldReason: "Needs review." },
  ];
  const history = [
    { recipientEmail: " HELLO@VENUE.EXAMPLE ", deliveryStatus: "sent" },
    { recipientEmail: "bounced@venue.example", deliveryStatus: "bounced", sentAt: "2026-10-30T18:00:00Z" },
    { recipientEmail: "retry@venue.example", deliveryStatus: "failed", sentAt: null },
  ];

  assert.deepEqual(
    capVenueProspectSelection(
      candidates,
      candidates.map(({ id }) => id),
      undefined,
      history,
      [" BLOCKED@VENUE.EXAMPLE "],
    ).map(({ id }) => id),
    ["failed"],
  );
});

test("the default next batch excludes exact recipients already recorded in history", () => {
  const candidates = [
    { id: "sent", email: "sent@example.com", fitTier: "top" },
    { id: "fresh", email: "fresh@example.com", fitTier: "top" },
  ];

  assert.deepEqual(
    getNextTopFitVenueBatch(candidates, [], [
      { recipientEmail: " SENT@example.com ", deliveryStatus: "sent", sentAt: "2026-10-30T18:00:00Z" },
    ]).map(({ id }) => id),
    ["fresh"],
  );
});
