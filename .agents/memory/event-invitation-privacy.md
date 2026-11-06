---
name: Event invitation privacy
description: Product rules for public and invitation-only event links.
---

Venue-owned invite-only events may be shared through bearer invitation links. Selecting visitors from the venue's checked-in guest list remains available, but is optional.

Venue-owned and community-created invite-only events may use optional passcodes. Verify a passcode before showing event details, and require sign-in to RSVP. Do not expose invitation tokens or passcode hashes in public event/feed responses.

Public venue events share their event-details URL. Private venue invitations use `/event-invite/:token`, not the venue's QR check-in route. Keep `/v/:placeId` for check-in only.

Social preview metadata is only public for published, visible events at approved venues with `public` visibility. Do not attach event title, date, venue, or image metadata to invite-only, hidden, unpublished, or unavailable events because preview crawlers are anonymous.

New venue-event shares use a per-share preview version in the URL, and the preview page preserves that version in its canonical metadata. Keep old unversioned event URLs working; every request still reads the current event and visibility state.

For community-event installs, keep the browser page available and require an explicit Continue tap after installation. Do not add cross-install token storage, Play referrer delivery, or a third-party deferred-link provider without explicit approval.

Generate community event invite links on `https://met-app.org`. Keep the old `metapp.replit.app/event-invite/*` path routed to the same fallback so previously shared links continue to work.

**Why:** The user wants venues to share invitation-only events through social links, with visitor-list invites optional.

**How to apply:** Keep bearer-link access limited to the linked event, gate details with any configured passcode, and keep invitee identifiers and invitation credentials out of public event/feed responses.

**Why:** The user asked to use `met-app.org` instead of the Replit subdomain.

**How to apply:** Use `met-app.org` for newly generated community event links; preserve the Replit-hosted route as a compatibility path for older links.

**Why:** The user reported that sharing a venue-created event produced a check-in link instead of the event.

**How to apply:** When changing venue-event sharing, point to the event-details route and keep QR/check-in links separate.

**Why:** Social preview crawlers do not have the viewer's account or invitation status, so private event metadata cannot be authorized per recipient.

**How to apply:** Restrict server-generated preview metadata to eligible public venue events; use a generic unavailable response for other events.

**Why:** Messaging platforms can cache metadata by URL and may ignore server no-cache headers.

**How to apply:** Add a fresh version to newly shared event URLs while keeping event lookup dynamic and privacy checks unchanged.

**Why:** A guest can resume from the original invitation page without adding install-time data collection or promising automatic recovery on platforms that do not guarantee it.

**How to apply:** Preserve the explicit browser-return flow unless a specific first-party handoff mechanism and its data handling are approved.
