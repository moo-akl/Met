import type { VenueCategory } from "@workspace/db";

export function normalizeGoogleVenueType(primaryType?: string | null): VenueCategory {
  const type = primaryType?.toLowerCase() ?? "";
  if (type.includes("cafe") || type.includes("coffee") || ["bakery", "tea_house"].includes(type)) return "cafe";
  if (type === "bar" || type === "night_club" || type === "pub" || type.endsWith("_bar")) return "bar";
  if (type.includes("restaurant") || ["food_court", "meal_takeaway", "meal_delivery"].includes(type)) return "restaurant";
  if (type === "barber_shop") return "other";
  if (type.includes("shop") || type.includes("store") || type.includes("market") || type === "mall") return "shopping";
  if (type.includes("park") || type.includes("campground") || type.includes("beach") || type.includes("garden")) return "outdoors";
  if (type.includes("museum") || type.includes("theater") || type.includes("gallery") || type === "cultural_center") return "culture";
  if (type.includes("gym") || type.includes("fitness") || type === "spa" || type.includes("sports")) return "fitness";
  if (type.includes("school") || type.includes("university") || type.includes("library")) return "education";
  if (["transit_station", "train_station", "bus_station", "subway_station", "light_rail_station", "airport"].includes(type)) return "transit";
  if (type.includes("hotel") || type.includes("lodging") || type.includes("hostel") || type.includes("resort")) return "lodging";
  return "other";
}

// Cache failures as well as in-flight lookups to avoid request storms.
const lookups = new Map<string, { until: number; promise: Promise<VenueCategory | null> }>();
let active = 0;
const waiting: (() => void)[] = [];
export function lookupGoogleVenueType(placeId: string): Promise<VenueCategory | null> {
  const existing = lookups.get(placeId);
  if (existing && existing.until > Date.now()) return existing.promise;
  const promise = (async () => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return null;
    if (active < 4) active++;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
        headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "primaryType" },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      const result = await response.json() as { primaryType?: string };
      return normalizeGoogleVenueType(result.primaryType);
    } catch {
      return null;
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  })();
  if (lookups.size > 2000) lookups.clear();
  lookups.set(placeId, { until: Date.now() + 60 * 60 * 1000, promise });
  return promise;
}
