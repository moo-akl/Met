export type VenueEventRsvpStatus = "going" | "maybe" | "not_going";

export type VenueEventRsvp = {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  status: VenueEventRsvpStatus;
};

export type VenueEventRsvpFilter = "all" | VenueEventRsvpStatus;

export const VENUE_EVENT_RSVP_FILTERS: Array<{
  value: VenueEventRsvpFilter;
  label: string;
}> = [
  { value: "all", label: "All responses" },
  { value: "going", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "not_going", label: "Not going" },
];

export const VENUE_EVENT_RSVP_LABELS: Record<VenueEventRsvpStatus, string> = {
  going: "Going",
  maybe: "Maybe",
  not_going: "Not going",
};

export function countVenueEventRsvps(
  rsvps: readonly VenueEventRsvp[],
): Record<VenueEventRsvpFilter, number> {
  return {
    all: rsvps.length,
    going: rsvps.filter((rsvp) => rsvp.status === "going").length,
    maybe: rsvps.filter((rsvp) => rsvp.status === "maybe").length,
    not_going: rsvps.filter((rsvp) => rsvp.status === "not_going").length,
  };
}

export function filterVenueEventRsvps(
  rsvps: readonly VenueEventRsvp[],
  filter: VenueEventRsvpFilter,
  search: string,
): VenueEventRsvp[] {
  const normalizedSearch = search.trim().toLowerCase();
  return rsvps.filter((rsvp) =>
    (filter === "all" || rsvp.status === filter) &&
    rsvp.displayName.toLowerCase().includes(normalizedSearch),
  );
}
