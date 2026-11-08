import assert from "node:assert/strict";
import test from "node:test";
import type { VenueOutreachHistoryEntry } from "@workspace/api-client-react";
import { DEFAULT_WORKLIST_FILTERS, dedupeRecipientEmails, dedupeVenueHistory, filterVenueGroups, getVenueSendErrorMessage, hasApplicationOrRegistrationInProgress, hasConfirmedReply, hasManualReplyConfirmation, hasPersonalizedApproach, isConfirmedVenueSendFailure, isFollowUpDue, lastSuccessfulEmail, latestGmailReply, latestManualReplyEvent, sendVenueBatch, shouldContinueGlobalVenueProspectBatchAfterFailure, shouldContinueVenueBatchAfterFailure, sortVenueGroups, venueGroupKey } from "./venue-outreach-worklist.ts";
import { makeNoReplyDrafts, NO_REPLY_TEMPLATE_ID } from "./venue-no-reply-campaign.ts";

const ALL_HISTORY_FILTERS = { ...DEFAULT_WORKLIST_FILTERS, view: "all" as const };

function entry(overrides: Partial<VenueOutreachHistoryEntry> = {}): VenueOutreachHistoryEntry {
  return {
    id: "evt-1",
    kind: "new_venue_outreach",
    businessName: "North Star",
    recipientEmail: "OWNER@example.com",
    template: "introduction",
    deliveryStatus: "sent",
    deliveryFailureStatus: null,
    deliveryFailureReason: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    sentAt: "2025-01-01T00:00:00.000Z",
    venueOwnerProfileId: null,
    applicationId: null,
    applicationStatus: null,
    placeId: null,
    gmailRepliedAt: null,
    gmailThreadId: null,
    gmailReplyClassification: null,
    expiresAt: null,
    linkStatus: "none",
    venueKey: "prospect:north star|owner@example.com",
    assignedAgentId: null,
    assignedAgentName: null,
    nextActionNote: null,
    nextActionDueDate: null,
    manualInterestLevel: null,
    manualReplyEvents: [],
    ...overrides,
  };
}

test("builds no-reply drafts only from unreplied, deliverable outreach", () => {
  const drafts = makeNoReplyDrafts([
    entry({
      id: "unmatched",
      businessName: "North Star Venue",
      recipientEmail: "north@example.com",
    }),
    entry({
      id: "known",
      businessName: "Artist House Bangkok",
      recipientEmail: "artisthousebangkok@gmail.com",
    }),
    entry({
      id: "blocked",
      businessName: "Blocked Venue",
      recipientEmail: "blocked@example.com",
    }),
    entry({
      id: "reply-sent",
      businessName: "Replied Venue",
      recipientEmail: "replied@example.com",
      createdAt: "2025-01-01T00:00:00.000Z",
      sentAt: "2025-01-01T00:00:00.000Z",
    }),
    entry({
      id: "reply",
      businessName: "Replied Venue",
      recipientEmail: "replied@example.com",
      createdAt: "2025-01-02T00:00:00.000Z",
      sentAt: null,
      gmailRepliedAt: "2025-01-02T00:00:00.000Z",
    }),
    entry({
      id: "follow-up",
      businessName: "Already Followed Up",
      recipientEmail: "followed@example.com",
      template: NO_REPLY_TEMPLATE_ID,
      createdAt: "2025-01-02T00:00:00.000Z",
      sentAt: "2025-01-02T00:00:00.000Z",
    }),
    entry({
      id: "uncertain-old",
      businessName: "Uncertain Venue",
      recipientEmail: "uncertain@example.com",
      createdAt: "2025-01-01T00:00:00.000Z",
      sentAt: "2025-01-01T00:00:00.000Z",
    }),
    entry({
      id: "uncertain-new",
      businessName: "Uncertain Venue",
      recipientEmail: "uncertain@example.com",
      deliveryStatus: "delivery_uncertain",
      createdAt: "2025-01-02T00:00:00.000Z",
      sentAt: null,
    }),
    entry({
      id: "manual-reply",
      businessName: "Manually Replied Venue",
      recipientEmail: "manual@example.com",
      manualReplyEvents: [{
        id: "71",
        venueKey: "prospect:manually replied venue|manual@example.com",
        action: "mark_replied",
        actorUid: "admin:1",
        createdAt: "2025-01-02T00:00:00.000Z",
      }],
    }),
    entry({
      id: "manual-reply-undone",
      businessName: "Reply Mark Undone Venue",
      recipientEmail: "undone@example.com",
      manualReplyEvents: [
        {
          id: "72",
          venueKey: "prospect:reply mark undone venue|undone@example.com",
          action: "mark_replied",
          actorUid: "admin:1",
          createdAt: "2025-01-02T00:00:00.000Z",
        },
        {
          id: "73",
          venueKey: "prospect:reply mark undone venue|undone@example.com",
          action: "undo_mark",
          actorUid: "admin:2",
          createdAt: "2025-01-03T00:00:00.000Z",
        },
      ],
    }),
  ], ["blocked@example.com"]);

  assert.deepEqual(drafts.map((draft) => draft.name), [
    "North Star Venue",
    "Artist House Bangkok",
    "Blocked Venue",
    "Reply Mark Undone Venue",
  ]);
  const generic = drafts.find((draft) => draft.name === "North Star Venue")!;
  assert.equal(generic.selected, true);
  assert.equal(generic.pdfCopy.venueCategory, "");
  assert.equal(generic.pdfCopy.venueLocation, "");
  assert.equal(generic.pdfCopy.venueName, "North Star Venue");
  const sourced = drafts.find((draft) => draft.name === "Artist House Bangkok")!;
  assert.equal(sourced.pdfCopy.venueCategory, "Art workshop café · cultural venue");
  assert.ok(sourced.pdfHookSourceUrl);
  assert.equal(drafts.find((draft) => draft.name === "Blocked Venue")?.selected, false);
  assert.equal(drafts.some((draft) => draft.name === "Manually Replied Venue"), false);
});

