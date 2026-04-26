# Met

A quiet, anonymous-by-default proximity social network. Your phone is a beacon — people you cross paths with within ~50m become "encounters." Mutual reveal turns an encounter into a "connection" that unlocks social handles. Photo + name + bio are always visible; only socials are gated.

## Stack

- Expo SDK 54 + expo-router (4 tabs: Home, Recent, Connections, Profile)
- AsyncStorage for all persistence (frontend-only prototype)
- expo-image-picker for the verified photo
- expo-linear-gradient + react-native-reanimated for beacon pulse + Meeting Spot card
- react-native-qrcode-svg for the My QR sheet
- expo-camera for QR scanning (`/scan`)
- expo-location for the foreground location permission prompt
- @expo/vector-icons (Feather + FontAwesome5 + MaterialCommunityIcons) — never emojis
- Inter font family

## Theme

- Background `#F1F8F0`, primary green `#3DCC44`, card `#FFFFFF`
- Light theme only. Green AppHeader bar with "Met" wordmark + page title.
- Brand-colored social chips, simplified EncounterRow.

## Structure

- `app/_layout.tsx` — root with `AppProvider` + `ProfileGate` (onboarding → permissions → tabs)
- `app/onboarding.tsx` — 3-slide intro carousel (target/shield/user) → photo → name+bio → socials
- `app/permissions.tsx` — Location / Bluetooth / Camera / Notifications consent screen with disclosure copy. Real requests fire on native via expo-location & expo-camera; Bluetooth + Notifications are UX-only on web.
- `app/scan.tsx` — Full-screen camera modal with QR overlay; on detect parses the JSON payload `{v,type,id,name}`, calls `upsertEncounterFromQr`, navigates to `/encounter/[id]`. Includes "Simulate a scan" demo button.
- `app/(tabs)/index.tsx` — Home: animated pulse beacon, "X people within 50m", stat cards
- `app/(tabs)/recent.tsx` — Recent encounters list with ScanFab → `/scan`
- `app/(tabs)/profile.tsx` — Editable own profile, MyQrSheet (grid icon), SettingsSheet (gear icon)
- `app/encounter/[id].tsx` — Full-bleed photo, "Met X times", "First met on", Meeting Spot card, lock card with SEND REVEAL REQUEST
- `contexts/AppContext.tsx` — profile + encounters state, AsyncStorage-backed
- `lib/seed.ts` — mock encounters
- `components/AppHeader.tsx` — green branded header
- `components/PulseBeacon.tsx` — radar pulse (gray + static when `active=false`)
- `components/EncounterRow.tsx` — list row with three-dot ActionSheet (Remove / Block)
- `components/MyQrSheet.tsx` — bottom sheet with avatar/name/bio/QR (JSON payload `{v,type,id,name}`)
- `components/SettingsSheet.tsx` — Tier-aware upgrade row (Free / Plus / Pro states with TierBadge), Visible on Radar toggle, Blocked people list, Reset profile
- `components/TierBadge.tsx` — green check for Plus, gold star + green check for Pro, used in MyQrSheet, SettingsSheet, etc.
- `components/ActionSheet.tsx` — cross-platform bottom sheet for destructive actions
- `components/RequestsSheet.tsx` — Reveal Requests bottom sheet (Recent bell + Home green CTA banner)
- `app/(tabs)/connections.tsx` — Connections tab: chat-list of all `status === "connected"` encounters sorted by last activity, showing avatar, name, last-message preview, timestamp, and an unread dot for replies in the last 60s. Empty state when no connections.
- `app/connection/[id].tsx` — Dedicated conversation screen: header with avatar/name + collapsible "details" panel (bio, encounter count, meeting spot, social chips), chat thread with bubbles, and a sticky composer at the bottom. Composer shows the upgrade card for Free, the per-day quota counter for Plus/Pro, and a "wait for reply" hint while a message is pending. After connection, all message UX lives here — the encounter detail screen redirects via `router.replace` so a connected encounter is never shown twice.
- `app/encounter/[id].tsx` — Encounter detail (pre-connection only). Handles SEND REVEAL REQUEST, the "request_sent" waiting state, and ACCEPT/Not now for received requests. Auto-redirects to `/connection/[id]` once status flips to connected.
- `app/paywall.tsx` — 3-tier paywall: Plus/Pro tier toggle in the hero, Monthly/Yearly cards derived from RevenueCat offerings (never hardcoded) with auto Save% badge, full feature comparison table (Free / Plus / Pro columns), test-mode confirmation modal in sandbox, restore button. Default tier preselection is reactive: Plus subscribers see Pro pre-selected as the upgrade path until they manually toggle.
- `lib/revenuecat.tsx` — RevenueCat client. `initializeRevenueCat()` (idempotent). `<SubscriptionProvider>` + `useSubscription()` hook backed by react-query exposes `tier` ("free" | "plus" | "pro"), `isPlusSubscriber` (true for plus OR pro — Pro is a superset), `isProSubscriber`, plus `plusOffering` and `proOffering`. Tri-state `subscriptionStatus` + `isSubscriptionReady` so we never gate paid users during cold start. `isRevenueCatTestMode()` selects the test API key (web/dev/Expo Go) vs platform keys. `withRetry()` wraps RC calls for the 429 rate-limit edge.
- `lib/usage.ts` — Per-day quota buckets keyed by local-day so they reset at midnight. Constants: `FREE_REVEALS_PER_DAY=2`, `PLUS_OPENING_MESSAGES_PER_DAY=1`, `PRO_OPENING_MESSAGES_PER_DAY=2`, `FREE_VISIBLE_ENCOUNTERS=10`. `tryConsumeFreeReveal()` and `tryConsumeOpeningMessage(cap)` are single-flight (per-key promise chain) to avoid quota races. Also exports `startOfTodayMs()` for slicing the encounter feed against the daily cap.

