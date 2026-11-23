import { describe, expect, it } from "vitest";
import { buildEventRsvpCsv } from "../lib/eventRsvpCsv";

describe("buildEventRsvpCsv", () => {
  it("combines RSVP responses with check-in status and time", () => {
    const csv = buildEventRsvpCsv(
      [
        { uid: "rsvp-going", displayName: "Alex Going", photoUrl: null, status: "going" },
        { uid: "rsvp-maybe", displayName: "Sam Maybe", photoUrl: null, status: "maybe" },
        { uid: "rsvp-no", displayName: "Taylor No", photoUrl: null, status: "not_going" },
      ],
      [
        {
          uid: "rsvp-going",
          displayName: "Alex Going",
          checkedInAt: "2035-06-12T16:02:00.000Z",
        },
        {
          uid: "walk-in",
          displayName: "Rory Walk-in",
          checkedInAt: "2035-06-12T16:09:00.000Z",
        },
      ],
    );

    expect(csv).toContain('"Alex Going","Going","Checked in","2035-06-12T16:02:00.000Z"');
    expect(csv).toContain('"Sam Maybe","Maybe","Not checked in",""');
    expect(csv).toContain('"Taylor No","Not going","Not checked in",""');
    expect(csv).toContain('"Rory Walk-in","No RSVP","Checked in","2035-06-12T16:09:00.000Z"');
    expect(csv.match(/"Alex Going"/g)).toHaveLength(1);
  });

  it("quotes separators and escapes formula-like guest names", () => {
    const csv = buildEventRsvpCsv(
      [{
        uid: "guest",
        displayName: '=HYPERLINK("https://example.test","Guest, one")',
        photoUrl: null,
        status: "going",
      }],
      [],
    );

    expect(csv).toContain(
      '"\'=HYPERLINK(""https://example.test"",""Guest, one"")","Going","Not checked in",""',
    );
  });

  it("preserves commas, quotes, and line breaks in guest names as valid CSV", () => {
    const csv = buildEventRsvpCsv(
      [{
        uid: "guest",
        displayName: 'Lee, "The Host"\nSecond line',
        photoUrl: null,
        status: "maybe",
      }],
      [],
    );

    expect(csv).toContain('"Lee, ""The Host""\nSecond line","Maybe","Not checked in",""');
  });
});
