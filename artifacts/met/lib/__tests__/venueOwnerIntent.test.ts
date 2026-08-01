jest.mock("@react-native-async-storage/async-storage", () => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store = {};
      return Promise.resolve();
    }),
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearVenueOwnerIntent,
  loadVenueOwnerIntent,
  saveVenueOwnerIntent,
} from "../venueOwnerIntent";

describe("venueOwnerIntent persistence", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("is false by default", async () => {
    expect(await loadVenueOwnerIntent()).toBe(false);
  });

  it("persists across a simulated restart", async () => {
    await saveVenueOwnerIntent();
    expect(await loadVenueOwnerIntent()).toBe(true);
  });

  it("clears when consumed", async () => {
    await saveVenueOwnerIntent();
    await clearVenueOwnerIntent();
    expect(await loadVenueOwnerIntent()).toBe(false);
  });

  it("treats unexpected stored values as no intent", async () => {
    await AsyncStorage.setItem("met:venue-owner-intent:v1", "banana");
    expect(await loadVenueOwnerIntent()).toBe(false);
  });

  it("does not throw when storage fails", async () => {
    const spy = jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("disk error"));
    await expect(loadVenueOwnerIntent()).resolves.toBe(false);
    spy.mockRestore();
  });
});
