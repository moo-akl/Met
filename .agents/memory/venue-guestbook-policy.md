---
name: Venue guestbook policy
description: Product intent and privacy/safety boundaries for permanent venue memories.
---

The user wants venue pages to keep handwritten-style visitor notes and photos
uploaded from the visitor's actual visit, not just their profile picture.
Entries should remain indefinitely rather than expire automatically.

**Why:** The user asked for notes and photos saved on the venue page “forever,”
and clarified “let them upload a photo from their visit.”

**How to apply:** No automatic expiry for posted memories. “Forever” must not
override author deletion, account deletion, or moderation. Explain that posts
are public and location-associated before submission.

New public visit photos must pass safety checks before storage/publication;
an unavailable or incomplete check must not silently approve them. A face is
not required in a visit photo. Strip camera/location metadata.

**Why:** These are lasting public uploads, and the user separately required
preserving App Store safety during social-feature changes. The older profile
photo fail-open behavior is not a template for this new public content.

**How to apply:** Keep legacy profile behavior isolated; do not weaken guestbook
checks to work around credential or moderation outages.

For Time Capsules, the author chooses whether content becomes public after
unlock or remains private to the author.

**Why:** The user said the creator should choose the capsule audience.

**How to apply:** Enforce the audience server-side, and redact locked or private
content from every response shown to other visitors.
