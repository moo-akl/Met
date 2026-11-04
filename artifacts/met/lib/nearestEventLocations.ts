export type Coordinates = { latitude: number; longitude: number };

type LocatedPlace = {
  latitude: number;
  longitude: number;
};

function distanceScore(place: LocatedPlace, origin: Coordinates): number {
  if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) {
    return Number.POSITIVE_INFINITY;
  }
  const radians = Math.PI / 180;
  const latitudeDelta = (place.latitude - origin.latitude) * radians;
  const longitudeDelta = (place.longitude - origin.longitude) * radians;
  return Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(origin.latitude * radians) * Math.cos(place.latitude * radians)
    * Math.sin(longitudeDelta / 2) ** 2;
}

/** Sort nearby event locations first without mutating the provider response. */
export function nearestEventLocations<T extends LocatedPlace>(
  locations: readonly T[],
  origin: Coordinates | null,
): T[] {
  if (!origin) return [...locations];
  return locations
    .map((location, index) => ({ location, index }))
    .sort((a, b) =>
      distanceScore(a.location, origin) - distanceScore(b.location, origin)
      || a.index - b.index,
    )
    .map(({ location }) => location);
}
