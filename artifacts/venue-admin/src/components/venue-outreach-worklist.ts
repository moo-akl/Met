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

export type WorklistSort = "venue" | "recent" | "status" | "agent" | "followup";
export function sortVenueGroups(groups: VenueGroup[], sort: WorklistSort): VenueGroup[] {
  return [...groups].sort((a, b) => {
    let primary = 0;
    if (sort === "venue") primary = a.latest.businessName.localeCompare(b.latest.businessName);
    if (sort === "recent") primary = new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime();
    if (sort === "status") primary = a.latest.deliveryStatus.localeCompare(b.latest.deliveryStatus);
    if (sort === "agent") {
      primary = (a.latest.assignedAgentName ?? "Unassigned").localeCompare(
        b.latest.assignedAgentName ?? "Unassigned",
      );
    }
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

export function isBulkEligible(
  group: VenueGroup,
  kind: VenueOutreachHistoryEntry["kind"],
  template?: string,
): boolean {
  const entry = group.latest;
  if (entry.kind !== kind || entry.deliveryStatus === "delivery_uncertain" || entry.deliveryStatus === "sending") return false;
  if (entry.kind === "manager_announcement") return false;
  if (entry.linkStatus === "used" && (entry.kind === "new_venue_outreach" || entry.kind === "registration_invite")) return false;
  if (entry.kind === "registration_invite") {
    return entry.venueOwnerProfileId != null &&
      entry.applicationStatus === "approved" &&
      (template == null || template === "registration" || template === "registration_with_video");
  }
  if (entry.kind === "contact_request") {
    return entry.venueOwnerProfileId != null && (template == null || template === "contact_request");
  }
  if (template === "preapproval_video_application") {
    return entry.venueOwnerProfileId == null && entry.applicationId == null;
  }
  return true;
}

export async function sendVenueBatch<T>(
  recipients: T[],
  send: (recipient: T) => Promise<void>,
  onProgress?: (progress: { completed: number; current: number; total: number }) => void,
): Promise<{ sentCount: number; failedCount: number; notAttemptedCount: number; error: unknown | null }> {
  let sentCount = 0;
  const batch = recipients.slice(0, 25);
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