test("resolves generic no-reply names only from a unique verified email match", () => {
  const drafts = makeNoReplyDrafts([
    entry({
      id: "verified-placeholder",
      businessName: " your venue ",
      recipientEmail: "artisthousebangkok@gmail.com",
    }),
    entry({
      id: "unknown-placeholder",
      businessName: "Your Venue",
      recipientEmail: "unverified@example.com",
    }),
  ], []);

  assert.deepEqual(drafts.map((draft) => draft.name), ["Artist House Bangkok"]);
  assert.equal(drafts[0].pdfCopy.venueName, "Artist House Bangkok");
});

test("excludes admin-confirmed Gmail reply addresses even without synced reply metadata", () => {
  const confirmedReplies = [
    "megan.silverman@greatbiggameshow.co",
    "josh@fablecocktailbar.capetown",
    "enquiries@hardrockcafe-kualalumpur.com",
    "lauren.hidayat@hardrockcafe-bali.com",
    "office@pogmahones.co.nz",
    "marketing@coupletcoffee.com",
  ];
  const history = confirmedReplies.map((recipientEmail, index) => entry({
    id: `confirmed-reply-${index}`,
    businessName: `Confirmed Reply Venue ${index}`,
    recipientEmail,
    gmailRepliedAt: null,
  }));

  assert.deepEqual(makeNoReplyDrafts(history, []), []);
});

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

