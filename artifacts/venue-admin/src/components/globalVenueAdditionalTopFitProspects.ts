import type { GlobalVenueProspectData } from "./globalVenueProspects";
import prospectData from "./globalVenueAdditionalTopFitProspects.json" with { type: "json" };

export const ADDITIONAL_TOP_FIT_VENUE_PROSPECTS =
  prospectData as GlobalVenueProspectData[];
