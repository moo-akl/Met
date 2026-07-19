import { test, expect } from "@playwright/test";

const BUSINESS_FIXTURE = {
  businessId: "biz-001",
  ownerId: "test-uid",
  placeId: "place-xyz",
  name: "Alice's Coffee",
  description: null,
  logoUrl: null,
  mediaUrls: [],
  isActiveSubscription: true,
  subscriptionEndDate: null,
  salesAgentId: null,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  events: [
    {
      eventId: 1,
      businessId: "biz-001",
      title: "Existing Gig Night",
      description: "Weekly live music",
      imageUrl: null,
      startTime: "2030-06-01T20:00:00.000Z",
      endTime: "2030-06-01T23:00:00.000Z",
      createdAt: "2025-01-01T00:00:00.000Z",
    },
  ],
};

const INVALID_IMAGE_URL = "http://localhost:22981/playwright-test-broken-image.jpg";
const VALID_IMAGE_URL = "http://localhost:22981/playwright-test-valid-image.jpg";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>)["__PLAYWRIGHT_TEST_USER__"] = {
      uid: "test-uid",
      email: "test@example.com",
      displayName: "Test User",
      getIdToken: () => Promise.resolve("fake-token"),
    };
  });

  await page.route("**/api/admin/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ isAdmin: false }) })
  );
  await page.route("**/api/business/mine", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ businesses: [BUSINESS_FIXTURE] }) })
  );
  await page.route("**/securetoken.googleapis.com/**", (route) => route.abort());
  await page.route("**/identitytoolkit.googleapis.com/**", (route) => route.abort());

  await page.route(INVALID_IMAGE_URL, (route) => route.abort());
  await page.route(VALID_IMAGE_URL, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG })
  );
});

test("invalid cover image URL shows inline error and blocks the Create Event action", async ({ page }) => {
  await page.goto("/business-portal/events");

  const newEventBtn = page.getByRole("button", { name: /new event/i });
  await newEventBtn.waitFor();
  await newEventBtn.click();

  await page.getByRole("heading", { name: "Create Event" }).waitFor();

  const imageInput = page.getByPlaceholder("https://example.com/event-photo.jpg");
  await imageInput.fill(INVALID_IMAGE_URL);

  await expect(page.getByText(/this url doesn't point to a valid image/i)).toBeVisible({ timeout: 10_000 });

  await page.evaluate(() => {
    const form = document.querySelector("form");
    if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  await expect(
    page.getByText(/cover image url could not be loaded/i)
  ).toBeVisible({ timeout: 5_000 });
});

test("valid cover image URL allows the Create Event form to proceed", async ({ page }) => {
  await page.route("**/api/business/biz-001/events", (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          eventId: 99,
          businessId: "biz-001",
          title: "Test Event",
          description: "",
          imageUrl: VALID_IMAGE_URL,
          startTime: "2030-08-01T14:00:00.000Z",
          endTime: "2030-08-01T16:00:00.000Z",
          createdAt: new Date().toISOString(),
        }),
      });
    } else {
      route.fallback();
    }
  });

  await page.goto("/business-portal/events");

  const newEventBtn = page.getByRole("button", { name: /new event/i });
  await newEventBtn.waitFor();
  await newEventBtn.click();

  await page.getByRole("heading", { name: "Create Event" }).waitFor();

  await page.getByPlaceholder("e.g. Happy Hour, Live Music").fill("Test Event");

  const imageInput = page.getByPlaceholder("https://example.com/event-photo.jpg");
  await imageInput.fill(VALID_IMAGE_URL);

  await expect(
    page.getByAltText("Event cover preview")
  ).toBeVisible({ timeout: 5_000 });

  const previewImg = page.getByAltText("Event cover preview");
  await expect(previewImg).not.toHaveAttribute("style", /display:\s*none/);

  await expect(
    page.getByText(/this url doesn't point to a valid image/i)
  ).not.toBeVisible({ timeout: 5_000 });

  const datetimeInputs = page.locator('input[type="datetime-local"]');
  await datetimeInputs.nth(0).fill("2030-08-01T14:00");
  await datetimeInputs.nth(1).fill("2030-08-01T16:00");

  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().includes("/api/business/biz-001/events") && req.method() === "POST"),
    page.evaluate(() => {
      const form = document.querySelector("form");
      if (form) form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }),
  ]);

  expect(request).toBeTruthy();
  const body = JSON.parse(request.postData() ?? "{}");
  expect(body.imageUrl).toBe(VALID_IMAGE_URL);
});