## Subscriptions (RevenueCat)

- Project `proj66b3842d`. Two entitlements + offerings, both seeded by `scripts/src/seedRevenueCat.ts` (idempotent, with retry on 429):
  - `plus` entitlement, offering `default`: `$rc_monthly` ($4.99) + `$rc_annual` ($39.99).
  - `pro` entitlement, offering `pro`: `$rc_monthly` ($8.99) + `$rc_annual` ($69.99). **Pro products are attached to BOTH the `pro` and `plus` entitlements** (Pro is a strict superset of Plus), so any `isPlusSubscriber` check passes for Pro users.
- Free tier: 10 visible encounters per day (resets at midnight) + 2 reveal requests per day + standard history. Past 10 today are hidden behind an upgrade card; past the reveal cap, SEND REVEAL REQUEST routes to `/paywall`.
- Plus: unlimited encounters/reveals, full history, read receipts, frequent paths, privacy mode, verified badge, **1 opening message per day** (gated client-side; auto-reply simulated after 4s in this prototype).
- Pro: everything in Plus + **2 opening messages per day** (replaces 1), Boost (rank higher in others' encounters), See who viewed your profile, premium gold badge. UX-only in this prototype except for the reveal cap, opening-message cap, and 10/day encounter cap which are enforced client-side.
- Public API keys are in env vars (`EXPO_PUBLIC_REVENUECAT_*_API_KEY`); IDs are in `REVENUECAT_*` env vars. Never hardcode prices — derive from `offerings.current.availablePackages`.

## Demo behavior

- On send-reveal, status → `request_sent`, then auto-accepts to `connected` after 3s.
- Block flips `blocked: true`; encounter is filtered from main lists, surfaces under Settings → Blocked people for unblock.
- Visible on Radar toggles `profile.isVisible`. When off: beacon goes gray/static, Home shows "You're invisible to others."
- QR scan: if the scanned id matches an existing encounter, it bumps its lastSeenAt + count and flips to `request_sent`. If unknown, a new encounter is fabricated with a deterministic pravatar avatar and `request_sent` status. Either way you land on the encounter detail and the 3-second auto-accept kicks in.
- Permissions screen is one-time (saved to AsyncStorage `met:permissions:v1`). Reset profile clears it so the flow can be re-tested.

## Real-app engine (reference, not implemented in this prototype)

The user's production Flutter app implements the discovery engine as follows. We mirror the UX surface but run on AsyncStorage seed data instead of the real backend.

- **Identity**: Firebase Auth UID, hashed to 16-bit `uidHash` for BLE major.
- **BLE beacon**: broadcasts a fixed proximity UUID with `major = uidHash`. Phones scanning the same UUID match by major and look the user up in Firestore.
- **GPS fallback**: every ~2 minutes writes own geopoint to `users/{uid}.location` and queries `users` within 50–100m via geoflutterfire.
- **Dedup**: in-memory 10-min `_recentlyMet` Set + per-user `last_met_*` 2-hr notification cooldown in SharedPreferences.
- **Data model** (Firestore):
  - `users/{uid}` — name, bio, photoUrl, socials, isVisible, location, uidHash, lastActive
  - `users/{uid}/met_people/{theirUid}` — lastMet, metCount, firstMet
  - `users/{uid}/requests/{theirUid}` — status (pending/accepted), from
  - `users/{uid}/blocked_users/{theirUid}` — blockedAt
- **Reveal handshake**: writing a `pending` request to the other side. If they already had one for you, both flip to `accepted` (mutual). QR scan bypasses BLE/GPS and goes straight to send-reveal.
- **Visibility**: `isVisible=false` excludes you from others' GPS scans; beacon stops broadcasting.
- **Photo verification**: google_mlkit_face_detection rejects uploads with 0 or >1 faces.
- **Background execution**: workmanager + flutter_background_service + Android foreground service notification.

## Business doc

See `docs/MET_BUSINESS.md` for competitor map and monetization plan.
