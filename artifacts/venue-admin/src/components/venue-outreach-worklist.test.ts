import assert from "node:assert/strict";
import test from "node:test";
import type { VenueOutreachHistoryEntry } from "@workspace/api-client-react";
import { DEFAULT_WORKLIST_FILTERS, dedupeRecipientEmails, dedupeVenueHistory, filterVenueGroups, isFollowUpDue, lastSuccessfulEmail, sendVenueBatch, sortVenueGroups, venueGroupKey } from "./venue-outreach-worklist.ts";

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

test("sorts stably by venue and successful email dates, leaving failed-only venues last", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "z", businessName: "Beacon", createdAt: "2025-01-01T00:00:00Z" }),
    entry({ id: "a", businessName: "Beacon", recipientEmail: "a@example.com", createdAt: "2025-01-01T00:00:00Z" }),
    entry({ id: "c", businessName: "Aster", createdAt: "2025-01-02T00:00:00Z", deliveryStatus: "failed" }),
  ]);
  assert.deepEqual(sortVenueGroups(groups, "venue").map((group) => group.latest.businessName), ["Aster", "Beacon", "Beacon"]);
  assert.deepEqual(sortVenueGroups(groups, "recent").map((group) => group.latest.id), ["a", "z", "c"]);
});

test("sorts by scheduled follow-up before venues without a plan", () => {
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
  assert.deepEqual(sortVenueGroups(groups, "followup").map((group) => group.latest.id), [
    "earlier",
    "later",
    "none",
  ]);
});

test("last-template filter ignores failed, sending and uncertain attempts", () => {
  for (const deliveryStatus of ["failed", "sending", "delivery_uncertain"] as const) {
    const groups = dedupeVenueHistory([
      entry({ id: "success", template: "introduction" }),
      entry({ id: "attempt", template: "latest_updates_prospect", deliveryStatus, sentAt: null, createdAt: "2025-02-01T00:00:00Z" }),
    ]);
    assert.equal(lastSuccessfulEmail(groups[0])?.id, "success");
    assert.equal(filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, lastTemplate: "introduction" }).length, 1);
    assert.equal(filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, lastTemplate: "latest_updates_prospect" }).length, 0);
  }
});

test("last-template means most recent successful send, not any historical match", () => {
  const groups = dedupeVenueHistory([
    entry(),
    entry({ id: "update", kind: "manager_announcement", template: "latest_updates_prospect",
      createdAt: "2025-02-01T00:00:00Z", sentAt: "2025-02-01T00:00:01Z" }),
    entry({ id: "never", businessName: "Never sent", deliveryStatus: "failed", sentAt: null }),
  ]);
  assert.equal(filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, lastTemplate: "introduction" }).length, 0);
  assert.deepEqual(filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, lastTemplate: "latest_updates_prospect" }).map((group) => group.latest.id), ["update"]);
  assert.deepEqual(filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, lastTemplate: "none" }).map((group) => group.latest.id), ["never"]);
});

test("successful send timestamps determine recency even when creation order differs", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "late-delivery", createdAt: "2025-01-01T00:00:00Z", sentAt: "2025-03-01T00:00:00Z" }),
    entry({ id: "later-record", createdAt: "2025-02-01T00:00:00Z", sentAt: "2025-02-01T00:00:00Z" }),
    entry({ id: "other", businessName: "Other", sentAt: "2025-02-15T00:00:00Z" }),
  ]);
  assert.equal(lastSuccessfulEmail(groups.find((group) => group.latest.id === "later-record")!)?.id, "late-delivery");
  assert.deepEqual(sortVenueGroups(groups, "recent").map((group) => group.latest.id), ["later-record", "other"]);
});

