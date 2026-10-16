import type { VenueOutreachHistoryEntry } from "@workspace/api-client-react";

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

export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isFollowUpDue(group: VenueGroup, today = localToday()): boolean {
  return !!group.latest.nextActionDueDate && group.latest.nextActionDueDate <= today;
}

export type WorklistFilters = {
  search: string;
  view: "all" | "followup" | "attention";
  status: string;
  kind: string;
  link: string;
  application: string;
  agent: string;
  followUp: string;
  lastTemplate: string;
};

export const DEFAULT_WORKLIST_FILTERS: WorklistFilters = {
  search: "", view: "all", status: "all", kind: "all", link: "all",
  application: "all", agent: "all", followUp: "all", lastTemplate: "all",
};

export function filterVenueGroups(groups: VenueGroup[], filters: WorklistFilters, today = localToday()): VenueGroup[] {
  const query = filters.search.trim().toLowerCase();
  return groups.filter((group) => {
    const entry = group.latest;
    const sent = lastSuccessfulEmail(group);
    const application = venueApplication(group);
    const invitation = venueInvitation(group);
    const hasPlan = !!(entry.nextActionNote?.trim() || entry.nextActionDueDate);
    return (filters.view === "all" ||
      (filters.view === "followup" && isFollowUpDue(group, today)) ||
      (filters.view === "attention" && ["failed", "delivery_uncertain"].includes(entry.deliveryStatus))) &&
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
      (!query || [
        entry.assignedAgentName ?? (entry.assignedAgentId == null ? "unassigned" : `agent ${entry.assignedAgentId}`),
        entry.nextActionNote ?? "", entry.nextActionDueDate ?? "",
        ...group.events.flatMap((event) => [event.businessName, event.recipientEmail, event.template, event.applicationStatus ?? ""]),
      ].join(" ").toLowerCase().includes(query));
  });
}

export type WorklistSort = "venue" | "recent" | "followup";
export function sortVenueGroups(groups: VenueGroup[], sort: WorklistSort): VenueGroup[] {
  return [...groups].sort((a, b) => {
    let primary = 0;
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

export async function sendVenueBatch<T>(
  recipients: T[],
  send: (recipient: T) => Promise<void>,
  onProgress?: (progress: { completed: number; current: number; total: number }) => void,
  limit = Infinity,
): Promise<{ sentCount: number; failedCount: number; notAttemptedCount: number; error: unknown | null }> {
  let sentCount = 0;
  const batch = recipients.slice(0, limit);
  for (const [index, recipient] of batch.entries()) {
    onProgress?.({ completed: sentCount, current: index + 1, total: batch.length });
    try {
      await send(recipient);
      sentCount += 1;
    } catch (error) {
      return {
        sentCount,
        failedCount: 1,
        notAttemptedCount: recipients.length - sentCount - 1,
        error,
      };
    }
  }
  return { sentCount, failedCount: 0, notAttemptedCount: recipients.length - sentCount, error: null };
}
