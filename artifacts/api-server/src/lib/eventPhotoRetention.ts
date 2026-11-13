export const EVENT_PHOTO_RETENTION_MS = 12 * 60 * 60 * 1000;
export const EVENT_PHOTO_MAX_COUNT = 10;

export function getEventPhotosExpireAt(
  startsAt: Date,
  endsAt: Date | null,
  hasPhotos: boolean,
): Date | null {
  if (!hasPhotos) return null;
  const eventEnd = endsAt ?? new Date(startsAt.getTime() + 4 * 60 * 60 * 1000);
  return new Date(eventEnd.getTime() + EVENT_PHOTO_RETENTION_MS);
}
