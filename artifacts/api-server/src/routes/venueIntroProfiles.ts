import { randomUUID } from "node:crypto";
import {
  CreateVenueIntroProfileBody,
  CreateVenueIntroProfileResponse,
  GetVenueIntroProfilesResponse,
  UpdateVenueIntroProfileBody,
  UpdateVenueIntroProfileParams,
  UpdateVenueIntroProfileResponse,
  type VenueIntroProfile,
  type VenueIntroProfileInput,
} from "@workspace/api-zod";
import { db, venueIntroProfilesTable } from "@workspace/db";
import { Router, type IRouter, type RequestHandler } from "express";
import { defaultVenueIntroProfiles } from "../lib/venueIntroProfiles";

function normalizeName(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase();
}

function normalizeProfileInput(
  input: VenueIntroProfileInput,
): VenueIntroProfileInput {
  return {
    venueName: input.venueName.trim(),
    coverCopy: input.coverCopy.trim(),
    slide2Heading: input.slide2Heading.trim(),
    slide2Copy: input.slide2Copy.trim(),
    slide3Heading: input.slide3Heading.trim(),
    slide3Copy: input.slide3Copy.trim(),
  };
}

function hasEmptyProfileCopy(input: VenueIntroProfileInput): boolean {
  return Object.values(input).some((value) => value.trim().length < 2);
}

function toProfile(row: typeof venueIntroProfilesTable.$inferSelect): VenueIntroProfile {
  return {
    key: row.key,
    venueName: row.venueName,
    coverCopy: row.coverCopy,
    slide2Heading: row.slide2Heading,
    slide2Copy: row.slide2Copy,
    slide3Heading: row.slide3Heading,
    slide3Copy: row.slide3Copy,
  };
}

async function listProfiles(): Promise<VenueIntroProfile[]> {
  const rows = await db.select().from(venueIntroProfilesTable);
  const saved = new Map(rows.map((row) => [row.key, toProfile(row)]));
  const defaultKeys = new Set(defaultVenueIntroProfiles.map((profile) => profile.key));
  const builtIns = defaultVenueIntroProfiles.map(
    (profile) => saved.get(profile.key) ?? profile,
  );
  const custom = rows
    .filter((row) => !defaultKeys.has(row.key))
    .map(toProfile)
    .sort((left, right) => left.venueName.localeCompare(right.venueName));

  return GetVenueIntroProfilesResponse.parse([...builtIns, ...custom]);
}

function makeCustomKey(venueName: string): string {
  const slug =
    venueName
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "venue";

  return `${slug}-${randomUUID().slice(0, 8)}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; cause?: { code?: unknown } };
  return candidate.code === "23505" || candidate.cause?.code === "23505";
}

export function createVenueIntroProfilesRouter(
  requireAdminSession: RequestHandler,
): IRouter {
  const router: IRouter = Router();

  router.get("/venue-intro-profiles", async (_req, res): Promise<void> => {
    res.json(await listProfiles());
  });

  router.post(
    "/admin/venue-intro-profiles",
    requireAdminSession,
    async (req, res): Promise<void> => {
      const parsed = CreateVenueIntroProfileBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Enter all six venue name and slide-copy fields." });
        return;
      }
      const input = normalizeProfileInput(parsed.data);
      const validatedInput = CreateVenueIntroProfileBody.safeParse(input);
      if (!validatedInput.success || hasEmptyProfileCopy(input)) {
        res.status(400).json({
          message: "Each field must contain at least two non-space characters.",
        });
        return;
      }

      const existing = await listProfiles();
      if (
        existing.some(
          (profile) => normalizeName(profile.venueName) === normalizeName(input.venueName),
        )
      ) {
        res.status(409).json({ message: "A venue profile with that name already exists." });
        return;
      }

      const key = makeCustomKey(input.venueName);
      const [created] = await db
        .insert(venueIntroProfilesTable)
        .values({
          key,
          venueName: input.venueName,
          venueNameKey: normalizeName(input.venueName),
          coverCopy: input.coverCopy,
          slide2Heading: input.slide2Heading,
          slide2Copy: input.slide2Copy,
          slide3Heading: input.slide3Heading,
          slide3Copy: input.slide3Copy,
        })
        .onConflictDoNothing()
        .returning();

      if (!created) {
        res.status(409).json({ message: "A venue profile with that name already exists." });
        return;
      }
      res.status(201).json(CreateVenueIntroProfileResponse.parse(toProfile(created)));
    },
  );

  router.put(
    "/admin/venue-intro-profiles/:key",
    requireAdminSession,
    async (req, res): Promise<void> => {
      const params = UpdateVenueIntroProfileParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ message: "Invalid venue profile key." });
        return;
      }
      const parsed = UpdateVenueIntroProfileBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ message: "Enter all six venue name and slide-copy fields." });
        return;
      }
      const input = normalizeProfileInput(parsed.data);
      const validatedInput = UpdateVenueIntroProfileBody.safeParse(input);
      if (!validatedInput.success || hasEmptyProfileCopy(input)) {
        res.status(400).json({
          message: "Each field must contain at least two non-space characters.",
        });
        return;
      }

      const profiles = await listProfiles();
      const current = profiles.find(({ key }) => key === params.data.key);
      if (!current) {
        res.status(404).json({ message: "Venue profile not found." });
        return;
      }
      if (
        profiles.some(
          (profile) =>
            profile.key !== current.key &&
            normalizeName(profile.venueName) === normalizeName(input.venueName),
        )
      ) {
        res.status(409).json({ message: "A venue profile with that name already exists." });
        return;
      }

      try {
        const [updated] = await db
          .insert(venueIntroProfilesTable)
          .values({
            key: current.key,
            venueName: input.venueName,
            venueNameKey: normalizeName(input.venueName),
            coverCopy: input.coverCopy,
            slide2Heading: input.slide2Heading,
            slide2Copy: input.slide2Copy,
            slide3Heading: input.slide3Heading,
            slide3Copy: input.slide3Copy,
          })
          .onConflictDoUpdate({
            target: venueIntroProfilesTable.key,
            set: {
              venueName: input.venueName,
              venueNameKey: normalizeName(input.venueName),
              coverCopy: input.coverCopy,
              slide2Heading: input.slide2Heading,
              slide2Copy: input.slide2Copy,
              slide3Heading: input.slide3Heading,
              slide3Copy: input.slide3Copy,
              updatedAt: new Date(),
            },
          })
          .returning();

        if (!updated) {
          res.status(404).json({ message: "Venue profile not found." });
          return;
        }
        res.json(UpdateVenueIntroProfileResponse.parse(toProfile(updated)));
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          res.status(409).json({ message: "A venue profile with that name already exists." });
          return;
        }
        throw error;
      }
    },
  );

  return router;
}

export default createVenueIntroProfilesRouter;
