import { randomUUID } from "node:crypto";
import { adminStorage } from "./firebaseAdmin";
import { moderateImage } from "./contentModeration";

export class GuestbookPhotoError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/** Drop EXIF/XMP/IPTC and comments (including camera GPS) before publication. */
export function stripJpegMetadata(input: Buffer): Buffer {
  if (input[0] !== 0xff || input[1] !== 0xd8) throw new GuestbookPhotoError(400, "Choose a JPEG photo.");
  const parts = [input.subarray(0, 2)];
  let offset = 2;
  while (offset < input.length) {
    const start = offset;
    if (input[offset++] !== 0xff) throw new GuestbookPhotoError(400, "Invalid photo.");
    while (input[offset] === 0xff) offset++;
    const marker = input[offset++];
    if (marker === 0xda) { // Scan bytes may contain escaped markers; do not parse them.
      parts.push(input.subarray(start));
      return Buffer.concat(parts);
    }
    if (marker === 0xd9 || marker === undefined) break;
    const length = input.readUInt16BE(offset);
    if (length < 2 || offset + length > input.length) throw new GuestbookPhotoError(400, "Invalid photo.");
    if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) parts.push(input.subarray(start, offset + length));
    offset += length;
  }
  throw new GuestbookPhotoError(400, "Invalid photo.");
}

export async function saveGuestbookPhoto(uid: string, base64: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length > 5_592_408) {
    throw new GuestbookPhotoError(400, "Choose a photo smaller than 4 MB.");
  }
  let bytes: Buffer;
  try { bytes = stripJpegMetadata(Buffer.from(base64, "base64")); }
  catch (err) {
    if (err instanceof GuestbookPhotoError) throw err;
    throw new GuestbookPhotoError(400, "Invalid photo.");
  }
  if (bytes.length > 4 * 1024 * 1024) throw new GuestbookPhotoError(413, "Choose a photo smaller than 4 MB.");
  // Unlike the legacy profile path, public guestbook photos fail closed.
  // Visit photos need not contain a face.
  let result;
  try { result = await moderateImage(bytes.toString("base64"), { failClosed: true }); }
  catch { throw new GuestbookPhotoError(503, "Photo checks are unavailable. Please try again."); }
  if (!result.safe) throw new GuestbookPhotoError(422, "This photo does not meet our community guidelines. Choose another photo.");
  const path = `venue-guestbook/${uid}/${randomUUID()}.jpg`;
  const bucket = adminStorage().bucket();
  const file = bucket.file(path);
  const token = randomUUID();
  await file.save(bytes, {
    resumable: false,
    contentType: "image/jpeg",
    metadata: { metadata: { firebaseStorageDownloadTokens: token }, cacheControl: "private, max-age=300" },
  });
  return {
    path,
    url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`,
  };
}

export async function deleteGuestbookPhoto(path: string | null) {
  if (path) await adminStorage().bucket().file(path).delete({ ignoreNotFound: true });
}
