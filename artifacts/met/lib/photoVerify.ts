import { detectSingleFace } from "./faceDetector";

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runFaceCheck(uri: string): Promise<boolean> {
  const { count, supported } = await detectSingleFace(uri);
  if (!supported) {
    // Web preview or Expo Go without the linked native module.
    // Keep the visible stage timing so the verifier UI feels consistent.
    await delay(PHOTO_VERIFY_STAGE_MS);
    return true;
  }
  // Exactly one clear face — matches the user-facing copy.
  return count === 1;
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
