import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireUid } from "../middlewares/requireUid";
import { createUserRateLimiter } from "../middlewares/rateLimit";
import { adminStorage } from "../lib/firebaseAdmin";
import { moderateImage } from "../lib/contentModeration";

const router: IRouter = Router();

const photoUploadRateLimiter = createUserRateLimiter({
  windowMs: 60_000,
  max: 5,
  name: "photo-upload",
});

const UploadPhotoBody = z.object({
  // Raw base64 (no `data:` prefix). Limit ~6MB encoded ≈ 4.5MB binary
  // — generous headroom for a heavily-compressed profile photo.
  // contentType is intentionally omitted: MIME type and extension are
  // determined server-side from magic bytes so all format rejections
  // return 415 Unsupported Media Type rather than 400 Bad Request.
  base64: z.string().min(64).max(8 * 1024 * 1024),
});

// JPEG magic bytes: FF D8 FF
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function detectImageType(buf: Buffer): "jpeg" | "png" | null {
  if (
    buf.length >= JPEG_MAGIC.length &&
    JPEG_MAGIC.every((b, i) => buf[i] === b)
  ) {
    return "jpeg";
  }
  if (
    buf.length >= PNG_MAGIC.length &&
    PNG_MAGIC.every((b, i) => buf[i] === b)
  ) {
    return "png";
  }
  return null;
}

function extFor(imageType: "jpeg" | "png"): string {
  return imageType === "png" ? "png" : "jpg";
}

function mimeFor(imageType: "jpeg" | "png"): string {
  return imageType === "png" ? "image/png" : "image/jpeg";
}

router.post(
  "/profiles/me/photo",
  requireUid,
  photoUploadRateLimiter,
  async (req, res) => {
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

    const imageType = detectImageType(buf);
    if (imageType === null) {
      res.status(415).json({
        message:
          "Unsupported media type: only JPEG and PNG images are accepted.",
      });
      return;
    }

    // Content moderation: check for adult/violent/racy content before storing.
    // Double fail-open: contentModeration.ts catches Vision API errors internally,
    // but we also catch here in case of an unexpected throw so a moderation bug
    // never blocks a legitimate upload.
    let moderation: Awaited<ReturnType<typeof moderateImage>>;
    try {
      moderation = await moderateImage(body.base64);
    } catch (err) {
      req.log?.error?.({ err }, "content moderation threw unexpectedly — allowing upload");
      moderation = { safe: true, faceCount: 1 };
    }
    if (!moderation.safe) {
      req.log?.warn?.({ uid }, "profile photo rejected by content moderation");
      res.status(422).json({ message: moderation.reason });
      return;
    }
    if (moderation.faceCount === 0) {
      req.log?.warn?.({ uid }, "profile photo rejected: no face detected");
      res.status(422).json({
        message:
          "We couldn't detect a face in this photo. Please use a clear, well-lit photo showing your face.",
      });
      return;
    }

    const bucket = adminStorage().bucket();
    const objectPath = `profile-photos/${uid}.${extFor(imageType)}`;
    const file = bucket.file(objectPath);

    // Step 1: upload the raw bytes.
    try {
      await file.save(buf, {
        contentType: mimeFor(imageType),
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
      const photoUrl = `https://storage.googleapis.com/${bucket.name}/${objectPath}?v=${Date.now()}`;
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
  },
);

export default router;
