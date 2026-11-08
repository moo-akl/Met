import type { VenueOutreachHistoryEntry } from "@workspace/api-client-react";
import {
  GLOBAL_VENUE_PROSPECTS,
  type GlobalVenueProspect,
} from "./globalVenueProspects";
import {
  createDefaultVenueIntroCopy,
  type VenueIntroProfileCopy,
} from "./venue-intro-profile-copy";
import { MAX_VENUE_OUTREACH_BATCH } from "./global-venue-batch-selection";
import {
  dedupeVenueHistory,
  hasConfirmedReply,
  lastSuccessfulEmail,
} from "./venue-outreach-worklist";

export const NO_REPLY_TEMPLATE_ID = "venue_no_reply_follow_up";

const GENERIC_VENUE_NAMES = new Set(["your venue", "your venue name"]);

// The admin confirmed these recipients replied in Gmail. Keep them out of this
// campaign even when the Gmail reply cannot be matched to an outreach log.
const ADMIN_CONFIRMED_REPLIED_EMAILS = new Set([
  "megan.silverman@greatbiggameshow.co",
  "josh@fablecocktailbar.capetown",
  "enquiries@hardrockcafe-kualalumpur.com",
  "lauren.hidayat@hardrockcafe-bali.com",
  "office@pogmahones.co.nz",
  "marketing@coupletcoffee.com",
]);

function normalizeVenueName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function uniqueVerifiedProspectForEmail(email: string): GlobalVenueProspect | null {
  const matches = GLOBAL_VENUE_PROSPECTS.filter((prospect) =>
    prospect.email.trim().toLowerCase() === email &&
    Boolean(prospect.name.trim() && prospect.websiteUrl.trim() && prospect.emailEvidenceUrl.trim()),
  );
  const byName = new Map(
    matches.map((prospect) => [normalizeVenueName(prospect.name), prospect]),
  );
  return byName.size === 1 ? [...byName.values()][0] ?? null : null;
}

export type VenueNoReplyCampaignDraft = GlobalVenueProspect & {
  selected: boolean;
  pdfCopy: VenueIntroProfileCopy;
  placeId?: string;
  venueOwnerProfileId?: number;
  sourceGroupKey?: string;
  attemptedInSession?: boolean;
};

export function makeNoReplyDrafts(
  history: VenueOutreachHistoryEntry[],
  suppressedEmails: string[],
): VenueNoReplyCampaignDraft[] {
  const suppressed = new Set(
    suppressedEmails.map((email) => email.trim().toLowerCase()),
  );
  let initialSelectionCount = 0;

  return dedupeVenueHistory(history).flatMap((group) => {
    const hasAdminConfirmedReply = group.events.some((event) =>
      ADMIN_CONFIRMED_REPLIED_EMAILS.has(event.recipientEmail.trim().toLowerCase()),
    );
    const sent = lastSuccessfulEmail(group);
    if (!sent || hasConfirmedReply(group) || hasAdminConfirmedReply) return [];

    const alreadyFollowedUp = group.events.some((event) =>
      event.template === NO_REPLY_TEMPLATE_ID &&
      ["sent", "sending", "delivery_uncertain", "bounced"].includes(event.deliveryStatus),
    );
    const lastSuccessfulAt = Date.parse(sent.sentAt ?? sent.createdAt) || 0;
    const newerUnconfirmedOrBounced = group.events.some((event) => {
      const eventAt = Date.parse(event.createdAt) || 0;
      return eventAt >= lastSuccessfulAt &&
        ["sending", "delivery_uncertain", "bounced"].includes(event.deliveryStatus);
    });
    if (
      alreadyFollowedUp ||
      newerUnconfirmedOrBounced ||
      !sent.recipientEmail.trim().includes("@")
    ) {
      return [];
    }

    const normalizedName = normalizeVenueName(sent.businessName);
    const normalizedEmail = sent.recipientEmail.trim().toLowerCase();
    const isGenericName = GENERIC_VENUE_NAMES.has(normalizedName);
    const verifiedEmailMatch = isGenericName
      ? uniqueVerifiedProspectForEmail(normalizedEmail)
      : null;
    if (isGenericName && !verifiedEmailMatch) return [];
    const source = verifiedEmailMatch ?? GLOBAL_VENUE_PROSPECTS.find((prospect) =>
      normalizeVenueName(prospect.name) === normalizedName &&
      prospect.email.trim().toLowerCase() === normalizedEmail,
    );
    const venueName = verifiedEmailMatch?.name ?? sent.businessName;
    const pdfCopy = createDefaultVenueIntroCopy({
      venueName,
      pdfDisplayName: source?.pdfDisplayName,
      venueCategory: source?.category ?? "",
      venueLocation: source?.location ?? "",
      coverCopy: "",
      pdfHook: source?.pdfHook,
    });
    const selected = !suppressed.has(normalizedEmail) &&
      initialSelectionCount < MAX_VENUE_OUTREACH_BATCH;
    if (selected) initialSelectionCount += 1;

    return [{
      id: `no-reply-${sent.id}`,
      name: venueName,
      location: source?.location ?? "",
      category: source?.category ?? "",
      email: sent.recipientEmail,
      websiteUrl: source?.websiteUrl ?? "",
      emailEvidenceUrl: source?.emailEvidenceUrl ?? "",
      emailEvidenceQuote: source?.emailEvidenceQuote ?? "",
      fitEvidenceUrl: source?.fitEvidenceUrl,
      fitEvidenceQuote: source?.fitEvidenceQuote,
      fitTier: source?.fitTier ?? "strong",
      fitRank: source?.fitRank,
      region: source?.region,
      fitReason: "",
      pdfHook: source?.pdfHook,
      pdfHookSourceUrl: source?.pdfHookSourceUrl,
      pdfHookEvidenceQuote: source?.pdfHookEvidenceQuote,
      selected,
      pdfCopy,
      placeId: sent.placeId ?? group.latest.placeId ?? undefined,
      venueOwnerProfileId: sent.venueOwnerProfileId ?? group.latest.venueOwnerProfileId ?? undefined,
      sourceGroupKey: group.key,
      attemptedInSession: false,
    }];
  });
}
