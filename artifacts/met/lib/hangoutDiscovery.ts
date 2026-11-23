export type HangoutSortMode = "nearest" | "soonest";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

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

export function approximateDistanceMetersBetween(
  from: Coordinates,
  to: Coordinates,
): number {
  return Math.round(distanceBetweenMeters(from, to) / 100) * 100;
}

export function formatApproximateDistance(
  distanceMeters: number,
  locale: string,
): string | null {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return null;

  const roundedMeters = Math.round(distanceMeters / 100) * 100;
  const formattedDistance =
    roundedMeters < 1_000
      ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(roundedMeters)} m`
      : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(roundedMeters / 1_000)} km`;

  return `~${formattedDistance}`;
}
