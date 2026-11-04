const venueApplicationSources = [
  "header",
  "hero",
  "venue_section",
  "faq",
] as const;

export type VenueApplicationSource = (typeof venueApplicationSources)[number];
export type VenueApplicationAttribution = VenueApplicationSource | "direct";

type AnalyticsData = Record<string, string | number | boolean>;

declare global {
  interface Window {
    umami?: {
      track: (name: string, data?: AnalyticsData) => void;
    };
  }
}

export function venueApplicationHref(source: VenueApplicationSource): string {
  return `/apply?source=${source}`;
}

export function getVenueApplicationSource(
  search: string,
): VenueApplicationAttribution {
  const source = new URLSearchParams(search).get("source");
  return venueApplicationSources.find((candidate) => candidate === source) ?? "direct";
}

export function trackEvent(name: string, data?: AnalyticsData): void {
  if (typeof window === "undefined") return;

  try {
    window.umami?.track(name, data);
  } catch {
    // Analytics must never interrupt the application flow.
  }
}

export function trackVenueApplicationStarted(
  source: VenueApplicationAttribution,
): void {
  trackEvent("venue_application_started", { source });
}

export function trackVenueApplicationSubmitted(
  source: VenueApplicationAttribution,
): void {
  trackEvent("venue_application_submitted", { source });
}
