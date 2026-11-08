import { expect, test, type Page } from "@playwright/test";
import { GLOBAL_VENUE_PROSPECTS } from "../src/components/globalVenueProspects";
import { getNextTopFitVenueBatch } from "../src/components/global-venue-batch-selection";
import { ADDITIONAL_STRONG_FIT_VENUE_PROSPECTS } from "../src/components/globalVenueAdditionalStrongFitProspects";
import { ADDITIONAL_TOP_FIT_VENUE_PROSPECTS } from "../src/components/globalVenueAdditionalTopFitProspects";
import { NEWEST_TOP_FIT_VENUE_PROSPECTS } from "../src/components/globalVenueNewestTopFitProspects";
import { BATCH2_TOP_FIT_VENUE_PROSPECTS } from "../src/components/globalVenueBatch2Prospects";
import {
  ADDITIONAL_SPANISH_TOP_FIT_VENUE_PROSPECTS,
  SPANISH_HOSPITALITY_VENUE_PROSPECTS,
  SPANISH_TOP_FIT_VENUE_PROSPECTS,
} from "../src/components/globalVenueSpanishTopFitProspects";
import { ENGLISH_TOP_FIT_VENUE_PROSPECTS } from "../src/components/globalVenueEnglishTopFitProspects";
import { ADDITIONAL_ENGLISH_VENUE_PROSPECTS } from "../src/components/globalVenueEnglishAdditionalProspects";

const selectedSummary = (page: Page) => page.getByText(/^\d+ of 100 selected/);

async function expectFirstPageRange(page: Page, count: number) {
  const end = Math.min(count, 20);
  const pageCount = Math.ceil(count / 20);
  await expect(page.getByText(
    `1–${end} of ${count} matching · Page 1/${pageCount}`,
    { exact: true },
  )).toBeVisible();
}

async function clearSelectedBatch(page: Page) {
  const summary = selectedSummary(page);
  await expect(summary).toBeVisible();
  for (let pageIndex = 0; pageIndex < 31; pageIndex += 1) {
    const selectedCount = Number((await summary.textContent())?.match(/^(\d+)/)?.[1] ?? 0);
    if (selectedCount === 0) return;

    const clearPage = page.getByRole("button", { name: "Clear page selection", exact: true });
    if (await clearPage.count()) await clearPage.click();
    if (Number((await summary.textContent())?.match(/^(\d+)/)?.[1] ?? 0) === 0) return;

    const nextPage = page.getByRole("button", { name: "Next venue drafts page" });
    if (pageIndex === 30 || !(await nextPage.isEnabled())) break;
    await nextPage.click();
  }
  await expect(summary).toHaveText(/^0 of 100 selected/);
}