test("the active worklist keeps registered or in-progress venues and personalized sends; archived history remains available", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "draft", businessName: "Draft", recipientEmail: "draft@example.com", applicationId: 11, applicationStatus: "draft" }),
    entry({ id: "submitted", businessName: "Submitted", recipientEmail: "submitted@example.com", applicationId: 12, applicationStatus: "submitted" }),
    entry({ id: "approved", businessName: "Approved", recipientEmail: "approved@example.com", applicationId: 13, applicationStatus: "approved" }),
    entry({ id: "registration", businessName: "Registration", recipientEmail: "registration@example.com", kind: "registration_invite", linkStatus: "active" }),
    entry({ id: "personalized", businessName: "Personalized", recipientEmail: "personalized@example.com", kind: "manager_announcement", template: "global_venue_prospect", sentAt: null }),
    entry({ id: "generic", businessName: "Generic", recipientEmail: "generic@example.com", template: "contact_request" }),
    entry({ id: "rejected", businessName: "Rejected", recipientEmail: "rejected@example.com", applicationId: 14, applicationStatus: "rejected" }),
  ]);

  const active = filterVenueGroups(groups, DEFAULT_WORKLIST_FILTERS);
  const archived = filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, view: "archived" });

  assert.deepEqual(active.map((group) => group.latest.id).sort(), [
    "approved", "draft", "personalized", "registration", "submitted",
  ]);
  assert.deepEqual(archived.map((group) => group.latest.id).sort(), ["generic", "rejected"]);
  assert.equal(groups.find((group) => group.latest.id === "generic")?.events.length, 1);
  assert.equal(hasApplicationOrRegistrationInProgress(groups.find((group) => group.latest.id === "submitted")!), true);
  assert.equal(hasPersonalizedApproach(groups.find((group) => group.latest.id === "personalized")!), true);
});

test("reply sort places Gmail responders first, newest reply before older reply", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "unreplied", businessName: "Unreplied", recipientEmail: "unreplied@example.com" }),
    entry({
      id: "older-reply",
      businessName: "Older reply",
      recipientEmail: "older@example.com",
      gmailRepliedAt: "2026-10-20T10:00:00.000Z",
      gmailThreadId: "gmail-thread-older",
    }),
    entry({
      id: "newer-reply",
      businessName: "Newer reply",
      recipientEmail: "newer@example.com",
      gmailRepliedAt: "2026-10-22T10:00:00.000Z",
      gmailThreadId: "gmail-thread-newer",
    }),
  ]);

  assert.deepEqual(sortVenueGroups(groups, "replied").map((group) => group.latest.id), [
    "newer-reply", "older-reply", "unreplied",
  ]);
  assert.equal(latestGmailReply(groups.find((group) => group.latest.id === "newer-reply")!)?.gmailThreadId, "gmail-thread-newer");
});

test("reply views separate interested, rejected, and venues with no recorded reply", () => {
  const groups = dedupeVenueHistory([
    entry({
      id: "interested",
      gmailRepliedAt: "2026-10-22T10:00:00.000Z",
      gmailReplyClassification: "interested",
    }),
    entry({
      id: "rejected",
      businessName: "Rejected",
      gmailRepliedAt: "2026-10-22T11:00:00.000Z",
      gmailReplyClassification: "rejected",
    }),
    entry({
      id: "unclassified",
      businessName: "Unclassified",
      gmailRepliedAt: "2026-10-22T12:00:00.000Z",
      gmailReplyClassification: null,
    }),
    entry({ id: "no-reply", businessName: "No reply" }),
    entry({
      id: "not-sent",
      businessName: "Not sent",
      deliveryStatus: "failed",
      sentAt: null,
    }),
  ]);

  assert.deepEqual(
    filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, view: "interested" }).map((group) => group.latest.id),
    ["interested"],
  );
  assert.deepEqual(
    filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, view: "rejected" }).map((group) => group.latest.id),
    ["rejected"],
  );
  assert.deepEqual(
    filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, view: "replied" }).map((group) => group.latest.id).sort(),
    ["interested", "rejected", "unclassified"],
  );
  assert.deepEqual(
    filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, view: "no_reply" }).map((group) => group.latest.id),
    ["no-reply"],
  );
});

