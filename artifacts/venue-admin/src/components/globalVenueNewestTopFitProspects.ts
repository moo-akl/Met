import type { GlobalVenueProspectData } from "./globalVenueProspects";
import prospectData from "./globalVenueNewestTopFitProspects.json" with { type: "json" };

export const NEWEST_TOP_FIT_VENUE_PROSPECTS =
  prospectData as GlobalVenueProspectData[];
