jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    _store: store,
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearVenueOwnerDraft,
  loadVenueOwnerDraft,
  saveVenueOwnerDraft,
  type VenueOwnerDraft,
} from "../venueOwnerDraft";

const draft: VenueOwnerDraft = {
  step: 2,
  placeId: "google-place-1",
  placeName: "The Corner",
  lat: "40.7",
  lng: "-74",
  venueQuery: "The Corner",
  businessName: "Corner Social",
  tagline: "Meet here",
  description: "A great place to meet.",
  verificationDocUrl: "https://example.com/proof.pdf",
  registrationNotes: "Owner since 2021",
};

const store = (AsyncStorage as unknown as { _store: Record<string, string> })._store;

describe("venue owner setup drafts", () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    jest.clearAllMocks();
  });

  it("restores a saved draft for the same applicant", async () => {
    await saveVenueOwnerDraft("uid-a", draft);

    await expect(loadVenueOwnerDraft("uid-a")).resolves.toEqual(draft);
  });

  it("does not expose one applicant's draft to another account", async () => {
    await saveVenueOwnerDraft("uid-a", draft);

    await expect(loadVenueOwnerDraft("uid-b")).resolves.toBeNull();
  });

  it("clears the draft after a successful application", async () => {
    await saveVenueOwnerDraft("uid-a", draft);
    await clearVenueOwnerDraft("uid-a");

    await expect(loadVenueOwnerDraft("uid-a")).resolves.toBeNull();
  });

  it("discards malformed stored content instead of crashing setup", async () => {
    store["met:venue-owner-draft:v1:uid-a"] = "not JSON";

    await expect(loadVenueOwnerDraft("uid-a")).resolves.toBeNull();
    expect(store["met:venue-owner-draft:v1:uid-a"]).toBeUndefined();
  });
});