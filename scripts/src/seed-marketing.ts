/**
 * seed-marketing.ts
 *
 * Populates the dev DB with "ideal showcase" data for App Store / marketing
 * screenshots.  Safe to re-run — everything uses INSERT … ON CONFLICT DO UPDATE
 * (upsert) so it won't duplicate rows.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed-marketing
 *
 * Prerequisites:
 *   DATABASE_URL env var must point to your local (dev) Postgres instance.
 *   The target profile UID is taken from MARKETING_UID env var (required).
 *
 * What it seeds:
 *   1. Profile   — isPioneer=true, displayName from env (default "Alex Chen")
 *   2. Reviews   — 10 reviews at 5 stars with "Kind" and "Reliable" tags
 *                  → results in 4.9 average rating + those tags on the profile
 *   3. UserStats — trustScore=175 (Trusted), communityStanding=0.98
 *   4. Trophy    — rank 1 monthly crown for a hub ("Central Park")
 *   5. HubCheckins — 22 checkins across 5 "active users" to drive the heatmap
 */

import { db, profilesTable, reviewsTable, userStatsTable, trophiesTable, hubCheckinsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const UID = process.env["MARKETING_UID"];
if (!UID) {
  console.error("Error: MARKETING_UID env var is required.\nSet it to the Firebase Auth UID of the account you want to use for screenshots.");
  process.exit(1);
}

const NAME = process.env["MARKETING_NAME"] ?? "Alex Chen";
const HUB_ID = "hub_central_park_001";
const HUB_NAME = "Central Park";
const LAT = "40.7851";
const LNG = "-73.9683";
const MONTH = new Date().toISOString().slice(0, 7); // "2026-07"

async function run() {
  console.log(`\n🌱  Seeding marketing data for UID: ${UID}\n`);

  // 1. Profile — set isPioneer + verify profile exists
  console.log("→ Updating profile (isPioneer=true)…");
  await db
    .update(profilesTable)
    .set({
      isPioneer: true,
      displayName: NAME,
      isVisible: true,
    })
    .where(eq(profilesTable.uid, UID!));
  console.log("  ✓ profile updated");

  // 2. Reviews — 10 × 5-star reviews from synthetic UIDs
  //    We use context='marketing_seed' to avoid conflicting with real reviews.
  console.log("→ Inserting 10 five-star reviews…");
  const reviewerBase = "seed_reviewer_";
  for (let i = 1; i <= 10; i++) {
    const reviewerUid = `${reviewerBase}${i.toString().padStart(3, "0")}`;
    const tag = i % 2 === 0 ? "Kind" : "Reliable";
    await db
      .insert(reviewsTable)
      .values({
        reviewerUid,
        receiverUid: UID!,
        context: "marketing_seed",
        tag,
        starRating: 5,
        courtesy: 5,
        communication: 5,
        reliability: 5,
      })
      .onConflictDoUpdate({
        target: [reviewsTable.reviewerUid, reviewsTable.receiverUid, reviewsTable.context],
        set: {
          tag,
          starRating: 5,
          courtesy: 5,
          communication: 5,
          reliability: 5,
        },
      });
  }
  console.log("  ✓ 10 reviews inserted (5 × Kind, 5 × Reliable)");

  // 3. UserStats — trustScore=175 (Trusted tier), 98% standing, 10 reviews
  console.log("→ Upserting user_stats (trustScore=175, communityStanding=0.98)…");
  await db
    .insert(userStatsTable)
    .values({
      userUid: UID!,
      trustScore: 175,
      communityStanding: 0.98,
      reviewCount: 10,
    })
    .onConflictDoUpdate({
      target: userStatsTable.userUid,
      set: {
        trustScore: 175,
        communityStanding: 0.98,
        reviewCount: 10,
      },
    });
  console.log("  ✓ user_stats upserted");

  // 4. Trophy — rank 1 monthly crown
  console.log(`→ Inserting rank-1 trophy for ${HUB_NAME} (${MONTH})…`);
  await db
    .insert(trophiesTable)
    .values({
      userUid: UID!,
      hubId: HUB_ID,
      hubName: HUB_NAME,
      monthYear: MONTH,
      rankAchieved: 1,
      trophyType: "monthly_crown",
    })
    .onConflictDoNothing();
  console.log("  ✓ trophy inserted (rank 1 monthly crown)");

  // 5. Hub checkins — 22 entries to populate the heatmap
  //    Mix of the target user + 20 synthetic "active" users all at Central Park.
  console.log("→ Inserting hub checkins for heatmap (22 users at Central Park)…");
  const allUids = [
    UID!,
    ...Array.from({ length: 21 }, (_, i) => `seed_nearby_${(i + 1).toString().padStart(3, "0")}`),
  ];
  for (const u of allUids) {
    await db
      .insert(hubCheckinsTable)
      .values({
        userUid: u,
        placeId: HUB_ID,
        placeName: HUB_NAME,
        lat: LAT,
        lng: LNG,
      })
      .onConflictDoNothing();
  }
  console.log("  ✓ 22 hub checkins inserted");

  // Summary
  console.log(`
✅  Marketing seed complete!

Profile  : ${NAME} (UID: ${UID})
Pioneer  : ✓ (gold shimmer border active)
Rating   : 5.0 × 10 reviews (→ ~4.9 display after algorithm)
Tags     : Kind, Reliable
Trust    : 175 (Trusted — green badge)
Trophy   : 🏆 Rank #1 Monthly Crown — ${HUB_NAME} (${MONTH})
Heatmap  : 22 active users at ${HUB_NAME}

Next steps:
  1. Open the app and navigate to each screenshot view.
  2. For a clean status bar on iOS Simulator:
       xcrun simctl status_bar booted override \\
         --time "9:41" --batteryLevel 100 --batteryState charged \\
         --dataNetwork lte --wifiMode active
  3. Take screenshots from Xcode → Device → Screenshot (or ⌘S in Simulator).
  4. Android equivalent: adb shell settings put global sysui_demo_allowed 1
       then send the STATUS_BAR demo intent (see AOSP docs).
`);

  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
