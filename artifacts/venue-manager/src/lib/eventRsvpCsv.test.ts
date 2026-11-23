import { describe, expect, it } from "vitest";
import { buildEventRsvpCsv } from "./eventRsvpCsv";

describe("buildEventRsvpCsv", () => {
  it("exports RSVP responses, check-in details, and check-ins without an RSVP", () => {
    const csv = buildEventRsvpCsv(
      [
        {
          uid: "guest-one",
          displayName: 'Rory, "Checked"\nIn',
          photoUrl: null,
          status: "going",
        },
        {
          uid: "guest-two",
          displayName: "=2+2",
          photoUrl: null,
          status: "maybe",
        },
      ],
      [
        {
          uid: "guest-one",
          displayName: "Unused check-in name",
          checkedInAt: "2035-06-12T16:02:00.000Z",
        },
        {
          uid: "walk-in",
          displayName: "\t=1+1",
          checkedInAt: "2035-06-12T17:30:00.000Z",
        },
      ],
    );

    expect(csv).toBe(
      '\uFEFF"Guest name","RSVP response","Check-in status","Check-in time"\r\n' +
        '"Rory, ""Checked""\nIn","Going","Checked in","2035-06-12T16:02:00.000Z"\r\n' +
        "\"'=2+2\",\"Maybe\",\"Not checked in\",\"\"\r\n" +
        "\"'\t=1+1\",\"No RSVP\",\"Checked in\",\"2035-06-12T17:30:00.000Z\"\r\n",
    );
  });
});
