# Met

Mobile SaaS app: a quiet, anonymous-by-default proximity social network. Your phone is a beacon — people you cross paths with within ~50m become "encounters." Mutual reveal turns an encounter into a "connection" with full profile + social handle access.

## Stack

- Expo SDK 54 + expo-router
- AsyncStorage for all persistence (frontend-only first build)
- expo-image-picker for profile photos
- expo-linear-gradient + react-native-reanimated for the beacon pulse
- @expo/vector-icons (Feather + FontAwesome5) — never emojis
- Inter font family

## Structure

- `app/_layout.tsx` — root with `AppProvider` + `ProfileGate` redirect to onboarding
- `app/onboarding.tsx` — 4-step setup: welcome → photo → name+bio → social handles
- `app/(tabs)/index.tsx` — Beacon: animated pulse + recent encounters
- `app/(tabs)/connections.tsx` — Reveal requests + connections
- `app/(tabs)/profile.tsx` — Editable own profile + reset
- `app/encounter/[id].tsx` — Encounter detail with reveal flow
- `contexts/AppContext.tsx` — profile + encounters state, AsyncStorage-backed
- `lib/seed.ts` — 8 mock encounters (mix of fresh, request-received, connected)
- `components/PulseBeacon.tsx` — radar pulse animation
- `components/EncounterRow.tsx` — list row with anonymous-vs-revealed state
- `components/SocialLinkRow.tsx` — opens handle in in-app browser

## Demo behavior

- On send-reveal, status flips to `request_sent`, then auto-accepts to `connected` after 3s (so the demo flow is visible end-to-end without a backend).

## Theme

- Background `#0A0A0F`, primary amber `#F5A623`, card `#16161E`
- One signature color (amber) used sparingly — beacon, ring on incoming requests, primary buttons
- 3 tabs (NativeTabs on iOS 26+, classic Tabs elsewhere)

## Business doc

See `docs/MET_BUSINESS.md` for competitor map and monetization plan.
