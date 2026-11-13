import { and, count, eq, gte, lt } from "drizzle-orm";
import {
  communityEventsTable,
  db,
  subscriptionsTable,
} from "@workspace/db";

export type MembershipTier = "free" | "plus" | "pro";

export const COMMUNITY_EVENT_CREATION_LIMITS: Record<
  MembershipTier,
  number | null
> = {
  free: 5,
  plus: 20,
  pro: null,
};

export function getUtcMonthWindow(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export function getEffectiveMembershipTier(
  subscription:
    | {
        tier: string;
        status: string;
        expiryDate: Date | null;
      }
    | undefined,
  now: Date,
): MembershipTier {
  if (
    !subscription ||
    subscription.status !== "active" ||
    (subscription.expiryDate && subscription.expiryDate <= now)
  ) {
    return "free";
  }

  return subscription.tier === "plus" || subscription.tier === "pro"
    ? subscription.tier
    : "free";
}

export function buildCommunityEventCreationUsage(
  tier: MembershipTier,
  used: number,
  now: Date,
) {
  const { end } = getUtcMonthWindow(now);
  const limit = COMMUNITY_EVENT_CREATION_LIMITS[tier];

  return {
    tier,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetsAt: end.toISOString(),
  };
}

type UsageReader = Pick<typeof db, "select">;

export async function readCommunityEventCreationUsage(
  reader: UsageReader,
  uid: string,
  now = new Date(),
) {
  const { start, end } = getUtcMonthWindow(now);
  const [subscription] = await reader
    .select({
      tier: subscriptionsTable.tier,
      status: subscriptionsTable.status,
      expiryDate: subscriptionsTable.expiryDate,
    })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userUid, uid))
    .limit(1);
  const [eventCount] = await reader
    .select({ used: count() })
    .from(communityEventsTable)
    .where(
      and(
        eq(communityEventsTable.ownerUid, uid),
        gte(communityEventsTable.createdAt, start),
        lt(communityEventsTable.createdAt, end),
      ),
    );

  return buildCommunityEventCreationUsage(
    getEffectiveMembershipTier(subscription, now),
    Number(eventCount?.used ?? 0),
    now,
  );
}
