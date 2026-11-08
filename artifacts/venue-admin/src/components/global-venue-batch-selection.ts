export const MAX_VENUE_OUTREACH_BATCH = 100;

type Prospect = { id: string; email: string; fitTier: string; outreachHoldReason?: string };
type HistoryEntry = {
  recipientEmail: string;
  deliveryStatus?: string;
  sentAt?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getConfirmedSentOutreachEmails(history: HistoryEntry[]): Set<string> {
  return new Set(
    history
      .filter((entry) => entry.deliveryStatus === "sent" || entry.sentAt != null)
      .map((entry) => normalizeEmail(entry.recipientEmail))
      .filter(Boolean),
  );
}

export function isManualProspectSelectionAllowed(
  prospect: Pick<Prospect, "email" | "outreachHoldReason">,
  sentEmails: ReadonlySet<string>,
  suppressedEmails: string[] | ReadonlySet<string> = [],
): boolean {
  const email = normalizeEmail(prospect.email);
  if (!email || prospect.outreachHoldReason?.trim()) return false;

  const isSuppressed = Array.isArray(suppressedEmails)
    ? new Set(suppressedEmails.map(normalizeEmail)).has(email)
    : suppressedEmails.has(email);
  return !isSuppressed && !sentEmails.has(email);
}

export function getNextTopFitVenueBatch<T extends Prospect>(
  prospects: T[],
  suppressedEmails: string[],
  history: HistoryEntry[],
  limit = MAX_VENUE_OUTREACH_BATCH,
): T[] {
  const suppressed = new Set(suppressedEmails.map(normalizeEmail));
  const contacted = new Set(history.map((entry) => normalizeEmail(entry.recipientEmail)));
  return prospects
    .filter((prospect) =>
      prospect.fitTier === "top" &&
      normalizeEmail(prospect.email).length > 0 &&
      !prospect.outreachHoldReason?.trim() &&
      !suppressed.has(normalizeEmail(prospect.email)) &&
      !contacted.has(normalizeEmail(prospect.email)),
    )
    .slice(0, Math.min(Math.max(0, limit), MAX_VENUE_OUTREACH_BATCH));
}

export function capVenueProspectSelection<T extends Prospect>(
  prospects: T[],
  requestedIds: Iterable<string>,
  limit = MAX_VENUE_OUTREACH_BATCH,
  history: HistoryEntry[] = [],
  suppressedEmails: string[] = [],
): T[] {
  const requested = new Set(requestedIds);
  const sentEmails = getConfirmedSentOutreachEmails(history);
  const suppressed = new Set(suppressedEmails.map(normalizeEmail));
  return prospects
    .filter((prospect) =>
      requested.has(prospect.id) &&
      isManualProspectSelectionAllowed(prospect, sentEmails, suppressed),
    )
    .slice(0, Math.min(Math.max(0, limit), MAX_VENUE_OUTREACH_BATCH));
}
