jest.mock("@react-native-async-storage/async-storage", () => {
  const values = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        values.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        values.delete(key);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        values.clear();
        return Promise.resolve();
      }),
    },
  };
});

jest.mock("expo-calendar", () => ({
  EntityTypes: { EVENT: "event" },
  getCalendarPermissionsAsync: jest.fn(),
  requestCalendarPermissionsAsync: jest.fn(),
  getDefaultCalendarAsync: jest.fn(),
  getCalendarsAsync: jest.fn(),
  getEventAsync: jest.fn(),
  updateEventAsync: jest.fn(),
  createEventAsync: jest.fn(),
}));

import * as Calendar from "expo-calendar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { addEventToCalendar } from "../addToCalendar";

const calendar = Calendar as unknown as Record<string, jest.Mock>;
const storage = AsyncStorage as unknown as Record<string, jest.Mock>;

const event = {
  eventType: "member" as const,
  id: 47,
  title: "Coffee with friends",
  startsAt: "2026-12-08T10:00:00.000Z",
  endsAt: "2026-12-08T11:30:00.000Z",
  location: "Riverside Cafe",
  venueName: null,
};

beforeEach(async () => {
  await storage.clear();
  jest.clearAllMocks();
  Object.defineProperty(Platform, "OS", {
    configurable: true,
    writable: true,
    value: "ios",
  });
  calendar.getCalendarPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  calendar.requestCalendarPermissionsAsync.mockResolvedValue({
    granted: true,
    canAskAgain: true,
  });
  calendar.getDefaultCalendarAsync.mockResolvedValue({
    id: "default-calendar",
    allowsModifications: true,
  });
  calendar.createEventAsync.mockResolvedValue("created-calendar-event");
  calendar.getEventAsync.mockResolvedValue({ id: "created-calendar-event" });
  calendar.updateEventAsync.mockResolvedValue("created-calendar-event");
});

describe("addEventToCalendar", () => {
  it("creates a real calendar entry and remembers its identifier", async () => {
    const result = await addEventToCalendar(event, "member-uid");

    expect(result).toEqual({ status: "added" });
    expect(calendar.createEventAsync).toHaveBeenCalledWith(
      "default-calendar",
      expect.objectContaining({
        title: event.title,
        startDate: new Date(event.startsAt),
        endDate: new Date(event.endsAt),
        location: event.location,
      }),
    );
    expect(storage.setItem).toHaveBeenCalledWith(
      "met:calendar-event:v1:member-uid:member:47",
      "created-calendar-event",
    );
    expect(calendar.getDefaultCalendarAsync).toHaveBeenCalledTimes(1);
    expect(calendar.getCalendarsAsync).not.toHaveBeenCalled();
  });

  it("selects a writable primary calendar on Android", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      writable: true,
      value: "android",
    });
    calendar.getCalendarsAsync.mockResolvedValue([
      { id: "read-only", isPrimary: true, allowsModifications: false },
      { id: "android-primary", isPrimary: true, allowsModifications: true },
      { id: "secondary", isPrimary: false, allowsModifications: true },
    ]);

    const result = await addEventToCalendar(event, "member-uid");

    expect(result).toEqual({ status: "added" });
    expect(calendar.getCalendarsAsync).toHaveBeenCalledWith("event");
    expect(calendar.createEventAsync).toHaveBeenCalledWith(
      "android-primary",
      expect.objectContaining({ title: event.title }),
    );
    expect(calendar.getDefaultCalendarAsync).not.toHaveBeenCalled();
  });

  it("reports when the device has no writable calendar", async () => {
    calendar.getDefaultCalendarAsync.mockResolvedValue(null);

    await expect(addEventToCalendar(event, "member-uid")).rejects.toThrow(
      "No writable calendar is available on this device.",
    );
    expect(calendar.createEventAsync).not.toHaveBeenCalled();
  });

  it("updates a previously added calendar entry instead of duplicating it", async () => {
    await addEventToCalendar(event, "member-uid");
    const updatedEvent = { ...event, title: "Coffee moved", startsAt: "2026-12-08T11:00:00.000Z" };

    const result = await addEventToCalendar(updatedEvent, "member-uid");

    expect(result).toEqual({ status: "updated" });
    expect(calendar.updateEventAsync).toHaveBeenCalledWith(
      "created-calendar-event",
      expect.objectContaining({ title: "Coffee moved" }),
    );
    expect(calendar.createEventAsync).toHaveBeenCalledTimes(1);
  });

  it("returns a permission result without creating an event when access is denied", async () => {
    calendar.getCalendarPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    calendar.requestCalendarPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });

    const result = await addEventToCalendar(event, "member-uid");

    expect(result).toEqual({
      status: "permission-denied",
      canAskAgain: false,
    });
    expect(calendar.createEventAsync).not.toHaveBeenCalled();
  });
});
