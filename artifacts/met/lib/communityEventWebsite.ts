export const DEFAULT_COMMUNITY_EVENT_WEBSITE = "https://";

export function getInitialCommunityEventWebsiteUrl(
  websiteUrl?: string | null,
): string {
  return websiteUrl?.trim() ? websiteUrl : DEFAULT_COMMUNITY_EVENT_WEBSITE;
}

export function normalizeCommunityEventWebsiteUrl(
  websiteUrl: string,
): string | null {
  const trimmed = websiteUrl.trim();
  if (!trimmed || /^https?:\/\/$/i.test(trimmed)) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