test("announcements do not remove historical venue outreach, application or invitation filters", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "original", placeId: "venue", applicationId: 12, applicationStatus: "approved", linkStatus: "used" }),
    entry({ id: "update", placeId: "venue", kind: "manager_announcement", template: "latest_updates_prospect",
      createdAt: "2025-02-01T00:00:00Z", sentAt: "2025-02-01T00:00:01Z" }),
  ]);
  assert.equal(filterVenueGroups(groups, {
    ...DEFAULT_WORKLIST_FILTERS, kind: "new_venue_outreach", application: "approved", link: "used",
    lastTemplate: "latest_updates_prospect",
  }).length, 1);
});

test("quick views show due dates through today and only failed or uncertain latest deliveries", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "overdue", businessName: "Overdue", nextActionDueDate: "2026-10-14" }),
    entry({ id: "today", businessName: "Today", nextActionDueDate: "2026-10-15", deliveryStatus: "failed" }),
    entry({ id: "future", businessName: "Future", nextActionDueDate: "2026-10-16" }),
    entry({ id: "uncertain", businessName: "Uncertain", deliveryStatus: "delivery_uncertain" }),
    entry({ id: "sending", businessName: "Sending", deliveryStatus: "sending" }),
  ]);
  const due = filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, view: "followup" }, "2026-10-15");
  assert.deepEqual(due.map((group) => group.latest.id), ["overdue", "today"]);
  assert.equal(isFollowUpDue(due[1], "2026-10-15"), true);
  assert.deepEqual(filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, view: "attention" }).map((group) => group.latest.id), ["today", "uncertain"]);
  assert.equal(filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, view: "followup", search: "today", status: "failed" }, "2026-10-15").length, 1);
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

test("sending the full venue list includes linked applications, active profiles and announcements", async () => {
  const groups = dedupeVenueHistory([
    entry({ id: "eligible-a" }),
    entry({ id: "eligible-b", businessName: "Second Venue", recipientEmail: "second@example.com" }),
    entry({ id: "linked", businessName: "Linked Venue", recipientEmail: "linked@example.com", venueOwnerProfileId: 7 }),
    entry({ id: "applied", businessName: "Applied Venue", recipientEmail: "applied@example.com", applicationId: 9 }),
    entry({ id: "manager", businessName: "Already Updated", recipientEmail: "manager@example.com", kind: "manager_announcement" }),
  ]);
  const sent: string[] = [];
  await sendVenueBatch(groups, async (group) => { sent.push(group.latest.id); });
  assert.deepEqual(sent.sort(), ["applied", "eligible-a", "eligible-b", "linked", "manager"]);
});

test("batch send includes all explicitly selected venues and performs no transport outside its injected sender", async () => {
  let sends = 0;
  const result = await sendVenueBatch(Array.from({ length: 28 }, (_, index) => index), async () => { sends += 1; }, undefined, 28);
  assert.equal(sends, 28);
  assert.equal(result.sentCount, 28);
  assert.equal(result.failedCount, 0);
  assert.equal(result.notAttemptedCount, 0);
  assert.equal(result.error, null);
});

test("all bulk templates send past the old 25-recipient limit by default", async () => {
  const result = await sendVenueBatch(Array.from({ length: 28 }, (_, index) => index), async () => {});
  assert.equal(result.sentCount, 28);
  assert.equal(result.notAttemptedCount, 0);
});

test("optional address deduplication keeps branch rows separate when disabled", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "branch-a", businessName: "Branch A", placeId: "place-a" }),
    entry({ id: "branch-b", businessName: "Branch B", placeId: "place-b", recipientEmail: "owner@example.com" }),
    entry({ id: "older-update", businessName: "Returning", recipientEmail: "returning@example.com", kind: "manager_announcement", template: "latest_updates_prospect" }),
  ]);
  assert.equal(groups.length, 3);
  assert.equal(dedupeRecipientEmails(groups).length, 2);
  const updated = dedupeVenueHistory([
    ...groups.flatMap((group) => group.events),
    entry({
      id: "recent", businessName: "Branch A", placeId: "place-a",
      kind: "manager_announcement", template: "latest_updates_prospect",
      createdAt: new Date().toISOString(),
    }),
  ]);
  assert.equal(updated.length, 3);
});
