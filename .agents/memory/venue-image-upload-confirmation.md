---
name: Venue image upload confirmation
description: Security boundary for admin-managed venue image uploads through presigned object storage URLs
---

For admin-managed venue photos, authorize both upload preparation and confirmation, and cryptographically bind the confirmation to the selected venue, session, object path, and a short expiry. Validate image bytes before returning the URL.

**Why:** A generic presigned upload URL produces a path without venue ownership metadata. Checking only that the confirmation path exists lets a different venue or session claim another upload.

**How to apply:** When adding another admin-managed media upload surface, reuse this boundary instead of treating the object path alone as proof of authorization. The venue-manager flow has a separate authorization model; avoid assuming its path-only confirmation provides venue binding.