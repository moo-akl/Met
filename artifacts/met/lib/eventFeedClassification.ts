import type { EventFeedItem } from "@workspace/api-client-react";

/**
 * Personal plans include private gatherings and public hangout plans that
 * require host approval. Venue events and ordinary public events stay in Events.
 */
export function isPlanEvent(
  event: Pick<EventFeedItem, "eventType" | "visibility" | "joinApprovalRequired">,
): boolean {
  return event.eventType === "member" &&
    (event.visibility === "invite_only" || event.joinApprovalRequired);
}
