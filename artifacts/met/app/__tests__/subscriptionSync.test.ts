import fs from "node:fs";
import path from "node:path";

const layoutSource = fs.readFileSync(
  path.join(__dirname, "../_layout.tsx"),
  "utf8",
);
const syncerSource =
  layoutSource.match(/function SubscriptionSyncer\(\)[\s\S]*?return null;\s*}/)?.[0] ??
  "";

describe("RevenueCat subscription server sync", () => {
  it("sends refreshed tiers for active signed-in accounts", () => {
    expect(syncerSource).toMatch(/api\s*\.syncSubscription\s*\(/);
    expect(syncerSource).toMatch(
      /if \(!authedUid \|\| accountLifecycle\.status !== "active" \|\| !isSubscriptionReady\) return;/,
    );
    expect(syncerSource).toMatch(
      /\{ tier, status: tier === "free" \? "inactive" : "active" \}/,
    );
    expect(syncerSource).toMatch(
      /\[authedUid, accountLifecycle\.status, tier, isSubscriptionReady\]/,
    );
  });
});
