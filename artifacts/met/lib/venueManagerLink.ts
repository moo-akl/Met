import { Linking } from "react-native";

const DEFAULT_VENUE_MANAGER_DOMAIN = "met-app.org";

export function getVenueManagerUrl(
  domain = process.env.EXPO_PUBLIC_DOMAIN || DEFAULT_VENUE_MANAGER_DOMAIN,
): string | null {
  const host = (domain?.trim() || DEFAULT_VENUE_MANAGER_DOMAIN)
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
  return host ? `https://${host}/venue-manager/` : null;
}

export async function openVenueManager(): Promise<void> {
  const url = getVenueManagerUrl();
  if (!url) {
    throw new Error("Venue Manager is not available from this build.");
  }
  await Linking.openURL(url);
}
