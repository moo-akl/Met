---
name: Venue outreach usability
description: User-approved direction for venue outreach UX, email copy, and email-template migration.
---

Keep Invited venues focused on the venue and the next action, rather than exposing email-log diagnostics as equally prominent controls.

**Why:** The user found the existing sorting confusing and approved a simpler worklist with understandable sorting, quick views, and less prominent advanced filters.

**How to apply:** Preserve this simplicity when adding outreach controls. Clearly distinguish venue/application information from individual email attempts, and distinguish selecting matching results from selecting across the entire history.

Manual emails from Invited venues must allow any selected venue and any chosen template, including venues that already have an application. Do not impose a 25-recipient cap, a latest-updates-only exception, or recipient exclusions based on application/link/history state.

**Why:** The user explicitly asked to remove these restrictions and be able to send any kind of email, and requested controls to create, edit, and remove templates.

**How to apply:** Keep manual messaging independent of approval and account-access operations. Warnings about possible duplicate delivery should inform the admin, not disable recipient selection.

Global prospect first-contact drafts are a separate flow: block another first-contact email when the exact recipient has a confirmed sent record, and route intentional no-reply follow-ups through the explicit follow-up campaign.

**Why:** The user requested this duplicate-send safeguard without changing general manual outreach or historical records.

**How to apply:** Keep the restriction scoped to prospect first-contact drafts; preserve the no-reply campaign and unrestricted Invited Venues manual-email flow.

Bulk pasted email lists must not require venue names or require researching names from addresses.

**Why:** The user said they will paste emails in bulk and will not spend time finding each venue name.

**How to apply:** Accept address-only lists and use generic venue wording rather than guessing names from email addresses.

An email explicitly blocked by an admin is a global opt-out from future Venue Admin outreach. Keep its past email history, skip it in outreach audiences and bulk sends, and let an admin allow it again.

**Why:** The user asked for both removing a venue's profile email and stopping future outreach to a bounced address.

**How to apply:** Treat explicit suppression as the exception to unrestricted manual recipient selection; do not delete send history when an address is blocked.

Bulk cleanup removes only confirmed `failed` outreach rows with no recorded sent timestamp. Keep `sending`/`delivery_uncertain` records because delivery may have occurred; preserve successful history, used/consumed invite links, and venue applications. Remove unused invitation links only when no other email references them.

**Why:** Removing an uncertain send can hide a possible delivery and lead to duplicates; applications and successful outreach must remain intact when clearing failed attempts.

**How to apply:** Keep cleanup count-confirmed and admin-authorized. Refresh the worklist after deletion; a prospect disappears only when no other email or invitation records remain.

The user wants failed-send cleanup to remove both Gmail failure notices and their original outgoing emails, as well as the matching Venue Admin records. Admin-only deletion does not fulfill that scope.

**Why:** The user explicitly selected “Both failure notices and original outgoing emails” when clarifying Gmail cleanup.

**How to apply:** Match confirmed failed deliveries before targeting mailbox messages; do not guess from a recipient address alone. Verify Gmail trash/delete permissions separately from read/send permissions and explain any blocker before claiming cleanup is complete.

The connected Gmail integration currently grants read/send/compose/labels scopes, but not `gmail.modify`; Gmail message trash operations are unavailable with this connection.

**Why:** The integration's own permission details list `gmail.modify` as not granted, and `messages.trash` requires it.

**How to apply:** Keep Venue Admin cleanup separate and never imply Gmail messages were trashed. Only enable Gmail cleanup after a connection with `gmail.modify` is available, and trash only exact confirmed notice/original pairs.

Saved built-in email templates can override generated defaults in production, so new content must also reach active saved copies without replacing an admin's custom wording.

**Why:** Production template records were found with older HTML that hid new default sections; one built-in template was also intentionally marked deleted.

**How to apply:** When changing built-in email content, account for persisted overrides, refresh managed sections explicitly in scope, add missing sections, and preserve surrounding saved copy and deletion state.

Built-in venue outreach emails use a compact 2×2 grid of the Home, venue page, Visitors, and Connections screenshots. Each cropped preview links to its full-size image; other screen examples remain text links.

