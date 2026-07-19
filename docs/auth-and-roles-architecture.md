# Met — Authentication & Role-Based Access Architecture

> **Audience:** Founder / internal reference.
> **Last updated:** July 2026 (build 207).
> **Key files referenced:** `artifacts/met/contexts/AppContext.tsx`, `artifacts/met/lib/auth.ts`, `artifacts/api-server/src/routes/profiles.ts`, `artifacts/api-server/src/routes/business.ts`, `artifacts/api-server/src/routes/admin.ts`, `artifacts/api-server/src/routes/webhooks.ts`, `artifacts/business-portal/src/App.tsx`, `artifacts/business-portal/src/pages/RegisterPage.tsx`, `lib/db/src/schema/`.

---

## Overview

Met has three distinct actor roles, each with its own identity path and access surface:

| Role | Entry point | Primary data store | Portal |
|---|---|---|---|
| **Standard User** | Mobile app (iOS/Android) | `profiles` table + Firestore | Expo mobile app |
| **Business Partner** | `met-app.org/business-register` | `business_profiles` table | Business Portal (web) |
| **Admin (Founder)** | Business Portal `/admin` | `ADMIN_UIDS` env var allowlist | SalesDashboard in Business Portal |

All three roles share the same Firebase Auth identity layer. Role differentiation happens at the database and API level, not at the auth provider level.

---

## Flow 1: The Standard User

### 1.1 Sign-up / Login

```
User opens app
      │
      ▼
Firebase Auth (lib/auth.ts)
  - Apple Sign-In   →  expo-apple-authentication → identity token + nonce → Firebase
  - Google Sign-In  →  Google OAuth → credential → Firebase
  - Email/Password  →  createUserWithEmailAndPassword / signInWithEmailAndPassword
      │
      ▼
Firebase returns uid + ID token
(stored in Firebase SDK session, persisted across restarts)
```

The `lib/auth.ts` module exposes a `subscribeToAuthState` helper that wraps Firebase's `onAuthStateChanged`. This is the single source of truth for whether a session is live.

### 1.2 AppContext Hydration

When the app mounts, `AppProvider` (`contexts/AppContext.tsx`) runs a `Promise.all` to bootstrap local state in parallel:

```
AppProvider mounts
      │
      ├─ loadProfile()             → last-known profile from AsyncStorage
      ├─ loadEncounters()          → encounter history from AsyncStorage
      ├─ loadPermissionsCompleted()→ onboarding completion flag
      └─ loadPreferences()         → app settings from AsyncStorage
      │
      ▼ (all four resolve)
subscribeToAuthState fires
      │
      ├─ sets authedUid (Firebase UID)
      ├─ Purchases.logIn(uid)      → hydrates RevenueCat SDK with this identity
      └─ initReferrals()           → syncs referral state from /api/referrals
```

> **Critical distinction:** `authedUid` is the Firebase UID and is always used for Firestore document paths and API calls. `profile.id` is a Postgres-generated ID that can be a `"local-"` string during onboarding before Firebase Auth finishes initialising — never use it for Firestore paths.

### 1.3 Profile Sync to the Backend

Once both `authedUid` and the local `profile` are available, AppContext automatically syncs:

```
authedUid + profile both set
      │
      ▼
POST /api/profiles/me
  - Header: Authorization: Bearer <Firebase ID token>
  - Body: { name, bio, photoUri, ... }
      │
      ▼
requireUid middleware (api-server)
  - verifies ID token with Firebase Admin SDK
  - attaches req.uid = Firebase UID
      │
      ▼
Upserts record into `profiles` table (Postgres)
Returns full profile + subscription fields
```

### 1.4 Subscription Status Binding

`GET /api/profiles/me` is the canonical "who am I?" endpoint. It returns:

| Field | Type | Meaning |
|---|---|---|
| `subscriptionTier` | `"free"` \| `"plus"` \| `"pro"` | Current plan |
| `isSubscribed` | `boolean` | `true` if tier is plus/pro AND `subscriptions.status = "active"` |
| `isPioneer` | `boolean` | One of the first 500 founding users |
| `referralCount` | `number` | Successful referrals (unlocks features) |

**How the subscription row gets there:**
1. User purchases a plan via the mobile app's paywall (`app/paywall.tsx`).
2. RevenueCat processes the App Store / Play Store transaction.
3. RevenueCat fires a webhook to `POST /api/webhooks/revenuecat` (secret-authenticated).
4. The webhook handler writes/updates a row in the `subscriptions` table keyed by the user's Firebase UID.
5. On the next call to `GET /api/profiles/me`, the API reads this row and computes `isSubscribed`.

