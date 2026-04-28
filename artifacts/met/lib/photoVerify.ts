import { NativeModules, Platform } from "react-native";
import FaceDetection from "@react-native-ml-kit/face-detection";

export type PhotoVerificationStage = "face" | "content";

export type PhotoVerificationResult =
  | { ok: true }
  | { ok: false; stage: PhotoVerificationStage; reason: string };

export const PHOTO_VERIFY_STAGE_MS = 700;

export const PHOTO_VERIFY_FAIL_REASONS: Record<PhotoVerificationStage, string> =
  {
    face:
      "We couldn't see exactly one clear face. Please use a recent solo photo of yourself in good light.",
    content:
      "This image doesn't meet our community guidelines. Please choose a different photo.",
  };

// On-device face detection via Google ML Kit. The native module is only
// linked into real iOS/Android builds (EAS / dev client). Expo Go and the
// web preview don't include it, so we detect that and pass through to
// keep development unblocked. Production store builds run the real check.
const HAS_NATIVE_FACE_DETECTION =
  Platform.OS !== "web" && Boolean(NativeModules.FaceDetection);

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runFaceCheck(uri: string): Promise<boolean> {
  if (!HAS_NATIVE_FACE_DETECTION) {
    // Dev fallback: web preview or Expo Go without the linked native module.
    // Keep the visible stage timing so the verifier UI feels consistent.
    await delay(PHOTO_VERIFY_STAGE_MS);
    return true;
  }

  try {
    const faces = await FaceDetection.detect(uri, {
      performanceMode: "fast",
      // Require the face to occupy at least 15% of the image width — filters
      // out tiny faces in group / scenery shots.
      minFaceSize: 0.15,
    });
    // Exactly one clear face — matches the user-facing copy.
    return faces.length === 1;
  } catch {
    // If the native call throws unexpectedly we fail closed: surface the
    // standard "no face" message so the user can pick another photo.
    return false;
  }
}

export async function runContentCheck(_uri: string): Promise<boolean> {
  // TODO: not yet wired to a real moderation provider. Currently a no-op
  // pass-through — keep the visible stage timing for UX consistency.
  await delay(PHOTO_VERIFY_STAGE_MS);
  return true;
}

export async function verifyPhoto(
  uri: string,
): Promise<PhotoVerificationResult> {
  const faceOk = await runFaceCheck(uri);
  if (!faceOk) {
    return { ok: false, stage: "face", reason: PHOTO_VERIFY_FAIL_REASONS.face };
  }
  const contentOk = await runContentCheck(uri);
  if (!contentOk) {
    return {
      ok: false,
      stage: "content",
      reason: PHOTO_VERIFY_FAIL_REASONS.content,
    };
  }
  return { ok: true };
}
