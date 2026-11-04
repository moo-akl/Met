const CANONICAL_APP_URL = "https://met-app.org";

export function buildEventDetailsUrl(
  eventType: "venue" | "member",
  eventId: number,
  previewVersion: number = Date.now(),
): string {
  if (!Number.isSafeInteger(eventId) || eventId <= 0) {
    throw new Error("A valid event ID is required to share this event.");
  }
  if (!Number.isSafeInteger(previewVersion) || previewVersion <= 0) {
    throw new Error("A valid preview version is required to share this event.");
  }

  const url = new URL(`${CANONICAL_APP_URL}/event-details/${eventType}/${eventId}`);
  url.searchParams.set("preview", String(previewVersion));
  return url.toString();
}
