# Venue guestbook release checklist

## Behavior

Verified visitors with a completed profile can publish a handwritten-style note
and optionally upload a photo from their visit. Posts show the author's name and
profile photo. There is no automatic expiry.

The composer requires explicit acknowledgement that the memory is public and
associated with that venue. Authors can delete their memories. Account deletion
removes authored memories, guestbook block relationships and stored visit photos.
Reported content is hidden for the reporter immediately; admins can review the
note/photo, hide it for everyone, or restore it. Blocking hides the author's
guestbook content across venues in both viewing directions.

## Before release

1. Ensure the API runtime receives the validated Firebase Admin credential through
   workspace Secrets. The uploaded replacement authenticated successfully and
   passed live Vision classification, Storage upload, download-byte comparison
   and deletion. However, the runtime environment still exposed a different,
   rejected credential. Do not generate another key merely because that old
   runtime value fails. Never use the uploaded file as a permanent app fallback
   or turn off photo checks to make an upload succeed.
2. Publish the API with the development schema changes. Replit's managed Publish
   flow applies the new guestbook/guestbook-block tables to production; do not add
   production DDL to build or startup commands. No Firestore rule change is needed
   for these server-managed PostgreSQL entries and Firebase Storage uploads.
3. Make fresh iOS and Android builds. The feature adds the SDK-compatible
   `expo-image-manipulator` dependency to resize and normalize visit photos.
   Existing binaries do not acquire it by reopening. Preserve bundle identifiers
   and allocate fresh platform build numbers when starting a release.
4. Test actual iPhone and Android photo selection, including HEIC/PNG conversion,
   camera orientation, large files, permission denial, timeout/retry, full-size
   viewing, author deletion and account-deletion photo cleanup.
5. Review the externally hosted privacy policy and both stores' privacy/data
   safety declarations before rollout. This implementation does not modify those
   external legal documents or submit store metadata.

## Privacy disclosure points for owner/legal review

- Notes, visit photos, author name/profile picture and the selected venue are
  visible to other signed-in people browsing the venue.
- Posting is optional. A public memory is separate from opting into nearby
  discovery and does not turn profile visibility on.
- Posted memories do not expire automatically; authors may delete them, account
  deletion removes them, and moderation can remove or hide content.
- Photos are processed by the existing Google Vision safety service before
  publication. A visit photo does not need to include a face.
- Images are resized/re-encoded; server-side handling removes EXIF/XMP/IPTC
  metadata and comments, including embedded camera GPS data.
- Photos are stored in the project's existing Firebase Storage. There is no new
  tracking, advertising SDK, or automatic photo-library upload.
- Copies previously saved by another person are outside Met's control.

## Verification scope

Development API tests exercise actual database persistence, access restrictions,
pagination, idempotent retries, reporting/blocking, moderation hiding and deletion.
Photo tests cover metadata removal, fail-closed moderation, malformed inputs and
storage calls. Live external moderation, upload, download and deletion passed
with the uploaded replacement credential in an isolated process. The temporary
image was removed. This does not verify that the running API has received that
same credential; its environment must be refreshed and checked separately.

The browser verified the clearly labeled read-only sample guestbook at mobile
width without horizontal overflow. The browser could not confirm the existing
venue-sheet back action, and it cannot substitute for native authenticated photo
selection or full posting. Samples never make writes or masquerade as real posts.

No publishing, GitHub push or store submission was initiated as part of this
guestbook implementation.
