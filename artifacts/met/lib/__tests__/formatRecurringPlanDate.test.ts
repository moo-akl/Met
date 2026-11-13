import { formatRecurringPlanDate } from "../formatRecurringPlanDate";

describe("formatRecurringPlanDate", () => {
  it("formats the next occurrence in the Plan's time zone", () => {
    const nextOccurrence = "2026-01-01T01:00:00.000Z";

    const bangkok = formatRecurringPlanDate(
      nextOccurrence,
      "en-US",
      "Asia/Bangkok",
    );
    const losAngeles = formatRecurringPlanDate(
      nextOccurrence,
      "en-US",
      "America/Los_Angeles",
    );

    expect(bangkok).toContain("Jan 1, 2026");
    expect(bangkok).toContain("8:00 AM");
    expect(losAngeles).toContain("Dec 31, 2025");
    expect(losAngeles).toContain("5:00 PM");
  });
});
