// Face-quality filtering is disabled in v1.0.
//
// We previously used `@infinitered/react-native-mlkit-face-detection` to gate
// uploads to "exactly one clear face", but that package's transitive
// MLKit iOS pods (MLKitVision / MLKitCommon) require GoogleUtilities ~> 7
// and GTMSessionFetcher ~> 1, which are incompatible with the modern
// Firebase Auth (~> 8 / >= 3.4) and Google Sign-In stack we depend on.
//
// `runFaceCheck` in `./photoVerify.ts` already treats `supported: false`
// as a graceful pass-through, so this stub keeps the photo-verifier UX
// unchanged (visible stage timing preserved) without the native gate.
//
// Re-enable in a future version via either:
//   1. A server-side check (e.g. Cloud Vision API in our API server), or
//   2. A vision-camera-based detector that uses modern MLKit pods.

export type FaceDetectionOutcome = {
  count: number;
  supported: boolean;
};

export async function detectSingleFace(
  _uri: string,
): Promise<FaceDetectionOutcome> {
  return { count: 0, supported: false };
}
