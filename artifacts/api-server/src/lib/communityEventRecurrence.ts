import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { communityEventsTable, db } from "@workspace/db";

type Frequency = "daily" | "weekly" | "monthly";

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
    let nextStart = plan.startsAt;
    let nextEnd = plan.endsAt;
    let shifts = 0;
    while (
      sqlWindowEnd(nextStart, nextEnd) <= now &&
      shifts < 20_000
    ) {
      const updatedStart = nextOccurrence(
        nextStart,
        frequency,
        plan.recurrenceTimeZone || "UTC",
        plan.recurrenceDayOfMonth,
      );
      if (nextEnd) {
        nextEnd = shiftEndByLocalDuration(
          nextStart,
          nextEnd,
          updatedStart,
          plan.recurrenceTimeZone || "UTC",
        );
      }
      nextStart = updatedStart;
      shifts += 1;
    }
    if (shifts === 0) continue;
    const [updated] = await db
      .update(communityEventsTable)
      .set({
        startsAt: nextStart,
        endsAt: nextEnd,
        ratingPromptSentAt: null,
        updatedAt: now,
      })
      .where(and(
        eq(communityEventsTable.id, plan.id),
        eq(communityEventsTable.startsAt, plan.startsAt),
        eq(communityEventsTable.repeatFrequency, frequency),
      ))
      .returning({ id: communityEventsTable.id });
    if (updated) advanced += 1;
  }
  return advanced;
}

function sqlWindowEnd(startsAt: Date, endsAt: Date | null): Date {
  return endsAt ?? new Date(startsAt.getTime() + 4 * 60 * 60 * 1000);
}
