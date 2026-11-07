import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

export type EventReminderLeadMinutes = 0 | 15 | 60 | 360;
export type QuietHoursChoice = "22-08" | "23-07" | "off";

export type EventReminderSettings = {
  leadMinutes: EventReminderLeadMinutes;
  quietHours: QuietHoursChoice;
  showDetails: boolean;
};

export type ReminderEvent = {
  eventType: "member" | "venue";
  id: number;
  title: string;
  startsAt: string;
  location?: string | null;
};

export type StoredEventReminder = {
  notificationId: string;
  eventType: ReminderEvent["eventType"];
  eventId: number;
  startsAt: string;
  settings: EventReminderSettings;
};

export const DEFAULT_EVENT_REMINDER_SETTINGS: EventReminderSettings = {
  leadMinutes: 60,
  quietHours: "22-08",
  showDetails: false,
};

const REMINDER_KEY_PREFIX = "met:event-reminder:v1";
const EVENT_TYPES = ["member", "venue"] as const;
export type ReminderEventType = (typeof EVENT_TYPES)[number];
const QUIET_HOUR_END_MINUTES: Record<Exclude<QuietHoursChoice, "off">, number> = {
  "22-08": 8 * 60,
  "23-07": 7 * 60,
};
const QUIET_HOUR_START_MINUTES: Record<Exclude<QuietHoursChoice, "off">, number> = {
  "22-08": 22 * 60,
  "23-07": 23 * 60,
};

function storageKey(
  uid: string,
  eventType: ReminderEvent["eventType"],
  eventId: number,
): string {
  return `${REMINDER_KEY_PREFIX}:${uid}:${eventType}:${eventId}`;
}

function isQuietTime(date: Date, choice: Exclude<QuietHoursChoice, "off">): boolean {
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  return minuteOfDay >= QUIET_HOUR_START_MINUTES[choice] ||
    minuteOfDay < QUIET_HOUR_END_MINUTES[choice];
}

function nextQuietEnd(
  date: Date,
  choice: Exclude<QuietHoursChoice, "off">,
): Date {
  const end = new Date(date);
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();
  if (minuteOfDay >= QUIET_HOUR_END_MINUTES[choice]) {
    end.setDate(end.getDate() + 1);
  }
  end.setHours(Math.floor(QUIET_HOUR_END_MINUTES[choice] / 60), 0, 0, 0);
  return end;
}

/**
 * Calculates a one-time notification date in the device's local timezone.
 * If quiet hours would push the reminder past an early event, it moves the
 * reminder to five minutes before quiet hours begin on the prior evening.
 */
export function getEventReminderFireDate(
  startsAt: string,
  leadMinutes: EventReminderLeadMinutes,
  quietHours: QuietHoursChoice,
  now = new Date(),
): Date | null {
  const eventStart = new Date(startsAt);
  if (!Number.isFinite(eventStart.getTime()) || eventStart.getTime() <= now.getTime()) {
    return null;
  }

  let requested = new Date(eventStart.getTime() - leadMinutes * 60_000);
  if (requested.getTime() <= now.getTime()) {
    requested = new Date(now.getTime() + 5_000);
  }
  if (quietHours === "off" || !isQuietTime(requested, quietHours)) {
    return requested.getTime() < eventStart.getTime() ? requested : null;
  }

  const nextMorning = nextQuietEnd(requested, quietHours);
  if (nextMorning.getTime() > now.getTime() && nextMorning.getTime() < eventStart.getTime()) {
    return nextMorning;
  }

  const previousEvening = new Date(eventStart);
  previousEvening.setDate(previousEvening.getDate() - 1);
  previousEvening.setHours(
    Math.floor(QUIET_HOUR_START_MINUTES[quietHours] / 60),
    QUIET_HOUR_START_MINUTES[quietHours] % 60 - 5,
    0,
    0,
  );
  return previousEvening.getTime() > now.getTime() &&
    previousEvening.getTime() < eventStart.getTime()
    ? previousEvening
    : null;
}

