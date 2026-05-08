import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireUid } from "../middlewares/requireUid";
import { adminStorage } from "../lib/firebaseAdmin";

const router: IRouter = Router();

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
  const objectPath = `profile-photos/${uid}.${extFor(body.contentType)}`;
  const file = bucket.file(objectPath);

  // Step 1: upload the raw bytes.
  try {
    await file.save(buf, {
      contentType: body.contentType,
      resumable: false,
    });
  } catch (err) {
    req.log?.error?.({ err }, "profile photo upload failed");
    res.status(500).json({ message: "Photo upload failed" });
    return;
  }

  // Step 2: try to make the object publicly readable (works when the
  // bucket has fine-grained ACLs; silently skipped for uniform-access
  // buckets). If this succeeds we return the simple public GCS URL which
  // never expires and needs no token.
  try {
    await file.makePublic();
    const photoUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
    req.log?.info?.({ uid, photoUrl }, "profile photo made public");
    res.json({ photoUrl });
    return;
  } catch {
    // Uniform bucket-level access — fall through to the download-token path.
  }

  // Step 3 (fallback): set the Firebase download-token via a dedicated
  // setMetadata() call. file.save() with resumable:false does NOT reliably
  // apply custom metadata in all GCS SDK versions, so we always do this as
  // a separate operation to guarantee the token is persisted on the object.
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    await file.setMetadata({
      cacheControl: "public, max-age=86400",
      metadata: { firebaseStorageDownloadTokens: token },
    });
  } catch (err) {
    req.log?.warn?.({ err }, "setMetadata failed; download URL may not work");
  }

  const photoUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
    `${encodeURIComponent(objectPath)}?alt=media&token=${token}`;

  req.log?.info?.({ uid, photoUrl }, "profile photo uploaded with token URL");
  res.json({ photoUrl });
});

export default router;
