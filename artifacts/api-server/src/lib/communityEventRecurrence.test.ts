import { describe, expect, it } from "vitest";

import {
  advanceRecurringPlanSchedule,
  dateOnlyInTimeZone,
  isValidDateOnly,
  nextOccurrence,
} from "./communityEventRecurrence";

const timeZone = "America/New_York";

const dstCases = [
  {
    description: "daily recurrence across spring-forward",
    frequency: "daily",
    startsAt: "2026-03-07T14:30:00.000Z",
    expected: "2026-03-08T13:30:00.000Z",
  },
  {
    description: "daily recurrence across fall-back",
    frequency: "daily",
    startsAt: "2026-10-31T13:30:00.000Z",
    expected: "2026-11-01T14:30:00.000Z",
  },
  {
    description: "weekly recurrence across spring-forward",
    frequency: "weekly",
    startsAt: "2026-03-01T14:30:00.000Z",
    expected: "2026-03-08T13:30:00.000Z",
  },
  {
    description: "weekly recurrence across fall-back",
    frequency: "weekly",
    startsAt: "2026-10-25T13:30:00.000Z",
    expected: "2026-11-01T14:30:00.000Z",
  },
] as const;

describe("nextOccurrence", () => {
  it.each(dstCases)("preserves 09:30 local time for $description", ({
    frequency,
    startsAt,
    expected,
  }) => {
    const next = nextOccurrence(new Date(startsAt), frequency, timeZone);

    expect(next.toISOString()).toBe(expected);
    expect(new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(next)).toBe("09:30");
  });

  it("keeps a 31st-of-the-month anchor after February and 30-day months", () => {
    const expected = [
      "2026-02-28T10:15:00.000Z",
      "2026-03-31T10:15:00.000Z",
      "2026-04-30T10:15:00.000Z",
      "2026-05-31T10:15:00.000Z",
    ];
    let occurrence = new Date("2026-01-31T10:15:00.000Z");

    for (const expectedOccurrence of expected) {
      occurrence = nextOccurrence(occurrence, "monthly", "UTC", 31);
      expect(occurrence.toISOString()).toBe(expectedOccurrence);
    }
  });
});

describe("recurrence end dates", () => {
  it("accepts only real YYYY-MM-DD calendar dates", () => {
    expect(isValidDateOnly("2026-02-28")).toBe(true);
    expect(isValidDateOnly("2026-02-30")).toBe(false);
    expect(isValidDateOnly("2026-2-03")).toBe(false);
  });

  it("checks dates in the recurrence time zone", () => {
    expect(
      dateOnlyInTimeZone(new Date("2026-01-01T01:00:00.000Z"), "America/Los_Angeles"),
    ).toBe("2025-12-31");
  });

  it("keeps the final local-date occurrence and then completes the series", () => {
    const advanced = advanceRecurringPlanSchedule(
      {
        startsAt: new Date("2026-01-01T07:30:00.000Z"),
        endsAt: new Date("2026-01-01T08:30:00.000Z"),
        frequency: "daily",
        recurrenceTimeZone: "America/Los_Angeles",
        recurrenceDayOfMonth: null,
        recurrenceEndDate: "2026-01-01",
      },
      new Date("2026-01-02T09:00:00.000Z"),
    );

    expect(advanced.startsAt.toISOString()).toBe("2026-01-02T07:30:00.000Z");
    expect(advanced.endsAt?.toISOString()).toBe("2026-01-02T08:30:00.000Z");
    expect(advanced.advancedOccurrences).toBe(1);
    expect(advanced.completed).toBe(true);
    expect(advanced.frequency).toBeNull();
    expect(advanced.recurrenceEndDate).toBeNull();
  });

  it("preserves unbounded recurrence advancement when no end date is set", () => {
    const advanced = advanceRecurringPlanSchedule(
      {
        startsAt: new Date("2026-01-01T10:00:00.000Z"),
        endsAt: new Date("2026-01-01T11:00:00.000Z"),
        frequency: "daily",
        recurrenceTimeZone: "UTC",
        recurrenceDayOfMonth: null,
        recurrenceEndDate: null,
      },
      new Date("2026-01-01T12:00:00.000Z"),
    );

    expect(advanced.startsAt.toISOString()).toBe("2026-01-02T10:00:00.000Z");
    expect(advanced.advancedOccurrences).toBe(1);
    expect(advanced.completed).toBe(false);
    expect(advanced.frequency).toBe("daily");
    expect(advanced.recurrenceEndDate).toBeNull();
  });
});
