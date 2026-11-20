---
name: Venue outreach deck standard
description: Use the user-approved Met venue-introduction PDF as the standard attachment for approaching venues.
---

Use the user-approved current Met venue-introduction PDF as the standard document for approaching venues. Keep it as-is by default; make prospect-specific PDF variants only when the user asks. Do not substitute a short one-page brief.

**Why:** On October 29, 2026, the user approved this PDF as the one to use for approaching venues going forward.

**How to apply:** Use the approved PDF for standard venue outreach. If preparing a personalized version, retain the shared product overview and present the file for review before sending unless the user approved that specific send.

An approved Spanish-language version is also available for Spanish-language outreach; keep English as the default version.

**Why:** The user requested a Spanish version of the approved venue-introduction PDF.

**How to apply:** Choose the English or Spanish PDF to match the recipient's language. The Spanish copy does not localize English text embedded in app screenshots.

Lead with relationship-first positioning: “Connect with your real visitors.” Give those guests reasons to return and keep the relationships and memories going. Do not lead with discovery as the main promise. Met recently launched, so do not invent or imply a reliable active-user count. Explain the venue growth path honestly: guests scan a venue QR, open or download Met, check in, earn points, join that venue’s visitor list, and the venue team can reconnect through Met later.

**Why:** The user asked to shift the main venue message toward real visitors and repeat visits, and supplied the current launch/user-base explanation.

**How to apply:** Keep this positioning consistent across the cover, FAQ, tailored venue introductions, and outreach copy. Use the live deck manifest count rather than assuming a fixed number of slides.

For personalized outreach PDFs, use a short PDF-only venue display name and do not repeat the full business title or category in later slide copy. Use distinct venue-type copy and a clear registration call to action. Keep added PDF-specific details separate from the email's fit reason, show their official source for review, and do not invent venue facts or audience metrics.

**Why:** The user said repeated long titles read unnaturally and wants the PDF to encourage venue managers to register.

**How to apply:** Keep long business names, email identity, and the email fit reason in the prospect record. Derive a concise PDF display name and use a separate, source-linked PDF detail so reviewers can verify it before sending.

For first-contact venue emails, use the user's approved complete-introduction approach: introduce Met as a new contact, refer to the attached venue-specific PDF, explain the potential for business traffic, stronger customer relationships, repeat visits, and free venue use; invite honest feedback; include an application link that is reviewed; ask for the right contact; and offer a clear no-follow-up opt-out. Never describe first contact as a follow-up.

**Why:** On November 2, 2026, the user asked to adapt their no-reply email into a new first-contact approach for newly researched prospects.

**How to apply:** Use a fresh recipient-specific application link and the personalized PDF. Do not reuse sample invite URLs or change unrelated campaign templates unless asked.

For batch PDF exports, render each tailored deck inside a 1920×1080 iframe before capturing slides. The slide layouts use viewport-relative `vw`/`vh` sizing, so capturing from the responsive exporter page distorts typography and spacing. Use an SVG-based DOM capture library; `html2canvas` cannot parse Tailwind's `oklab` colors.

**Why:** The PDF must retain the same full-size composition as the shared deck, and the exporter runs from a smaller responsive screen.

**How to apply:** Keep the offscreen `/allslides` frame at 1920×1080, pass a known profile key in its query, and verify that the first three pages are tailored while shared pages remain identical.
