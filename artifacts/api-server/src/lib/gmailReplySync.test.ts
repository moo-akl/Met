import { beforeEach, describe, expect, it, vi } from "vitest";
const { mockOpenAICompletionCreate } = vi.hoisted(() => ({
  mockOpenAICompletionCreate: vi.fn(),
}));
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: { completions: { create: mockOpenAICompletionCreate } },
  },
}));
import {
  classifyVenueOutreachReplyText,
  extractReplyTextFromGmailPayload,
  hasPotentialLegacyVenueOutreachTarget,
  hasPotentialVenueOutreachThreadRecoveryTarget,
  matchGmailReplyToLegacyVenueOutreach,
  matchGmailReplyToVenueOutreach,
  matchGmailReplyToVenueOutreachThread,
  shouldClassifyVenueOutreachReply,
  type GmailOutreachReplyMessage,
  type VenueOutreachReplyTarget,
} from "./gmailReplySync.js";
import type { GmailSentMessage } from "./gmailBounceSync.js";

const sentAt = new Date("2026-10-20T10:00:00.000Z");

beforeEach(() => {
  mockOpenAICompletionCreate.mockReset();
});

function target(overrides: Partial<VenueOutreachReplyTarget> = {}): VenueOutreachReplyTarget {
  return {
    id: 1,
    recipientEmail: "owner@example.com",
    sentAt,
    gmailRfcMessageId: "outreach-1@example.com",
    gmailThreadId: "thread-1",
    gmailReplyAt: null,
    gmailReplyMessageId: null,
    gmailReplyClassification: null,
    gmailReplyClassificationVersion: 1,
    ...overrides,
  };
}

function reply(overrides: Partial<GmailOutreachReplyMessage> = {}): GmailOutreachReplyMessage {
  return {
    id: "reply-1",
    threadId: "thread-1",
    internalDate: String(Date.parse("2026-10-21T10:00:00.000Z")),
    payload: {
      headers: [
        { name: "From", value: "Venue Owner <owner@example.com>" },
        { name: "To", value: "outreach@met-app.org" },
        { name: "In-Reply-To", value: "<outreach-1@example.com>" },
        { name: "References", value: "<outreach-1@example.com>" },
      ],
    },
    ...overrides,
  };
}

function sentMessage(overrides: Partial<GmailSentMessage> = {}): GmailSentMessage {
  return {
    gmailMessageId: "sent-gmail-1",
    gmailThreadId: "thread-1",
    rfcMessageId: "outreach-1@example.com",
    from: ["outreach@met-app.org"],
    to: ["owner@example.com"],
    sentAt,
    ...overrides,
  };
}

