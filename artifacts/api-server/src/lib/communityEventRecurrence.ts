import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { communityEventsTable, db } from "@workspace/db";

type Frequency = "daily" | "weekly" | "monthly";

export type RecurringPlanFrequency = Frequency;

export type RecurringPlanSchedule = {
  startsAt: Date;
  endsAt: Date | null;
  frequency: Frequency;
  recurrenceTimeZone: string;
  recurrenceDayOfMonth: number | null;
  recurrenceEndDate: string | null;
};

type AdvancedRecurringPlanSchedule = Omit<RecurringPlanSchedule, "frequency"> & {
  frequency: Frequency | null;
  advancedOccurrences: number;
  completed: boolean;
};

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: values.year!,
    month: values.month!,
    day: values.day!,
    hour: values.hour!,
    minute: values.minute!,
    second: values.second!,
  };
}

function fromZonedParts(
  parts: ReturnType<typeof getZonedParts>,
  timeZone: string,
  millisecond: number,
): Date {
  const desiredLocalAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    millisecond,
  );
  let candidate = desiredLocalAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getZonedParts(new Date(candidate), timeZone);
    const actualLocalAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      millisecond,
    );
    const difference = desiredLocalAsUtc - actualLocalAsUtc;
    if (difference === 0) break;
    candidate += difference;
  }
  return new Date(candidate);
}

export function nextOccurrence(
  startsAt: Date,
  frequency: Frequency,
  timeZone: string,
  dayOfMonthAnchor?: number | null,
): Date {
  let local = getZonedParts(startsAt, timeZone);
  if (frequency === "daily" || frequency === "weekly") {
    const dayDelta = frequency === "daily" ? 1 : 7;
    const nextDay = new Date(Date.UTC(local.year, local.month - 1, local.day + dayDelta));
    local = { ...local, year: nextDay.getUTCFullYear(), month: nextDay.getUTCMonth() + 1, day: nextDay.getUTCDate() };
  } else {
    const nextMonth = new Date(Date.UTC(local.year, local.month, 1));
    const year = nextMonth.getUTCFullYear();
    const month = nextMonth.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    local = {
      ...local,
      year,
      month,
      day: Math.min(dayOfMonthAnchor ?? local.day, lastDay),
    };
  }
  return fromZonedParts(local, timeZone, startsAt.getMilliseconds());
}

function shiftEndByLocalDuration(
  startsAt: Date,
  endsAt: Date,
  nextStartsAt: Date,
  timeZone: string,
): Date {
  const start = getZonedParts(startsAt, timeZone);
  const end = getZonedParts(endsAt, timeZone);
  const nextStart = getZonedParts(nextStartsAt, timeZone);
  const localStartMs = Date.UTC(
    start.year, start.month - 1, start.day, start.hour, start.minute,
    start.second, startsAt.getMilliseconds(),
  );
  const localEndMs = Date.UTC(
    end.year, end.month - 1, end.day, end.hour, end.minute,
    end.second, endsAt.getMilliseconds(),
  );
  const nextLocalStartMs = Date.UTC(
    nextStart.year, nextStart.month - 1, nextStart.day, nextStart.hour,
    nextStart.minute, nextStart.second, nextStartsAt.getMilliseconds(),
  );
  const nextLocalEnd = new Date(nextLocalStartMs + localEndMs - localStartMs);
  return fromZonedParts({
    year: nextLocalEnd.getUTCFullYear(),
    month: nextLocalEnd.getUTCMonth() + 1,
    day: nextLocalEnd.getUTCDate(),
    hour: nextLocalEnd.getUTCHours(),
    minute: nextLocalEnd.getUTCMinutes(),
    second: nextLocalEnd.getUTCSeconds(),
  }, timeZone, nextLocalEnd.getUTCMilliseconds());
}

export function dayOfMonthInTimeZone(date: Date, timeZone: string): number {
  return getZonedParts(date, timeZone).day;
}

export function dateOnlyInTimeZone(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

export function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10) === value;
}

