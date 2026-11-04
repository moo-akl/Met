import { ReplitConnectors } from "@replit/connectors-sdk";

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};
export type GmailBounceApiMessage = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};

export type GmailSentMessage = {
  gmailMessageId: string;
  gmailThreadId: string | null;
  rfcMessageId: string | null;
  from: string[];
  to: string[];
  sentAt: Date | null;
};

export type GmailBounceNotice = {
  gmailMessageId: string;
  gmailThreadId: string | null;
  recipientEmail: string;
  recipientCount: number;
  recipientMismatch: boolean;
  originalMessageId: string | null;
  originalSentAt: Date | null;
  receivedAt: Date | null;
  status: string | null;
  reason: string;
};

export type OutreachBounceCandidate = {
  id: number;
  businessName: string;
  recipientEmail: string;
  createdAt: Date;
  gmailRfcMessageId: string | null;
};

export type BounceCandidateMatch =
  | { kind: "matched"; candidate: OutreachBounceCandidate }
  | { kind: "ambiguous"; candidates: OutreachBounceCandidate[] }
  | {
      kind: "unmatched";
      reason:
        | "missing_original_message_id"
        | "no_eligible_send_candidate"
        | "recipient_mismatch"
        | "multiple_recipients";
    };

const MAX_MESSAGES_PER_SYNC = 1000;
const MAX_GMAIL_REQUEST_ATTEMPTS = 3;
const GMAIL_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const GMAIL_QUERY =
  'in:anywhere newer_than:730d {from:mailer-daemon from:postmaster} subject:"Delivery Status Notification"';

function gmailRetryDelayMs(response: Response, attempt: number): number {
  if (response.status !== 429) return 300 * 2 ** (attempt - 1);

  const retryAfter = response.headers?.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const retryAt = Number.isFinite(seconds)
      ? Date.now() + seconds * 1000
      : Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.min(60_000, Math.max(500, retryAt - Date.now()));
    }
  }

  return 1000 * 2 ** (attempt - 1);
}

async function gmailRequest(
  connectors: ReplitConnectors,
  path: string,
  operation: "search" | "read",
): Promise<Response> {
  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= MAX_GMAIL_REQUEST_ATTEMPTS; attempt += 1) {
    const response = await connectors.proxy("google-mail", path);
    if (response.ok) return response;
    lastStatus = response.status;
    if (
      !GMAIL_RETRYABLE_STATUSES.has(response.status) ||
      attempt === MAX_GMAIL_REQUEST_ATTEMPTS
    ) {
      throw new Error(
        `Gmail ${operation} request failed with status ${response.status} after ${attempt} attempt(s).`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, gmailRetryDelayMs(response, attempt)));
  }
  throw new Error(
    `Gmail ${operation} request failed${lastStatus ? ` with status ${lastStatus}` : ""}.`,
  );
}

