import type { EventFeedItem } from "@workspace/api-client-react";
import { isPlanEvent } from "./eventFeedClassification";

export type EventMapPinCandidate = Pick<
  EventFeedItem,
  | "eventType"
  | "id"
  | "title"
  | "location"
  | "venueName"
  | "startsAt"
  | "endsAt"
  | "latitude"
  | "longitude"
  | "visibility"
  | "myRsvp"
  | "joinApprovalRequired"
  | "ownerUid"
  | "myJoinRequestStatus"
>;

export type EventMapPin = Omit<
  EventMapPinCandidate,
  "latitude" | "longitude"
> & {
  latitude: number;
  longitude: number;
};

export const DEFAULT_EVENT_MAP_DURATION_MS = 4 * 60 * 60 * 1000;
export const EVENT_MAP_START_WINDOW_MS = 2 * 60 * 60 * 1000;

function isActiveMapPin(
  event: EventMapPinCandidate,
  now: number,
  viewerUid?: string | null,
): event is EventMapPin {
  if (
    event.latitude == null ||
    event.longitude == null ||
    !Number.isFinite(event.latitude) ||
    !Number.isFinite(event.longitude)
  ) {
    return false;
  }

  const startsAt = Date.parse(event.startsAt);
  const endsAt = event.endsAt
    ? Date.parse(event.endsAt)
    : startsAt + DEFAULT_EVENT_MAP_DURATION_MS;

  const viewerIsGoing =
    event.myRsvp === "going" ||
    (viewerUid != null &&
      event.ownerUid === viewerUid &&
      isPlanEvent(event));

  return (
    viewerIsGoing &&
    Number.isFinite(startsAt) &&
    Number.isFinite(endsAt) &&
    startsAt - EVENT_MAP_START_WINDOW_MS <= now &&
    endsAt > now
  );
}

export function getCurrentEventMapPins(
  events: readonly EventMapPinCandidate[],
  now = Date.now(),
  viewerUid?: string | null,
): EventMapPin[] {
  return events.filter((event) => isActiveMapPin(event, now, viewerUid));
}
