jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      getAllKeys: jest.fn(async () => Object.keys(store)),
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      clear: jest.fn(async () => {
        for (const key of Object.keys(store)) delete store[key];
      }),
    },
  };
});

jest.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date" },
  scheduleNotificationAsync: jest.fn(async () => "local-reminder-1"),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  cancelEventReminder,
  getEventReminderFireDate,
  reconcileEventReminders,
  scheduleEventReminder,
} from "../eventReminders";

describe("event reminder timing", () => {
  it("schedules according to the device's local clock", () => {
    const start = new Date(2040, 5, 12, 12, 0, 0);
    const now = new Date(2040, 5, 12, 9, 0, 0);
    const fireAt = getEventReminderFireDate(
      start.toISOString(),
      60,
      "off",
      now,
    );
    expect(fireAt?.getTime()).toBe(new Date(2040, 5, 12, 11, 0, 0).getTime());
  });

  it("moves a reminder out of quiet hours to the next morning", () => {
    const start = new Date(2040, 5, 12, 8, 10, 0);
    const now = new Date(2040, 5, 12, 6, 0, 0);
    const fireAt = getEventReminderFireDate(
      start.toISOString(),
      15,
      "22-08",
      now,
    );
    expect(fireAt?.getTime()).toBe(new Date(2040, 5, 12, 8, 0, 0).getTime());
  });

  it("moves an early-event reminder to the prior evening when morning is too late", () => {
    const start = new Date(2040, 5, 12, 7, 30, 0);
    const now = new Date(2040, 5, 11, 20, 0, 0);
    const fireAt = getEventReminderFireDate(
      start.toISOString(),
      15,
      "22-08",
      now,
    );
    expect(fireAt?.getTime()).toBe(new Date(2040, 5, 11, 21, 55, 0).getTime());
  });

  it("returns no reminder when the event has already started", () => {
    const now = new Date(2040, 5, 12, 12, 0, 0);
    expect(
      getEventReminderFireDate(
        new Date(2040, 5, 12, 11, 0, 0).toISOString(),
        60,
        "off",
        now,
      ),
    ).toBeNull();
  });
});

describe("local event reminder persistence and privacy", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("uses generic lock-screen copy by default and stores only a local reminder record", async () => {
    const event = {
      eventType: "member" as const,
      id: 48,
      title: "Private dinner plan",
      startsAt: new Date(2040, 5, 12, 12, 0, 0).toISOString(),
      location: "Private address",
    };
    const record = await scheduleEventReminder({
      uid: "user-1",
      event,
      settings: { leadMinutes: 60, quietHours: "off", showDetails: false },
      notificationTitle: "Plan reminder",
      genericBody: "A plan is coming up. Open Met for details.",
      now: new Date(2040, 5, 12, 9, 0, 0),
    });

    const request = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(request.content).toMatchObject({
      title: "Plan reminder",
      body: "A plan is coming up. Open Met for details.",
      data: { type: "event_reminder", eventType: "member", eventId: "48" },
    });
    expect(JSON.stringify(request.content)).not.toContain("Private dinner plan");
    expect(JSON.stringify(request.content)).not.toContain("Private address");
    expect(record.settings.showDetails).toBe(false);
    expect(await AsyncStorage.getItem(
      "met:event-reminder:v1:user-1:member:48",
    )).toContain("local-reminder-1");
  });

  it("includes details only when the user opts in and cancels the scheduled reminder", async () => {
    const event = {
      eventType: "venue" as const,
      id: 77,
      title: "Community meetup",
      startsAt: new Date(2040, 5, 12, 12, 0, 0).toISOString(),
      location: "Garden room",
    };
    await scheduleEventReminder({
      uid: "user-2",
      event,
      settings: { leadMinutes: 15, quietHours: "off", showDetails: true },
      notificationTitle: "Plan reminder",
      genericBody: "A plan is coming up.",
      now: new Date(2040, 5, 12, 9, 0, 0),
    });

    const request = jest.mocked(Notifications.scheduleNotificationAsync).mock.calls[0][0];
    expect(request.content.body).toBe("Community meetup · Garden room");
    await cancelEventReminder("user-2", "venue", 77);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "local-reminder-1",
    );
    expect(await AsyncStorage.getItem(
      "met:event-reminder:v1:user-2:venue:77",
    )).toBeNull();
  });

  it("cancels reminders for missing events when that feed type is complete", async () => {
    const event = {
      eventType: "member" as const,
      id: 48,
      title: "Dinner plan",
      startsAt: new Date(2040, 5, 12, 12, 0, 0).toISOString(),
    };
    await scheduleEventReminder({
      uid: "user-1",
      event,
      settings: { leadMinutes: 60, quietHours: "off", showDetails: false },
      notificationTitle: "Plan reminder",
      genericBody: "A plan is coming up.",
      now: new Date(2040, 5, 12, 9, 0, 0),
    });

    const removed = await reconcileEventReminders(
      "user-1",
      [],
      new Set(["member", "venue"]),
    );

    expect(removed).toBe(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "local-reminder-1",
    );
    expect(await AsyncStorage.getItem(
      "met:event-reminder:v1:user-1:member:48",
    )).toBeNull();
  });

  it("keeps reminders when a feed type may be truncated", async () => {
    const event = {
      eventType: "venue" as const,
      id: 77,
      title: "Meetup",
      startsAt: new Date(2040, 5, 12, 12, 0, 0).toISOString(),
    };
    await scheduleEventReminder({
      uid: "user-1",
      event,
      settings: { leadMinutes: 60, quietHours: "off", showDetails: false },
      notificationTitle: "Plan reminder",
      genericBody: "An event is coming up.",
      now: new Date(2040, 5, 12, 9, 0, 0),
    });

    const removed = await reconcileEventReminders(
      "user-1",
      [],
      new Set(["member"]),
    );

    expect(removed).toBe(0);
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(
      "met:event-reminder:v1:user-1:venue:77",
    )).not.toBeNull();
  });

  it("does not remove another user's reminders", async () => {
    const event = {
      eventType: "member" as const,
      id: 48,
      title: "Dinner plan",
      startsAt: new Date(2040, 5, 12, 12, 0, 0).toISOString(),
    };
    await scheduleEventReminder({
      uid: "user-2",
      event,
      settings: { leadMinutes: 60, quietHours: "off", showDetails: false },
      notificationTitle: "Plan reminder",
      genericBody: "A plan is coming up.",
      now: new Date(2040, 5, 12, 9, 0, 0),
    });

    await reconcileEventReminders("user-1", [], new Set(["member"]));

    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(
      "met:event-reminder:v1:user-2:member:48",
    )).not.toBeNull();
  });
});