async function searchGmailSentMessageIds(
  connectors: ReplitConnectors,
  rfcMessageId: string,
): Promise<string[]> {
  const normalizedId = normalizeMessageId(rfcMessageId);
  if (!normalizedId) return [];
  const query = new URLSearchParams({
    q: `in:sent rfc822msgid:${normalizedId}`,
    maxResults: "10",
  });
  const response = await gmailRequest(
    connectors,
    `/gmail/v1/users/me/messages?${query.toString()}`,
    "search",
  );
  const result = await response.json() as { messages?: Array<{ id?: string }> };
  return (result.messages ?? [])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

function parseGmailSentMessage(message: GmailBounceApiMessage): GmailSentMessage | null {
  if (!message.id) return null;
  const headers = new Map(
    (message.payload?.headers ?? []).map((header) => [
      header.name?.trim().toLowerCase() ?? "",
      header.value ?? "",
    ]),
  );
  return {
    gmailMessageId: message.id,
    gmailThreadId: message.threadId ?? null,
    rfcMessageId: normalizeMessageId(headers.get("message-id")),
    from: findEmailAddresses(headers.get("from")),
    to: findEmailAddresses(headers.get("to")),
    sentAt: parseDate(headers.get("date")),
  };
}

export async function readGmailDeliveryFailureNoticesByIds(
  messageIds: string[],
): Promise<Map<string, GmailBounceNotice>> {
  const connectors = new ReplitConnectors();
  const uniqueIds = [...new Set(messageIds)];
  const notices = new Map<string, GmailBounceNotice>();
  for (let offset = 0; offset < uniqueIds.length; offset += 3) {
    const batch = await Promise.all(uniqueIds.slice(offset, offset + 3).map(async (id) => {
      const response = await gmailRequest(
        connectors,
        `/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
        "read",
      );
      const message = await response.json() as GmailBounceApiMessage;
      return parseGmailBounceMessage(message);
    }));
    for (const notice of batch) {
      if (notice) notices.set(notice.gmailMessageId, notice);
    }
  }
  return notices;
}

export async function findGmailSentMessageByRfcMessageId(
  rfcMessageId: string,
): Promise<{ kind: "none" | "ambiguous" } | { kind: "matched"; message: GmailSentMessage }> {
  const connectors = new ReplitConnectors();
  const ids = await searchGmailSentMessageIds(connectors, rfcMessageId);
  if (ids.length === 0) return { kind: "none" };
  if (ids.length !== 1) return { kind: "ambiguous" };
  const response = await gmailRequest(
    connectors,
    `/gmail/v1/users/me/messages/${encodeURIComponent(ids[0]!)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date&metadataHeaders=Message-ID`,
    "read",
  );
  const message = parseGmailSentMessage(await response.json() as GmailBounceApiMessage);
  return message ? { kind: "matched", message } : { kind: "none" };
}

export async function gmailSentMessageIdExists(rfcMessageId: string): Promise<boolean> {
  const connectors = new ReplitConnectors();
  return (await searchGmailSentMessageIds(connectors, rfcMessageId)).length > 0;
}

export async function readGmailSentMessageById(
  gmailMessageId: string,
): Promise<GmailSentMessage | null> {
  const connectors = new ReplitConnectors();
  const response = await gmailRequest(
    connectors,
    `/gmail/v1/users/me/messages/${encodeURIComponent(gmailMessageId)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date&metadataHeaders=Message-ID`,
    "read",
  );
  return parseGmailSentMessage(await response.json() as GmailBounceApiMessage);
}

export async function readGmailAccountEmail(): Promise<string | null> {
  const connectors = new ReplitConnectors();
  const response = await gmailRequest(
    connectors,
    "/gmail/v1/users/me/profile",
    "read",
  );
  const profile = await response.json() as { emailAddress?: string };
  return profile.emailAddress?.trim().toLowerCase() || null;
}

function decodePart(part: GmailPart): string {
  if (!part.body?.data) return "";
  try {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function collectPlainText(part: GmailPart, output: string[]): void {
  if (part.mimeType?.toLowerCase() === "text/plain") {
    const text = decodePart(part);
    if (text) output.push(text);
  }
  for (const child of part.parts ?? []) collectPlainText(child, output);
}

function unfoldHeaders(source: string): Map<string, string> {
  const fields = new Map<string, string>();
  let activeName: string | null = null;
  for (const line of source.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && activeName) {
      fields.set(activeName, `${fields.get(activeName) ?? ""} ${line.trim()}`.trim());
      continue;
    }
    const field = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/);
    if (!field) {
      activeName = null;
      continue;
    }
    activeName = field[1]!.toLowerCase();
    fields.set(activeName, field[2]!.trim());
  }
  return fields;
}

function findEmailAddresses(value: string | undefined): string[] {
  if (!value) return [];
  return [...value.matchAll(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
    .map((match) => match[0]!.toLowerCase());
}

function normalizeMessageId(value: string | undefined): string | null {
  const normalized = value?.trim().replace(/^<|>$/g, "").trim().toLowerCase();
  return normalized || null;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function cleanDiagnostic(value: string | undefined): string {
  return (value ?? "")
    .replace(/^[^;]+;\s*/, "")
    .replace(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[address]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export function parseGmailBounceMessage(
  message: GmailBounceApiMessage,
): GmailBounceNotice | null {
  if (!message.id || !message.payload) return null;

  const textParts: string[] = [];
  collectPlainText(message.payload, textParts);
  const dsnText = textParts.join("\n");
  const dsn = unfoldHeaders(dsnText);
  if (dsn.get("action")?.toLowerCase() !== "failed") return null;

  const recipientValues = dsn.get("final-recipient") ?? dsn.get("original-recipient");
  const recipientEmails = findEmailAddresses(recipientValues);
  if (recipientEmails.length === 0) return null;

  const originalHeaderPart = findOriginalHeadersPart(message.payload);
  const originalHeaders = unfoldHeaders(originalHeaderPart);
  const originalRecipients = findEmailAddresses(originalHeaders.get("to"));
  const finalRecipientCount =
    (dsnText.match(/^\s*Final-Recipient:/gim) ?? []).length ||
    (dsnText.match(/^\s*Original-Recipient:/gim) ?? []).length ||
    1;
  const recipientMismatch = originalRecipients.length === 1 &&
    originalRecipients[0] !== recipientEmails[0];
  const receivedAt = message.internalDate && Number.isFinite(Number(message.internalDate))
    ? new Date(Number(message.internalDate))
    : null;

  return {
    gmailMessageId: message.id,
    gmailThreadId: message.threadId ?? null,
    recipientEmail: recipientEmails[0]!,
    recipientMismatch,
    originalMessageId: normalizeMessageId(originalHeaders.get("message-id")),
    originalSentAt: parseDate(originalHeaders.get("date")),
    receivedAt: receivedAt && Number.isFinite(receivedAt.getTime())
      ? receivedAt
      : null,
    status: dsn.get("status")?.trim() || null,
    reason: cleanDiagnostic(dsn.get("diagnostic-code")),
    // A report with multiple original recipients must be reviewed manually.
    recipientCount: Math.max(
      finalRecipientCount,
      originalRecipients.length,
      recipientMismatch ? 2 : 1,
    ),
  };
}

function findOriginalHeadersPart(part: GmailPart): string {
  if (part.mimeType?.toLowerCase() === "text/rfc822-headers") return decodePart(part);
  for (const child of part.parts ?? []) {
    const found = findOriginalHeadersPart(child);
    if (found) return found;
  }
  return "";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function matchGmailBounceToOutreach(
  notice: GmailBounceNotice,
  candidates: OutreachBounceCandidate[],
): BounceCandidateMatch {
  if (notice.recipientMismatch) {
    return { kind: "unmatched", reason: "recipient_mismatch" };
  }
  if (notice.recipientCount !== 1) {
    return { kind: "unmatched", reason: "multiple_recipients" };
  }
  const recipient = normalizeEmail(notice.recipientEmail);
  const messageId = normalizeMessageId(notice.originalMessageId ?? undefined);
  if (messageId) {
    const sameMessageId = candidates.filter((candidate) =>
      normalizeMessageId(candidate.gmailRfcMessageId ?? undefined) === messageId,
    );
    const exact = sameMessageId.filter((candidate) =>
      normalizeEmail(candidate.recipientEmail) === recipient,
    );
    if (exact.length === 1) return { kind: "matched", candidate: exact[0]! };
    if (exact.length > 1) return { kind: "ambiguous", candidates: exact };
    if (sameMessageId.length > 0) {
      return { kind: "unmatched", reason: "recipient_mismatch" };
    }
  }

  if (!notice.originalSentAt) {
    return {
      kind: "unmatched",
      reason: messageId ? "no_eligible_send_candidate" : "missing_original_message_id",
    };
  }
  const legacyCandidates = candidates.filter((candidate) => {
    if (candidate.gmailRfcMessageId) return false;
    if (normalizeEmail(candidate.recipientEmail) !== recipient) return false;
    return Math.abs(candidate.createdAt.getTime() - notice.originalSentAt!.getTime()) <= 15 * 60_000;
  });
  if (legacyCandidates.length === 1) {
    return { kind: "matched", candidate: legacyCandidates[0]! };
  }
  if (legacyCandidates.length > 1) {
    return { kind: "ambiguous", candidates: legacyCandidates };
  }
  return {
    kind: "unmatched",
    reason: messageId ? "no_eligible_send_candidate" : "missing_original_message_id",
  };
}

export async function readGmailDeliveryFailures(): Promise<{
  messages: GmailBounceNotice[];
  scannedCount: number;
  truncated: boolean;
}> {
  const connectors = new ReplitConnectors();
  const ids: string[] = [];
  let pageToken: string | undefined;
  let truncated = false;

  do {
    const remaining = MAX_MESSAGES_PER_SYNC - ids.length;
    const query = new URLSearchParams({
      q: GMAIL_QUERY,
      maxResults: String(Math.min(100, remaining)),
    });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await gmailRequest(
      connectors,
      `/gmail/v1/users/me/messages?${query.toString()}`,
      "search",
    );
    const page = await response.json() as {
      messages?: Array<{ id?: string }>;
      nextPageToken?: string;
    };
    const pageIds = (page.messages ?? []).map((item) => item.id).filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    ids.push(...pageIds.slice(0, remaining));
    pageToken = page.nextPageToken;
    if (
      pageIds.length > remaining ||
      (pageToken && ids.length >= MAX_MESSAGES_PER_SYNC)
    ) {
      truncated = true;
      break;
    }
  } while (pageToken);

  const messages: GmailBounceNotice[] = [];
  // Keep mailbox scans bounded while avoiding a long chain of sequential Gmail round trips.
  for (let offset = 0; offset < ids.length; offset += 10) {
    const batch = await Promise.all(ids.slice(offset, offset + 10).map(async (id) => {
      const response = await gmailRequest(
        connectors,
        `/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
        "read",
      );
      const message = await response.json() as GmailBounceApiMessage;
      return parseGmailBounceMessage(message);
    }));
    messages.push(...batch.filter((notice): notice is GmailBounceNotice => notice !== null));
  }
  return { messages, scannedCount: ids.length, truncated };
}
