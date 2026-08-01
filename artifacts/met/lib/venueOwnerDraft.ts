import AsyncStorage from "@react-native-async-storage/async-storage";

export type VenueOwnerDraft = {
  step: 1 | 2 | 3;
  placeId: string;
  placeName: string;
  lat: string;
  lng: string;
  venueQuery: string;
  businessName: string;
  tagline: string;
  description: string;
  verificationDocUrl: string;
  registrationNotes: string;
};

const keyFor = (uid: string) => `met:venue-owner-draft:v1:${uid}`;

export async function loadVenueOwnerDraft(uid: string): Promise<VenueOwnerDraft | null> {
  const raw = await AsyncStorage.getItem(keyFor(uid));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VenueOwnerDraft;
  } catch {
    await AsyncStorage.removeItem(keyFor(uid));
    return null;
  }
}

export async function saveVenueOwnerDraft(uid: string, draft: VenueOwnerDraft): Promise<void> {
  await AsyncStorage.setItem(keyFor(uid), JSON.stringify(draft));
}

export async function clearVenueOwnerDraft(uid: string): Promise<void> {
  await AsyncStorage.removeItem(keyFor(uid));
}