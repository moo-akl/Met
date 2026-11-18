import { EVENT_PHOTO_MAX_COUNT } from "./eventPhotoRetention";

function getOwnedEventPhotoPath(rawUrl: string, uid: string): string | null {
  try {
    const url = new URL(rawUrl);
    let objectPath: string | null = null;
    if (url.hostname === "storage.googleapis.com") {
      const segments = url.pathname.split("/").filter(Boolean);
      objectPath = segments.slice(1).map(decodeURIComponent).join("/");
    } else if (url.hostname === "firebasestorage.googleapis.com") {
      const match = url.pathname.match(/^\/v0\/b\/[^/]+\/o\/(.+)$/);
      if (match) objectPath = decodeURIComponent(match[1]!);
    }
    if (
      !objectPath ||
      !objectPath.startsWith(`venue-event-images/${uid}/`) ||
      objectPath.split("/").some((part) => part === "..")
    ) {
      return null;
    }
    return objectPath;
  } catch {
    return null;
  }
}

export function validateOwnedEventGalleryPhotos(
  photos: string[] | undefined,
  uid: string,
  existingPhotos: string[] = [],
): string[] | null {
  const uniquePhotos = [...new Set(photos ?? [])];
  if (uniquePhotos.length > EVENT_PHOTO_MAX_COUNT) return null;
  return uniquePhotos.every((photo) =>
    existingPhotos.includes(photo) || getOwnedEventPhotoPath(photo, uid) !== null,
  )
    ? uniquePhotos
    : null;
}