test("the venue list includes each planned cohort without duplicate contacts", () => {
  expect(ADDITIONAL_STRONG_FIT_VENUE_PROSPECTS).toHaveLength(100);
  expect(ADDITIONAL_TOP_FIT_VENUE_PROSPECTS).toHaveLength(200);
  expect(NEWEST_TOP_FIT_VENUE_PROSPECTS).toHaveLength(120);
  expect(BATCH2_TOP_FIT_VENUE_PROSPECTS).toHaveLength(100);
  expect(ADDITIONAL_SPANISH_TOP_FIT_VENUE_PROSPECTS).toHaveLength(40);
  expect(SPANISH_HOSPITALITY_VENUE_PROSPECTS).toHaveLength(50);
  expect(SPANISH_TOP_FIT_VENUE_PROSPECTS).toHaveLength(150);
  expect(ADDITIONAL_ENGLISH_VENUE_PROSPECTS).toHaveLength(40);
  expect(ENGLISH_TOP_FIT_VENUE_PROSPECTS).toHaveLength(90);
  expect(GLOBAL_VENUE_PROSPECTS.filter((venue) => venue.outreachLanguage === "es")).toHaveLength(150);
  expect(GLOBAL_VENUE_PROSPECTS.filter((venue) => venue.outreachLanguage === "en")).toHaveLength(90);
  expect(SPANISH_TOP_FIT_VENUE_PROSPECTS.filter((venue) => venue.email.trim())).toHaveLength(104);
  expect(SPANISH_TOP_FIT_VENUE_PROSPECTS.filter((venue) => venue.outreachHoldReason)).toHaveLength(46);
  expect(GLOBAL_VENUE_PROSPECTS).toHaveLength(816);
  expect(GLOBAL_VENUE_PROSPECTS.filter((venue) => venue.fitTier === "top")).toHaveLength(677);
  expect(GLOBAL_VENUE_PROSPECTS.filter((venue) => venue.fitTier === "strong")).toHaveLength(139);
  expect(new Set(GLOBAL_VENUE_PROSPECTS.map((venue) => venue.id)).size).toBe(816);
  expect(new Set(GLOBAL_VENUE_PROSPECTS.filter((venue) => venue.email.trim()).map((venue) => venue.email.trim().toLowerCase())).size)
    .toBe(GLOBAL_VENUE_PROSPECTS.filter((venue) => venue.email.trim()).length);
  expect(new Set(ADDITIONAL_STRONG_FIT_VENUE_PROSPECTS.map((venue) => venue.fitReason)).size).toBe(100);
  for (const venue of ADDITIONAL_STRONG_FIT_VENUE_PROSPECTS) {
    expect(venue.emailEvidenceQuote.toLowerCase()).toContain(venue.email.toLowerCase());
    expect(venue.emailEvidenceUrl).toMatch(/^https:\/\//);
    expect(venue.fitReason.length).toBeGreaterThan(50);
  }
  const regionCounts = ADDITIONAL_TOP_FIT_VENUE_PROSPECTS.reduce<Record<string, number>>((counts, venue) => {
    counts[venue.region ?? "missing"] = (counts[venue.region ?? "missing"] ?? 0) + 1;
    return counts;
  }, {});
  expect(regionCounts).toEqual({
    Europe: 40,
    "North America": 40,
    "Latin America and the Caribbean": 40,
    "Asia-Pacific": 40,
    "Africa and the Middle East": 40,
  });
  for (const venue of ADDITIONAL_TOP_FIT_VENUE_PROSPECTS) {
    expect(venue.emailEvidenceQuote.toLowerCase()).toContain(venue.email.toLowerCase());
    expect(venue.emailEvidenceUrl).toMatch(/^https?:\/\//);
    expect(venue.fitEvidenceUrl).toMatch(/^https?:\/\//);
    expect(venue.fitReason.length).toBeGreaterThan(50);
  }
  const newestIds = new Set(NEWEST_TOP_FIT_VENUE_PROSPECTS.map((venue) => venue.id));
  const existingProspects = GLOBAL_VENUE_PROSPECTS.filter((venue) => !newestIds.has(venue.id));
  const normalizeIdentity = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const existingIdentities = new Set(existingProspects.map((venue) =>
    normalizeIdentity(`${venue.name} ${venue.location.split(",")[0]}`),
  ));
  for (const venue of NEWEST_TOP_FIT_VENUE_PROSPECTS) {
    if (venue.email.trim()) {
      expect(venue.emailEvidenceQuote.toLowerCase()).toContain(venue.email.toLowerCase());
      expect(venue.emailEvidenceUrl).toMatch(/^https?:\/\//);
    } else {
      expect(venue.outreachHoldReason).toBeTruthy();
    }
    expect(venue.fitEvidenceUrl).toMatch(/^https:\/\//);
    expect(venue.fitReason.length).toBeGreaterThan(50);
    expect(existingIdentities.has(normalizeIdentity(`${venue.name} ${venue.location.split(",")[0]}`))).toBe(false);
  }
  const spanishIds = new Set(SPANISH_TOP_FIT_VENUE_PROSPECTS.map((venue) => venue.id));
  const newSpanishIdentities = ADDITIONAL_SPANISH_TOP_FIT_VENUE_PROSPECTS.map((venue) =>
    normalizeIdentity(`${venue.name} ${venue.location.split(",")[0]}`),
  );
  expect(new Set(newSpanishIdentities).size).toBe(40);
  const hospitalityIdentities = SPANISH_HOSPITALITY_VENUE_PROSPECTS.map((venue) =>
    normalizeIdentity(`${venue.name} ${venue.location.split(",")[0]}`),
  );
  expect(new Set(hospitalityIdentities).size).toBe(50);
  for (const venue of SPANISH_HOSPITALITY_VENUE_PROSPECTS) {
    expect(venue.email.trim()).toBeTruthy();
    expect(venue.emailEvidenceQuote.toLowerCase()).toContain(venue.email.toLowerCase());
    expect(venue.emailEvidenceUrl).toMatch(/^https?:\/\//);
    expect(venue.fitEvidenceUrl).toMatch(/^https?:\/\//);
    expect(venue.fitReason.length).toBeGreaterThan(50);
    expect(venue.discoverySourceUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\//);
  }
  for (const venue of ADDITIONAL_SPANISH_TOP_FIT_VENUE_PROSPECTS) {
    expect(venue.fitEvidenceQuote?.trim()).toBeTruthy();
    expect(venue.fitEvidenceUrl).toMatch(/^https:\/\//);
  }
  const identitiesWithoutSpanish = new Set(GLOBAL_VENUE_PROSPECTS
    .filter((venue) => !spanishIds.has(venue.id))
    .map((venue) => normalizeIdentity(`${venue.name} ${venue.location.split(",")[0]}`)));
  for (const venue of SPANISH_TOP_FIT_VENUE_PROSPECTS) {
    expect(venue.emailEvidenceUrl).toMatch(/^https?:\/\//);
    expect(venue.fitEvidenceUrl).toMatch(/^https?:\/\//);
    expect(venue.fitReason.length).toBeGreaterThan(50);
    expect(venue.contactUrl).toMatch(/^(https?:\/\/|mailto:|tel:)/);
    if (venue.email.trim()) {
      expect(venue.emailEvidenceQuote.toLowerCase()).toContain(venue.email.toLowerCase());
    } else {
      expect(venue.outreachHoldReason).toMatch(/(?:correo|correos) (?:empresarial|empresariales) (?:general )?publicados?/i);
    }
    if (venue.discoverySourceUrl) {
      expect(venue.discoverySourceUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\//);
    }
    expect(identitiesWithoutSpanish.has(normalizeIdentity(`${venue.name} ${venue.location.split(",")[0]}`))).toBe(false);
  }

  const englishIds = new Set(ENGLISH_TOP_FIT_VENUE_PROSPECTS.map((venue) => venue.id));
  const englishIdentities = ENGLISH_TOP_FIT_VENUE_PROSPECTS.map((venue) =>
    normalizeIdentity(`${venue.name} ${venue.location.split(",")[0]}`),
  );
  expect(new Set(englishIdentities).size).toBe(90);
  const identitiesWithoutEnglish = new Set(GLOBAL_VENUE_PROSPECTS
    .filter((venue) => !englishIds.has(venue.id))
    .map((venue) => normalizeIdentity(`${venue.name} ${venue.location.split(",")[0]}`)));
  for (const venue of ENGLISH_TOP_FIT_VENUE_PROSPECTS) {
    expect(venue.outreachLanguage).toBe("en");
    expect(venue.contactUrl).toMatch(/^(https?:\/\/|mailto:)/);
    expect(venue.fitEvidenceUrl).toMatch(/^https:\/\//);
    expect(venue.fitEvidenceQuote?.trim()).toBeTruthy();
    expect(venue.fitReason.length).toBeGreaterThan(50);
    expect(venue.discoverySourceUrl).toMatch(/^https:\/\/www\.openstreetmap\.org\/(?:node|way|relation)\//);
    expect(identitiesWithoutEnglish.has(normalizeIdentity(`${venue.name} ${venue.location.split(",")[0]}`))).toBe(false);
    if (venue.email.trim()) {
      expect(venue.emailEvidenceQuote.toLowerCase()).toContain(venue.email.toLowerCase());
      expect(venue.emailEvidenceUrl).toMatch(/^https:\/\//);
    } else {
      expect(venue.outreachHoldReason).toBeTruthy();
      expect(venue.contactFormDraft).toContain(venue.name);
    }
  }
  const chicagoSnakesLattes = GLOBAL_VENUE_PROSPECTS.find(
    (venue) => venue.id === "en-new-chicago-snakes-lattes",
  );
  expect(chicagoSnakesLattes?.outreachHoldReason).toMatch(
    /Snakes & Lattes College on Oct 22 and Oct 27, 2026/,
  );
  expect(getNextTopFitVenueBatch([chicagoSnakesLattes!], [], [])).toEqual([]);
  expect(ADDITIONAL_ENGLISH_VENUE_PROSPECTS.filter((venue) => !venue.email.trim())).toHaveLength(12);
});

test("fit-tier filtering and selection preserve outreach and suppression safeguards", async ({ page }) => {
  await page.goto("/venue-admin/browser-tests/venue-invitation-tiers.html");

  const tierFilter = page.getByLabel("Filter venue drafts by cohort or fit tier");
  await expect(tierFilter).toHaveValue("all");
  await expectFirstPageRange(page, 816);
  await expect(selectedSummary(page)).toHaveText(/^100 of 100 selected/);
  await expect(page.getByRole("option", { name: "Top fit (677)" })).toBeAttached();
  await expect(page.getByRole("option", { name: "Strong fit (139)" })).toBeAttached();
  await expect(page.getByRole("option", { name: "New cafés, bars & pubs (100)" })).toBeAttached();
  await expect(page.getByRole("option", { name: "New worldwide top-fit venues (200)" })).toBeAttached();
  await expect(page.getByRole("option", { name: "Latest top-fit venues (120)" })).toBeAttached();
  await expect(page.getByRole("option", { name: "Batch 2 — 100 additional venues (100)" })).toBeAttached();
  await expect(page.getByRole("option", { name: "Spanish-speaking top-fit venues (150)" })).toBeAttached();
  await expect(page.getByRole("option", { name: "English-speaking venue cohort (90)" })).toBeAttached();

  await clearSelectedBatch(page);
  await tierFilter.selectOption("english");
  await expectFirstPageRange(page, 90);
  await expect(page.getByRole("heading", { name: "Abuelo" })).toBeVisible();
  await expect(selectedSummary(page)).toHaveText(/^0 of 100 selected/);
  await page.getByRole("button", { name: "Next venue drafts page" }).click();
  await page.getByRole("button", { name: "Next venue drafts page" }).click();
  const heldBrel = page.locator("article").filter({ has: page.getByRole("heading", { name: "Brel" }) });
  await expect(heldBrel.getByText("No public business email")).toBeVisible();
  await expect(heldBrel.getByText(/No general business email was verified/)).toBeVisible();
  await expect(heldBrel.getByRole("link", { name: "Official contact route" })).toHaveAttribute("href", "https://www.brelbar.com/group-booking");
  await expect(heldBrel.getByRole("checkbox", { name: "Include Brel" })).toBeDisabled();
  await heldBrel.getByText("Personalized contact-form draft").click();
  await expect(heldBrel.getByText(/Hello, team at Brel/)).toBeVisible();
  await tierFilter.selectOption("all");
  await tierFilter.selectOption("top");
  await expectFirstPageRange(page, 677);
  await expect(page.getByRole("heading", { name: "Artist House Bangkok" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Artist House Bangkok" }).getByText("Top fit", { exact: true })).toBeVisible();

  await tierFilter.selectOption("strong");
  await expectFirstPageRange(page, 139);
  await expect(page.getByRole("heading", { name: "G Hotel Amman" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "G Hotel Amman" }).getByText("Strong fit", { exact: true })).toBeVisible();
  await expect(page.getByText("1 prior outreach attempt in history. Review the worklist before resending; it remains selectable.")).toBeVisible();

  const contactedCheckbox = page.getByRole("checkbox", { name: "Include G Hotel Amman" });
  const suppressedCheckbox = page.getByRole("checkbox", { name: "Include Chinese American Museum, Los Angeles" });
  await expect(contactedCheckbox).not.toBeChecked();
  await expect(contactedCheckbox).toBeEnabled();
  await expect(suppressedCheckbox).not.toBeChecked();
  await expect(suppressedCheckbox).toBeDisabled();

  await contactedCheckbox.check();
  await expect(contactedCheckbox).toBeChecked();
  await expect(suppressedCheckbox).not.toBeChecked();
  await expect(selectedSummary(page)).toHaveText(/^1 of 100 selected/);
});

test("Spanish top-fit venues separate email-ready contacts from public-route-only venues", async ({ page }) => {
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().includes("/outreach/manual-send")) sends += 1;
  });
  await page.goto("/venue-admin/browser-tests/venue-invitation-tiers.html");
  const tierFilter = page.getByLabel("Filter venue drafts by cohort or fit tier");
  await tierFilter.selectOption("spanish");
  await expect(page.getByText("1–20 of 150 matching · Page 1/8")).toBeVisible();

  const murCafe = page.locator("article").filter({ has: page.getByRole("heading", { name: "Mür Café" }) });
  await expect(murCafe.getByText("No public business email")).toBeVisible();
  await expect(murCafe.getByRole("checkbox", { name: "Include Mür Café" })).toBeDisabled();
  await expect(murCafe.getByText(/No hay un correo empresarial publicado/)).toBeVisible();

  const teatroKapital = page.locator("article").filter({ has: page.getByRole("heading", { name: "Teatro Kapital" }) });
  await expect(teatroKapital.getByText("info@teatrokapital.com").first()).toBeVisible();
  await expect(teatroKapital.getByRole("checkbox", { name: "Include Teatro Kapital" })).toBeEnabled();
  await teatroKapital.getByTestId("button-preview-venue-invitation-es-topfit-teatro-kapital").click();
  await expect(teatroKapital.getByText("Subject: Una nota para Teatro Kapital")).toBeVisible();
  const spanishEmailPreview = page.frameLocator('iframe[title="Teatro Kapital invitation preview"]');
  await expect(spanishEmailPreview.locator("body")).toContainText("Hola, equipo de Teatro Kapital:");
  await expect(spanishEmailPreview.locator("body")).toContainText("Me llamó la atención");
  await expect(spanishEmailPreview.locator("body")).toContainText("Su agenda nocturna");
  await expect(spanishEmailPreview.locator("body")).not.toContainText("Hello, Teatro Kapital team");

  const chinaski = page.locator("article").filter({ has: page.getByRole("heading", { name: "Chinaski Lavapiés" }) });
  await expect(chinaski.getByText("barchinaskilavapies@gmail.com").first()).toBeVisible();
  await expect(chinaski.getByRole("checkbox", { name: "Include Chinaski Lavapiés" })).toBeEnabled();
  expect(sends).toBe(0);
});

test("Spanish invitation preparation renders a Spanish PDF without sending", async ({ page }) => {
  test.setTimeout(120_000);
  let sends = 0;
  const slideRequests: string[] = [];
  await page.route("**/met-venue-intro/allslides**", async (route) => {
    slideRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><html lang="es"><head><style>body{margin:0}</style></head><body>
        <section data-slide-id="spanish-test" style="box-sizing:border-box;width:1920px;height:1080px;padding:80px;background:#f5f5ef;color:#183c2f;font:80px Arial,sans-serif">
          Conecta con tus visitantes reales
        </section>
      </body></html>`,
    });
  });
  page.on("request", (request) => {
    if (request.url().includes("/outreach/manual-send")) sends += 1;
  });

  await page.goto("/venue-admin/browser-tests/venue-invitation-tiers.html");
  await clearSelectedBatch(page);
  const tierFilter = page.getByLabel("Filter venue drafts by cohort or fit tier");

  await tierFilter.selectOption("spanish");
  await page.getByRole("button", { name: "Next venue drafts page" }).click();
  await page.getByRole("button", { name: "Next venue drafts page" }).click();
  await expect(page.getByText("41–60 of 150 matching · Page 3/8")).toBeVisible();
  const cafeLibertad = page.locator("article").filter({ has: page.getByRole("heading", { name: "Café Libertad 8" }) });
  await expect(cafeLibertad.getByRole("link", { name: "OpenStreetMap discovery · © OpenStreetMap contributors" }))
    .toHaveAttribute("href", "https://www.openstreetmap.org/search?query=Caf%C3%A9%20Libertad%208%20Madrid%20Spain");
  await cafeLibertad.getByRole("checkbox", { name: "Include Café Libertad 8" }).check();
  await page.getByRole("button", { name: "Prepare 1 email and PDFs" }).click();

  await expect(page.getByText("Ready · 1 personalized PDF", { exact: true })).toBeVisible({ timeout: 90_000 });
  await page.getByText("Preview Café Libertad 8 PDF", { exact: true }).click();
  await expect(page.getByTitle("Café Libertad 8 personalized Met introduction PDF")).toBeVisible();
  expect(slideRequests).toHaveLength(1);
  const slideUrl = new URL(slideRequests[0]);
  expect(slideUrl.searchParams.get("lang")).toBe("es");
  expect(slideUrl.searchParams.get("venueProfile")).toContain("Café Libertad 8");
  await expect(page.getByRole("button", { name: "Send 1 personalized email" })).toBeEnabled();
  expect(sends).toBe(0);
});

test("filters let admins add a new-cohort venue without changing earlier selections", async ({ page }) => {
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().includes("/outreach/manual-send")) sends += 1;
  });
  await page.goto("/venue-admin/browser-tests/venue-invitation-tiers.html");
  await clearSelectedBatch(page);
  const tierFilter = page.getByLabel("Filter venue drafts by cohort or fit tier");
  await tierFilter.selectOption("top");
  const artistHouse = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Artist House Bangkok" }),
  });
  const artistHouseCheckbox = artistHouse.getByRole("checkbox", { name: "Include Artist House Bangkok" });
  await artistHouseCheckbox.check();
  await expect(selectedSummary(page)).toHaveText(/^1 of 100 selected/);

  await tierFilter.selectOption("new");
  await expectFirstPageRange(page, 100);
  await expect(page.getByRole("heading", { name: "Ottoman Coffeehouse" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "G Hotel Amman" })).toHaveCount(0);
  const ottoman = page.locator("article").filter({ has: page.getByRole("heading", { name: "Ottoman Coffeehouse" }) });
  const ottomanCheckbox = ottoman.getByRole("checkbox", { name: "Include Ottoman Coffeehouse" });
  await expect(ottomanCheckbox).not.toBeChecked();
  await ottomanCheckbox.check();
  await expect(selectedSummary(page)).toHaveText(/^2 of 100 selected/);

  await tierFilter.selectOption("top");
  await expect(artistHouseCheckbox).toBeChecked();
  await tierFilter.selectOption("new");
  await expect(ottomanCheckbox).toBeChecked();
  expect(sends).toBe(0);
});

test("admins can review the new 200 top-fit venues separately without altering the existing 100 filter", async ({ page }) => {
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().includes("/outreach/manual-send")) sends += 1;
  });
  await page.goto("/venue-admin/browser-tests/venue-invitation-tiers.html");
  const tierFilter = page.getByLabel("Filter venue drafts by cohort or fit tier");
  await tierFilter.selectOption("newTop");
  await expectFirstPageRange(page, 200);
  await expect(page.getByRole("heading", { name: "Antico Caffè San Marco" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Antico Caffè San Marco" }).getByRole("link", { name: "Venue-fit source" })).toHaveAttribute("href", "https://www.caffesanmarco.com/");
  await expect(page.getByRole("heading", { name: "Ottoman Coffeehouse" })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "New cafés, bars & pubs (100)" })).toBeAttached();
  expect(sends).toBe(0);

  await tierFilter.selectOption("new");
  await expectFirstPageRange(page, 100);
  await expect(page.getByRole("heading", { name: "Ottoman Coffeehouse" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Antico Caffè San Marco" })).toHaveCount(0);
  expect(sends).toBe(0);
});

test("admins can review the latest 100 top-fit venues separately without sending", async ({ page }) => {
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().includes("/outreach/manual-send")) sends += 1;
  });
  await page.goto("/venue-admin/browser-tests/venue-invitation-tiers.html");
  const tierFilter = page.getByLabel("Filter venue drafts by cohort or fit tier");
  await tierFilter.selectOption("newestTop");
  await expectFirstPageRange(page, 120);
  await expect(page.getByRole("heading", { name: NEWEST_TOP_FIT_VENUE_PROSPECTS[0].name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Artist House Bangkok" })).toHaveCount(0);
  expect(sends).toBe(0);
});

test("Batch 2 stays unselected until an admin selects its separate cohort", async ({ page }) => {
  await page.goto("/venue-admin/browser-tests/venue-invitation-tiers.html");
  await clearSelectedBatch(page);
  const tierFilter = page.getByLabel("Filter venue drafts by cohort or fit tier");

  await tierFilter.selectOption("batch2");
  await expectFirstPageRange(page, 100);
  await expect(selectedSummary(page)).toHaveText(/^0 of 100 selected/);
  const selectUncontactedPage = page.getByRole("button", { name: /^Select page with no history \(\d+\)$/ });
  const pageSelectionCount = Number((await selectUncontactedPage.textContent())?.match(/\((\d+)\)/)?.[1] ?? 0);
  expect(pageSelectionCount).toBeGreaterThan(0);
  await selectUncontactedPage.click();
  await expect(selectedSummary(page)).toHaveText(new RegExp(`^${pageSelectionCount} of 100 selected`));
  await page.getByRole("button", { name: "Clear page selection", exact: true }).click();
  await expect(selectedSummary(page)).toHaveText(/^0 of 100 selected/);
});

test("the default outreach batch stays capped at 100", async ({ page }) => {
  await page.goto("/venue-admin/browser-tests/venue-invitation-tiers.html");
  await expect(selectedSummary(page)).toHaveText(/^100 of 100 selected/);
  await expect(page.getByRole("button", { name: "Select next batch (100)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare 100 emails and PDFs" })).toBeEnabled();
  await expect(page.locator('iframe[title$="invitation preview"]')).toHaveCount(0);
});

test("draft email previews are not mounted until opened and are removed when closed", async ({ page }) => {
  await page.goto("/venue-admin/browser-tests/venue-invitation-tiers.html");
  const row = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Artist House Bangkok" }),
  });
  const preview = row.getByTestId("iframe-venue-invitation-preview-artist-house-bangkok");
  const toggle = row.getByTestId("button-preview-venue-invitation-artist-house-bangkok");
  const draftPreviews = page.locator('iframe[title$="invitation preview"]');

  await expect(draftPreviews).toHaveCount(0);
  await toggle.click();
  await expect(preview).toHaveCount(1);
  await expect(draftPreviews).toHaveCount(1);
  await toggle.click();
  await expect(preview).toHaveCount(0);
  await expect(draftPreviews).toHaveCount(0);
});
