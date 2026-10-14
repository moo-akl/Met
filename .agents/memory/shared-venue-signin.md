---
name: Shared Met venue sign-in
description: Security and transition rules for one Firebase sign-in across Met and Venue Manager
---

Venue Manager uses Met's Firebase identity for new accounts. Existing password-only manager accounts must prove both control of the verified Firebase account and their previous business password before they are linked. Matching email alone is never sufficient; staff membership does not imply venue ownership. Existing business passwords are transitional and stop authenticating once linked.

**Why:** Admin-invited venues previously had synthetic owner identities and independent manager credentials. Equating email addresses would let an unrelated Firebase identity acquire management rights or ownership, while discarding legacy passwords immediately would lock out existing managers.

**How to apply:** Future enrollment, membership, account recovery, and ownership features must preserve explicit membership grants, one-time proof of legacy credentials when migrating, and collision/revocation checks. New password-only manager account creation should not return. A Firebase Web client requires its own Web API key; do not reuse the native app's Android-restricted key.

Public web branch applications keep a unique `web:` synthetic owner UID per profile. After admin approval, the one-time registration token and verified matching Firebase email can convert only that business's active placeholder owner membership to a `managerId` membership. Keep the profile UID synthetic and leave the membership UID null; Venue Manager's business-scoped membership is the canonical branch context.

**Why:** Venue owner profile UIDs are unique, while the legacy Met owner flow resolves memberships by Firebase UID and can otherwise choose an arbitrary branch. Rewriting multiple branch profiles to one Firebase UID would collide and weaken business-level isolation.

**How to apply:** Keep future web-branch enrollment narrowly scoped to the approved business and manager membership. Do not expose these branches through UID-only owner resolution unless that flow becomes explicitly multi-venue aware.

Admin venue deletion must remove venue-specific state and unshared manager credentials, while preserving the person's shared Met login. The same login must be able to enroll again as a fresh venue manager.

**Why:** After a deleted venue was recreated, its manager encountered the shared-login email collision. The user explicitly chose to keep the Met login rather than delete it, to protect mobile accounts and access to other venues.

**How to apply:** Treat fresh venue enrollment separately from creating a new Met identity. An existing email is not a permanent registration block: require authentication to the existing account and a valid new venue invitation. Never delete a shared identity or another venue's memberships merely to release an email.