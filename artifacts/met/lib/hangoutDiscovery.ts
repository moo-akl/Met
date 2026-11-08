import type { EventFeedItem } from "@workspace/api-client-react";

export type HangoutTimePeriod =
  | "any"
  | "morning"
  | "afternoon"
  | "evening"
  | "night";

export type HangoutSortMode = "nearest" | "soonest";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

type SearchableHangout = Pick<
  EventFeedItem,
  | "eventType"
  | "joinApprovalRequired"
  | "visibility"
  | "startsAt"
  | "latitude"
  | "longitude"
  | "location"
  | "title"
  | "description"
>;

type HangoutDiscoveryOptions = {
  userLocation: Coordinates | null;
  locationQuery: string;
  dateFilter: string | null;
  timePeriod: HangoutTimePeriod;
  sortMode: HangoutSortMode;
};

export function parseHangoutDateFilter(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function getLocalDateKey(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function distanceBetweenMeters(
  from: Coordinates,
  to: Coordinates,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLng = radians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function eventDistance(
  event: SearchableHangout,
  userLocation: Coordinates | null,
): number | null {
  if (
    !userLocation ||
    event.latitude == null ||
    event.longitude == null ||
    !Number.isFinite(event.latitude) ||
    !Number.isFinite(event.longitude)
  ) {
    return null;
  }
  return distanceBetweenMeters(userLocation, {
    latitude: event.latitude,
    longitude: event.longitude,
  });
}

function matchesTimePeriod(value: string, period: HangoutTimePeriod): boolean {
  if (period === "any") return true;
  const hour = new Date(value).getHours();
  if (period === "morning") return hour >= 5 && hour < 12;
  if (period === "afternoon") return hour >= 12 && hour < 17;
  if (period === "evening") return hour >= 17 && hour < 22;
  return hour >= 22 || hour < 5;
}

export function discoverHangouts<T extends SearchableHangout>(
  events: readonly T[],
  options: HangoutDiscoveryOptions,
): T[] {
  const search = options.locationQuery.trim().toLocaleLowerCase();
  const filtered = events.filter((event) => {
    if (
      event.eventType !== "member" ||
      !event.joinApprovalRequired ||
      event.visibility !== "public"
    ) {
      return false;
    }
    if (options.dateFilter && getLocalDateKey(event.startsAt) !== options.dateFilter) {
      return false;
    }
    if (!matchesTimePeriod(event.startsAt, options.timePeriod)) return false;
    if (
      search &&
      !(event.location ?? "").toLocaleLowerCase().includes(search)
    ) {
      return false;
    }
    return true;
  });

  const startsSooner = (a: T, b: T) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  return filtered.sort((a, b) => {
    const aDistance = eventDistance(a, options.userLocation);
    const bDistance = eventDistance(b, options.userLocation);
    if (options.sortMode === "soonest") {
      const timeDifference = startsSooner(a, b);
      if (timeDifference !== 0) return timeDifference;
    }
    if (aDistance == null && bDistance != null) return 1;
    if (aDistance != null && bDistance == null) return -1;
    if (
      aDistance != null &&
      bDistance != null &&
      aDistance !== bDistance
    ) {
      return aDistance - bDistance;
    }
    return startsSooner(a, b);
  });
}
