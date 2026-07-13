/**
 * simulate-month-end.ts
 *
 * Test script — simulates the month-end cron job by calling
 * POST /api/hubs/crown-monthly-champions with the CRON_SECRET.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run simulate-month-end
 *
 * Prerequisites:
 *   - CRON_SECRET env var must match the server's CRON_SECRET
 *   - API_URL env var should point to the target server
 *     (defaults to http://localhost:80)
 */

const apiUrl = process.env["API_URL"] ?? "http://localhost:80";
const cronSecret = process.env["CRON_SECRET"];

if (!cronSecret) {
  console.error(
    "Error: CRON_SECRET env var is not set.\n" +
      "Set it to the same value as the server's CRON_SECRET secret.",
  );
  process.exit(1);
}

async function run() {
  const url = `${apiUrl}/api/hubs/crown-monthly-champions`;
  console.log(`→ POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret!,
    },
  });

  const body = await res.text();

  if (!res.ok) {
    console.error(`✗ HTTP ${res.status}: ${body}`);
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }

  console.log(`✓ HTTP ${res.status}:`, JSON.stringify(parsed, null, 2));

  const result = parsed as { crowned?: number; month?: string };
  if (typeof result.crowned === "number") {
    console.log(
      `\n🏆  Crowned ${result.crowned} champion(s) for month ${result.month ?? "?"}`,
    );
    if (result.crowned === 0) {
      console.log(
        "   ↳ No check-ins found for the previous calendar month.\n" +
          "   ↳ Tip: Insert test rows into hub_checkins with a created_at\n" +
          "          in the previous month, then re-run this script.",
      );
    }
  }
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
