/** A private visitor is an authenticated account, not a public social profile. */
export function hasSocialProfile(profile: { displayName?: string | null; photoUrl?: string | null } | null | undefined): boolean {
  return Boolean(profile?.displayName?.trim() && profile?.photoUrl?.trim());
}

/** Safety exits (report/block/remove/delete) deliberately remain available. */
export function needsSocialProfile(method: string, rawPath: string): boolean {
  const path = rawPath.replace(/^\/api(?=\/)/, "");
  if (method === "DELETE") return false;
  if (/^\/(?:encounters|ble\/resolve)(?:\/|$)/.test(path)) return true;
  if (/^\/reveals(?:\/accept)?$/.test(path)) return true;
  if (/^\/chats(?:\/|$)/.test(path)) return true;
  if (method === "GET") return false;
  return (
    /^\/networks(?:\/|$)/.test(path) ||
    /^\/connections\/mark-met$/.test(path) ||
    /^\/(?:reviews|profile-views|hubs\/checkin)$/.test(path) ||
    /^\/hubs\/[^/]+\/review$/.test(path) ||
    /^\/venue-events\/[^/]+\/rsvp$/.test(path)
  );
}
