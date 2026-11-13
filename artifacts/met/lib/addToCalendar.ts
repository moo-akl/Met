import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

import type { EventFeedItem } from "@workspace/api-client-react";

export type AddToCalendarResult =
  | { status: "added" }
  | { status: "updated" }
  | { status: "permission-denied"; canAskAgain: boolean };

function getEventEndDate(startsAt: Date, endsAt?: string | null): Date {
  const end = endsAt ? new Date(endsAt) : null;
  return end && Number.isFinite(end.getTime()) && end.getTime() > startsAt.getTime()
    ? end
    : new Date(startsAt.getTime() + 60 * 60 * 1000);
}

async function getWritableCalendar(): Promise<Calendar.Calendar | null> {
  if (Platform.OS === "ios") {
    return Calendar.getDefaultCalendarAsync();
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return (
    calendars.find((calendar) => calendar.isPrimary && calendar.allowsModifications) ??
    calendars.find((calendar) => calendar.allowsModifications) ??
    null
  );
}

export async function addEventToCalendar(
  event: Pick<
    EventFeedItem,
    "eventType" | "id" | "title" | "startsAt" | "endsAt" | "location" | "venueName"
  >,
  uid: string | null,
): Promise<AddToCalendarResult> {
  const currentPermission = await Calendar.getCalendarPermissionsAsync();
  const permission = currentPermission.granted
    ? currentPermission
    : await Calendar.requestCalendarPermissionsAsync();

  if (!permission.granted) {
    return {
      status: "permission-denied",
      canAskAgain: permission.canAskAgain,
    };
  }

  const startsAt = new Date(event.startsAt);
  if (!Number.isFinite(startsAt.getTime())) {
    throw new Error("The event has an invalid start date.");
  }
  const calendar = await getWritableCalendar();
  if (!calendar) {
    throw new Error("No writable calendar is available on this device.");
  }

  const details = {
    title: event.title,
    startDate: startsAt,
    endDate: getEventEndDate(startsAt, event.endsAt),
    location: event.location ?? event.venueName ?? null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
  };
  const storageKey = [
    "met:calendar-event:v1",
    uid ?? "device",
    event.eventType,
    event.id,
  ].join(":");
  const storedEventId = await AsyncStorage.getItem(storageKey);

  if (storedEventId) {
    let calendarEventExists = true;
    try {
      await Calendar.getEventAsync(storedEventId);
    } catch {
      calendarEventExists = false;
      await AsyncStorage.removeItem(storageKey);
    }
    if (calendarEventExists) {
      await Calendar.updateEventAsync(storedEventId, details);
      return { status: "updated" };
    }
  }

  const createdEventId = await Calendar.createEventAsync(calendar.id, details);
  await AsyncStorage.setItem(storageKey, createdEventId).catch((error) => {
    console.warn("[calendar] added event but couldn't save its local identifier", error);
  });
  return { status: "added" };
}
