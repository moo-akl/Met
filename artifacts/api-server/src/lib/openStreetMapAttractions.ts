export const OPENSTREETMAP_ATTRIBUTION_URL = "https://www.openstreetmap.org/copyright";
export const OPENSTREETMAP_OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export const OSM_ATTRACTION_COUNTRIES = {
  VN: { name: "Vietnam", isoCode: "VN" },
  MY: { name: "Malaysia", isoCode: "MY" },
  LA: { name: "Laos", isoCode: "LA" },
  KH: { name: "Cambodia", isoCode: "KH" },
} as const;

export type OsmAttractionCountry = keyof typeof OSM_ATTRACTION_COUNTRIES;

type OsmElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OsmElement[];
};

export type OpenStreetMapAttraction = {
  placeId: string;
  placeName: string;
  category: string;
  lat: number;
  lng: number;
  sourceUrl: string;
};

export const CURATED_OSM_ATTRACTIONS: Record<OsmAttractionCountry, OpenStreetMapAttraction[]> = {
  VN: [
    { placeId: "osm-node-2707025319", placeName: "Ha Long Bay", category: "Bay", lat: 20.9084384, lng: 107.0682782, sourceUrl: "https://www.openstreetmap.org/node/2707025319" },
    { placeId: "osm-node-4611306993", placeName: "Hoi An Old Town", category: "Historic town", lat: 15.8779509, lng: 108.3239898, sourceUrl: "https://www.openstreetmap.org/node/4611306993" },
    { placeId: "osm-relation-7039289", placeName: "Phong Nha–Ke Bang National Park", category: "National park or nature reserve", lat: 17.5552645, lng: 106.1123041, sourceUrl: "https://www.openstreetmap.org/relation/7039289" },
    { placeId: "osm-node-1388480068", placeName: "Cu Chi Tunnels (Ben Dinh)", category: "Historic attraction", lat: 11.0630436, lng: 106.5291244, sourceUrl: "https://www.openstreetmap.org/node/1388480068" },
    { placeId: "osm-way-1362978856", placeName: "Trang An Landscape Complex", category: "Protected landscape", lat: 20.2537827, lng: 105.9005014, sourceUrl: "https://www.openstreetmap.org/way/1362978856" },
  ],
  MY: [
    { placeId: "osm-way-279944536", placeName: "Petronas Twin Towers", category: "Landmark", lat: 3.1579679, lng: 101.7112048, sourceUrl: "https://www.openstreetmap.org/way/279944536" },
    { placeId: "osm-way-1362025121", placeName: "Batu Caves", category: "Hindu temple and cave", lat: 3.2376533, lng: 101.6832228, sourceUrl: "https://www.openstreetmap.org/way/1362025121" },
    { placeId: "osm-relation-18435780", placeName: "Historic City of Melaka", category: "Historic city", lat: 2.1959652, lng: 102.250727, sourceUrl: "https://www.openstreetmap.org/relation/18435780" },
    { placeId: "osm-way-429428102", placeName: "Kinabalu Park", category: "National park", lat: 6.0687717, lng: 116.5642292, sourceUrl: "https://www.openstreetmap.org/way/429428102" },
    { placeId: "osm-way-112477895", placeName: "Langkawi Sky Bridge", category: "Viewpoint", lat: 6.38656, lng: 99.6619744, sourceUrl: "https://www.openstreetmap.org/way/112477895" },
  ],
  LA: [
    { placeId: "osm-node-116056557", placeName: "Luang Prabang Old Town", category: "Historic city", lat: 19.8887438, lng: 102.135898, sourceUrl: "https://www.openstreetmap.org/node/116056557" },
    { placeId: "osm-way-1347235970", placeName: "Kuang Si Falls", category: "Waterfall", lat: 19.7497382, lng: 101.9920713, sourceUrl: "https://www.openstreetmap.org/way/1347235970" },
    { placeId: "osm-relation-273288", placeName: "Pha That Luang", category: "Temple", lat: 17.9766636, lng: 102.6364902, sourceUrl: "https://www.openstreetmap.org/relation/273288" },
    { placeId: "osm-way-1564547716", placeName: "Plain of Jars (Site 2)", category: "Archaeological site", lat: 19.3194522, lng: 103.1538458, sourceUrl: "https://www.openstreetmap.org/way/1564547716" },
    { placeId: "osm-way-272647001", placeName: "Wat Xieng Thong", category: "Temple", lat: 19.8974586, lng: 102.143161, sourceUrl: "https://www.openstreetmap.org/way/272647001" },
  ],
  KH: [
    { placeId: "osm-way-1113380295", placeName: "Angkor Wat", category: "Historic temple", lat: 13.412521, lng: 103.8665896, sourceUrl: "https://www.openstreetmap.org/way/1113380295" },
    { placeId: "osm-way-1221842998", placeName: "Angkor Thom", category: "Archaeological site", lat: 13.4484714, lng: 103.8587628, sourceUrl: "https://www.openstreetmap.org/way/1221842998" },
    { placeId: "osm-relation-6987298", placeName: "Ta Prohm", category: "Historic temple", lat: 13.4349458, lng: 103.8895579, sourceUrl: "https://www.openstreetmap.org/relation/6987298" },
    { placeId: "osm-way-370804236", placeName: "Preah Vihear Temple", category: "Historic temple", lat: 14.3946688, lng: 104.6803192, sourceUrl: "https://www.openstreetmap.org/way/370804236" },
    { placeId: "osm-way-227968458", placeName: "Banteay Srei", category: "Historic temple", lat: 13.5991582, lng: 103.9630491, sourceUrl: "https://www.openstreetmap.org/way/227968458" },
  ],
};

