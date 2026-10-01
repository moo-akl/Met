import { eq, sql } from "drizzle-orm";
import { db, venueActivationPoliciesTable } from "@workspace/db";

const REGISTRATION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const QR_ACTIVATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type ActivationExecutor = Pick<typeof db, "insert" | "update" | "select">;

/**
 * Record the first owner invitation. Repeated invitations retain the original
 * clock and deadline. Call after the first invitation was actually dispatched.
 */
export async function recordVenueInvitation(profileId: number, at = new Date()): Promise<Date> {
  const firstDeadline = new Date(at.getTime() + REGISTRATION_WINDOW_MS);
  const [policy] = await db
    .insert(venueActivationPoliciesTable)
    .values({
      profileId,
      firstInvitationSentAt: at,
      registrationDeadline: firstDeadline,
    })
    .onConflictDoUpdate({
      target: venueActivationPoliciesTable.profileId,
      set: {
        firstInvitationSentAt: sql`coalesce(${venueActivationPoliciesTable.firstInvitationSentAt}, excluded.first_invitation_sent_at)`,
        registrationDeadline: sql`coalesce(${venueActivationPoliciesTable.registrationDeadline}, excluded.registration_deadline)`,
        updatedAt: new Date(),
      },
    })
    .returning({
      firstInvitationSentAt: venueActivationPoliciesTable.firstInvitationSentAt,
      registrationDeadline: venueActivationPoliciesTable.registrationDeadline,
    });

  if (!policy?.firstInvitationSentAt || !policy.registrationDeadline) {
    throw new Error(`Could not record activation invitation for venue profile ${profileId}`);
  }
  return policy.firstInvitationSentAt;
}

export async function getRegistrationDeadline(profileId: number): Promise<Date | null> {
  const [policy] = await db
    .select({
      registrationDeadline: venueActivationPoliciesTable.registrationDeadline,
      exempt: venueActivationPoliciesTable.exempt,
    })
    .from(venueActivationPoliciesTable)
    .where(eq(venueActivationPoliciesTable.profileId, profileId))
    .limit(1);
  // A reinstated, exempt venue may need a fresh usable token without
  // restarting the original activation clock or exposing a past expiry.
  if (policy?.exempt && policy.registrationDeadline && policy.registrationDeadline <= new Date()) return null;
  return policy?.registrationDeadline ?? null;
}

/**
 * Marks a previously opted-in venue as registered. Supplying the caller's
 * transaction executor allows the registration mutation and activation clock
 * to commit atomically. Profiles without an invitation policy remain opted out.
 */
export async function markVenueRegistered(
  profileId: number,
  at = new Date(),
  tx?: ActivationExecutor,
): Promise<void> {
  const executor = tx ?? db;
  const [policy] = await (tx ?? db).select().from(venueActivationPoliciesTable)
    .where(eq(venueActivationPoliciesTable.profileId, profileId)).limit(1).for("update");
  if (!policy) {
    await executor.insert(venueActivationPoliciesTable).values({
      profileId,
      registeredAt: at,
      qrDeadline: new Date(at.getTime() + QR_ACTIVATION_WINDOW_MS),
    });
    return;
  }
  if (policy.unlistedAt || policy.registeredAt ||
      (policy.registrationDeadline && policy.registrationDeadline <= at && !policy.exempt)) {
    throw new Error("This venue is no longer eligible for owner registration.");
  }
  await executor
    .update(venueActivationPoliciesTable)
    .set({
      registeredAt: at,
      qrDeadline: new Date(at.getTime() + QR_ACTIVATION_WINDOW_MS),
      updatedAt: at,
    })
    .where(
      sql`${venueActivationPoliciesTable.profileId} = ${profileId}
        AND ${venueActivationPoliciesTable.registeredAt} IS NULL`,
    );
}