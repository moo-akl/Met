import { expect, test } from "@playwright/test";

const historyPath = "/api/admin/venue-owner/outreach/history";
const templatesPath = "/api/admin/venue-owner/email-templates";
const sendPath = "/api/admin/venue-owner/outreach/manual-send";
const cleanupPath = "/api/admin/venue-owner/outreach/failed";
const gmailRepliesSyncPath = "/api/admin/venue-owner/outreach/sync-gmail-replies";
const recipients = [
  {
    id: "7101",
    businessName: "Cedar House",
    recipientEmail: "owner@cedar.example",
    placeId: "retry-place-cedar",
    deliveryStatus: "bounced",
  },
  {
    id: "7102",
    businessName: "Harbor Hall",
    recipientEmail: "manager@harbor.example",
    placeId: "retry-place-harbor",
    deliveryStatus: "bounced",
  },
  {
    id: "7103",
    businessName: "Active Venue",
    recipientEmail: "contact@active.example",
    placeId: "retry-place-active",
    deliveryStatus: "sent",
  },
];

type CleanupEmail = {
  id: number;
  deliveryStatus: string;
  sentAt: string | null;
  [key: string]: unknown;
};

function makeCleanupHistory(): CleanupEmail[] {
  const shared = {
    kind: "new_venue_outreach",
    template: "contact_request",
    templateName: "Initial template",
    deliveryFailureReason: null,
    createdAt: "2026-10-20T08:55:00.000Z",
    venueOwnerProfileId: null,
    applicationId: null,
    applicationStatus: null,
    expiresAt: null,
    linkStatus: "none",
    assignedAgentId: null,
    assignedAgentName: null,
    nextActionNote: null,
    nextActionDueDate: null,
    gmailRepliedAt: null,
    gmailThreadId: null,
    gmailReplyClassification: null,
  };

  return [
    {
      ...shared,
      id: 8201,
      businessName: "Bounced Cleanup House",
      recipientEmail: "bounced@cleanup.example",
      placeId: "cleanup-bounced-place",
      venueKey: "place:cleanup-bounced-place",
      deliveryStatus: "bounced",
      deliveryFailureStatus: "5.1.1",
      sentAt: "2026-10-20T09:00:00.000Z",
    },
    {
      ...shared,
      id: 8202,
      businessName: "Failed Cleanup Hall",
      recipientEmail: "failed@cleanup.example",
      placeId: "cleanup-failed-place",
      venueKey: "place:cleanup-failed-place",
      deliveryStatus: "failed",
      deliveryFailureStatus: null,
      sentAt: null,
    },
    {
      ...shared,
      id: 8203,
      businessName: "Successful Cleanup Venue",
      recipientEmail: "sent@cleanup.example",
      placeId: "cleanup-sent-place",
      venueKey: "place:cleanup-sent-place",
      deliveryStatus: "sent",
      deliveryFailureStatus: null,
      sentAt: "2026-10-20T09:00:00.000Z",
    },
  ];
}

