export type EventLocationSearchResult = {
  placeId: string;
  label: string;
  name: string;
  latitude: number;
  longitude: number;
};

type PhotonProperties = {
  osm_type?: unknown;
  osm_id?: unknown;
  name?: unknown;
  housenumber?: unknown;
  street?: unknown;
  postcode?: unknown;
  city?: unknown;
  district?: unknown;
  county?: unknown;
  state?: unknown;
  country?: unknown;
};

type PhotonFeature = {
  properties?: PhotonProperties;
  geometry?: { coordinates?: unknown };
};

const cache = new Map<string, { expiresAt: number; locations: EventLocationSearchResult[] }>();
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 250;

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text ? text.slice(0, maxLength) : null;
}

function parseFeature(feature: PhotonFeature): EventLocationSearchResult | null {
  const properties = feature.properties;
  const coordinates = feature.geometry?.coordinates;
  if (!properties || !Array.isArray(coordinates) || coordinates.length < 2) return null;

  const longitude = coordinates[0];
  const latitude = coordinates[1];
  if (
    typeof longitude !== "number" ||
    typeof latitude !== "number" ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  const osmType = cleanText(properties.osm_type, 8)?.toLowerCase();
  const osmId =
    typeof properties.osm_id === "number" || typeof properties.osm_id === "string"
      ? String(properties.osm_id)
      : null;
  if (!osmType || !osmId) return null;

  const name = cleanText(properties.name, 160);
  const street = [
    cleanText(properties.housenumber, 24),
    cleanText(properties.street, 100),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  const locality =
    cleanText(properties.city, 80) ??
    cleanText(properties.district, 80) ??
    cleanText(properties.county, 80);
  const addressParts = [
    name,
    street || null,
    cleanText(properties.postcode, 24),
    locality,
    cleanText(properties.state, 80),
    cleanText(properties.country, 80),
  ];
  const uniqueParts = addressParts.filter(
    (part, index, parts): part is string =>
      Boolean(part) &&
      parts.findIndex((candidate) => candidate?.toLocaleLowerCase() === part?.toLocaleLowerCase()) === index,
  );
  const label = uniqueParts.join(", ").slice(0, 200);
  const displayName = name ?? uniqueParts[0] ?? label;
  if (!label || !displayName) return null;

  return {
    placeId: `${osmType}:${osmId}`,
    label,
    name: displayName,
    latitude,
    longitude,
  };
}

export function parsePhotonLocations(payload: unknown): EventLocationSearchResult[] {
  if (!payload || typeof payload !== "object" || !("features" in payload)) return [];
  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];

  const results: EventLocationSearchResult[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    if (!feature || typeof feature !== "object") continue;
    const location = parseFeature(feature as PhotonFeature);
    if (!location || seen.has(location.placeId)) continue;
    seen.add(location.placeId);
    results.push(location);
    if (results.length === 8) break;
  }
  return results;
}

export async function searchPhotonLocations(
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<EventLocationSearchResult[]> {
  const normalizedQuery = query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  const cached = cache.get(normalizedQuery);
  if (cached && cached.expiresAt > Date.now()) return cached.locations;
  if (cached) cache.delete(normalizedQuery);

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", "8");
  const response = await fetcher(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Met event location search",
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Place search returned HTTP ${response.status}`);
  }

  const locations = parsePhotonLocations(await response.json());
  cache.set(normalizedQuery, { expiresAt: Date.now() + CACHE_TTL_MS, locations });
  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  return locations;
}
