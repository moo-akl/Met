import type { GlobalVenueProspectData } from "./globalVenueProspects";
import prospectData from "./globalVenueBatch2Prospects.json" with { type: "json" };

export const BATCH2_TOP_FIT_VENUE_PROSPECTS =
  prospectData as GlobalVenueProspectData[];
