import {
  dateOnlyFromLocalDate,
  dateOnlyInTimeZone,
  formatDateOnly,
  localDateFromDateOnly,
} from "../recurrenceEndDate";

describe("recurrence end dates", () => {
  it("keeps date-only values stable through the local date picker", () => {
    const date = localDateFromDateOnly("2026-02-28");

    expect(date).not.toBeNull();
    expect(dateOnlyFromLocalDate(date!)).toBe("2026-02-28");
    expect(formatDateOnly("2026-02-28", "en-US")).toContain("Feb 28, 2026");
  });

  it("uses the recurrence zone's calendar day near midnight", () => {
    expect(
      dateOnlyInTimeZone(new Date("2026-01-01T01:00:00.000Z"), "America/Los_Angeles"),
    ).toBe("2025-12-31");
  });

  it("rejects impossible calendar dates", () => {
    expect(localDateFromDateOnly("2026-02-30")).toBeNull();
  });
});