**Why:** The user chose compact, clickable thumbnails over tall stacked images to keep outreach emails shorter while still showing the product.

**How to apply:** Keep the grid email-safe, include descriptive alt text and captions, retain direct screenshot URLs in plain-text emails, and replace only managed legacy screenshot blocks in saved built-ins. Leave custom templates and admin-authored copy unchanged.

The separate “A look into Met” built-in email is a screenshot-only alternative with all seven full-size screens and a brief description above each.

**Why:** The user requested a dedicated template for sharing the complete visual showcase, separate from the compact grid used in regular outreach.

**How to apply:** Keep it screenshot-first and end with the requested free-app/venue-listing CTA, reply option, and App Store/Google Play links. Describe privacy and security as design goals, preserve image/store URLs in plain text, and omit the standard FAQ and portfolio links.

Keep Gmail bounce notices with no matching Venue Admin outreach recipient outside the actionable review queue, while retaining a visible count and sample notices. Never auto-link ambiguous notices; any manual link must match the recipient and must not conflict with a stored original message ID.

**Why:** The user chose to separate no-history notices from the action queue and emphasized reducing review burden without incorrect linking or deletion.

**How to apply:** Only classify a notice as no-history when it is a single-recipient notice without recipient mismatch and no recipient exists in outreach history. Keep uncertain cases actionable, and do not delete Gmail notices or send records as part of triage.

Security and privacy copy must not claim that Met is completely safe or that App Store / Google Play approval guarantees security. Keep the venue FAQ concise and scope hiding to new nearby discovery; describe Bluetooth, profile details, and GPS sharing accurately.

**Why:** The user selected a five-question FAQ focused on venue discovery, check-ins, guestbook content, hiding, and GPS privacy, replacing the earlier security and store-review question.

**How to apply:** Use the approved five-question copy, keep hiding limited to new nearby discovery, and do not restore extra security questions or caveats unless asked. When linking the Privacy Policy elsewhere, use the canonical `met-app.org/privacy` route. Update the managed FAQ block in saved built-ins while preserving surrounding admin-edited email copy.

Research-backed prospect campaigns are draft-only: use official published business emails, individual venue-specific fit reasons, and two linked product screenshots in the personalized invitation. Do not send automatically.

**Why:** The user requested worldwide café, bar, and pub prospects for manual review, with personalized reasons and a couple of Met screenshots, while retaining the existing prospect list.

**How to apply:** Preserve existing prospects and outreach history, deduplicate new research, retain suppression and final-review safeguards, and do not treat publication of an email address as proof of deliverability or consent.

The user reports that venues approached through Venue Invitation Drafts with personalized outreach produced much better response results.

**Why:** The user observed stronger response outcomes from personalized venue invitations.

**How to apply:** Keep venue-specific personalization central in draft creation and template work; do not replace it with generic copy for convenience.

Rank worldwide prospect cohorts by strength of fit; do not enforce equal regional quotas.

**Why:** The user said strong fit matters more than equal regional counts.

**How to apply:** Let regional counts follow the strongest available candidates unless the user asks for a geographic balance.

Describe Met in venue-partner outreach as a recently launched tool that helps venues connect with guests, build relationships, and give guests reasons to return; Met is adding venues worldwide.

**Why:** The user stated this is the current product positioning and expansion context.

**How to apply:** Include the message in relevant venue outreach without implying unverified user counts or changing the stated pricing terms.

Venue outreach needs distinct replied and didn't-reply views, plus persistent manual priority labels (`top_interest`, `interest`, `no_interest`) independent of AI reply classifications.

**Why:** The user requested a simple reply-status split and manual venue prioritization.

**How to apply:** Keep manual labels editable and filterable per venue; never overwrite them with AI classifications.

Venue Admin must keep outreach-history removal separate from permanent venue deletion. History removal leaves the venue/application and email blocks intact, does not delete Gmail messages, and warns that related invitation links may be revoked.

**Why:** The user chose to offer both deletion scopes as separate actions.

**How to apply:** Require explicit confirmation for each action and never route history removal through the permanent venue-data deletion flow. Revoke only unused, unconsumed invitation tokens with no remaining outreach-log references; preserve consumed tokens and application-linked invitations.