describe("matchGmailReplyToVenueOutreach", () => {
  it("matches a reply that references a tracked send from the exact recipient", () => {
    expect(matchGmailReplyToVenueOutreach(reply(), [target()])).toMatchObject({
      logId: 1,
      gmailMessageId: "reply-1",
      gmailThreadId: "thread-1",
      replyAt: new Date("2026-10-21T10:00:00.000Z"),
    });
  });

  it("accepts same-thread replies when the sender matches, even without reference headers", () => {
    const message = reply({
      payload: {
        headers: [{ name: "From", value: "owner@example.com" }],
      },
    });
    expect(matchGmailReplyToVenueOutreach(message, [target()])?.logId).toBe(1);
  });

  it("does not associate a message from a different sender, even if it references the send", () => {
    const message = reply({
      payload: {
        headers: [
          { name: "From", value: "other@example.com" },
          { name: "In-Reply-To", value: "<outreach-1@example.com>" },
        ],
      },
    });
    expect(matchGmailReplyToVenueOutreach(message, [target()])).toBeNull();
  });

  it("does not associate unrelated messages from the recipient", () => {
    const message = reply({
      threadId: "unrelated-thread",
      payload: { headers: [{ name: "From", value: "owner@example.com" }] },
    });
    expect(matchGmailReplyToVenueOutreach(message, [target()])).toBeNull();
  });

  it("does not treat a message sent before the tracked outreach as a reply", () => {
    const message = reply({
      internalDate: String(Date.parse("2026-10-19T10:00:00.000Z")),
    });
    expect(matchGmailReplyToVenueOutreach(message, [target()])).toBeNull();
  });

  it("uses the most recent tracked send in a thread before the reply", () => {
    const result = matchGmailReplyToVenueOutreach(reply({
      payload: { headers: [{ name: "From", value: "owner@example.com" }] },
    }), [
      target({ id: 1, sentAt: new Date("2026-10-20T10:00:00.000Z"), gmailRfcMessageId: null }),
      target({ id: 2, sentAt: new Date("2026-10-20T11:00:00.000Z"), gmailRfcMessageId: null }),
    ]);
    expect(result?.logId).toBe(2);
  });

  it("recovers a legacy send only from an exact Gmail Sent reference, recipient, and send time", () => {
    const legacyTarget = target({
      id: 22,
      gmailRfcMessageId: null,
      gmailThreadId: null,
    });
    const message = reply({
      payload: {
        headers: [
          { name: "From", value: "Venue Owner <owner@example.com>" },
          { name: "In-Reply-To", value: "<outreach-1@example.com>" },
        ],
      },
    });

    expect(hasPotentialLegacyVenueOutreachTarget(message, [legacyTarget])).toBe(true);
    expect(matchGmailReplyToLegacyVenueOutreach(message, [legacyTarget], sentMessage())).toMatchObject({
      logId: 22,
      gmailMessageId: "reply-1",
      gmailThreadId: "thread-1",
      originalRfcMessageId: "outreach-1@example.com",
      originalGmailThreadId: "thread-1",
    });
  });

  it("does not recover a legacy send when the sender or original recipient differs", () => {
    const legacyTarget = target({ gmailRfcMessageId: null, gmailThreadId: null });
    const referencedReply = reply({
      payload: {
        headers: [
          { name: "From", value: "other@example.com" },
          { name: "In-Reply-To", value: "<outreach-1@example.com>" },
        ],
      },
    });
    expect(matchGmailReplyToLegacyVenueOutreach(referencedReply, [legacyTarget], sentMessage())).toBeNull();
    expect(matchGmailReplyToLegacyVenueOutreach(
      reply(),
      [legacyTarget],
      sentMessage({ to: ["other@example.com"] }),
    )).toBeNull();
  });

  it("leaves legacy matches unmatched when send time is not close or is ambiguous", () => {
    const legacyTarget = target({ gmailRfcMessageId: null, gmailThreadId: null });
    const message = reply();
    expect(matchGmailReplyToLegacyVenueOutreach(
      message,
      [legacyTarget],
      sentMessage({ sentAt: new Date(sentAt.getTime() + 16 * 60_000) }),
    )).toBeNull();
    expect(matchGmailReplyToLegacyVenueOutreach(
      message,
      [legacyTarget, target({ id: 2, gmailRfcMessageId: null, gmailThreadId: null })],
      sentMessage(),
    )).toBeNull();
  });
});

