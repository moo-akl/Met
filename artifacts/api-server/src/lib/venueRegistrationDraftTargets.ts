import { createHash } from "node:crypto";

export const VENUE_REGISTRATION_DRAFT_TARGETS = [
  "Met - Bestiari - Venue Introduction.pdf",
  "Met - Chequers-British-Pub - Venue Introduction.pdf",
  "Met - Coffee-By-Chance - Venue Introduction.pdf",
  "Met - Do-You-Ever-Social-Club - Venue Introduction.pdf",
  "Met - Garnish-Samui - Venue Introduction.pdf",
  "Met - Hanoi-Coffee-Station - Venue Introduction.pdf",
  "Met - Hub-Social-Barcelona - Venue Introduction.pdf",
  "Met - Le-Maquis-Club - Venue Introduction.pdf",
  "Met - Lot-TwentyTwo - Venue Introduction.pdf",
  "Met - Old-Viet-s-Restaurant - Venue Introduction.pdf",
  "Met - Roselle - Venue Introduction.pdf",
  "Met - Sunset-Beach-Bar-Restaurant - Venue Introduction.pdf",
] as const;

export type VenueRegistrationDraftPdfFilename =
  (typeof VENUE_REGISTRATION_DRAFT_TARGETS)[number];

const VENUE_REGISTRATION_DRAFT_BUSINESS_NAME_ALIASES: Partial<
  Record<VenueRegistrationDraftPdfFilename, readonly string[]>
> = {
  "Met - Hanoi-Coffee-Station - Venue Introduction.pdf": [
    "Hanoi Coffee Station & Restaurant",
  ],
  "Met - Le-Maquis-Club - Venue Introduction.pdf": [
    "Le Maquis Club | Speakeasy Bar",
  ],
};

export const VENUE_REGISTRATION_DRAFT_PDF_SHA256: Record<
  VenueRegistrationDraftPdfFilename,
  string
> = {
  "Met - Bestiari - Venue Introduction.pdf": "c2abdac7a5541406fd824ab984521d6211dfe5c26e377607f9b2315446d91579",
  "Met - Chequers-British-Pub - Venue Introduction.pdf": "d424b7b9b5a2db08647e98c82a0eb4adea56474a11b9ebce229955c07f8d2593",
  "Met - Coffee-By-Chance - Venue Introduction.pdf": "8e17ed3e21e1e15224594dd8fa470335aa062596f8a3a4c86169d4c50bee713a",
  "Met - Do-You-Ever-Social-Club - Venue Introduction.pdf": "baa4d79576f335fb3a9779132f69f98ff8acb106f7c7db50585295d1b8c7f528",
  "Met - Garnish-Samui - Venue Introduction.pdf": "228b099e526c3e660a4198912c7616347e5d8dab61c06ca1fb610686d8c88ebe",
  "Met - Hanoi-Coffee-Station - Venue Introduction.pdf": "becb486e9858e551663cdf0c25b38c1af8664c26ba1f6063c9b72925835fffe3",
  "Met - Hub-Social-Barcelona - Venue Introduction.pdf": "7734de0382721e64c701199658803f93c7a5e09fde7b2f513cfb8bc35f6cdd40",
  "Met - Le-Maquis-Club - Venue Introduction.pdf": "c9473dc1a8b9c776bd100c2afba1ae0f95c77ae364c3ef2b71525d24815a882f",
  "Met - Lot-TwentyTwo - Venue Introduction.pdf": "f786ce85aec60357c3ea6b7eab2b47ae46eed8d92f6d15e0ddb0bf6be59d778d",
  "Met - Old-Viet-s-Restaurant - Venue Introduction.pdf": "8333a3f3c15507442a4f4bd2a358e3b56eeb1333c7c1a93754f8c5a35337f255",
  "Met - Roselle - Venue Introduction.pdf": "05398ca201b1c1ded5295c65250c1f5388fd05cd252964410bff331fd59f0f9b",
  "Met - Sunset-Beach-Bar-Restaurant - Venue Introduction.pdf": "9d5f4cf970db40651771020da9766bef57be77d4a585baf069cffc8bd2aa1a1a",
};

export function isExpectedVenueRegistrationDraftPdf(
  filename: VenueRegistrationDraftPdfFilename,
  bytes: Buffer,
): boolean {
  const expectedHash = VENUE_REGISTRATION_DRAFT_PDF_SHA256[filename];
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  return actualHash === expectedHash;
}

export function normalizeVenueDraftName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function venueNameFromDraftPdf(filename: VenueRegistrationDraftPdfFilename): string {
  return filename.slice("Met - ".length, -" - Venue Introduction.pdf".length);
}

export function venueDraftNameMatchesBusinessName(
  filename: VenueRegistrationDraftPdfFilename,
  businessName: string,
): boolean {
  const normalizedBusinessName = normalizeVenueDraftName(businessName);
  return [
    venueNameFromDraftPdf(filename),
    ...(VENUE_REGISTRATION_DRAFT_BUSINESS_NAME_ALIASES[filename] ?? []),
  ].some((name) => normalizeVenueDraftName(name) === normalizedBusinessName);
}
