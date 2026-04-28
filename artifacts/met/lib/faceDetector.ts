// Thin wrapper around the on-device face detector. Loads the native
// module lazily so the module-evaluation side-effects don't crash the
// web preview or Expo Go (where the native module isn't linked).
//
// Production iOS / Android builds (EAS, dev clients) include the native
// module and get the real detector. Anywhere else this returns
// `supported: false` so callers can fall back to a pass-through.

export type FaceDetectionOutcome = {
  count: number;
  supported: boolean;
};

type DetectorLike = {
  detectFaces: (
    uri: string,
  ) => Promise<{ faces?: unknown[] } | undefined>;
};

let cachedDetector: DetectorLike | null = null;
let nativeUnavailable = false;

export async function detectSingleFace(
  uri: string,
): Promise<FaceDetectionOutcome> {
  if (nativeUnavailable) return { count: 0, supported: false };

  try {
    if (!cachedDetector) {
      const mod = await import(
        "@infinitered/react-native-mlkit-face-detection"
      );
      cachedDetector = new mod.RNMLKitFaceDetector({
        performanceMode: "fast",
        // Require the face to occupy at least 15% of image width — filters
        // out tiny faces in group / scenery shots.
        minFaceSize: 0.15,
      }) as unknown as DetectorLike;
    }
    const result = await cachedDetector.detectFaces(uri);
    return {
      count: Array.isArray(result?.faces) ? result.faces.length : 0,
      supported: true,
    };
  } catch {
    // Web preview, Expo Go without the linked module, or an unexpected
    // native failure. Mark unavailable so we don't keep retrying.
    nativeUnavailable = true;
    return { count: 0, supported: false };
  }
}