test("manual reply marks move a venue out of no-reply views and can be undone", () => {
  const history = [
    entry({
      id: "manual-replied",
      businessName: "Manual Reply",
      recipientEmail: "manual@example.com",
      manualReplyEvents: [{
        id: "101",
        venueKey: "prospect:manual reply|manual@example.com",
        action: "mark_replied",
        actorUid: "admin:4",
        createdAt: "2026-10-22T10:00:00.000Z",
      }],
    }),
    entry({
      id: "manual-undone",
      businessName: "Undo Reply",
      recipientEmail: "undo@example.com",
      manualReplyEvents: [
        {
          id: "102",
          venueKey: "prospect:undo reply|undo@example.com",
          action: "mark_replied",
          actorUid: "admin:4",
          createdAt: "2026-10-22T10:00:00.000Z",
        },
        {
          id: "103",
          venueKey: "prospect:undo reply|undo@example.com",
          action: "undo_mark",
          actorUid: "admin:5",
          createdAt: "2026-10-23T10:00:00.000Z",
        },
      ],
    }),
  ];
  const groups = dedupeVenueHistory(history);
  const marked = groups.find((group) => group.latest.id === "manual-replied")!;
  const undone = groups.find((group) => group.latest.id === "manual-undone")!;

  assert.equal(hasConfirmedReply(marked), true);
  assert.equal(hasManualReplyConfirmation(marked), true);
  assert.equal(latestManualReplyEvent(marked)?.actorUid, "admin:4");
  assert.equal(hasConfirmedReply(undone), false);
  assert.equal(latestManualReplyEvent(undone)?.action, "undo_mark");
  assert.deepEqual(
    filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, view: "replied" }).map((group) => group.key),
    [marked.key],
  );
  assert.deepEqual(
    filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, view: "no_reply" }).map((group) => group.key),
    [undone.key],
  );
});

test("manual interest filter separates top interest, interest, and no interest", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "top", businessName: "Top venue", recipientEmail: "top@example.com", manualInterestLevel: "top_interest" }),
    entry({ id: "normal", businessName: "Normal venue", recipientEmail: "normal@example.com", manualInterestLevel: "interest" }),
    entry({ id: "none", businessName: "No interest venue", recipientEmail: "none@example.com", manualInterestLevel: "no_interest" }),
    entry({ id: "unset", businessName: "Unclassified venue", recipientEmail: "unset@example.com" }),
  ]);
  for (const [manualInterest, expected] of [
    ["top_interest", "top"],
    ["interest", "normal"],
    ["no_interest", "none"],
    ["unclassified", "unset"],
  ] as const) {
    assert.deepEqual(
      filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, manualInterest }).map((group) => group.latest.id),
      [expected],
    );
  }
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

test("last-template filter ignores failed, bounced, sending and uncertain attempts", () => {
  for (const deliveryStatus of ["failed", "bounced", "sending", "delivery_uncertain"] as const) {
    const groups = dedupeVenueHistory([
      entry({ id: "success", template: "introduction" }),
      entry({ id: "attempt", template: "latest_updates_prospect", deliveryStatus, sentAt: null, createdAt: "2025-02-01T00:00:00Z" }),
    ]);
    assert.equal(lastSuccessfulEmail(groups[0])?.id, "success");
    assert.equal(filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, lastTemplate: "introduction" }).length, 1);
    assert.equal(filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, lastTemplate: "latest_updates_prospect" }).length, 0);
  }
});

test("last-template means most recent successful send, not any historical match", () => {
  const groups = dedupeVenueHistory([
    entry(),
    entry({ id: "update", kind: "manager_announcement", template: "latest_updates_prospect",
      createdAt: "2025-02-01T00:00:00Z", sentAt: "2025-02-01T00:00:01Z" }),
    entry({ id: "never", businessName: "Never sent", deliveryStatus: "failed", sentAt: null }),
  ]);
  assert.equal(filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, lastTemplate: "introduction" }).length, 0);
  assert.deepEqual(filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, lastTemplate: "latest_updates_prospect" }).map((group) => group.latest.id), ["update"]);
  assert.deepEqual(filterVenueGroups(groups, { ...ALL_HISTORY_FILTERS, lastTemplate: "none" }).map((group) => group.latest.id), ["never"]);
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

test("quick views show due dates through today and include bounced latest deliveries in attention", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "overdue", businessName: "Overdue", nextActionDueDate: "2026-10-14" }),
    entry({ id: "today", businessName: "Today", nextActionDueDate: "2026-10-15", deliveryStatus: "failed" }),
    entry({ id: "future", businessName: "Future", nextActionDueDate: "2026-10-16" }),
    entry({ id: "uncertain", businessName: "Uncertain", deliveryStatus: "delivery_uncertain" }),
    entry({ id: "bounced", businessName: "Bounced", deliveryStatus: "bounced" }),
    entry({ id: "sending", businessName: "Sending", deliveryStatus: "sending" }),
  ]);
  const due = filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, view: "followup" }, "2026-10-15");
  assert.deepEqual(due.map((group) => group.latest.id), ["overdue", "today"]);
  assert.equal(isFollowUpDue(due[1], "2026-10-15"), true);
  assert.deepEqual(filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, view: "attention" }).map((group) => group.latest.id), ["today", "uncertain", "bounced"]);
  assert.equal(filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, view: "followup", search: "today", status: "failed" }, "2026-10-15").length, 1);
  assert.equal(filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, view: "followup", search: "bounced", status: "bounced" }, "2026-10-15").length, 0);
});

