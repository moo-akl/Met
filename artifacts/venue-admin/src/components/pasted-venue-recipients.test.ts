import assert from "node:assert/strict";
import test from "node:test";
import { keepRetryablePastedRecipients, parsePastedVenueRecipients } from "./pasted-venue-recipients.ts";

test("parses address-only lists separated by commas, semicolons, whitespace and newlines", () => {
  const result = parsePastedVenueRecipients("OWNER@EXAMPLE.COM, cafe@example.com;\nsouth@example.com\t<east@example.com>");
  assert.deepEqual(result.recipients, [
    { businessName: "your venue", recipientEmail: "owner@example.com" },
    { businessName: "your venue", recipientEmail: "cafe@example.com" },
    { businessName: "your venue", recipientEmail: "south@example.com" },
    { businessName: "your venue", recipientEmail: "east@example.com" },
  ]);
  assert.deepEqual(result.issues, []);
});

test("flags invalid addresses without dropping valid addresses on the same line", () => {
  const result = parsePastedVenueRecipients("\nonly@example.com, broken; missing@domain\nvalid@example.com");
  assert.deepEqual(result.issues.map((issue) => issue.line), [2, 2]);
  assert.equal(result.recipients.length, 2);
});

test("deduplicates normalized addresses without requiring venue names", () => {
  const result = parsePastedVenueRecipients("owner@example.com\nOWNER@example.com\nthird@example.com");
  assert.equal(result.duplicateCount, 1);
  assert.deepEqual(result.recipients.map((recipient) => recipient.recipientEmail), ["owner@example.com", "third@example.com"]);
});

test("keeps rejected and not-attempted addresses but drops sent and uncertain addresses", () => {
  const recipients = ["sent@example.com", "rejected@example.com", "uncertain@example.com", "later@example.com"]
    .map((recipientEmail) => ({ businessName: "your venue", recipientEmail }));
  const retryable = keepRetryablePastedRecipients(
    recipients,
    3,
    [recipients[1]!],
    null,
  );
  assert.deepEqual(retryable.map(({ recipientEmail }) => recipientEmail), [
    "rejected@example.com",
    "later@example.com",
  ]);
});

test("keeps a terminal address only when the server confirmed it was not sent", () => {
  const recipients = ["sent@example.com", "rejected@example.com", "blocked@example.com", "later@example.com"]
    .map((recipientEmail) => ({ businessName: "your venue", recipientEmail }));
  const retryable = keepRetryablePastedRecipients(
    recipients,
    3,
    [recipients[1]!],
    recipients[2]!,
  );
  assert.deepEqual(retryable.map(({ recipientEmail }) => recipientEmail), [
    "rejected@example.com",
    "blocked@example.com",
    "later@example.com",
  ]);
});
