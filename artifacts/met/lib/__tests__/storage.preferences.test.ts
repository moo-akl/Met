const mockStore: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStore[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStore[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete mockStore[key];
    }),
    clear: jest.fn(async () => {
      for (const key of Object.keys(mockStore)) delete mockStore[key];
    }),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { loadPreferences } from "../storage";

describe("loadPreferences notification migration", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("preserves the saved recap opt-out from the legacy daily key", async () => {
    await AsyncStorage.setItem(
      "met:prefs:v1",
      JSON.stringify({ notifyDailyRecap: false }),
    );

    const preferences = await loadPreferences();

    expect(preferences.notifyWeeklyRecap).toBe(false);
  });

  it("prefers the current weekly recap value when both keys exist", async () => {
    await AsyncStorage.setItem(
      "met:prefs:v1",
      JSON.stringify({
        notifyDailyRecap: false,
        notifyWeeklyRecap: true,
      }),
    );

    const preferences = await loadPreferences();

    expect(preferences.notifyWeeklyRecap).toBe(true);
  });

  it("loads independent opt-outs for new optional notification categories", async () => {
    await AsyncStorage.setItem(
      "met:prefs:v1",
      JSON.stringify({
        notifyNewEncounters: false,
        notifyConnectionRequests: false,
        notifyCrownDefense: false,
        notifyRewardUpdates: false,
      }),
    );

    const preferences = await loadPreferences();

    expect(preferences).toMatchObject({
      notifyNewEncounters: false,
      notifyConnectionRequests: false,
      notifyCrownDefense: false,
      notifyRewardUpdates: false,
    });
  });
});
