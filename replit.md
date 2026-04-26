# Met

A quiet, anonymous-by-default proximity social network. Your phone is a beacon — people you cross paths with within ~50m become "encounters." Mutual reveal turns an encounter into a "connection" that unlocks social handles. Photo + name + bio are always visible; only socials are gated.

## Stack

- Expo SDK 54 + expo-router (3 tabs: Home, Recent, Profile)
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
- `components/SettingsSheet.tsx` — "Upgrade to Met Plus" CTA (top), Visible on Radar toggle, Blocked people list, Reset profile
- `components/ActionSheet.tsx` — cross-platform bottom sheet for destructive actions
- `components/RequestsSheet.tsx` — Reveal Requests bottom sheet (Recent bell + Home green CTA banner)
- `app/paywall.tsx` — Met Plus paywall (Monthly / Yearly cards derived from RevenueCat offerings — never hardcoded), test-mode confirmation modal in sandbox, restore button
- `lib/revenuecat.tsx` — RevenueCat client. `initializeRevenueCat()` (idempotent), `<SubscriptionProvider>` + `useSubscription()` hook backed by react-query. Tri-state `subscriptionStatus` + `isSubscriptionReady` so we never gate paid users during cold start. `isRevenueCatTestMode()` selects the test API key (web/dev/Expo Go) vs platform keys.
- `lib/usage.ts` — Free-tier weekly counter (3 reveals/week, resets after 7 days). `tryConsumeFreeReveal()` is single-flight to avoid quota race.

## Subscriptions (RevenueCat)

- Project `proj66b3842d`, entitlement `plus`, offering `default` with `$rc_monthly` ($4.99) + `$rc_annual` ($39.99). Seeded by `scripts/src/seedRevenueCat.ts` (idempotent).
- Free tier: 3 reveal requests / week + standard history. After cap, SEND REVEAL REQUEST routes to `/paywall` instead of sending.
- Plus: unlimited reveals, full history, read receipts, frequent paths, privacy mode (UX-only in this prototype — only the reveal cap is actually enforced client-side).
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