test("bounced bulk retry requires a fresh template choice, recipient review, and confirmation", async ({ page }) => {
  const sendRequests: Array<Record<string, unknown>> = [];
  const unexpectedApiRequests: string[] = [];
  const history = {
    emails: recipients.map((recipient) => ({
      ...recipient,
      kind: "new_venue_outreach",
      template: "previous_template",
      templateName: "Previous template",
      deliveryFailureStatus: recipient.deliveryStatus === "bounced" ? "5.1.1" : null,
      deliveryFailureReason: recipient.deliveryStatus === "bounced" ? "Recipient address rejected" : null,
      createdAt: "2026-10-20T08:55:00.000Z",
      sentAt: "2026-10-20T09:00:00.000Z",
      venueOwnerProfileId: null,
      applicationId: null,
      applicationStatus: null,
      expiresAt: null,
      linkStatus: "none",
      venueKey: `place:${recipient.placeId}`,
      assignedAgentId: null,
      assignedAgentName: null,
      nextActionNote: null,
      nextActionDueDate: null,
      gmailRepliedAt: null,
      gmailThreadId: null,
      gmailReplyClassification: null,
    })),
    suppressedEmails: [],
  };
  const templates = [
    {
      id: "contact_request",
      name: "Initial template",
      subject: "An initial note",
      body: "Initial message",
      format: "text",
      builtin: true,
    },
    {
      id: "retry_review",
      name: "Retry review template",
      subject: "A reviewed retry",
      body: "Hello {{businessName}}",
      format: "text",
      builtin: false,
    },
  ];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;

    if (path === historyPath && method === "GET") {
      await route.fulfill({ json: history });
      return;
    }
    if (path === templatesPath && method === "GET") {
      await route.fulfill({ json: templates });
      return;
    }
    if (path === sendPath && method === "POST") {
      sendRequests.push(request.postDataJSON() as Record<string, unknown>);
      const body = request.postDataJSON() as { recipientEmail: string };
      await route.fulfill({
        status: 201,
        json: { emailSent: true, recipientEmail: body.recipientEmail },
      });
      return;
    }

    unexpectedApiRequests.push(`${method} ${path}`);
    await route.fulfill({ status: 501, json: { message: "Unexpected API request in browser test" } });
  });

  await page.goto("/venue-admin/browser-tests/venue-outreach-bulk-retry.html");
  const templateSelect = page.getByTestId("select-bulk-template");
  const reviewButton = page.getByTestId("button-bulk-send-preview");
  const selectBouncedButton = page.getByTestId("button-select-bounced-for-retry");

  await expect(selectBouncedButton).toHaveText("Select bounced for retry (2)");
  await expect(templateSelect).toHaveValue("contact_request");
  await selectBouncedButton.click();

  await expect(templateSelect).toHaveValue("");
  await expect(reviewButton).toBeDisabled();
  expect(sendRequests).toHaveLength(0);

  await templateSelect.selectOption("retry_review");
  await expect(reviewButton).toBeEnabled();
  await reviewButton.click();

  const reviewDialog = page.getByRole("dialog");
  await expect(reviewDialog.getByRole("heading", { name: "Confirm recipients before sending" })).toBeVisible();
  await expect(reviewDialog).toContainText("Retry review template");
  await expect(reviewDialog.getByTestId("text-bulk-recipient-count")).toHaveText("2 emails · 2 venues selected");
  const recipientList = reviewDialog.getByTestId("list-bulk-recipients");
  await expect(recipientList).toContainText("Cedar House");
  await expect(recipientList).toContainText("owner@cedar.example");
  await expect(recipientList).toContainText("Harbor Hall");
  await expect(recipientList).toContainText("manager@harbor.example");
  await expect(recipientList).not.toContainText("Active Venue");
  expect(sendRequests).toHaveLength(0);
  await expect(reviewDialog.getByTestId("button-confirm-bulk-send")).toBeEnabled();

  await reviewDialog.getByTestId("button-confirm-bulk-send").click();
  await expect.poll(() => sendRequests.length).toBe(2);
  await expect(page.getByTestId("status-bulk-send-result"))
    .toContainText("Batch finished: 2 sent, 0 rejected before sending, 0 needing a check, 0 not attempted.");

  expect(sendRequests.map((body) => body.recipientEmail).sort()).toEqual([
    "manager@harbor.example",
    "owner@cedar.example",
  ]);
  expect(sendRequests.map((body) => body.templateId)).toEqual(["retry_review", "retry_review"]);
  expect(sendRequests.map((body) => body.retryOfLogId).sort()).toEqual([7101, 7102]);
  expect(unexpectedApiRequests).toEqual([]);
});

