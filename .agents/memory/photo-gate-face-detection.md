---
name: Photo gate — face detection architecture
description: Why face detection is server-side via Vision API and how the client/server gate works
---

## Rule
Face detection for profile photos is enforced server-side (Vision API FACE_DETECTION in `profilePhoto.ts`), NOT client-side. The client-side `faceDetector.ts` always returns `supported: false` and must NOT be relied on as a gate.

**Why:** `@infinitered/react-native-mlkit-face-detection` MLKit iOS pods (MLKitVision/MLKitCommon) conflict with Firebase Auth (~>8/>=3.4) and Google Sign-In. The package was removed. `faceDetector.ts` is a stub.

**How to apply:**
- `contentModeration.ts` `moderateImage()` now requests both SAFE_SEARCH_DETECTION and FACE_DETECTION in one Vision API call and returns `faceCount` alongside `safe`.
- `profilePhoto.ts` rejects with 422 when `faceCount === 0`.
- Fail-open paths return `faceCount: 1` so Vision API outages never block uploads.
- To re-enable native client-side detection: use vision-camera + modern MLKit pods (not the infinitered package), or keep it server-only.
