import assert from "node:assert/strict";
import test from "node:test";
import type { VenueOutreachHistoryEntry } from "@workspace/api-client-react";
import { dedupeVenueHistory, isBulkEligible, sendVenueBatch, sortVenueGroups, venueGroupKey } from "./venue-outreach-worklist.ts";

function entry(overrides: Partial<VenueOutreachHistoryEntry> = {}): VenueOutreachHistoryEntry {
  return {
    id: "evt-1",
    kind: "new_venue_outreach",
    businessName: "North Star",
    recipientEmail: "OWNER@example.com",
    template: "introduction",
    deliveryStatus: "sent",
    createdAt: "2025-01-01T00:00:00.000Z",
    sentAt: "2025-01-01T00:00:00.000Z",
    venueOwnerProfileId: null,
    applicationId: null,
    applicationStatus: null,
    placeId: null,
    expiresAt: null,
    linkStatus: "none",
    venueKey: "prospect:north star|owner@example.com",
    assignedAgentId: null,
    assignedAgentName: null,
    nextActionNote: null,
    nextActionDueDate: null,
    ...overrides,
  };
}

test("deduplicates linked profile ids and normalized prospect name/email while retaining events", () => {
  const items = [
    entry(),
    entry({ id: "evt-2", businessName: " north   star ", recipientEmail: "owner@example.com", createdAt: "2025-01-02T00:00:00.000Z" }),
    entry({ id: "linked-1", venueOwnerProfileId: 41 }),
    entry({ id: "linked-2", venueOwnerProfileId: 41, recipientEmail: "alt@example.com" }),
  ];
  const result = dedupeVenueHistory(items);
  assert.equal(result.length, 2);
  assert.deepEqual(result.find((group) => group.key.startsWith("prospect:"))?.events.map((item) => item.id), ["evt-2", "evt-1"]);
  assert.equal(result.find((group) => group.key === "profile:41")?.events.length, 2);
});

test("groups outreach to the same map place when contact email changes", () => {
  const result = dedupeVenueHistory([
    entry({ id: "first", placeId: "maps-place-1", recipientEmail: "old@example.com" }),
    entry({
      id: "second",
      placeId: "maps-place-1",
      recipientEmail: "new@example.com",
      createdAt: "2025-01-02T00:00:00.000Z",
    }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.key, "place:maps-place-1");
  assert.deepEqual(result[0]?.events.map((item) => item.id), ["second", "first"]);
});

test("Map Place ID remains the grouping key even across profiles and recipient emails", () => {
  const result = dedupeVenueHistory([
    entry({ id: "first", venueOwnerProfileId: 41, placeId: "maps-place-1", recipientEmail: "old@example.com" }),
    entry({ id: "second", venueOwnerProfileId: 42, placeId: "maps-place-1", recipientEmail: "new@example.com" }),
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.key, "place:maps-place-1");
  assert.deepEqual(result[0]?.events.map((item) => item.id), ["first", "second"]);
});

test("keeps same-name branches separate when their map place ids differ", () => {
  const result = dedupeVenueHistory([
    entry({ id: "branch-a", placeId: "maps-place-a", recipientEmail: "same@example.com" }),
    entry({ id: "branch-b", placeId: "maps-place-b", recipientEmail: "same@example.com" }),
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((group) => group.key).sort(), [
    "place:maps-place-a",
    "place:maps-place-b",
  ]);
});

test("uses the existing name-and-email fallback when historical entries have no place id", () => {
  assert.equal(venueGroupKey(entry({ placeId: null })), "prospect:north star|owner@example.com");
});

test("sorts stably using venue/status/recent keys and deterministic name/key ties", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "z", businessName: "Beacon", createdAt: "2025-01-01T00:00:00Z" }),
    entry({ id: "a", businessName: "Beacon", recipientEmail: "a@example.com", createdAt: "2025-01-01T00:00:00Z" }),
    entry({ id: "c", businessName: "Aster", createdAt: "2025-01-02T00:00:00Z", deliveryStatus: "failed" }),
  ]);
  assert.deepEqual(sortVenueGroups(groups, "venue").map((group) => group.latest.businessName), ["Aster", "Beacon", "Beacon"]);
  assert.deepEqual(sortVenueGroups(groups, "recent").map((group) => group.latest.id), ["c", "a", "z"]);
  assert.deepEqual(sortVenueGroups(groups, "status").map((group) => group.latest.deliveryStatus), ["failed", "sent", "sent"]);
});

test("sorts by assigned agent and scheduled follow-up before venues without a plan", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "none", businessName: "No plan" }),
    entry({
      id: "later",
      businessName: "Later",
      assignedAgentName: "Casey",
      nextActionNote: "Call back",
      nextActionDueDate: "2026-11-10",
    }),
    entry({
      id: "earlier",
      businessName: "Earlier",
      assignedAgentName: "Avery",
      nextActionNote: "Send details",
      nextActionDueDate: "2026-10-20",
    }),
  ]);
  assert.deepEqual(sortVenueGroups(groups, "agent").map((group) => group.latest.id), [
    "earlier",
    "later",
    "none",
  ]);
  assert.deepEqual(sortVenueGroups(groups, "followup").map((group) => group.latest.id), [
    "earlier",
    "later",
    "none",
  ]);
});

test("bulk eligibility excludes uncertain, used links, manager mail, and unapproved registration links", () => {
  const group = (value: VenueOutreachHistoryEntry) => dedupeVenueHistory([value])[0];
  assert.equal(isBulkEligible(group(entry()), "new_venue_outreach"), true);
  assert.equal(isBulkEligible(group(entry()), "new_venue_outreach", "preapproval_video_application"), true);
  assert.equal(isBulkEligible(group(entry({ venueOwnerProfileId: 12, applicationId: 12 })), "new_venue_outreach", "preapproval_video_application"), false);
  assert.equal(isBulkEligible(group(entry({ kind: "contact_request", venueOwnerProfileId: 12 })), "contact_request", "benefits"), false);
  assert.equal(isBulkEligible(group(entry({ deliveryStatus: "delivery_uncertain" })), "new_venue_outreach"), false);
  assert.equal(isBulkEligible(group(entry({ linkStatus: "used" })), "new_venue_outreach"), false);
  assert.equal(isBulkEligible(group(entry({ kind: "manager_announcement" })), "manager_announcement"), false);
  assert.equal(isBulkEligible(group(entry({ kind: "registration_invite", venueOwnerProfileId: 7, applicationStatus: "submitted" })), "registration_invite"), false);
  assert.equal(isBulkEligible(group(entry({ kind: "registration_invite", venueOwnerProfileId: 7, applicationStatus: "approved" })), "registration_invite"), true);
});

test("batch send is serial and stops at first failed or uncertain result", async () => {
  const calls: number[] = [];
  const result = await sendVenueBatch([1, 2, 3, 4], async (recipient) => {
    calls.push(recipient);
    if (recipient === 3) throw new Error("delivery uncertain");
  });
  assert.deepEqual(calls, [1, 2, 3]);
  assert.equal(result.sentCount, 2);
  assert.equal(result.failedCount, 1);
  assert.equal(result.notAttemptedCount, 1);
  assert.ok(result.error instanceof Error);
});

test("batch send caps work at 25 and performs no transport outside its injected sender", async () => {
  let sends = 0;
  const result = await sendVenueBatch(Array.from({ length: 28 }, (_, index) => index), async () => { sends += 1; });
  assert.equal(sends, 25);
  assert.equal(result.sentCount, 25);
  assert.equal(result.failedCount, 0);
  assert.equal(result.notAttemptedCount, 3);
  assert.equal(result.error, null);
});