test("failed sends view finds failures in a venue's history even after a later successful send", () => {
  const groups = dedupeVenueHistory([
    entry({ id: "old-failure", placeId: "same-venue", businessName: "Same venue", deliveryStatus: "failed", sentAt: null }),
    entry({
      id: "new-success",
      placeId: "same-venue",
      businessName: "Same venue",
      deliveryStatus: "sent",
      createdAt: "2026-10-16T00:00:00Z",
      sentAt: "2026-10-16T00:00:01Z",
    }),
    entry({ id: "uncertain-only", businessName: "Uncertain only", deliveryStatus: "delivery_uncertain" }),
  ]);

  const failed = filterVenueGroups(groups, { ...DEFAULT_WORKLIST_FILTERS, view: "failed" });
  assert.equal(failed.length, 1);
  assert.equal(failed[0]?.latest.id, "new-success");
  assert.deepEqual(failed[0]?.events.map((event) => event.id), ["new-success", "old-failure"]);
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

test("batch send continues after an explicitly safe recipient rejection", async () => {
  const calls: number[] = [];
  const result = await sendVenueBatch([1, 2, 3], async (recipient) => {
    calls.push(recipient);
    if (recipient === 2) throw new Error("invalid recipient");
  }, undefined, Infinity, (error) => error instanceof Error && error.message === "invalid recipient");
  assert.deepEqual(calls, [1, 2, 3]);
  assert.equal(result.sentCount, 2);
  assert.equal(result.failedCount, 1);
  assert.equal(result.notAttemptedCount, 0);
  assert.equal(result.error, null);
  assert.deepEqual(result.continuedFailures.map(({ recipient }) => recipient), [2]);
});

test("only definite non-delivery failures are skipped; ambiguous outcomes still stop", () => {
  const apiError = (status: number, message: string) => ({ status, data: { message } });
  const recipientRejected = apiError(400, "Enter a venue, email address and template.");
  const wrappedRecipientRejected = {
    message: "Request failed",
    response: {
      status: "400",
      data: { message: "The personalized PDF is invalid or exceeds the 6 MB attachment limit." },
    },
  };
  const messageOnlyRecipientRejected = new Error("HTTP 400 Bad Request: Enter a venue, email address and template.");
  const templateRemoved = apiError(400, "This template was removed. Refresh the template list.");
  const definiteGmailFailure = apiError(503, "The email was not sent. It is marked Failed.");
  const uncertainGmailFailure = apiError(503, "Delivery could not be confirmed. Check Gmail Sent before sending again.");
  const gmailRateLimited = { status: 429, data: { gmailStatus: 429, message: "The email was not sent. Gmail rate-limited the request (HTTP 429). Wait before retrying." } };
  const wrappedGmailRateLimited = {
    status: 503,
    data: { message: "The email was not sent. Gmail rate-limited the request (HTTP 429). Wait before retrying." },
  };
  const gmailBadRecipient = { status: 503, data: { gmailStatus: 400, message: "The email was not sent. Gmail rejected the request (HTTP 400)." } };

  assert.equal(getVenueSendErrorMessage(recipientRejected), "Enter a venue, email address and template.");
  assert.equal(shouldContinueVenueBatchAfterFailure(recipientRejected), true);
  assert.equal(isConfirmedVenueSendFailure(recipientRejected), true);
  assert.equal(getVenueSendErrorMessage(wrappedRecipientRejected), "The personalized PDF is invalid or exceeds the 6 MB attachment limit.");
  assert.equal(shouldContinueVenueBatchAfterFailure(wrappedRecipientRejected), true);
  assert.equal(isConfirmedVenueSendFailure(wrappedRecipientRejected), true);
  assert.equal(shouldContinueVenueBatchAfterFailure(messageOnlyRecipientRejected), true);
  assert.equal(isConfirmedVenueSendFailure(messageOnlyRecipientRejected), true);
  assert.equal(shouldContinueVenueBatchAfterFailure(templateRemoved), false);
  assert.equal(isConfirmedVenueSendFailure(templateRemoved), true);
  assert.equal(shouldContinueVenueBatchAfterFailure(definiteGmailFailure), true);
  assert.equal(isConfirmedVenueSendFailure(definiteGmailFailure), true);
  assert.equal(shouldContinueVenueBatchAfterFailure(gmailRateLimited), false);
  assert.equal(shouldContinueGlobalVenueProspectBatchAfterFailure(gmailRateLimited), false);
  assert.equal(isConfirmedVenueSendFailure(gmailRateLimited), true);
  assert.equal(shouldContinueVenueBatchAfterFailure(wrappedGmailRateLimited), false);
  assert.equal(shouldContinueGlobalVenueProspectBatchAfterFailure(wrappedGmailRateLimited), false);
  assert.equal(isConfirmedVenueSendFailure(wrappedGmailRateLimited), true);
  assert.equal(shouldContinueVenueBatchAfterFailure(gmailBadRecipient), true);
  assert.equal(isConfirmedVenueSendFailure(gmailBadRecipient), true);
  assert.equal(shouldContinueVenueBatchAfterFailure(uncertainGmailFailure), false);
  assert.equal(isConfirmedVenueSendFailure(uncertainGmailFailure), false);
  assert.equal(shouldContinueVenueBatchAfterFailure(new Error("network disconnected")), false);
  assert.equal(isConfirmedVenueSendFailure(new Error("network disconnected")), false);
  assert.equal(shouldContinueGlobalVenueProspectBatchAfterFailure(uncertainGmailFailure), true);
  assert.equal(shouldContinueGlobalVenueProspectBatchAfterFailure(new Error("network disconnected")), true);
  assert.equal(shouldContinueGlobalVenueProspectBatchAfterFailure(templateRemoved), false);
  assert.equal(shouldContinueGlobalVenueProspectBatchAfterFailure(apiError(401, "Admin session expired.")), false);
  assert.equal(shouldContinueGlobalVenueProspectBatchAfterFailure(apiError(429, "Too many requests.")), false);
});

test("personalized prospect batch continues past an uncertain recipient without retrying it", async () => {
  const attempts: string[] = [];
  const uncertain = {
    status: 503,
    data: { message: "Delivery could not be confirmed. Check Gmail Sent before sending again." },
  };
  const result = await sendVenueBatch(["uncertain@example.com", "later@example.com"], async (email) => {
    attempts.push(email);
    if (email === "uncertain@example.com") throw uncertain;
  }, undefined, Infinity, shouldContinueGlobalVenueProspectBatchAfterFailure);

  assert.deepEqual(attempts, ["uncertain@example.com", "later@example.com"]);
  assert.equal(result.sentCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(result.notAttemptedCount, 0);
  assert.equal(result.error, null);
  assert.deepEqual(result.continuedFailures.map(({ recipient }) => recipient), ["uncertain@example.com"]);
});

test("personalized prospect batch stops after a Gmail rate-limit rejection", async () => {
  const attempts: string[] = [];
  const rateLimited = {
    status: 429,
    data: {
      gmailStatus: 429,
      message: "The email was not sent. Gmail rate-limited the request (HTTP 429). Wait before retrying.",
    },
  };
  const result = await sendVenueBatch(
    ["first@example.com", "later@example.com"],
    async (email) => {
      attempts.push(email);
      throw rateLimited;
    },
    undefined,
    Infinity,
    shouldContinueGlobalVenueProspectBatchAfterFailure,
  );

  assert.deepEqual(attempts, ["first@example.com"]);
  assert.equal(result.sentCount, 0);
  assert.equal(result.failedCount, 1);
  assert.equal(result.notAttemptedCount, 1);
  assert.equal(result.error, rateLimited);
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