const tourismTypes = "attraction|museum|zoo|aquarium|theme_park|viewpoint";
const historicTypes = "archaeological_site|castle|fort|memorial|monument|palace|ruins|temple";

export function buildOpenStreetMapAttractionQuery(country: OsmAttractionCountry): string {
  const isoCode = OSM_ATTRACTION_COUNTRIES[country].isoCode;
  return `
[out:json][timeout:25];
area["ISO3166-1"="${isoCode}"][admin_level=2]->.country;
(
  nwr["name"]["tourism"~"^(${tourismTypes})$"]["wikidata"](area.country);
  nwr["name"]["tourism"~"^(${tourismTypes})$"]["wikipedia"](area.country);
  nwr["name"]["historic"~"^(${historicTypes})$"]["wikidata"](area.country);
  nwr["name"]["historic"~"^(${historicTypes})$"]["wikipedia"](area.country);
  nwr["name"]["historic"~"^(${historicTypes})$"]["heritage"](area.country);
  nwr["name"]["boundary"="national_park"]["wikidata"](area.country);
  nwr["name"]["boundary"="national_park"]["wikipedia"](area.country);
  nwr["name"]["leisure"="nature_reserve"]["wikidata"](area.country);
  nwr["name"]["leisure"="nature_reserve"]["wikipedia"](area.country);
);
 out center tags 1000;
`.trim();
}

function attractionCategory(tags: Record<string, string>): string {
  if (tags["boundary"] === "national_park" || tags["leisure"] === "nature_reserve") {
    return "National park or nature reserve";
  }
  if (tags["historic"]) return `Historic site · ${tags["historic"].replaceAll("_", " ")}`;
  if (tags["tourism"]) return tags["tourism"].replaceAll("_", " ");
  return "Tourist attraction";
}

function isNotableAttraction(tags: Record<string, string>): boolean {
  return Boolean(tags["wikidata"] || tags["wikipedia"] || tags["heritage"]);
}

function isTouristPlace(tags: Record<string, string>): boolean {
  return Boolean(
    tags["tourism"] &&
      new RegExp(`^(?:${tourismTypes})$`).test(tags["tourism"]) ||
      tags["historic"] &&
        new RegExp(`^(?:${historicTypes})$`).test(tags["historic"]) ||
      tags["boundary"] === "national_park" ||
      tags["leisure"] === "nature_reserve",
  );
}

function elementCoordinates(element: OsmElement): { lat: number; lng: number } | null {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

export function parseOpenStreetMapAttractions(payload: OverpassResponse): OpenStreetMapAttraction[] {
  const candidates = (payload.elements ?? [])
    .flatMap((element): Array<{ attraction: OpenStreetMapAttraction; rank: number }> => {
      if (
        !["node", "way", "relation"].includes(element.type ?? "") ||
        !Number.isSafeInteger(element.id) ||
        (element.id ?? 0) <= 0
      ) {
        return [];
      }

      const tags = element.tags;
      const name = tags?.["name:en"]?.trim() || tags?.["name"]?.trim();
      if (!tags || !name || !isNotableAttraction(tags) || !isTouristPlace(tags)) return [];
      const coordinates = elementCoordinates(element);
      if (!coordinates) return [];

      const type = element.type!;
      const id = element.id!;
      const rank = Number(Boolean(tags["wikidata"])) * 3 +
        Number(Boolean(tags["wikipedia"])) * 2 +
        Number(Boolean(tags["heritage"]));
      return [{
        attraction: {
          placeId: `osm-${type}-${id}`,
          placeName: name,
          category: attractionCategory(tags),
          lat: coordinates.lat,
          lng: coordinates.lng,
          sourceUrl: `https://www.openstreetmap.org/${type}/${id}`,
        },
        rank,
      }];
    })
    .sort((a, b) => {
      return b.rank - a.rank || a.attraction.placeName.localeCompare(b.attraction.placeName);
    })
    .map(({ attraction }) => attraction);

  const seenIds = new Set<string>();
  const seenNearbyNames = new Set<string>();
  return candidates.filter((candidate) => {
    const normalizedName = candidate.placeName.normalize("NFKC").trim().toLocaleLowerCase();
    const nearbyNameKey = `${normalizedName}:${candidate.lat.toFixed(3)}:${candidate.lng.toFixed(3)}`;
    if (seenIds.has(candidate.placeId) || seenNearbyNames.has(nearbyNameKey)) return false;
    seenIds.add(candidate.placeId);
    seenNearbyNames.add(nearbyNameKey);
    return true;
  }).slice(0, 200);
}

export async function fetchOpenStreetMapAttractions(
  country: OsmAttractionCountry,
  fetcher: typeof fetch = fetch,
): Promise<OpenStreetMapAttraction[]> {
  const response = await fetcher(OPENSTREETMAP_OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Met Venue Admin (+https://met-app.org)",
      "Accept": "application/json",
    },
    body: new URLSearchParams({ data: buildOpenStreetMapAttractionQuery(country) }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap Overpass returned HTTP ${response.status}`);
  }

  const payload = await response.json() as OverpassResponse;
  return parseOpenStreetMapAttractions(payload);
}

export async function discoverOpenStreetMapAttractions(
  country: OsmAttractionCountry,
  fetcher: typeof fetch = fetch,
): Promise<{
  attractions: OpenStreetMapAttraction[];
  source: "overpass" | "curated_fallback";
  upstreamError?: unknown;
}> {
  try {
    return {
      attractions: await fetchOpenStreetMapAttractions(country, fetcher),
      source: "overpass",
    };
  } catch (upstreamError) {
    return {
      attractions: CURATED_OSM_ATTRACTIONS[country],
      source: "curated_fallback",
      upstreamError,
    };
  }
}
