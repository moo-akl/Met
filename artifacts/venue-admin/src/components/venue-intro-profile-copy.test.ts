import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createPreviousVenueIntroCopyDefaults,
  createDefaultVenueIntroCopy,
  getShortVenueName,
  removeRepeatedVenueName,
  restoreVenueIntroCopy,
  validateVenueIntroCopy,
} from "./venue-intro-profile-copy.ts";

type PdfHookProspect = {
  id: string;
  name: string;
  location: string;
  category: string;
  fitReason: string;
  pdfDisplayName?: string;
  pdfHook?: string;
  pdfHookSourceUrl?: string;
  pdfHookEvidenceQuote?: string;
};

const additionalProspects = JSON.parse(
  readFileSync(new URL("./globalVenueAdditionalTopFitProspects.json", import.meta.url), "utf8"),
) as PdfHookProspect[];

const defaults = createDefaultVenueIntroCopy({
  venueName: "Sample Venue",
  venueCategory: "Independent café",
  venueLocation: "Bangkok, Thailand",
  coverCopy: "Your local events can bring visitors back.",
});

test("builds editable defaults from the verified venue details and fit reason", () => {
  assert.equal(defaults.venueName, "Sample Venue");
  assert.equal(defaults.venueCategory, "Independent café");
  assert.equal(defaults.venueLocation, "Bangkok, Thailand");
  assert.equal(defaults.coverCopy, "Your local events can bring visitors back.");
  assert.deepEqual(validateVenueIntroCopy(defaults), {});
});

test("shortens a descriptive venue title and keeps the full source identity out of repeated PDF copy", () => {
  const fullName = "Arcaley a private cafe venue, cafe for events";
  assert.equal(getShortVenueName(fullName, "Private café venue"), "Arcaley");
  assert.equal(
    getShortVenueName("Arcaley a private café venue, café for events", "Private café venue"),
    "Arcaley",
  );
  assert.equal(
    createDefaultVenueIntroCopy({
      venueName: "Thirsty Meeples Board Game Café Bath",
      pdfDisplayName: "Thirsty Meeples",
      venueCategory: "Board-game café",
      venueLocation: "Bath, United Kingdom",
      coverCopy: "A board-game café with a large library.",
    }).venueName,
    "Thirsty Meeples",
  );
  assert.equal(getShortVenueName("Artist House Bangkok", "Art workshop café · cultural venue"), "Artist House Bangkok");
  assert.equal(
    removeRepeatedVenueName("Arcaley’s event calendar gives guests a reason to return.", "Arcaley"),
    "Your venue’s event calendar gives guests a reason to return.",
  );
});

test("uses distinct, category-aware copy instead of repeating the venue title", () => {
  const tailored = createDefaultVenueIntroCopy({
    venueName: "Arcaley a private cafe venue, cafe for events",
    venueCategory: "Independent café",
    venueLocation: "Bangkok, Thailand",
    coverCopy: "Arcaley’s neighborhood café gives regulars a reason to return.",
  });
  assert.equal(tailored.venueName, "Arcaley");
  assert.equal(tailored.slide2Heading, "Give café regulars a reason to return");
  assert.equal(tailored.slide3Heading, "Start with one Met QR at your venue");
  assert.doesNotMatch(tailored.coverCopy, /Arcaley/i);
  assert.doesNotMatch(`${tailored.slide2Copy} ${tailored.slide3Copy}`, /Arcaley|cafe for events/i);
  assert.match(tailored.slide3Copy, /earn points/);
});

test("creates Spanish venue-specific PDF copy for the Spanish prospect cohort", () => {
  const tailored = createDefaultVenueIntroCopy({
    venueName: "Café de Barbieri",
    venueCategory: "Café y bar",
    venueLocation: "Madrid, Spain",
    coverCopy: "Su trayectoria y sus eventos animan a visitantes a volver.",
    language: "es",
  });
  assert.equal(tailored.slide2Heading, "Dales a tus clientes motivos para volver");
  assert.match(tailored.slide2Copy, /Libro de Visitas/);
  assert.equal(tailored.slide3Heading, "Empieza con un código QR de Met en tu local");
  assert.match(tailored.slide3Copy, /ganan puntos/);
  assert.deepEqual(validateVenueIntroCopy(tailored), {});
  assert.equal(
    removeRepeatedVenueName("Café de Barbieri organiza eventos para sus visitantes.", "Café de Barbieri", "es"),
    "Su local organiza eventos para sus visitantes.",
  );
});

test("migrates generated English PDF defaults to Spanish without discarding deliberate edits", () => {
  const copyInput = {
    venueName: "Teatro Kapital",
    venueCategory: "Discoteca",
    venueLocation: "Madrid, Spain",
    coverCopy: "Su agenda nocturna y sus eventos ofrecen motivos para regresar.",
  };
  const englishDefaults = createDefaultVenueIntroCopy(copyInput);
  const spanishDefaults = createDefaultVenueIntroCopy({ ...copyInput, language: "es" });
  const migrated = restoreVenueIntroCopy(englishDefaults, spanishDefaults, [englishDefaults]);
  const migratedWithEdit = restoreVenueIntroCopy(
    { ...englishDefaults, slide3Copy: "Texto personalizado para el PDF." },
    spanishDefaults,
    [englishDefaults],
  );

  assert.equal(migrated.slide2Heading, spanishDefaults.slide2Heading);
  assert.equal(migrated.slide3Copy, spanishDefaults.slide3Copy);
  assert.equal(migratedWithEdit.slide3Copy, "Texto personalizado para el PDF.");
  assert.equal(migratedWithEdit.slide2Heading, spanishDefaults.slide2Heading);
});

