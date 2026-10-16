type Coordinates = { latitude: number; longitude: number };
type VenueCoordinates = { lat: number; lng: number };

function distanceScore(venue: VenueCoordinates, origin: Coordinates): number {
  if (!Number.isFinite(venue.lat) || !Number.isFinite(venue.lng)) return Infinity;
  const radians = Math.PI / 180;
  const latitudeDelta = (venue.lat - origin.latitude) * radians;
  const longitudeDelta = (venue.lng - origin.longitude) * radians;
  // Haversine's angular score is monotonic with distance; no radius is needed.
  return Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(origin.latitude * radians) * Math.cos(venue.lat * radians)
    * Math.sin(longitudeDelta / 2) ** 2;
}

/** Sort a copy, preserving the server's order when location is unavailable. */
export function nearestVenues<T extends VenueCoordinates>(
  venues: readonly T[],
  origin: Coordinates | null,
): T[] {
  if (!origin) return [...venues];
  return [...venues].sort((a, b) => distanceScore(a, origin) - distanceScore(b, origin));
}
