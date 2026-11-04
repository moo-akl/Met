import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ proxy: vi.fn() }));

vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    proxy = mocks.proxy;
  },
}));

import {
  matchGmailBounceToOutreach,
  parseGmailBounceMessage,
  readGmailDeliveryFailures,
  readGmailDeliveryFailureNoticesByIds,
  findGmailSentMessageByRfcMessageId,
  gmailSentMessageIdExists,
  readGmailSentMessageById,
  readGmailAccountEmail,
  type GmailBounceNotice,
  type OutreachBounceCandidate,
} from "./gmailBounceSync.js";

function asEncodedPart(mimeType: string, content: string) {
  return {
    mimeType,
    body: { data: Buffer.from(content, "utf8").toString("base64url") },
  };
}

function sampleMessage(action = "failed") {
  return {
    id: "bounce-gmail-id",
    threadId: "bounce-gmail-thread-id",
    internalDate: "1792400000000",
    payload: {
      mimeType: "multipart/report",
      parts: [
        asEncodedPart(
          "text/plain",
          [
            "Final-Recipient: rfc822; owner@example.com",
            `Action: ${action}`,
            "Status: 5.4.1",
            "Diagnostic-Code: smtp; 550 Recipient address rejected",
          ].join("\r\n"),
        ),
        asEncodedPart(
          "text/rfc822-headers",
          [
            "Date: Mon, 19 Oct 2026 03:28:09 -0500",
            "Message-ID: <invite-123@example.com>",
            "Subject: An invitation to discover Met.",
            "To: Venue Owner <owner@example.com>",
          ].join("\r\n"),
        ),
      ],
    },
  };
}

function sampleMessageWithId(id: string) {
  return { ...sampleMessage(), id };
}

const candidate = (
  id: number,
  gmailRfcMessageId: string | null = null,
  createdAt = new Date("2026-10-19T08:29:00.000Z"),
): OutreachBounceCandidate => ({
  id,
  businessName: `Venue ${id}`,
  recipientEmail: "OWNER@example.com",
  createdAt,
  gmailRfcMessageId,
});

