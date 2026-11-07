import { buildEventCalendarIcs } from "../calendarExport";

describe("buildEventCalendarIcs", () => {
  it("creates an importable calendar event with escaped title and venue details", () => {
    const ics = buildEventCalendarIcs(
      {
        eventType: "member",
        id: 9,
        title: "Dinner, then; music\nwith friends",
        startsAt: "2040-06-12T18:00:00-04:00",
        endsAt: "2040-06-12T20:00:00-04:00",
        location: "Studio, Room 2",
      },
      new Date("2040-01-01T00:00:00.000Z"),
    );

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20400612T220000Z");
    expect(ics).toContain("DTEND:20400613T000000Z");
    expect(ics).toContain("SUMMARY:Dinner\\, then\\; music\\nwith friends");
    expect(ics).toContain("LOCATION:Studio\\, Room 2");
    expect(ics).toContain("END:VCALENDAR\r\n");
  });

  it("uses a one-hour default duration and excludes private descriptions", () => {
    const ics = buildEventCalendarIcs(
      {
        eventType: "member",
        id: 10,
        title: "Quiet coffee",
        startsAt: "2040-06-12T12:00:00.000Z",
        description: "Secret details that should stay in Met",
      } as Parameters<typeof buildEventCalendarIcs>[0] & { description: string },
      new Date("2040-01-01T00:00:00.000Z"),
    );

    expect(ics).toContain("DTEND:20400612T130000Z");
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("Secret details");
  });

  it("rejects an invalid start time", () => {
    expect(() =>
      buildEventCalendarIcs({
        eventType: "venue",
        id: 3,
        title: "Invalid",
        startsAt: "not-a-date",
      }),
    ).toThrow("Invalid event start time.");
  });
});
