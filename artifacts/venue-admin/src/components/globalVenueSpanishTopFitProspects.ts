import type { GlobalVenueProspectData } from "./globalVenueProspects";
import prospectData from "./globalVenueSpanishTopFitProspects.json" with { type: "json" };
import additionalProspectData from "./globalVenueSpanishTopFitAdditionalProspects.json" with { type: "json" };
import hospitalityProspectData from "./globalVenueSpanishHospitalityProspects.json" with { type: "json" };

export const ADDITIONAL_SPANISH_TOP_FIT_VENUE_PROSPECTS =
  additionalProspectData as GlobalVenueProspectData[];

export const SPANISH_HOSPITALITY_VENUE_PROSPECTS =
  hospitalityProspectData as GlobalVenueProspectData[];

export const SPANISH_TOP_FIT_VENUE_PROSPECTS =
  [
    ...prospectData,
    ...ADDITIONAL_SPANISH_TOP_FIT_VENUE_PROSPECTS,
    ...SPANISH_HOSPITALITY_VENUE_PROSPECTS,
  ] as GlobalVenueProspectData[];