test("uses a verified PDF-only hook without changing category copy", () => {
  const hook = "Your restored century-old house in Khlong Bang Luang hosts an art-workshop café.";
  const tailored = createDefaultVenueIntroCopy({
    venueName: "Artist House Bangkok",
    venueCategory: "Art workshop café · cultural venue",
    venueLocation: "Bangkok, Thailand",
    coverCopy: "Your community-focused workshops give guests a reason to return.",
    pdfHook: hook,
  });
  assert.equal(tailored.coverCopy, hook);
  assert.match(tailored.slide2Copy, /Guest Book memory/);
});

test("every saved PDF-only hook has a valid source link and supporting excerpt", () => {
  const hookedProspects = additionalProspects.filter((prospect) => prospect.pdfHook);
  assert.ok(hookedProspects.length > 0);

  for (const prospect of hookedProspects) {
    assert.ok(prospect.pdfHookSourceUrl, `${prospect.id} is missing a source URL`);
    assert.ok(prospect.pdfHookEvidenceQuote?.trim(), `${prospect.id} is missing its source excerpt`);
    assert.ok(prospect.pdfHook!.length <= 240, `${prospect.id} exceeds the cover-copy limit`);
    assert.notEqual(prospect.pdfHook, prospect.fitReason, `${prospect.id} reused its email fit reason`);
    assert.ok(["http:", "https:"].includes(new URL(prospect.pdfHookSourceUrl).protocol));
    const generatedCopy = createDefaultVenueIntroCopy({
      venueName: prospect.name,
      pdfDisplayName: prospect.pdfDisplayName,
      venueCategory: prospect.category,
      venueLocation: prospect.location,
      coverCopy: prospect.fitReason,
      pdfHook: prospect.pdfHook,
    });
    assert.equal(generatedCopy.coverCopy, prospect.pdfHook, `${prospect.id} did not place its source-backed hook on the PDF cover`);
    assert.equal(
      generatedCopy.venueName,
      prospect.pdfDisplayName || getShortVenueName(prospect.name, prospect.category),
      `${prospect.id} did not use its short PDF display name`,
    );
    const previousDefaults = createPreviousVenueIntroCopyDefaults({
      venueName: prospect.name,
      venueCategory: prospect.category,
      venueLocation: prospect.location,
      coverCopy: prospect.fitReason,
    });
    const migratedCopy = restoreVenueIntroCopy(
      previousDefaults[0],
      generatedCopy,
      previousDefaults,
    );
    assert.equal(
      migratedCopy.coverCopy,
      prospect.pdfHook,
      `${prospect.id} kept its old generic cover copy instead of the verified hook`,
    );
    assert.equal(
      migratedCopy.venueName,
      generatedCopy.venueName,
      `${prospect.id} kept its old long PDF display name`,
    );
  }

  for (const prospect of additionalProspects.filter((item) => !item.pdfHook)) {
    assert.equal(prospect.pdfHookSourceUrl, undefined, `${prospect.id} has a source URL without a hook`);
    assert.equal(prospect.pdfHookEvidenceQuote, undefined, `${prospect.id} has evidence without a hook`);
  }
});

test("rejects blank and over-limit copy before PDF preparation", () => {
  const errors = validateVenueIntroCopy({
    ...defaults,
    venueName: " ",
    slide2Copy: "x".repeat(301),
  });
  assert.equal(errors.venueName, "Enter at least 2 characters.");
  assert.equal(errors.slide2Copy, "Keep this to 300 characters or fewer.");
});

test("restores saved copy while keeping defaults for fields missing from older drafts", () => {
  const restored = restoreVenueIntroCopy(
    { venueName: "Edited PDF Name", slide3Copy: "Custom visitor copy." },
    defaults,
  );
  assert.equal(restored.venueName, "Edited PDF Name");
  assert.equal(restored.slide3Copy, "Custom visitor copy.");
  assert.equal(restored.venueCategory, defaults.venueCategory);
  assert.equal(restored.coverCopy, defaults.coverCopy);
});

test("migrates previously generated repetitive copy but keeps deliberate edits", () => {
  const input = {
    venueName: "Arcaley a private cafe venue, cafe for events",
    venueCategory: "Independent café",
    venueLocation: "Bangkok, Thailand",
    coverCopy: "Your local events can bring visitors back.",
    pdfHook: "Your verified Saturday event brings neighbors together.",
  };
  const currentDefaults = createDefaultVenueIntroCopy(input);
  const previousDefaults = createPreviousVenueIntroCopyDefaults(input);
  const restored = restoreVenueIntroCopy(
    {
      ...previousDefaults[0],
      coverCopy: "A custom cover line for this prospect.",
    },
    currentDefaults,
    previousDefaults,
  );
  const migrated = restoreVenueIntroCopy(previousDefaults[0], currentDefaults, previousDefaults);
  assert.equal(restored.venueName, "Arcaley");
  assert.equal(restored.slide2Heading, currentDefaults.slide2Heading);
  assert.equal(restored.slide2Copy, currentDefaults.slide2Copy);
  assert.equal(migrated.coverCopy, input.pdfHook);
  assert.equal(restored.coverCopy, "A custom cover line for this prospect.");
});