describe("matchGmailReplyToVenueOutreachThread", () => {
  const legacyTarget = target({
    id: 33,
    gmailThreadId: null,
    gmailReplyAt: null,
  });
  const sentThreadMessage = (overrides: Partial<GmailOutreachReplyMessage> = {}) => ({
    id: "sent-gmail-1",
    threadId: "thread-1",
    internalDate: String(sentAt.getTime()),
    payload: {
      headers: [
        { name: "From", value: "outreach@met-app.org" },
        { name: "To", value: "owner@example.com" },
        { name: "Message-ID", value: "<outreach-1@example.com>" },
      ],
    },
    ...overrides,
  });

  it("recovers a send with no stored thread ID from unique Sent metadata", () => {
    const incomingReply = reply({
      payload: {
        headers: [{ name: "From", value: "owner@example.com" }],
      },
    });
    const threadMessages = [sentThreadMessage(), incomingReply];

    expect(hasPotentialVenueOutreachThreadRecoveryTarget(incomingReply, [legacyTarget])).toBe(true);
    expect(matchGmailReplyToVenueOutreachThread(
      incomingReply,
      [legacyTarget],
      threadMessages,
    )).toMatchObject({
      logId: 33,
      gmailMessageId: "reply-1",
      gmailThreadId: "thread-1",
      originalRfcMessageId: "outreach-1@example.com",
      originalGmailThreadId: "thread-1",
    });
  });

  it("does not recover a thread when the stored RFC ID differs", () => {
    const incomingReply = reply({
      payload: { headers: [{ name: "From", value: "owner@example.com" }] },
    });
    expect(matchGmailReplyToVenueOutreachThread(
      incomingReply,
      [legacyTarget],
      [
        sentThreadMessage({
          payload: {
            headers: [
              { name: "From", value: "outreach@met-app.org" },
              { name: "To", value: "owner@example.com" },
              { name: "Message-ID", value: "<different@example.com>" },
            ],
          },
        }),
        incomingReply,
      ],
    )).toBeNull();
  });

  it("does not recover an ambiguous thread or mismatched sender", () => {
    const incomingReply = reply({
      payload: { headers: [{ name: "From", value: "owner@example.com" }] },
    });
    expect(matchGmailReplyToVenueOutreachThread(
      incomingReply,
      [legacyTarget, target({ id: 34, gmailThreadId: null, gmailReplyAt: null })],
      [sentThreadMessage(), incomingReply],
    )).toBeNull();

    const wrongSender = reply({
      payload: { headers: [{ name: "From", value: "other@example.com" }] },
    });
    expect(matchGmailReplyToVenueOutreachThread(
      wrongSender,
      [legacyTarget],
      [sentThreadMessage(), wrongSender],
    )).toBeNull();
  });

  it("requires the reply itself to be present in the fetched Gmail thread", () => {
    const incomingReply = reply({
      payload: { headers: [{ name: "From", value: "owner@example.com" }] },
    });
    expect(matchGmailReplyToVenueOutreachThread(
      incomingReply,
      [legacyTarget],
      [sentThreadMessage()],
    )).toBeNull();
  });
});

describe("Gmail reply text and classification", () => {
  it("reclassifies existing other and uncertain replies only once", () => {
    expect(shouldClassifyVenueOutreachReply(target({
      gmailReplyAt: sentAt,
      gmailReplyMessageId: "reply-1",
      gmailReplyClassification: "other",
    }))).toBe(true);
    expect(shouldClassifyVenueOutreachReply(target({
      gmailReplyAt: sentAt,
      gmailReplyMessageId: "reply-2",
      gmailReplyClassification: "uncertain",
    }))).toBe(true);
    expect(shouldClassifyVenueOutreachReply(target({
      gmailReplyAt: sentAt,
      gmailReplyMessageId: "reply-3",
      gmailReplyClassification: "other",
      gmailReplyClassificationVersion: 2,
    }))).toBe(false);
    expect(shouldClassifyVenueOutreachReply(target({
      gmailReplyAt: sentAt,
      gmailReplyMessageId: "reply-4",
      gmailReplyClassification: "interested",
    }))).toBe(false);
  });

  it("extracts only the sender's plain-text response before quoted history", () => {
    const body = Buffer.from(
      "Yes, please send the details.\n\nOn Mon, Oct 20, 2026, Venue Admin wrote:\n> Original invitation",
    ).toString("base64url");
    expect(extractReplyTextFromGmailPayload({
      mimeType: "multipart/alternative",
      parts: [{ mimeType: "text/plain", body: { data: body } }],
    })).toBe("Yes, please send the details.");
  });

  it("falls back to readable HTML when a plain-text body is unavailable", () => {
    const body = Buffer.from("<p>Not interested.</p><blockquote>Original invitation</blockquote>").toString("base64url");
    expect(extractReplyTextFromGmailPayload({
      mimeType: "text/html",
      body: { data: body },
    })).toBe("Not interested.");
  });

  it("accepts only one of the supported AI classifications", async () => {
    mockOpenAICompletionCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"classification":"interested"}' } }],
    });
    await expect(classifyVenueOutreachReplyText("Please send the next steps.")).resolves.toBe("interested");
    expect(mockOpenAICompletionCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5.6-luna",
      response_format: { type: "json_object" },
    }));
    const systemPrompt = mockOpenAICompletionCreate.mock.calls[0]?.[0]?.messages[0]?.content as string;
    expect(systemPrompt).toContain("substantive questions about the offer");
    expect(systemPrompt).toContain("willingness to hear more");

    mockOpenAICompletionCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"classification":"maybe"}' } }],
    });
    await expect(classifyVenueOutreachReplyText("Maybe?")).rejects.toThrow("unsupported classification");
  });
});
