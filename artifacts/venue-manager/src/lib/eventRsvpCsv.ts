import {
  VENUE_EVENT_RSVP_LABELS,
  type VenueEventRsvp,
} from "./eventRsvpGroups";

export type EventAttendanceCsvAttendee = {
  uid: string;
  displayName: string;
  checkedInAt: string;
};

function csvCell(value: string): string {
  const spreadsheetSafe = /^[\u0000-\u0020]*[=+\-@]/.test(value)
    ? `'${value}`
    : value;
  return `"${spreadsheetSafe.replace(/"/g, '""')}"`;
}

export function buildEventRsvpCsv(
  rsvps: readonly VenueEventRsvp[],
  attendees: readonly EventAttendanceCsvAttendee[],
): string {
  const attendeesByUid = new Map(
    attendees.map((attendee) => [attendee.uid, attendee]),
  );
  const rsvpUids = new Set(rsvps.map((rsvp) => rsvp.uid));
  const rows: string[][] = [
    ["Guest name", "RSVP response", "Check-in status", "Check-in time"],
    ...rsvps.map((rsvp) => {
      const attendee = attendeesByUid.get(rsvp.uid);
      return [
        rsvp.displayName,
        VENUE_EVENT_RSVP_LABELS[rsvp.status],
        attendee ? "Checked in" : "Not checked in",
        attendee ? new Date(attendee.checkedInAt).toISOString() : "",
      ];
    }),
    ...attendees
      .filter((attendee) => !rsvpUids.has(attendee.uid))
      .map((attendee) => [
        attendee.displayName,
        "No RSVP",
        "Checked in",
        new Date(attendee.checkedInAt).toISOString(),
      ]),
  ];

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
