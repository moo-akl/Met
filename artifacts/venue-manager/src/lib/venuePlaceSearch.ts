export type VenuePlaceSearchItem = {
  placeId: string;
  placeName: string;
  address: string | null;
  lat: number;
  lng: number;
};

export type PlaceResult = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

export function normalizeVenuePlaceSearchResult(place: VenuePlaceSearchItem): PlaceResult {
  return {
    placeId: place.placeId,
    name: place.placeName,
    address: place.address ?? "",
    lat: place.lat,
    lng: place.lng,
  };
}