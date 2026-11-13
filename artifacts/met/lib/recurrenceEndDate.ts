export function dateOnlyFromLocalDate(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function dateOnlyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return [
    String(values.year!).padStart(4, "0"),
    String(values.month!).padStart(2, "0"),
    String(values.day!).padStart(2, "0"),
  ].join("-");
}

export function localDateFromDateOnly(value: string | null | undefined): Date | null {
  const match = value && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(0);
  date.setFullYear(Number(year), Number(month) - 1, Number(day));
  date.setHours(12, 0, 0, 0);
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }
  return date;
}

export function formatDateOnly(value: string, locale: string): string {
  const date = localDateFromDateOnly(value);
  return date
    ? date.toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : value;
}
