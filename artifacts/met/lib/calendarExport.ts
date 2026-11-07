export type CalendarExportEvent = {
  eventType: "member" | "venue";
  id: number;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  location?: string | null;
};

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toUtcIcsDate(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildEventCalendarIcs(
  event: CalendarExportEvent,
  generatedAt = new Date(),
): string {
  const startsAt = new Date(event.startsAt);
  if (!Number.isFinite(startsAt.getTime())) {
    throw new Error("Invalid event start time.");
  }
  const suppliedEnd = event.endsAt ? new Date(event.endsAt) : null;
  const endsAt = suppliedEnd &&
    Number.isFinite(suppliedEnd.getTime()) &&
    suppliedEnd.getTime() > startsAt.getTime()
    ? suppliedEnd
    : new Date(startsAt.getTime() + 60 * 60 * 1000);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Met//Event Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.eventType}-${event.id}@met-app`,
    `DTSTAMP:${toUtcIcsDate(generatedAt)}`,
    `DTSTART:${toUtcIcsDate(startsAt)}`,
    `DTEND:${toUtcIcsDate(endsAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];
  if (event.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(event.location.trim())}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}
