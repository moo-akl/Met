---
name: Venue reply classification
description: Privacy and billing constraints for AI-assisted venue outreach response triage.
---

Only classify replies matched to known venue outreach. Interested includes substantive questions about the opportunity and willingness to hear more or receive details, even without a commitment. Send extracted reply text to the Replit OpenAI integration only after explicit consent; never persist or log reply content. Store category metadata only, retaining `other` and `uncertain` states. Keep per-sync processing bounded and expose remaining-classification counts so users can safely run more syncs; model use consumes Replit credits.

**Why:** The user chose AI classification after being told reply text would be sent to a model and model usage is billed to Replit credits. They also specified that questions and willingness to hear more are signs of venue interest.

**How to apply:** Do not broaden classification to unmatched or unrelated Gmail messages. Keep interested, rejected, and no-reply views based on stored classification/reply metadata; ambiguous or failed classifications must remain visible as replies and retryable. When the interested criteria change, reclassify existing `other` or `uncertain` records once, within the existing per-sync limit.
