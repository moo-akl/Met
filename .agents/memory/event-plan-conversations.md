---
name: Event plan conversations
description: Architectural boundary for group conversations attached to Met community events.
---

Plan conversations are event-scoped and use the existing PostgreSQL/API stack. Keep them separate from the Firestore one-to-one chat system. For invite-only friend Plans, an invitation grants access to the event details and acceptance action, but not the group chat; only the host and active going/maybe RSVPs can chat. Leaving removes both the RSVP and invitation, so the host must invite the person again. For approval-based Hangouts, preserve the existing direct-invite and accepted-request access behavior. The visible participant list is the host plus active RSVPs. Plan-chat pushes must use generic lock-screen copy, omit event titles and message text, and respect the user's chat-notification preference.

**Why:** The user requested invitation-based friend Plans without Going/Interested/Not going choices: accepting grants access, while leaving requires a new invitation to rejoin. They also required invite-only event privacy in public notification previews and no replacement of the current direct-chat system.

**How to apply:** Distinguish invite-only friend Plans from approval-based Hangouts when enforcing access. Extend event-scoped storage and APIs for group conversation changes; do not route these messages through direct-chat documents or alter direct-chat participant rules. Route push taps using the event ID, then let the authenticated event-chat API recheck access.