test("cleanup dialog confirms bounced and unsent-failure counts, then refreshes history", async ({ page }) => {
  let emails = makeCleanupHistory();
  let historyReads = 0;
  const cleanupBodies: Array<Record<string, unknown>> = [];
  const deletedIds: number[] = [];
  const unexpectedApiRequests: string[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;

    if (path === historyPath && method === "GET") {
      historyReads += 1;
      await route.fulfill({ json: { emails, suppressedEmails: [] } });
      return;
    }
    if (path === templatesPath && method === "GET") {
      await route.fulfill({ json: [] });
      return;
    }
    if (path === cleanupPath && method === "DELETE") {
      cleanupBodies.push(request.postDataJSON() as Record<string, unknown>);
      const cleanupCandidates = emails.filter((email) =>
        email.deliveryStatus === "bounced" ||
        (email.deliveryStatus === "failed" && email.sentAt === null)
      );
      deletedIds.push(...cleanupCandidates.map((email) => email.id));
      emails = emails.filter((email) => !cleanupCandidates.includes(email));
      await route.fulfill({
        status: 200,
        json: {
          clearedEmailCount: 2,
          clearedFailedEmailCount: 1,
          clearedBouncedEmailCount: 1,
          removedUnusedInviteCount: 0,
        },
      });
      return;
    }

    unexpectedApiRequests.push(`${method} ${path}`);
    await route.fulfill({ status: 501, json: { message: "Unexpected API request in browser test" } });
  });

  await page.goto("/venue-admin/browser-tests/venue-outreach-bulk-retry.html");
  await page.getByTestId("button-outreach-view-all").click();
  await expect(page.getByTestId("text-outreach-business-8201")).toBeVisible();
  await expect(page.getByTestId("text-outreach-business-8202")).toBeVisible();
  await expect(page.getByTestId("button-clear-bounced-failed-outreach"))
    .toHaveText("Clear bounced + failed (2)");

  await page.getByTestId("button-clear-bounced-failed-outreach").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "1 bounced record and 1 confirmed failed attempt with no recorded send time",
  );
  await expect(dialog.getByTestId("text-gmail-cleanup-unavailable"))
    .toContainText("The bounce notices and original sent messages remain in Gmail.");
  expect(cleanupBodies).toHaveLength(0);
  await dialog.getByTestId("button-confirm-clear-outreach-records").click();

  await expect(page.getByText("Failed and bounced records cleared", { exact: true })).toBeVisible();
  await expect(page.getByTestId("text-outreach-business-8201")).toHaveCount(0);
  await expect(page.getByTestId("text-outreach-business-8202")).toHaveCount(0);
  await expect(page.getByTestId("text-outreach-business-8203")).toBeVisible();
  await expect(page.getByTestId("button-clear-bounced-failed-outreach"))
    .toHaveText("Clear bounced + failed (0)");
  await expect.poll(() => historyReads).toBeGreaterThan(1);

  expect(cleanupBodies).toEqual([{
    confirm: true,
    expectedFailedEmailCount: 1,
    expectedBouncedEmailCount: 1,
  }]);
  expect(deletedIds.sort()).toEqual([8201, 8202]);
  expect(unexpectedApiRequests).toEqual([]);
});

test("a stale cleanup count causes a refresh without deleting the changing record", async ({ page }) => {
  let emails = makeCleanupHistory();
  let historyReads = 0;
  const cleanupBodies: Array<Record<string, unknown>> = [];
  const deletedIds: number[] = [];
  const unexpectedApiRequests: string[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;

    if (path === historyPath && method === "GET") {
      historyReads += 1;
      await route.fulfill({ json: { emails, suppressedEmails: [] } });
      return;
    }
    if (path === templatesPath && method === "GET") {
      await route.fulfill({ json: [] });
      return;
    }
    if (path === cleanupPath && method === "DELETE") {
      cleanupBodies.push(request.postDataJSON() as Record<string, unknown>);
      // Simulate another actor changing the failed send to "sending" after the
      // page loaded. The server rejects the stale count; it does not delete it.
      emails = emails.map((email) =>
        email.id === 8202 ? { ...email, deliveryStatus: "sending" } : email
      );
      await route.fulfill({
        status: 409,
        json: { message: "The bounced or unsent-failure count changed. Refresh and review it again." },
      });
      return;
    }

    unexpectedApiRequests.push(`${method} ${path}`);
    await route.fulfill({ status: 501, json: { message: "Unexpected API request in browser test" } });
  });

  await page.goto("/venue-admin/browser-tests/venue-outreach-bulk-retry.html");
  await page.getByTestId("button-outreach-view-all").click();
  await expect(page.getByTestId("button-clear-bounced-failed-outreach"))
    .toHaveText("Clear bounced + failed (2)");
  await page.getByTestId("button-clear-bounced-failed-outreach").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("button-confirm-clear-outreach-records"))
    .toHaveText("Clear 2 records");
  expect(cleanupBodies).toHaveLength(0);
  await dialog.getByTestId("button-confirm-clear-outreach-records").click();

  await expect(page.getByText("Cleanup was not completed", { exact: true })).toBeVisible();
  await expect(page.getByTestId("text-outreach-business-8202")).toBeVisible();
  await expect(page.getByTestId("status-outreach-delivery-8202")).toContainText("Sending");
  await expect(dialog).toContainText(
    "1 bounced record and 0 confirmed failed attempts with no recorded send time",
  );
  await expect(dialog.getByTestId("button-confirm-clear-outreach-records"))
    .toHaveText("Clear 1 records");
  await expect.poll(() => historyReads).toBeGreaterThan(1);

  expect(cleanupBodies).toEqual([{
    confirm: true,
    expectedFailedEmailCount: 1,
    expectedBouncedEmailCount: 1,
  }]);
  expect(deletedIds).toEqual([]);
  expect(unexpectedApiRequests).toEqual([]);
});