export async function loadEventReminder(
  uid: string,
  eventType: ReminderEvent["eventType"],
  eventId: number,
): Promise<StoredEventReminder | null> {
  const key = storageKey(uid, eventType, eventId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    const record = JSON.parse(raw) as StoredEventReminder;
    const valid =
      typeof record.notificationId === "string" &&
      record.eventType === eventType &&
      record.eventId === eventId &&
      typeof record.startsAt === "string" &&
      (record.settings?.leadMinutes === 0 ||
        record.settings?.leadMinutes === 15 ||
        record.settings?.leadMinutes === 60 ||
        record.settings?.leadMinutes === 360) &&
      (record.settings?.quietHours === "22-08" ||
        record.settings?.quietHours === "23-07" ||
        record.settings?.quietHours === "off") &&
      typeof record.settings?.showDetails === "boolean";
    if (valid) return record;
  } catch {
    // Treat an unreadable local reminder as absent and remove its bad record.
  }
  await AsyncStorage.removeItem(key);
  return null;
}

export async function scheduleEventReminder(input: {
  uid: string;
  event: ReminderEvent;
  settings: EventReminderSettings;
  genericBody: string;
  notificationTitle: string;
  now?: Date;
}): Promise<StoredEventReminder> {
  const fireDate = getEventReminderFireDate(
    input.event.startsAt,
    input.settings.leadMinutes,
    input.settings.quietHours,
    input.now,
  );
  if (!fireDate) throw new Error("REMINDER_TIME_UNAVAILABLE");

  const key = storageKey(input.uid, input.event.eventType, input.event.id);
  const previous = await loadEventReminder(
    input.uid,
    input.event.eventType,
    input.event.id,
  );
  const body = input.settings.showDetails
    ? [input.event.title, input.event.location?.trim()].filter(Boolean).join(" · ")
    : input.genericBody;
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: input.notificationTitle,
      body,
      data: {
        type: "event_reminder",
        eventType: input.event.eventType,
        eventId: String(input.event.id),
      },
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
      channelId: "default",
    },
  });
  const record: StoredEventReminder = {
    notificationId,
    eventType: input.event.eventType,
    eventId: input.event.id,
    startsAt: input.event.startsAt,
    settings: input.settings,
  };

  try {
    await AsyncStorage.setItem(key, JSON.stringify(record));
  } catch (error) {
    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
    throw error;
  }

  if (previous?.notificationId && previous.notificationId !== notificationId) {
    await Notifications.cancelScheduledNotificationAsync(previous.notificationId).catch(() => {});
  }
  return record;
}

export async function cancelEventReminder(
  uid: string,
  eventType: ReminderEvent["eventType"],
  eventId: number,
): Promise<void> {
  const key = storageKey(uid, eventType, eventId);
  const reminder = await loadEventReminder(uid, eventType, eventId);
  if (reminder?.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
  }
  await AsyncStorage.removeItem(key);
}

/**
 * Removes reminders for events that are no longer present in a complete
 * server feed. The feed is capped at 100 events per type, so callers must not
 * mark a type complete when its result hit that limit.
 */
export async function reconcileEventReminders(
  uid: string,
  activeEvents: ReadonlyArray<Pick<ReminderEvent, "eventType" | "id">>,
  completeEventTypes: ReadonlySet<ReminderEventType>,
): Promise<number> {
  if (!uid || completeEventTypes.size === 0) return 0;

  const prefix = `${REMINDER_KEY_PREFIX}:${uid}:`;
  const activeKeys = new Set(
    activeEvents.map((event) => `${event.eventType}:${event.id}`),
  );
  const keys = await AsyncStorage.getAllKeys();
  const stale: Array<{ eventType: ReminderEventType; eventId: number }> = [];

  for (const key of keys) {
    if (!key.startsWith(prefix)) continue;
    const [rawEventType, rawEventId, ...extra] = key.slice(prefix.length).split(":");
    if (extra.length > 0 || !EVENT_TYPES.includes(rawEventType as ReminderEventType)) {
      continue;
    }
    const eventType = rawEventType as ReminderEventType;
    const eventId = Number(rawEventId);
    if (
      !completeEventTypes.has(eventType) ||
      !Number.isSafeInteger(eventId) ||
      eventId <= 0 ||
      activeKeys.has(`${eventType}:${eventId}`)
    ) {
      continue;
    }
    stale.push({ eventType, eventId });
  }

  let removed = 0;
  for (const reminder of stale) {
    await cancelEventReminder(uid, reminder.eventType, reminder.eventId);
    removed += 1;
  }
  return removed;
}