describe("Gmail bounce parsing and matching", () => {
  beforeEach(() => {
    mocks.proxy.mockReset();
  });

  it("only searches and reads Gmail messages without making any write requests", async () => {
    mocks.proxy
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: "bounce-gmail-id" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sampleMessage(),
      });

    const result = await readGmailDeliveryFailures();

    expect(result).toMatchObject({ scannedCount: 1, truncated: false });
    expect(result.messages).toHaveLength(1);
    expect(mocks.proxy).toHaveBeenCalledTimes(2);

    const calls = mocks.proxy.mock.calls as Array<[string, string, { method?: string }?]>;
    expect(calls.map(([service]) => service)).toEqual(["google-mail", "google-mail"]);
    expect(calls.map(([, path]) => path)).toEqual([
      expect.stringMatching(/^\/gmail\/v1\/users\/me\/messages\?/),
      "/gmail/v1/users/me/messages/bounce-gmail-id?format=full",
    ]);
    for (const [, , options] of calls) {
      expect(options?.method ?? "GET").toBe("GET");
    }
  });

  it("follows Gmail page tokens and collects messages from every page", async () => {
    mocks.proxy.mockImplementation(async (_service: string, path: string) => {
      if (path.startsWith("/gmail/v1/users/me/messages?")) {
        const query = new URLSearchParams(path.split("?")[1]);
        if (!query.has("pageToken")) {
          return {
            ok: true,
            json: async () => ({
              messages: [{ id: "first-page-message" }],
              nextPageToken: "page-2-token",
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ messages: [{ id: "second-page-message" }] }),
        };
      }
      const id = path.split("/").at(-1)?.split("?")[0] ?? "";
      return { ok: true, json: async () => sampleMessageWithId(id) };
    });

    const result = await readGmailDeliveryFailures();

    expect(result).toMatchObject({ scannedCount: 2, truncated: false });
    expect(result.messages.map((message) => message.gmailMessageId)).toEqual([
      "first-page-message",
      "second-page-message",
    ]);
    const searchCalls = (mocks.proxy.mock.calls as Array<[string, string]>)
      .map(([, path]) => path)
      .filter((path) => path.startsWith("/gmail/v1/users/me/messages?"));
    expect(searchCalls).toHaveLength(2);
    expect(new URLSearchParams(searchCalls[0]!.split("?")[1]).get("pageToken")).toBeNull();
    expect(new URLSearchParams(searchCalls[1]!.split("?")[1]).get("pageToken"))
      .toBe("page-2-token");
  });

  it("retries a transient Gmail 503 and completes the sync", async () => {
    mocks.proxy
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: "bounce-gmail-id" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => sampleMessage(),
      });

    const result = await readGmailDeliveryFailures();

    expect(result).toMatchObject({ scannedCount: 1, truncated: false });
    expect(result.messages).toHaveLength(1);
    expect(mocks.proxy).toHaveBeenCalledTimes(3);
  });

  it("honors Gmail Retry-After before retrying a rate-limited request", async () => {
    vi.useFakeTimers();
    try {
      mocks.proxy
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ "retry-after": "2" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [] }),
        });

      const request = readGmailDeliveryFailures();
      await vi.advanceTimersByTimeAsync(1999);
      expect(mocks.proxy).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      await expect(request).resolves.toMatchObject({ scannedCount: 0, truncated: false });
      expect(mocks.proxy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports the Gmail operation and final status after retryable failures", async () => {
    mocks.proxy.mockResolvedValue({ ok: false, status: 503 });

    await expect(readGmailDeliveryFailures())
      .rejects.toThrow("Gmail search request failed with status 503 after 3 attempt(s).");
    expect(mocks.proxy).toHaveBeenCalledTimes(3);
  });

  it("does not retry Gmail authorization failures", async () => {
    mocks.proxy.mockResolvedValue({ ok: false, status: 403 });

    await expect(readGmailDeliveryFailures())
      .rejects.toThrow("Gmail search request failed with status 403 after 1 attempt(s).");
    expect(mocks.proxy).toHaveBeenCalledTimes(1);
  });

  it("reads no more than 1,000 messages and reports when the scan is truncated", async () => {
    const pageIds = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}` }));
    mocks.proxy.mockImplementation(async (_service: string, path: string) => {
      if (path.startsWith("/gmail/v1/users/me/messages?")) {
        const query = new URLSearchParams(path.split("?")[1]);
        const token = query.get("pageToken");
        const page = token ? Number(token) : 0;
        return {
          ok: true,
          json: async () => ({
            messages: pageIds(`page-${page}`, 100),
            nextPageToken: String(page + 1),
          }),
        };
      }
      const id = path.split("/").at(-1)?.split("?")[0] ?? "";
      return { ok: true, json: async () => sampleMessageWithId(id) };
    });

    const result = await readGmailDeliveryFailures();

    expect(result.scannedCount).toBe(1000);
    expect(result.messages).toHaveLength(1000);
    expect(result.truncated).toBe(true);
    const calls = (mocks.proxy.mock.calls as Array<[string, string]>).map(([, path]) => path);
    const searchCalls = calls.filter((path) =>
      path.startsWith("/gmail/v1/users/me/messages?"),
    );
    const searchQueries = searchCalls.map((path) =>
      new URLSearchParams(path.split("?")[1]),
    );
    expect(searchQueries).toHaveLength(10);
    expect(searchQueries.map((query) => query.get("maxResults"))).toEqual(Array(10).fill("100"));
    expect(searchQueries.map((query) => query.get("pageToken"))).toEqual([
      null,
      ...Array.from({ length: 9 }, (_, index) => String(index + 1)),
    ]);
    expect(calls.filter((path) => path.includes("?format=full"))).toHaveLength(1000);
  });

  it("parses Gmail's nested delivery-status attachment used by Address not found notices", () => {
    const base = sampleMessage();
    const [dsnPart, originalHeaders] = base.payload.parts;
    const nestedMessage = {
      ...base,
      payload: {
        mimeType: "multipart/report",
        parts: [
          {
            mimeType: "multipart/related",
            parts: [{
              mimeType: "multipart/alternative",
              parts: [
                asEncodedPart(
                  "text/plain",
                  "Address not found. Your message wasn't delivered because the domain could not be found.",
                ),
              ],
            }],
          },
          {
            mimeType: "message/delivery-status",
            parts: [dsnPart],
          },
          originalHeaders,
        ],
      },
    };

    expect(parseGmailBounceMessage(nestedMessage)).toMatchObject({
      recipientEmail: "owner@example.com",
      recipientCount: 1,
      originalMessageId: "invite-123@example.com",
      status: "5.4.1",
    });
  });

  it("revalidates specific bounce and Sent messages using read-only Gmail requests", async () => {
    const sentAt = new Date("2026-10-19T08:28:09.000Z");
    const requestPaths: string[] = [];
    mocks.proxy.mockImplementation(async (_service: string, path: string) => {
      requestPaths.push(path);
      if (path.includes("/messages?")) {
        const query = new URLSearchParams(path.split("?")[1] ?? "").get("q") ?? "";
        return {
          ok: true,
          json: async () => query.includes("stale") ? {} : { messages: [{ id: "sent-gmail-id" }] },
        };
      }
      if (path.includes("/messages/sent-gmail-id?")) {
        return {
          ok: true,
          json: async () => ({
            id: "sent-gmail-id",
            threadId: "sent-gmail-thread",
            payload: {
              headers: [
                { name: "Message-ID", value: "<invite-123@example.com>" },
                { name: "From", value: "Met Outreach <outreach@example.com>" },
                { name: "To", value: "Venue Owner <owner@example.com>" },
                { name: "Date", value: sentAt.toUTCString() },
              ],
            },
          }),
        };
      }
      if (path.includes("/messages/bounce-gmail-id?")) {
        return { ok: true, json: async () => sampleMessage() };
      }
      if (path.endsWith("/profile")) {
        return { ok: true, json: async () => ({ emailAddress: "outreach@example.com" }) };
      }
      throw new Error(`Unexpected Gmail request path: ${path}`);
    });

    const sent = await findGmailSentMessageByRfcMessageId("invite-123@example.com");
    expect(sent).toMatchObject({
      kind: "matched",
      message: {
        gmailMessageId: "sent-gmail-id",
        gmailThreadId: "sent-gmail-thread",
        rfcMessageId: "invite-123@example.com",
        from: ["outreach@example.com"],
        to: ["owner@example.com"],
        sentAt,
      },
    });
    expect(await gmailSentMessageIdExists("stale-message-id@example.test")).toBe(false);
    expect(await readGmailSentMessageById("sent-gmail-id")).toMatchObject({
      gmailMessageId: "sent-gmail-id",
      rfcMessageId: "invite-123@example.com",
      sentAt,
    });
    expect(await readGmailAccountEmail()).toBe("outreach@example.com");

    const notices = await readGmailDeliveryFailureNoticesByIds(["bounce-gmail-id"]);
    expect(notices.get("bounce-gmail-id")).toMatchObject({
      recipientEmail: "owner@example.com",
      originalMessageId: "invite-123@example.com",
    });
    expect(requestPaths.every((path) => path.startsWith("/gmail/v1/users/me/"))).toBe(true);
    expect(requestPaths.some((path) => path.includes("format=metadata"))).toBe(true);
    expect(requestPaths.some((path) => path.includes("format=full"))).toBe(true);
  });

  it("parses only confirmed failed DSNs and keeps original send identifiers", () => {
    const notice = parseGmailBounceMessage(sampleMessage());
    expect(notice).toMatchObject({
      gmailMessageId: "bounce-gmail-id",
      gmailThreadId: "bounce-gmail-thread-id",
      recipientEmail: "owner@example.com",
      recipientCount: 1,
      originalMessageId: "invite-123@example.com",
      originalSentAt: new Date("2026-10-19T08:28:09.000Z"),
      status: "5.4.1",
      reason: "550 Recipient address rejected",
    });
    expect(parseGmailBounceMessage(sampleMessage("delayed"))).toBeNull();
  });

  it("matches by exact RFC Message-ID before using a conservative legacy fallback", () => {
    const notice = parseGmailBounceMessage(sampleMessage())!;
    expect(matchGmailBounceToOutreach(notice, [
      candidate(1, "<invite-123@example.com>"),
      candidate(2, null),
    ])).toMatchObject({ kind: "matched", candidate: { id: 1 } });

    expect(matchGmailBounceToOutreach(notice, [
      candidate(2, null),
    ])).toMatchObject({ kind: "matched", candidate: { id: 2 } });
  });

  it("leaves ambiguous or nonmatching messages unmatched for manual review", () => {
    const notice = parseGmailBounceMessage(sampleMessage())!;
    const ambiguous = matchGmailBounceToOutreach(notice, [
      candidate(1),
      candidate(2),
    ]);
    expect(ambiguous).toMatchObject({ kind: "ambiguous", candidates: [{ id: 1 }, { id: 2 }] });
    expect(matchGmailBounceToOutreach(notice, [
      candidate(3, null, new Date("2026-10-19T10:00:00.000Z")),
    ])).toEqual({
      kind: "unmatched",
      reason: "no_eligible_send_candidate",
    });
  });

  it("returns a bounded matching reason for each unmatched-notice case", () => {
    const notice = parseGmailBounceMessage(sampleMessage())!;
    const noticeWithoutMessageId = { ...notice, originalMessageId: null };

    expect(matchGmailBounceToOutreach(noticeWithoutMessageId, [])).toEqual({
      kind: "unmatched",
      reason: "missing_original_message_id",
    });
    expect(matchGmailBounceToOutreach(notice, [])).toEqual({
      kind: "unmatched",
      reason: "no_eligible_send_candidate",
    });
    expect(matchGmailBounceToOutreach(notice, [
      { ...candidate(1, notice.originalMessageId), recipientEmail: "different@example.com" },
    ])).toEqual({
      kind: "unmatched",
      reason: "recipient_mismatch",
    });
    expect(matchGmailBounceToOutreach({ ...notice, recipientCount: 2 }, [])).toEqual({
      kind: "unmatched",
      reason: "multiple_recipients",
    });
  });

  it("does not match a DSN that refers to more than one original recipient", () => {
    const multiRecipientMessage = sampleMessage();
    multiRecipientMessage.payload.parts[1] = asEncodedPart(
      "text/rfc822-headers",
      [
        "Date: Mon, 19 Oct 2026 03:28:09 -0500",
        "Message-ID: <invite-123@example.com>",
        "To: owner@example.com, manager@example.com",
      ].join("\r\n"),
    );
    const notice = parseGmailBounceMessage(multiRecipientMessage) as GmailBounceNotice;
    expect(notice.recipientCount).toBe(2);
    expect(matchGmailBounceToOutreach(notice, [candidate(1)])).toEqual({
      kind: "unmatched",
      reason: "multiple_recipients",
    });
  });

  it("does not auto-match when the final recipient differs from the original To address", () => {
    const rewrittenRecipient = sampleMessage();
    rewrittenRecipient.payload.parts[0] = asEncodedPart(
      "text/plain",
      [
        "Final-Recipient: rfc822; rewritten@example.com",
        "Action: failed",
        "Status: 5.4.1",
      ].join("\r\n"),
    );
    const notice = parseGmailBounceMessage(rewrittenRecipient)!;
    expect(notice.recipientCount).toBe(2);
    expect(notice.recipientMismatch).toBe(true);
    expect(matchGmailBounceToOutreach(notice, [candidate(1)])).toEqual({
      kind: "unmatched",
      reason: "recipient_mismatch",
    });
  });
});