test("active and archived views keep outreach history, prioritize Gmail replies, and sync replies", async ({ page }) => {
  const history = {
    emails: [
      {
        id: 9101,
        businessName: "Personalized Reply Venue",
        recipientEmail: "owner@reply.example",
        placeId: "reply-place",
        venueKey: "place:reply-place",
        kind: "manager_announcement",
        template: "global_venue_prospect",
        templateName: "Personalized venue invitation",
        deliveryStatus: "sent",
        deliveryFailureStatus: null,
        deliveryFailureReason: null,
        createdAt: "2026-10-20T08:55:00.000Z",
        sentAt: "2026-10-20T09:00:00.000Z",
        venueOwnerProfileId: null,
        applicationId: null,
        applicationStatus: null,
        expiresAt: null,
        linkStatus: "none",
        assignedAgentId: null,
        assignedAgentName: null,
        nextActionNote: null,
        nextActionDueDate: null,
        gmailRepliedAt: "2026-10-22T09:00:00.000Z",
        gmailThreadId: "gmail-thread-reply",
        gmailReplyClassification: "interested",
      },
      {
        id: 9102,
        businessName: "Application In Progress Venue",
        recipientEmail: "owner@application.example",
        placeId: "application-place",
        venueKey: "place:application-place",
        kind: "new_venue_outreach",
        template: "contact_request",
        templateName: "Contact request",
        deliveryStatus: "sent",
        deliveryFailureStatus: null,
        deliveryFailureReason: null,
        createdAt: "2026-10-21T08:55:00.000Z",
        sentAt: "2026-10-21T09:00:00.000Z",
        venueOwnerProfileId: null,
        applicationId: 910,
        applicationStatus: "submitted",
        expiresAt: null,
        linkStatus: "none",
        assignedAgentId: null,
        assignedAgentName: null,
        nextActionNote: null,
        nextActionDueDate: null,
        gmailRepliedAt: null,
        gmailThreadId: null,
        gmailReplyClassification: null,
      },
      {
        id: 9103,
        businessName: "Archived Venue",
        recipientEmail: "owner@archived.example",
        placeId: "archived-place",
        venueKey: "place:archived-place",
        kind: "manager_announcement",
        template: "contact_request",
        templateName: "Contact request",
        deliveryStatus: "sent",
        deliveryFailureStatus: null,
        deliveryFailureReason: null,
        createdAt: "2026-10-19T08:55:00.000Z",
        sentAt: "2026-10-19T09:00:00.000Z",
        venueOwnerProfileId: null,
        applicationId: null,
        applicationStatus: null,
        expiresAt: null,
        linkStatus: "none",
        assignedAgentId: null,
        assignedAgentName: null,
        nextActionNote: null,
        nextActionDueDate: null,
        gmailRepliedAt: null,
        gmailThreadId: null,
        gmailReplyClassification: null,
      },
    ],
    suppressedEmails: [],
  };
  let replySyncCalls = 0;
  const unexpectedApiRequests: string[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;

    if (path === historyPath && method === "GET") {
      await route.fulfill({ json: history });
      return;
    }
    if (path === templatesPath && method === "GET") {
      await route.fulfill({ json: [] });
      return;
    }
    if (path === gmailRepliesSyncPath && method === "POST") {
      replySyncCalls += 1;
      await route.fulfill({
        status: 200,
        json: {
          scannedCount: 1000,
          matchedReplyCount: 1,
          updatedSendCount: 1,
          classifiedReplyCount: 1,
          classificationFailedCount: 0,
          classificationPendingCount: 0,
          truncated: true,
          lookbackDays: 730,
        },
      });
      return;
    }

    unexpectedApiRequests.push(`${method} ${path}`);
    await route.fulfill({ status: 501, json: { message: "Unexpected API request in browser test" } });
  });

  await page.goto("/venue-admin/browser-tests/venue-outreach-bulk-retry.html");
  await expect(page.getByTestId("select-outreach-sort")).toHaveValue("replied");
  await expect(page.getByTestId("text-outreach-business-9101")).toBeVisible();
  await expect(page.getByTestId("text-outreach-business-9102")).toBeVisible();
  await expect(page.getByTestId("text-outreach-business-9103")).toHaveCount(0);
  await expect(page.getByTestId("link-outreach-gmail-reply-9101"))
    .toHaveAttribute("href", "https://mail.google.com/mail/u/0/#all/gmail-thread-reply");
  await expect(page.getByTestId("badge-outreach-reply-classification-9101")).toHaveText("Interested");
  await expect(page.getByTestId("text-outreach-no-reply-9102")).toHaveText("No reply recorded");

  const visibleVenueNames = await page.locator('[data-testid^="text-outreach-business-"]').allTextContents();
  expect(visibleVenueNames.slice(0, 2)).toEqual([
    "Personalized Reply Venue",
    "Application In Progress Venue",
  ]);

  await page.getByTestId("button-outreach-view-archived").click();
  await expect(page.getByTestId("text-outreach-business-9103")).toBeVisible();
  await expect(page.getByTestId("text-outreach-business-9101")).toHaveCount(0);

  await page.getByTestId("button-outreach-view-all").click();
  await expect(page.getByTestId("text-outreach-business-9101")).toBeVisible();
  await expect(page.getByTestId("text-outreach-business-9102")).toBeVisible();
  await expect(page.getByTestId("text-outreach-business-9103")).toBeVisible();

  await page.getByTestId("button-outreach-view-interested").click();
  await expect(page.getByTestId("text-outreach-business-9101")).toBeVisible();
  await expect(page.getByTestId("text-outreach-business-9102")).toHaveCount(0);

  await page.getByTestId("button-outreach-view-rejected").click();
  await expect(page.getByTestId("text-outreach-business-9101")).toHaveCount(0);
  await expect(page.getByTestId("text-outreach-business-9102")).toHaveCount(0);

  await page.getByTestId("button-outreach-view-no_reply").click();
  await expect(page.getByTestId("text-outreach-business-9102")).toBeVisible();
  await expect(page.getByTestId("text-outreach-business-9103")).toBeVisible();
  await expect(page.getByTestId("text-outreach-business-9101")).toHaveCount(0);

  await page.getByTestId("button-outreach-view-all").click();
  await page.getByTestId("button-sync-gmail-replies").click();
  await expect(page.getByText("Gmail metadata sync complete", { exact: true })).toBeVisible();
  await expect(page.getByText(
    "Scanned 1000 messages and matched 1 reply. No AI classification was run. No replies are awaiting AI classification. The 1,000-message limit was reached; some older replies may not have been checked.",
    { exact: true },
  )).toBeVisible();
  expect(replySyncCalls).toBe(1);
  expect(unexpectedApiRequests).toEqual([]);
});
