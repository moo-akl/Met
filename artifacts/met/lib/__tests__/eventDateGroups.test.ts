import { groupEventsByDate } from "../eventDateGroups";

describe("groupEventsByDate", () => {
  it("keeps first-seen date groups and events in the incoming sort order", () => {
    const now = new Date(2026, 6, 15, 12);
    const localDate = (dayOffset: number, hour: number) =>
      new Date(2026, 6, 15 + dayOffset, hour).toISOString();
    const events = [
      { id: "nearest-tomorrow", startsAt: localDate(1, 10) },
      { id: "near-today", startsAt: localDate(0, 18) },
      { id: "farther-tomorrow", startsAt: localDate(1, 14) },
      { id: "later", startsAt: localDate(3, 9) },
    ];

    const groups = groupEventsByDate(events, "en", "Today", now);

    expect(groups.map((group) => group.events.map((event) => event.id))).toEqual([
      ["nearest-tomorrow", "farther-tomorrow"],
      ["near-today"],
      ["later"],
    ]);
    expect(groups[1].label).toBe("Today");
  });

  it("uses localized weekday and date labels for dates outside today", () => {
    const now = new Date(2026, 6, 15, 12);
    const event = {
      id: "future",
      startsAt: new Date(2026, 6, 16, 10).toISOString(),
    };

    const [group] = groupEventsByDate([event], "en", "Today", now);

    expect(group.label).toBe("Thursday, July 16");
  });

  it("separates events on either side of local midnight", () => {
    const now = new Date(2026, 6, 15, 0, 10);
    const events = [
      {
        id: "before-midnight",
        startsAt: new Date(2026, 6, 14, 23, 55).toISOString(),
      },
      {
        id: "after-midnight",
        startsAt: new Date(2026, 6, 15, 0, 5).toISOString(),
      },
    ];

    const groups = groupEventsByDate(events, "en", "Today", now);

    expect(groups.map((group) => group.events.map((event) => event.id))).toEqual([
      ["before-midnight"],
      ["after-midnight"],
    ]);
    expect(groups[1].label).toBe("Today");
  });

  it.each([
    ["en", "july"],
    ["es", "julio"],
    ["fr", "juillet"],
    ["nl", "juli"],
    ["pt", "julho"],
    ["ru", "июля"],
    ["vi", "tháng 7"],
    ["zh", "7月"],
    ["ar", /[\u0600-\u06FF]/],
  ] as Array<[string, string | RegExp]>)(
    "formats the date using the %s locale",
    (locale, expected) => {
      const now = new Date(2026, 6, 15, 12);
      const event = {
        id: "future",
        startsAt: new Date(2026, 6, 16, 10).toISOString(),
      };

      const [group] = groupEventsByDate([event], locale, "Today", now);

      if (expected instanceof RegExp) {
        expect(group.label).toMatch(expected);
      } else {
        expect(group.label.toLocaleLowerCase(locale)).toContain(expected);
      }
    },
  );

  it.each([
    ["en", "Today"],
    ["es", "Hoy"],
    ["ar", "اليوم"],
    ["zh", "今天"],
    ["ru", "Сегодня"],
    ["fr", "Aujourd'hui"],
    ["vi", "Hôm nay"],
    ["pt", "Hoje"],
    ["nl", "Vandaag"],
  ])("uses the translated today label for %s", (locale, todayLabel) => {
    const now = new Date(2026, 6, 15, 12);
    const event = {
      id: "today",
      startsAt: new Date(2026, 6, 15, 18).toISOString(),
    };

    const [group] = groupEventsByDate([event], locale, todayLabel, now);

    expect(group.label).toBe(todayLabel);
  });
});
