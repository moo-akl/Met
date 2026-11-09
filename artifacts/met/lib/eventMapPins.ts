import type { EventFeedItem } from "@workspace/api-client-react";

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
  | "joinApprovalRequired"
>;

export type EventMapPin = Omit<
  EventMapPinCandidate,
  "latitude" | "longitude"
> & {
  latitude: number;
  longitude: number;
};

export const DEFAULT_EVENT_MAP_DURATION_MS = 4 * 60 * 60 * 1000;

function isActiveMapPin(
  event: EventMapPinCandidate,
  now: number,
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

  return Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt > now;
}

export function getCurrentEventMapPins(
  events: readonly EventMapPinCandidate[],
  now = Date.now(),
): EventMapPin[] {
  return events.filter((event) => isActiveMapPin(event, now));
}