The mobile app stores the returned profile fields in `AppContext` and propagates them to UI components (`TierBadge.tsx`, `GoldShimmerBorder.tsx`, feature gates in `paywall.tsx`).

---

## Flow 2: The Business Partner

### 2.1 Sales Agent Link Generation

A sales agent (or the founder) generates a unique registration link via the admin panel:

```
POST /api/admin/generate-sales-link
  - requireAdminUid middleware enforces founder-only access
  - Body: { agentId: "XYZ" }
      │
      ▼
Returns: https://met-app.org/business-register?agent=XYZ
```

The `agentId` is an arbitrary string (typically the sales agent's name or ID) that is passed through as a URL query parameter.

### 2.2 Business Partner Registration

When the prospective partner opens the link in a browser:

```
https://met-app.org/business-register?agent=XYZ
      │
      ▼
Business Portal — RegisterPage.tsx
      │
      ├─ Captures agent param:
      │    const params = new URLSearchParams(useSearch());
      │    const salesAgentId = params.get("agent") ?? "";
      │    (stored in component state for the lifetime of the form)
      │
      ├─ User authenticates (Firebase Auth — same provider as mobile)
      │
      ├─ User searches for their venue (Google Places autocomplete → placeId)
      │
      └─ User submits: displayName, description, logoUrl, placeId
```

### 2.3 Business Profile Creation

```
POST /api/business
  - Header: Authorization: Bearer <Firebase ID token>
  - Body: { displayName, description, logoUrl, placeId, salesAgentId }
      │
      ▼
requireUid middleware
  - verifies token → req.uid = Firebase UID of the registering user
      │
      ▼
Validation:
  - One owner can only register one business per placeId
      │
      ▼
INSERT into `business_profiles` table:
  ┌──────────────────────────────────────────┐
  │  id               → generated UUID       │  ← this becomes the RevenueCat app_user_id
  │  owner_id         → req.uid              │  ← Firebase UID of the registering user
  │  place_id         → from Google Maps     │
  │  display_name     → from form            │
  │  sales_agent_id   → from ?agent= param   │
  │  is_active_subscription → false (default)│
  └──────────────────────────────────────────┘
      │
      ▼
Returns: full business profile record
```

**Key linkage:** `owner_id` = the Firebase UID of the person who registered. This is how the business profile is associated with a specific person's login. The `sales_agent_id` column records which agent sourced this partner, enabling commission tracking in the SalesDashboard.

### 2.4 RevenueCat Webhook → `is_active_subscription`

Business partners purchase a subscription through RevenueCat. Unlike user subscriptions (keyed by Firebase UID), business subscriptions are keyed by the **business profile UUID**:

```
RevenueCat event fires
      │
      ▼
POST /api/webhooks/revenuecat
  - Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
  - Body: { event: { type, app_user_id, expiration_at_ms, ... } }
      │
      ▼
app_user_id = business profile UUID (set when creating the RevenueCat customer)
      │
      ▼
Switch on event.type:

  INITIAL_PURCHASE / RENEWAL / UNCANCELLATION / PRODUCT_CHANGE
      → UPDATE business_profiles
          SET is_active_subscription = true,
              subscription_end_date  = expiration_at_ms (converted)
          WHERE id = app_user_id

  CANCELLATION / EXPIRATION / BILLING_ISSUE
      → UPDATE business_profiles
          SET is_active_subscription = false
          WHERE id = app_user_id
```

**Effect in the Business Portal:** `GET /api/business/mine` returns the partner's business profiles including `isActiveSubscription`. If `false`, advanced features (analytics, event management) are gated behind an upgrade prompt.

---

## Flow 3: Admin Access (Founder View)

### 3.1 Admin Identity — The ADMIN_UIDS Allowlist

There is no "admin" role in the database. Admin identity is controlled entirely by an environment variable on the API server:

```
ADMIN_UIDS=<your-firebase-uid>,<optional-second-uid>,...
```

The `requireAdminUid` middleware in `artifacts/api-server/src/routes/admin.ts`:
1. Calls `requireUid` first (verifies the Firebase token).
2. Checks whether `req.uid` is in `process.env.ADMIN_UIDS.split(",")`.
3. Returns `403 Forbidden` if not in the list.

To grant admin access to a new person: add their Firebase UID to `ADMIN_UIDS` and redeploy the API server. No database changes needed.

### 3.2 How the Business Portal Unlocks the Admin View

```
Business Portal loads (App.tsx)
      │
      ▼
GET /api/admin/me
  - Returns: { isAdmin: boolean }
  - true  → uid is in ADMIN_UIDS
  - false → regular partner or unauthenticated
      │
      ▼
isAdmin stored in App-level React state
      │
      ├─ false → normal sidebar (Dashboard, My Hubs, Subscription)
      └─ true  → sidebar gains "Admin" section → /admin route renders SalesDashboard
```

`SalesDashboard.tsx` is only mounted if `isAdmin === true`. Navigating to `/admin` directly without the admin flag will not render the component — the route guard enforces it in the `Layout` component via the `adminOnly` flag on sidebar items.

### 3.3 What the SalesDashboard Shows

The SalesDashboard queries admin-only endpoints to display:

| Section | Data source | What you see |
|---|---|---|
| Sign-ups | `GET /api/admin/business-profiles` | All registered business partners, their `sales_agent_id`, and registration date |
| Revenue | RevenueCat webhook data surfaced via `is_active_subscription` + `subscription_end_date` | Which partners have active subscriptions |
| Agent attribution | `sales_agent_id` column per business profile | Which sales agent sourced each partner |

### 3.4 User vs. Business Partner — How the App Tells Them Apart

There is no `role` column. The differentiation is entirely structural:

```
Firebase UID present?
      │
      ├─ profiles row exists       → Standard User  (can use mobile app)
      │
      └─ business_profiles row
         WHERE owner_id = uid      → Business Partner (can use Business Portal)
```

A person can be both simultaneously — the same Firebase UID can have a `profiles` row (mobile user) and own one or more `business_profiles` rows (portal user). The two surfaces are separate applications; there is no toggle within a single app:

- **Standard users** → open the Expo mobile app.
- **Business partners** → open `met-app.org` (Business Portal web app) and sign in with the same Firebase credentials they used when registering.
- **The founder** → opens the Business Portal, gets the same view as a business partner, plus the Admin sidebar section because the UID is in `ADMIN_UIDS`.

---

## Quick Reference: Key Environment Variables

| Variable | Where used | Purpose |
|---|---|---|
| `ADMIN_UIDS` | API server | Comma-separated Firebase UIDs with full admin access |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | API server | Firebase Admin SDK — verifies ID tokens in `requireUid` |
| `REVENUECAT_WEBHOOK_SECRET` | API server | Authenticates inbound RevenueCat webhook calls |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Mobile app | RevenueCat SDK initialisation on iOS |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | Mobile app | RevenueCat SDK initialisation on Android |

---

## Sequence Diagrams

### User Login & Subscription Check

```
Mobile App          Firebase Auth       API Server          Postgres
    │                    │                   │                   │
    │── signIn() ───────►│                   │                   │
    │◄── uid + token ────│                   │                   │
    │                    │                   │                   │
    │── POST /api/profiles/me ──────────────►│                   │
    │   Bearer: <ID token>                   │── verify token ──►│Firebase Admin SDK
    │                                        │◄── req.uid ────── │
    │                                        │── SELECT profiles ►│
    │                                        │── SELECT subscriptions►│
    │◄── { subscriptionTier, isSubscribed } ─│◄────────────────── │
    │                                        │                   │
    │ (UI gates features on subscriptionTier)│                   │
```

### Business Partner Registration

```
Browser             Business Portal     API Server          Postgres
    │                    │                   │                   │
    │ /business-register?agent=XYZ           │                   │
    │───────────────────►│                   │                   │
    │                    │ capture agentId   │                   │
    │ (sign in)          │                   │                   │
    │ (fill form)        │                   │                   │
    │── submit ─────────►│                   │                   │
    │                    │── POST /api/business ────────────────►│
    │                    │   owner_id = req.uid                  │
    │                    │   sales_agent_id = agentId            │
    │                    │                   │── INSERT business_profiles►│
    │◄── business profile│◄──────────────────│◄──────────────────│
```

### RevenueCat Subscription Activation

```
RevenueCat          API Server          Postgres
    │                   │                   │
    │── POST /api/webhooks/revenuecat ─────►│
    │   Authorization: Bearer <secret>      │
    │   event.app_user_id = business UUID   │
    │   event.type = INITIAL_PURCHASE       │
    │                   │── UPDATE business_profiles ─────────►│
    │                   │   SET is_active_subscription = true   │
    │◄── 200 OK ────────│◄──────────────────────────────────── │
```
