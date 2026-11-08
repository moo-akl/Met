import type {
  VenueOutreachHistoryEntry,
  VenueOutreachManualReplyEvent,
} from "@workspace/api-client-react";

export type VenueGroup = {
  key: string;
  events: VenueOutreachHistoryEntry[];
  latest: VenueOutreachHistoryEntry;
};

export function venueGroupKey(entry: VenueOutreachHistoryEntry): string {
  const placeId = entry.placeId?.trim();
  if (placeId) return `place:${placeId}`;
  if (entry.venueOwnerProfileId != null) return `profile:${entry.venueOwnerProfileId}`;
  const business = entry.businessName.trim().toLowerCase().replace(/\s+/g, " ");
  const email = entry.recipientEmail.trim().toLowerCase();
  if (business && email.includes("@")) return `prospect:${business}|${email}`;
  return `event:${entry.id}`;
}

export function dedupeVenueHistory(entries: VenueOutreachHistoryEntry[]): VenueGroup[] {
  const groups = new Map<string, VenueOutreachHistoryEntry[]>();
  for (const entry of entries) {
    const key = venueGroupKey(entry);
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return Array.from(groups, ([key, events]) => {
    events.sort((a, b) => {
      const dateOrder = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return dateOrder || a.id.localeCompare(b.id);
    });
    return { key, events, latest: events[0] };
  });
}

export function lastSuccessfulEmail(group: VenueGroup): VenueOutreachHistoryEntry | null {
  return group.events.filter((event) => event.deliveryStatus === "sent")
    .sort((a, b) => sentTime(b) - sentTime(a) || a.id.localeCompare(b.id))[0] ?? null;
}

function sentTime(event: VenueOutreachHistoryEntry | null): number {
  if (!event) return 0;
  return Date.parse(event.sentAt ?? event.createdAt) || Date.parse(event.createdAt) || 0;
}

export function venueApplication(group: VenueGroup): VenueOutreachHistoryEntry | null {
  return group.events.find((event) => event.applicationId != null || event.applicationStatus != null) ?? null;
}

export function venueInvitation(group: VenueGroup): VenueOutreachHistoryEntry | null {
  return group.events.find((event) => event.linkStatus !== "none") ?? null;
}

const ACTIVE_APPLICATION_STATUSES = new Set([
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
  "resubmitted",
  "approved",
]);

export function hasApplicationOrRegistrationInProgress(group: VenueGroup): boolean {
  return group.events.some((event) => {
    const status = event.applicationStatus?.trim().toLowerCase();
    const applicationIsActive = event.applicationId != null &&
      (!status || ACTIVE_APPLICATION_STATUSES.has(status));
    const registrationIsActive = event.linkStatus === "active" || event.linkStatus === "used";
    return applicationIsActive || registrationIsActive;
  });
}

export function hasPersonalizedApproach(group: VenueGroup): boolean {
  return group.events.some((event) =>
    event.template === "global_venue_prospect" &&
    event.deliveryStatus === "sent",
  );
}

export function isActiveOutreachGroup(group: VenueGroup): boolean {
  return hasApplicationOrRegistrationInProgress(group) || hasPersonalizedApproach(group);
}

export function latestGmailReply(group: VenueGroup): VenueOutreachHistoryEntry | null {
  return group.events
    .filter((event) => Boolean(event.gmailRepliedAt))
    .sort((a, b) =>
      Date.parse(b.gmailRepliedAt ?? "") - Date.parse(a.gmailRepliedAt ?? "") ||
      a.id.localeCompare(b.id),
    )[0] ?? null;
}

export function manualReplyHistory(group: VenueGroup): VenueOutreachManualReplyEvent[] {
  const eventsById = new Map<string, VenueOutreachManualReplyEvent>();
  for (const entry of group.events) {
    for (const event of entry.manualReplyEvents ?? []) eventsById.set(event.id, event);
  }
  return [...eventsById.values()].sort((a, b) =>
    Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
    Number(a.id) - Number(b.id),
  );
}

export function latestManualReplyEvent(group: VenueGroup): VenueOutreachManualReplyEvent | null {
  const history = manualReplyHistory(group);
  return history[history.length - 1] ?? null;
}

export function hasManualReplyConfirmation(group: VenueGroup): boolean {
  return latestManualReplyEvent(group)?.action === "mark_replied";
}

export function hasConfirmedReply(group: VenueGroup): boolean {
  return latestGmailReply(group) !== null || hasManualReplyConfirmation(group);
}

export function latestConfirmedReplyAt(group: VenueGroup): string | null {
  const latestGmailReplyAt = latestGmailReply(group)?.gmailRepliedAt ?? null;
  const latestManualReply = latestManualReplyEvent(group);
  const latestManualReplyAt = latestManualReply?.action === "mark_replied"
    ? latestManualReply.createdAt
    : null;
  return [latestGmailReplyAt, latestManualReplyAt]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isFollowUpDue(group: VenueGroup, today = localToday()): boolean {
  return !!group.latest.nextActionDueDate && group.latest.nextActionDueDate <= today;
}

export type WorklistFilters = {
  search: string;
  view: "worklist" | "archived" | "all" | "replied" | "interested" | "rejected" | "no_reply" | "followup" | "attention" | "failed";
  status: string;
  kind: string;
  link: string;
  application: string;
  agent: string;
  followUp: string;
  lastTemplate: string;
  manualInterest: string;
};

export const DEFAULT_WORKLIST_FILTERS: WorklistFilters = {
  search: "", view: "worklist", status: "all", kind: "all", link: "all",
  application: "all", agent: "all", followUp: "all", lastTemplate: "all", manualInterest: "all",
};

export function filterVenueGroups(groups: VenueGroup[], filters: WorklistFilters, today = localToday()): VenueGroup[] {
  const query = filters.search.trim().toLowerCase();
  return groups.filter((group) => {
    const entry = group.latest;
    const sent = lastSuccessfulEmail(group);
    const reply = latestGmailReply(group);
    const confirmedReply = hasConfirmedReply(group);
    const application = venueApplication(group);
    const invitation = venueInvitation(group);
    const hasPlan = !!(entry.nextActionNote?.trim() || entry.nextActionDueDate);
    const hasFailedAttempt = group.events.some((event) =>
      event.deliveryStatus === "failed" || event.deliveryStatus === "bounced",
    );
    return (filters.view === "all" ||
      (filters.view === "worklist" && isActiveOutreachGroup(group)) ||
      (filters.view === "archived" && !isActiveOutreachGroup(group)) ||
      (filters.view === "replied" && confirmedReply) ||
      (filters.view === "interested" && reply?.gmailReplyClassification === "interested") ||
      (filters.view === "rejected" && reply?.gmailReplyClassification === "rejected") ||
      (filters.view === "no_reply" && sent !== null && !confirmedReply) ||
      (filters.view === "followup" && isFollowUpDue(group, today)) ||
      (filters.view === "attention" && group.events.some((event) =>
        ["failed", "delivery_uncertain", "bounced"].includes(event.deliveryStatus),
      )) ||
      (filters.view === "failed" && hasFailedAttempt)) &&
      (filters.status === "all" || entry.deliveryStatus === filters.status) &&
      (filters.kind === "all" || group.events.some((event) => event.kind === filters.kind)) &&
      (filters.link === "all" || (invitation?.linkStatus ?? "none") === filters.link) &&
      (filters.application === "all" ||
        (filters.application === "linked" && application?.applicationId != null) ||
        (filters.application === "unlinked" && application?.applicationId == null) ||
        (filters.application === "approved" && application?.applicationStatus === "approved")) &&
      (filters.agent === "all" ||
        (filters.agent === "assigned" && entry.assignedAgentId != null) ||
        (filters.agent === "unassigned" && entry.assignedAgentId == null)) &&
      (filters.followUp === "all" ||
        (filters.followUp === "scheduled" && hasPlan) ||
        (filters.followUp === "unscheduled" && !hasPlan)) &&
      (filters.lastTemplate === "all" ||
        (filters.lastTemplate === "none" ? !sent : sent?.template === filters.lastTemplate)) &&
      (filters.manualInterest === "all" ||
        (filters.manualInterest === "unclassified" && !entry.manualInterestLevel) ||
        entry.manualInterestLevel === filters.manualInterest) &&
      (!query || [
        entry.assignedAgentName ?? (entry.assignedAgentId == null ? "unassigned" : `agent ${entry.assignedAgentId}`),
        entry.nextActionNote ?? "", entry.nextActionDueDate ?? "",
        ...group.events.flatMap((event) => [event.businessName, event.recipientEmail, event.template, event.applicationStatus ?? ""]),
      ].join(" ").toLowerCase().includes(query));
  });
}

export type WorklistSort = "replied" | "venue" | "recent" | "followup";
export function sortVenueGroups(groups: VenueGroup[], sort: WorklistSort): VenueGroup[] {
  return [...groups].sort((a, b) => {
    let primary = 0;
    if (sort === "replied") {
      const aReply = latestConfirmedReplyAt(a);
      const bReply = latestConfirmedReplyAt(b);
      primary = Number(bReply !== null) - Number(aReply !== null);
      if (primary === 0 && aReply && bReply) {
        primary = Date.parse(bReply) - Date.parse(aReply);
      }
      if (primary === 0) {
        primary = sentTime(lastSuccessfulEmail(b)) - sentTime(lastSuccessfulEmail(a));
      }
    }
    if (sort === "venue") primary = a.latest.businessName.localeCompare(b.latest.businessName);
    if (sort === "recent") primary = sentTime(lastSuccessfulEmail(b)) - sentTime(lastSuccessfulEmail(a));
    if (sort === "followup") {
      const aDate = a.latest.nextActionDueDate;
      const bDate = b.latest.nextActionDueDate;
      primary = aDate && bDate ? aDate.localeCompare(bDate) : aDate ? -1 : bDate ? 1 : 0;
      if (primary === 0) {
        const aHasPlan = Boolean(a.latest.nextActionNote?.trim() || aDate);
        const bHasPlan = Boolean(b.latest.nextActionNote?.trim() || bDate);
        primary = Number(bHasPlan) - Number(aHasPlan);
      }
    }
    return primary || a.latest.businessName.localeCompare(b.latest.businessName) || a.key.localeCompare(b.key);
  });
}

export function dedupeRecipientEmails(groups: VenueGroup[]): VenueGroup[] {
  const seen = new Set<string>();
  return groups.filter((group) => {
    const email = group.latest.recipientEmail.trim().toLowerCase();
    if (seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

function getHttpErrorStatus(error: unknown): number | null {
  if (!error || (typeof error !== "object" && typeof error !== "string")) return null;
  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" ? value as Record<string, unknown> : null;
  const root = asRecord(error);
  const response = asRecord(root?.response);
  const cause = asRecord(root?.cause);
  const rootData = asRecord(root?.data);
  const responseData = asRecord(response?.data);
  const causeData = asRecord(cause?.data);
  const nestedResponse = asRecord(cause?.response);
  const providerMessages = [
    rootData?.message,
    responseData?.message,
    causeData?.message,
    root?.message,
    response?.message,
    cause?.message,
  ];
  for (const candidate of providerMessages) {
    if (typeof candidate !== "string") continue;
    const providerMatch = candidate.match(
      /\bGmail\b[^\n]{0,160}?\b(?:HTTP(?:\/\d(?:\.\d)?)?\s+|status(?:\s+code)?\s*[:=]?\s*)(\d{3})\b/i,
    );
    if (providerMatch) return Number(providerMatch[1]);
  }
  const candidates = [
    rootData?.gmailStatus,
    responseData?.gmailStatus,
    causeData?.gmailStatus,
    root?.status,
    root?.statusCode,
    response?.status,
    response?.statusCode,
    cause?.status,
    cause?.statusCode,
    nestedResponse?.status,
    nestedResponse?.statusCode,
  ];
  for (const candidate of candidates) {
    const status = typeof candidate === "number"
      ? candidate
      : typeof candidate === "string" && /^\d{3}$/.test(candidate)
        ? Number(candidate)
        : null;
    if (status !== null && status >= 100 && status <= 599) return status;
  }

  const message = typeof error === "string"
    ? error
    : typeof root?.message === "string"
      ? root.message
      : "";
  const match = message.match(/\b(?:HTTP(?:\/\d(?:\.\d)?)?\s+|status(?:\s+code)?\s*[:=]?\s*)(\d{3})\b/i);
  return match ? Number(match[1]) : null;
}

export function getVenueSendErrorMessage(error: unknown): string {
  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" ? value as Record<string, unknown> : null;
  const root = asRecord(error);
  const response = asRecord(root?.response);
  const cause = asRecord(root?.cause);
  for (const data of [root?.data, response?.data, cause?.data]) {
    const message = asRecord(data)?.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return error instanceof Error ? error.message : "The server rejected the request.";
}

export function isConfirmedVenueSendFailure(error: unknown): boolean {
  const status = getHttpErrorStatus(error);
  const message = getVenueSendErrorMessage(error);
  if (status !== null && status >= 400 && status < 500 && status !== 408) return true;
  return status === 503 && /email was not sent|marked failed/i.test(message);
}

export function shouldContinueVenueBatchAfterFailure(error: unknown): boolean {
  const status = getHttpErrorStatus(error);
  const message = getVenueSendErrorMessage(error);
  if (status === 400 && /template was removed/i.test(message)) return false;
  return status === 400 || status === 409 || status === 413 || status === 422 ||
    (status === 503 && /email was not sent|marked failed/i.test(message));
}

export function shouldContinueGlobalVenueProspectBatchAfterFailure(error: unknown): boolean {
  const status = getHttpErrorStatus(error);
  const message = getVenueSendErrorMessage(error);
  if (status === 400 && /template was removed/i.test(message)) return false;
  if (status === 401 || status === 403 || status === 428 || status === 429) return false;
  if (/admin session (?:has )?expired|admin sessions are not enabled/i.test(message)) return false;
  return true;
}

export type VenueBatchContinuedFailure<T> = { recipient: T; error: unknown };

export async function sendVenueBatch<T>(
  recipients: T[],
  send: (recipient: T) => Promise<void>,
  onProgress?: (progress: { completed: number; current: number; total: number }) => void,
  limit = Infinity,
  continueAfterError?: (error: unknown, recipient: T) => boolean,
): Promise<{
  sentCount: number;
  failedCount: number;
  notAttemptedCount: number;
  error: unknown | null;
  continuedFailures: VenueBatchContinuedFailure<T>[];
}> {
  let sentCount = 0;
  const continuedFailures: VenueBatchContinuedFailure<T>[] = [];
  const batch = recipients.slice(0, limit);
  for (const [index, recipient] of batch.entries()) {
    onProgress?.({ completed: sentCount + continuedFailures.length, current: index + 1, total: batch.length });
    try {
      await send(recipient);
      sentCount += 1;
    } catch (error) {
      if (continueAfterError?.(error, recipient)) {
        continuedFailures.push({ recipient, error });
        continue;
      }
      return {
        sentCount,
        failedCount: continuedFailures.length + 1,
        notAttemptedCount: recipients.length - sentCount - continuedFailures.length - 1,
        error,
        continuedFailures,
      };
    }
  }
  return {
    sentCount,
    failedCount: continuedFailures.length,
    notAttemptedCount: recipients.length - sentCount - continuedFailures.length,
    error: null,
    continuedFailures,
  };
}