export function advanceRecurringPlanSchedule(
  plan: RecurringPlanSchedule,
  now: Date,
): AdvancedRecurringPlanSchedule {
  let nextStart = plan.startsAt;
  let nextEnd = plan.endsAt;
  let advancedOccurrences = 0;
  let completed = false;

  while (sqlWindowEnd(nextStart, nextEnd) <= now && advancedOccurrences < 20_000) {
    if (
      plan.recurrenceEndDate &&
      dateOnlyInTimeZone(nextStart, plan.recurrenceTimeZone) > plan.recurrenceEndDate
    ) {
      completed = true;
      break;
    }

    const updatedStart = nextOccurrence(
      nextStart,
      plan.frequency,
      plan.recurrenceTimeZone,
      plan.recurrenceDayOfMonth,
    );
    if (
      plan.recurrenceEndDate &&
      dateOnlyInTimeZone(updatedStart, plan.recurrenceTimeZone) > plan.recurrenceEndDate
    ) {
      completed = true;
      break;
    }

    if (nextEnd) {
      nextEnd = shiftEndByLocalDuration(
        nextStart,
        nextEnd,
        updatedStart,
        plan.recurrenceTimeZone,
      );
    }
    nextStart = updatedStart;
    advancedOccurrences += 1;
  }

  return {
    ...plan,
    startsAt: nextStart,
    endsAt: nextEnd,
    frequency: completed ? null : plan.frequency,
    recurrenceDayOfMonth: completed ? null : plan.recurrenceDayOfMonth,
    recurrenceEndDate: completed ? null : plan.recurrenceEndDate,
    advancedOccurrences,
    completed,
  };
}

export async function advanceDueRecurringFriendPlans(
  now = new Date(),
): Promise<number> {
  const duePlans = await db
    .select({
      id: communityEventsTable.id,
      startsAt: communityEventsTable.startsAt,
      endsAt: communityEventsTable.endsAt,
      repeatFrequency: communityEventsTable.repeatFrequency,
      recurrenceTimeZone: communityEventsTable.recurrenceTimeZone,
      recurrenceDayOfMonth: communityEventsTable.recurrenceDayOfMonth,
      recurrenceEndDate: communityEventsTable.recurrenceEndDate,
    })
    .from(communityEventsTable)
    .where(and(
      eq(communityEventsTable.visibility, "invite_only"),
      eq(communityEventsTable.joinApprovalRequired, false),
      eq(communityEventsTable.isHidden, false),
      inArray(communityEventsTable.repeatFrequency, ["daily", "weekly", "monthly"]),
       lte(
         sql`COALESCE(
           ${communityEventsTable.endsAt},
           ${communityEventsTable.startsAt} + INTERVAL '4 hours'
         )`,
         now,
       ),
    ))
    .limit(100);

  let advanced = 0;
  for (const plan of duePlans) {
    const frequency = plan.repeatFrequency as Frequency;
    const timeZone = plan.recurrenceTimeZone || "UTC";
    const next = advanceRecurringPlanSchedule({
      startsAt: plan.startsAt,
      endsAt: plan.endsAt,
      frequency,
      recurrenceTimeZone: timeZone,
      recurrenceDayOfMonth: plan.recurrenceDayOfMonth,
      recurrenceEndDate: plan.recurrenceEndDate,
    }, now);
    if (next.advancedOccurrences === 0 && !next.completed) continue;
    const [updated] = await db
      .update(communityEventsTable)
      .set({
        startsAt: next.startsAt,
        endsAt: next.endsAt,
        repeatFrequency: next.completed ? null : frequency,
        recurrenceDayOfMonth: next.recurrenceDayOfMonth,
        recurrenceEndDate: next.recurrenceEndDate,
        ratingPromptSentAt: null,
        updatedAt: now,
      })
      .where(and(
        eq(communityEventsTable.id, plan.id),
        eq(communityEventsTable.startsAt, plan.startsAt),
        eq(communityEventsTable.repeatFrequency, frequency),
        plan.recurrenceEndDate == null
          ? isNull(communityEventsTable.recurrenceEndDate)
          : eq(communityEventsTable.recurrenceEndDate, plan.recurrenceEndDate),
      ))
      .returning({ id: communityEventsTable.id });
    if (updated) advanced += 1;
  }
  return advanced;
}

function sqlWindowEnd(startsAt: Date, endsAt: Date | null): Date {
  return endsAt ?? new Date(startsAt.getTime() + 4 * 60 * 60 * 1000);
}
