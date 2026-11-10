import { eq, or } from "drizzle-orm";
import { db, notificationInboxTable, profilesTable } from "@workspace/db";

export type PersistedNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string | undefined>;
};

function cleanNotificationData(
  data: PersistedNotificationPayload["data"],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export async function recordNotificationForUser(
  uid: string,
  payload: PersistedNotificationPayload,
): Promise<void> {
  if (!uid) return;
  await db.insert(notificationInboxTable).values({
    uid,
    title: payload.title,
    body: payload.body,
    data: cleanNotificationData(payload.data),
  });
}

/**
 * Push call sites generally have the recipient's device token, not their UID.
 * Resolve the token to its profile so the same notification is available in
 * the signed-in user's inbox even after the OS push is dismissed.
 */
export async function recordNotificationForPushToken(
  token: string | null | undefined,
  payload: PersistedNotificationPayload,
): Promise<void> {
  if (!token) return;
  const [profile] = await db
    .select({ uid: profilesTable.uid })
    .from(profilesTable)
    .where(or(
      eq(profilesTable.pushToken, token),
      eq(profilesTable.uid, token),
    ))
    .limit(1);
  if (!profile) return;
  await recordNotificationForUser(profile.uid, payload);
}
