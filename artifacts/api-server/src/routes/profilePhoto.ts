import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireUid } from "../middlewares/requireUid";
import { adminStorage } from "../lib/firebaseAdmin";

const router: IRouter = Router();

// Hand-rolled body schema (kept here instead of @workspace/api-zod to
// avoid a codegen round-trip for a leaf endpoint).
const UploadPhotoBody = z.object({
  // Raw base64 (no `data:` prefix). Limit ~6MB encoded ≈ 4.5MB binary
  // — generous headroom for a heavily-compressed profile photo.
  base64: z.string().min(64).max(8 * 1024 * 1024),
  contentType: z
    .string()
    .regex(/^image\/(jpeg|jpg|png|webp|heic|heif)$/i)
    .default("image/jpeg"),
});

function extFor(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("heic") || lower.includes("heif")) return "heic";
  return "jpg";
}

router.post("/profiles/me/photo", requireUid, async (req, res) => {
  const uid = req.uid!;
  let body: z.infer<typeof UploadPhotoBody>;
  try {
    body = UploadPhotoBody.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
    return;
  }

  const buf = Buffer.from(body.base64, "base64");
  if (buf.length === 0) {
    res.status(400).json({ message: "base64 decoded to empty buffer" });
    return;
  }

  const bucket = adminStorage().bucket();
  // One canonical object per user — repeated uploads overwrite, so we
  // never accumulate orphan blobs and Firestore consumers always see a
  // stable URL prefix per uid.
  const objectPath = `profile-photos/${uid}.${extFor(body.contentType)}`;
  const file = bucket.file(objectPath);

  // `firebaseStorageDownloadTokens` is the magic metadata key Firebase
  // honours: any object that has a token gets a public download URL of
  // the form `/o/<encoded-path>?alt=media&token=<token>`. We keep one
  // stable token per upload so the URL changes on each save (which lets
  // expo-image's cache invalidate naturally and avoids stale previews).
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  try {
    await file.save(buf, {
      contentType: body.contentType,
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=86400",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
  } catch (err) {
    req.log?.error?.({ err }, "profile photo upload failed");
    res.status(500).json({ message: "Photo upload failed" });
    return;
  }

  const photoUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
    `${encodeURIComponent(objectPath)}?alt=media&token=${token}`;

  res.json({ photoUrl });
});

export default router;
