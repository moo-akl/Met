---
name: Photo upload CDN cache
description: Firebase Storage photo URL is stable per user; CDN serves stale image unless URL is versioned
---

The profile photo is always stored at `profile-photos/{uid}.jpg` — same path on every upload. After a successful upload, the React Native Image component switches from the local `file://` URI to the remote URL. Since the URL is identical to the previous upload, the CDN returns the cached old photo, making it appear the upload "reverted."

**Why:** Google Cloud CDN caches by URL. Overwriting a file at the same path does not invalidate the cache entry.

**How to apply:** In `profilePhoto.ts` (Step 2 makePublic path), append `?v=${Date.now()}` to the returned URL. This gives each upload a unique URL, forcing a fresh CDN fetch. The `?v=` parameter is ignored by GCS when serving the object.
