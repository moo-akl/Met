import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hasSocialProfile } from "./socialEligibility";

/** Kept separate from route queries so authorization has an explicit boundary. */
export async function canUseSocialFeatures(uid: string): Promise<boolean> {
  const [profile] = await db.select({
    displayName: profilesTable.displayName,
    photoUrl: profilesTable.photoUrl,
  }).from(profilesTable).where(eq(profilesTable.uid, uid)).limit(1);
  return hasSocialProfile(profile);
}
