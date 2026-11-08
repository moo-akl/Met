export type EventDateGroup<T> = {
  key: string;
  label: string;
  events: T[];
};

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Groups an already-sorted feed by local calendar date.
 * Group and event order follow the input, so nearby-first order stays primary
 * when the caller has sorted events by distance.
 */
export function groupEventsByDate<T extends { startsAt: string | number }>(
  events: T[],
  locale: string,
  todayLabel: string,
  now = new Date(),
): EventDateGroup<T>[] {
  const todayKey = localDateKey(now);
  const groups = new Map<string, EventDateGroup<T>>();

  for (const event of events) {
    const date = new Date(event.startsAt);
    const key = localDateKey(date);
    let group = groups.get(key);

    if (!group) {
      const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: "long",
        month: "long",
        day: "numeric",
        ...(date.getFullYear() !== now.getFullYear()
          ? { year: "numeric" }
          : {}),
      };
      group = {
        key,
        label:
          key === todayKey
            ? todayLabel
            : new Intl.DateTimeFormat(locale, dateOptions).format(date),
        events: [],
      };
      groups.set(key, group);
    }

    group.events.push(event);
  }

  return Array.from(groups.values());
}
