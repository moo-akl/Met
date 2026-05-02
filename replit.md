# Met

## Overview
Met is a proximity-based social networking application designed for anonymous-by-default interactions. It enables users to discover people they cross paths with in real life, fostering connections based on mutual interest. The app aims to create a quiet and personal social experience, emphasizing genuine encounters over follower counts. The business vision includes a tiered subscription model for enhanced features and a focus on facilitating real-world interactions.

## User Preferences
I prefer simple language and clear explanations.
I want iterative development with regular updates.
Please ask before making any major architectural changes or introducing new dependencies.
I prefer to focus on core features before moving to optimizations.
Do not make changes to files related to `lib/revenuecat.tsx` unless explicitly instructed.
I prefer to use functional components and hooks in React Native.
Ensure all UI changes are responsive and adhere to the established theme.
Prioritize performance and user experience in all development tasks.

## System Architecture

### UI/UX Decisions
- **Theme**: Light theme with a primary green (`#3DCC44`) and a clean background (`#F1F8F0`). Cards are white (`#FFFFFF`).
- **Typography**: Inter font family is used throughout the application.
- **Iconography**: `(@expo/vector-icons)` including Feather, FontAwesome5, and MaterialCommunityIcons. Emojis are avoided.
- **Header**: Green `AppHeader` bar with "Met" wordmark and page title.
- **Interaction Patterns**:
    - Animated pulse beacon on the Home screen.
    - Inline cards for confirmations/info instead of `Alert.alert`.
    - Cross-platform bottom sheets for actions.

### Technical Implementations
- **Framework**: Expo SDK 54 with `expo-router` for navigation (Home, Recent, Connections, Profile tabs).
- **State Management & Persistence**: `AsyncStorage` is used for all client-side persistence (prototype only).
- **Photo Handling**: `expo-image-picker` for verified photos, `expo-camera` for QR scanning. `PhotoVerifier` modal implements a two-stage verification process (face and content checks).
- **Location & Discovery**: `expo-location` for foreground location permissions. Discovery range is configurable (10m, 50m, 200m).
- **Animations**: `expo-linear-gradient` and `react-native-reanimated` for UI animations like the beacon pulse and Meeting Spot card. `useCountUp.ts` provides rAF-based easing for animated number transitions.
- **QR Codes**: `react-native-qrcode-svg` for displaying user QR codes, `expo-camera` for scanning.
- **Profile Management**: Users can edit their profile, including photo, name, bio, and social handles. `photoVerifiedAt` tracks photo verification status. `extraPhotos` are tier-gated.
- **Encounter & Connection Management**:
    - Encounters are people crossed paths with. Mutual reveal turns an encounter into a connection.
    - `AppContext.tsx` manages profile and encounter state, handling request expiration and status updates.
    - Connections allow for private notes, tags, and a conversation thread with a per-day message quota.
- **Settings**: Comprehensive settings sheet with sections for Discovery (visibility, range), Memory (notifications, auto-cleanup), Preferences (Language picker), and Account (photo verification, blocked people, invite friends, sign out, reset, delete).
- **Authentication**: Real sign-in only (no anonymous fallback) via `@react-native-firebase/auth` v24. Onboarding gates the profile setup behind a single sign-in screen offering Apple Sign-In (iOS only, with SHA-256 nonce flow), Google Sign-In (`@react-native-google-signin/google-signin`, configured with the project web OAuth client ID), and email/password (sign-in / create account / forgot password). All sign-in helpers live in `lib/auth.ts` (`signInWithApple`, `signInWithGoogle`, `signInWithEmail`, `signUpWithEmail`, `sendPasswordReset`, `sendVerificationEmail`, `reloadAndCheckVerified`, `isCurrentUserEmailVerified`, `getCurrentUserEmail`, `getCurrentUserId`, `requireUserId`, `signOut`, `deleteUserAccount`). User-cancel events return `null` and are treated as silent no-ops. **Email verification is required** for email/password accounts: `signUpWithEmail` automatically fires `sendEmailVerification` on the new user, and onboarding inserts a dedicated `"verify"` phase (envelope hero + Continue / Resend-with-60s-cooldown / Use-different-email actions, plus a 5s background poll of `user.reload()` so the user doesn't have to tap Continue if they verified on another device). Apple and Google bypass the verify phase because their identity tokens already include verified emails. On app re-open, an `useEffect` in `app/onboarding.tsx` resumes mid-flow: signed-in + unverified → verify phase; signed-in + verified → profile-setup. Web preview shows a `__DEV__`-gated "Skip sign-in" link that lets onboarding mint a `local-XXX` ID for browser testing only — production native builds always require a real Firebase UID. Bundle ID `app.met.founders`; Firebase project `metapp-b4642`.
- **Paywall**: 3-tier paywall (Free, Plus, Pro) implemented with `RevenueCat` offerings for subscriptions, including feature comparison.
- **Internationalization (i18n)**: 9 languages supported (English, Spanish, Arabic, Chinese, Russian, French, Vietnamese, Portuguese, Dutch) via `i18n-js` + `expo-localization`. Persisted in AsyncStorage (`met:lang:v1`). In-app picker in Settings → Preferences → Language. Auto-detects device locale on first launch and falls back to English. Non-English locale files are sparse (`DeepPartial`) and use runtime English fallback (`enableFallback: true`). Arabic triggers RTL via `I18nManager.forceRTL(true)` with a restart prompt on native; web uses CSS direction. Picking a new language always shows a brief "Switching language…" overlay, then automatically reloads the app (`window.location.reload()` on web) after ~1.5s so cached strings/RTL pick up cleanly.
- **Home Referral CTA**: A green-bordered "Invite friends, get a free month" card sits at the bottom of the Home scroll. Tapping it routes to the Referrals screen, where users can share their invite code; 3 friends joining unlocks 1 month of Met Plus locally.
- **Referral Program (prototype, local-attribution)**: Each profile gets a 6-char uppercase code (no I/O/0/1) generated on first launch. Invite 3 friends → unlock 1 month of "Met Plus via referral" (`met:promoPlusUntil = now + 30 days`). `useSubscription` ORs the local promo into the RC entitlement so tier resolves to `plus` whenever either is active. Settings shows "Met Plus active (via referral)" and the Invite friends row reflects progress (e.g. "0 of 3 friends joined" → "Reward unlocked — Met Plus active"). Onboarding has an optional invite-code step; deep links `met://r/CODE` (with `https://met.app/r/CODE` web fallback) pre-fill the code via `consumePendingReferral()`. The Referrals screen exposes a "Simulate a friend joining" demo button for prototype validation.

### Feature Specifications
- **Home Screen**: Animated beacon, "X people within Nm" counter, "LIVE pulse dot", "vibe pill" (quiet/lively), activity ticker, stat cards, "This week" recap.
- **Recent Encounters**: List of recent encounters, with a "Crossed paths again" pill for repeat encounters. ScanFab to initiate QR scanning.
- **Connections**: Searchable list of connected users. Sortable by recent, most met, or name. Supports tag-based filtering. Each row shows avatar, name, timestamp, and a context-aware preview.
- **Encounter Detail**: Displays full-bleed photo, meeting frequency, first met date, Meeting Spot card, and options to send/accept reveal requests. Auto-redirects to connection detail once connected.
- **Connection Detail**: Shows connection profile (avatar, name, bio, meeting spot, social chips), editable notes and tags. The conversation/messaging UI (composer, chat bubbles, "Connected with…" card) was removed entirely — connections are kept as quiet keepsakes, not chat threads.
- **Reveal Request Sheet**: Tapping "SEND REVEAL REQUEST" on an encounter opens a confirmation sheet with advisory copy ("limited chances, use them wisely, be genuine") and an optional personal-note `TextInput`. The note is persisted on the encounter as `revealMessage` and rendered on the receiver's "Wants to share socials" lock card under "Their note".
- **Report flow** (App Store trust-and-safety requirement): Encounter detail kebab menu has Report → reasons sheet (Inappropriate / Harassment / Spam / Underage / Other). Submitting a report stores it in AsyncStorage (`met:reports:v1` via `lib/reports.ts`) and **automatically blocks** the reported user, then shows an inline confirmation toast and routes back. This satisfies Apple's UGC moderation requirement (Guideline 1.2) for any app where users can communicate with strangers — required because of the optional reveal-request personal note.
- **My QR Sheet**: Displays user's QR code with avatar, name, and bio.
- **Subscription Tiers**:
    - **Free**: Limited visible encounters (10/day), limited reveal requests (2/day), standard history.
    - **Plus**: Unlimited encounters/reveals, full history, read receipts, frequent paths, privacy mode, verified badge, 1 opening message/day.
    - **Pro**: All Plus features + 2 opening messages/day, Boost, See who viewed profile, premium gold badge.

## External Dependencies
- **Expo SDK 54**: Core framework for React Native development.
- **`expo-router`**: File-based routing for navigation.
- **`AsyncStorage`**: Client-side data persistence.
- **`expo-image-picker`**: For selecting images from the device.
- **`expo-linear-gradient`**: For linear gradient backgrounds.
- **`react-native-reanimated`**: For declarative animations.
- **`react-native-qrcode-svg`**: For generating QR codes.
- **`expo-camera`**: For camera access, used in QR scanning.
- **`expo-location`**: For accessing device location.
- **`@expo/vector-icons`**: For UI icons (Feather, FontAwesome5, MaterialCommunityIcons).
- **RevenueCat**: For managing in-app subscriptions and entitlements.
- **`expo-linking`**: For handling external links (Privacy, Terms, Contact, Rate).
- **`react-query`**: For data fetching, caching, and state management, particularly with RevenueCat integration.
- **`@react-native-firebase/app` + `auth`** (v24): Native Firebase Auth bridge for Apple, Google, and email/password sign-in.
- **`expo-apple-authentication`**: Apple Sign-In native sheet (iOS only).
- **`@react-native-google-signin/google-signin`**: Google Sign-In native sheet (iOS + Android).
- **`expo-crypto`**: SHA-256 nonce hashing for the Apple Sign-In replay-protection flow.

## iOS Build Notes
- **Bundle ID**: `app.met.founders` · **App Store name**: "Met: We Crossed Paths" · **Apple Team ID**: `AWHU9BTQQX` · **Firebase project**: `metapp-b4642`.
- **EAS auth**: Uses App Store Connect API Key (`78GT7G5P5A`) instead of Apple ID password. The `.p8` is at `artifacts/met/.secrets/AuthKey_78GT7G5P5A.p8` (gitignored, chmod 600). Before any `eas build` or `eas submit`, export in the shell session: `EXPO_ASC_API_KEY_PATH` (absolute path), `EXPO_ASC_KEY_ID=78GT7G5P5A`, `EXPO_ASC_ISSUER_ID=ace2baad-b6ed-4999-90c5-7f8cf8feb768`, `EXPO_APPLE_TEAM_ID=AWHU9BTQQX`.
- **Modular headers fix**: `useFrameworks: "static"` (required by Firebase iOS SDK) causes RNFBApp to error on non-modular React-Core header includes. The custom plugin `plugins/with-modular-headers.js` (registered in `app.json` plugins) injects two things into the prebuilt Podfile: (1) `use_modular_headers!` after `use_frameworks!`, and (2) `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` on every pod target inside the `post_install` hook. The plugin requires `@expo/config-plugins` as a direct devDep (pnpm doesn't hoist it for EAS to find).
- **SDK version alignment**: Several `expo-*` packages were on SDK 55 versions while the project is SDK 54. Fixed by aligning `expo-apple-authentication@~8.0.8`, `expo-build-properties@~1.0.10`, `expo-crypto@~15.0.9`. SDK 55 packages reference `StaticFunction`/`StaticAsyncFunction` Swift APIs that don't exist in SDK 54's `expo-modules-core@3.0.x`. Use `npx expo install --check` to verify alignment before any build.
- **Face detector stub**: `lib/faceDetector.ts` returns `{count: 0, supported: false}` because both `@react-native-ml-kit/face-detection` and `@infinitered/react-native-mlkit-face-detection` had incompatible MLKit pods conflicting with Firebase 12.x's GoogleUtilities ~>8 / GTMSessionFetcher >=3.4. `runFaceCheck` already passes through gracefully when face detection is unavailable.

## Real Proximity (Build #13)
- **Architecture**: hybrid GPS + BLE. Build #13 ships GPS only. BLE scan + advertise (custom Expo native module) is scheduled for Build #14. Profile lookup unifies both paths by Firebase UID.
- **Backend** (`artifacts/api-server`):
  - Postgres (NOT Firebase Firestore) via Drizzle. Schemas in `lib/db/src/schema/{profiles,encounters,presence}.ts`.
  - Routes in `artifacts/api-server/src/routes/{profiles,encounters,presence}.ts` + `middlewares/requireUid.ts` (X-Met-Uid header trust for MVP — hardening = `firebase-admin` token verification).
  - Endpoints: `PUT /api/profiles/me`, `GET /api/profiles/{uid}`, `POST /api/encounters`, `GET /api/encounters`, `PUT /api/presence`, `GET /api/presence/nearby`. Nearby uses Haversine SQL, defaults: 200 m radius, 15 min maxAge.
  - OpenAPI contract in `lib/api-spec/openapi.yaml`; codegen via `pnpm --filter @workspace/api-spec run codegen`.
- **Mobile**:
  - `lib/api/client.ts` — typed wrappers; resolves API URL from `EXPO_PUBLIC_API_URL` or expo Constants hostUri. Adds `X-Met-Uid` header.
  - `lib/proximity/presence.ts` — singleton GPS loop. Pushes location every 60 s, polls nearby every 30 s, dedupes re-emits within 10 min, resolves each new uid via `/api/profiles/{uid}`, logs to `/api/encounters`, emits typed `ProximityDetection` events.
  - `lib/auth.ts` — added `subscribeToAuthState(cb)` wrapping Firebase `onAuthStateChanged`.
  - `contexts/AppContext.tsx` — `upsertEncounterFromProximity` merges detections into the local encounter list using uid as the row id (so a later QR scan unifies into the same encounter). Two effects: profile→backend sync; uid+permissions→start/stop proximity loop.
- **UI polish (Build #13)**:
  - Email-auth password field gained a show/hide eye toggle.
  - Profile photo edit now offers Replace / Remove via `Alert.alert` (Save remains disabled until a photo is chosen).
  - Settings sheet has a new Permissions row that deep-links to OS settings via `Linking.openSettings()`.
  - Home vibe label "Quiet zone" was renamed to active language ("Looking around") across all 9 locales.

## Real BLE Proximity (Build #14)
- **Encoding**: each user's identity hash = first 8 bytes of SHA-256(firebaseUid), encoded as 16 lowercase hex chars. Met service UUID `4d455400-7770-4ac2-9b3d-000000000001`.
- **Backend**: added `uidHash text` column (indexed, default `''`) to `profilesTable`; recomputed on every profile upsert via `artifacts/api-server/src/lib/uidHash.ts`. New route `POST /api/ble/resolve` (`routes/ble.ts`) accepts `{ hashes: string[] }` (each 16 hex, max 64) and returns matched profiles. OpenAPI updated with `BleResolveRequest` + `BleResolveEntry` schemas.
- **Mobile BLE library** (`artifacts/met/lib/ble/`):
  - `uuids.ts`, `encode.ts` (uses `expo-crypto`), `plx.ts` (defensive lazy require of `react-native-ble-plx` so Expo Go silently no-ops).
  - `scanner.ts` — singleton, generation tokens, dual-source hash extraction (Android service-data + iOS local-name `met:<hex>` fallback), batched resolve every 4s with `inFlightHashes` set to prevent dedup races during the resolve await, and proper overflow re-queueing for batches >32.
  - `index.ts` — `startBleProximity({uid, listener})` / `stopBleProximity()` mirroring the GPS service. RSSI → meters estimator (rough, clamped 1–50m).
- **Custom Expo native module** at `artifacts/met/modules/expo-met-ble/`:
  - iOS Swift module using `CBPeripheralManager` (advertises Met service UUID + local name `met:<hex>` because iOS strips service data).
  - Android Kotlin module using `BluetoothLeAdvertiser` (advertises service UUID + 8-byte service data payload).
  - JS bridge `src/index.ts` exports `startAdvertising(uid, hashHex)`, `stopAdvertising()`, `isAdvertisingAvailable()` with `requireOptionalNativeModule` + try/catch fallback for Expo Go.
  - Auto-discovered by `expo-modules-autolinking` from the `modules/` folder.
- **Config plugin** `artifacts/met/plugins/with-met-ble.js` — idempotent injection of iOS `NSBluetoothAlwaysUsageDescription` and Android `BLUETOOTH`/`BLUETOOTH_ADMIN`/`BLUETOOTH_SCAN` (with `neverForLocation`)/`BLUETOOTH_CONNECT`/`BLUETOOTH_ADVERTISE` permissions.
- **Permissions UI**: `app/permissions.tsx` Bluetooth row now performs real probes — `PermissionsAndroid.requestMultiple` on Android 12+, BleManager `onStateChange` probe on iOS (with subscription cleanup + 4s timeout).
- **AppContext**: added a second `useEffect` that mirrors the GPS effect for BLE — same gating (uid + permissions + api configured), independent lifecycle so a failure in one pipeline doesn't tear down the other. Both pipelines feed `upsertEncounterFromProximity`, source label is "In the room" for BLE vs "Nearby" for GPS.
- **Caveats**: BLE cannot be tested in Expo Go, simulator, or emulator — requires a pair of physical devices and an EAS dev/production build. Foreground only (background BLE on iOS requires App Store justification, deferred).
- **App version**: iOS `buildNumber` = `14`, Android `versionCode` = `4`. App version stays `1.0.0`.

## Reveal Requests (server-backed, post-Build #20)
- **Why**: Mutual identity reveal needs server mediation so two devices that detect each other via BLE can actually exchange consent. Pre-#20 the encounter screen optimistically flipped local status with a 3s dev-only auto-accept stub.
- **DB**: `lib/db/src/schema/reveals.ts` — `revealRequestsTable(senderUid, recipientUid, message, status pending|accepted|declined, createdAt, updatedAt, respondedAt)`. Unique on (sender, recipient); indexed both directions for inbox/outbox lookups.
- **Routes** (`artifacts/api-server/src/routes/reveals.ts`): `POST /api/reveals` (upsert: re-sending after accept/decline returns to pending), `GET /api/reveals/inbox`, `GET /api/reveals/outbox`, `POST /api/reveals/accept`, `POST /api/reveals/decline`. Inbox/outbox responses inline the peer profile (`RemoteRevealRequestWithProfile`) — same surface area as `/api/profiles/:uid`, no extra leak.
- **Mutual-consent shortcut**: `POST /reveals/accept` runs the inbound update + reverse-pending update inside a single `db.transaction(...)` so both rows flip to accepted atomically (no asymmetric "one side connected, other still waiting" if the process crashes between writes). `decline` is per-direction and never touches the reverse row.
- **Self-target → 400**, **unknown recipient → 404**, **accept with no pending row → 404**.
- **Client API** (`artifacts/met/lib/api/client.ts`): 5 typed wrappers + `RemoteRevealRequest` / `RemoteRevealRequestWithProfile` types.
- **AppContext** (`artifacts/met/contexts/AppContext.tsx`):
  - `sendRevealRequest`, `acceptRevealRequest`, `declineRevealRequest` — pessimistic API-first then local `updateEncounterStatus`. Throw on failure so the encounter screen surfaces a native `Alert`.
  - 20s `setInterval` poller, single-flight (`pollInFlight` ref skips overlapping ticks), gated on `authedUid + permissionsCompleted + api.isConfigured`. Push notifications via FCM/APNs are a follow-up.
  - **Per-peer watermarks** (`revealWatermarks` ref of inbound/outbound `Map<peerUid, updatedAtMs>`): every applied poll entry must have `updatedAt > watermark[peerUid]`. User-driven actions bump the watermark to the API response's `updatedAt` (or for the auto-accepted reverse row, the same response timestamp). Prevents a stale poll response from clobbering a freshly-completed accept/decline/send. Watermarks reset on `authedUid` change.
  - `applyRemoteRevealState` merger handles all status combinations; never downgrades `connected` or `blocked`; bumps watermarks even on no-op branches so unchanged rows aren't re-evaluated forever.
  - Inbox entries with no matching local encounter (e.g. QR-only flow where the recipient has never detected the sender) get a fabricated encounter with `lastLocation: "Reveal request"` so the request still surfaces.
- **Encounter screen** (`artifacts/met/app/encounter/[id].tsx`): `confirmSend` calls `sendRevealRequest`; on failure refunds the free reveal via the new atomic `refundFreeReveal()` in `lib/usage.ts` (the same write-chain mutex as `tryConsumeFreeReveal` so refund + concurrent consume can't race; floors at 0). `handleAccept` / `handleDecline` wrap the new context methods with try/catch + Alert.
- **Dev-only 3s auto-accept timer** in encounter/[id].tsx is preserved (gated on `__DEV__`, false in EAS preview/TestFlight). With a working backend it's harmless because watermarks ensure the server's authoritative state wins on subsequent polls.
- **Caveats**: still uses MVP `X-Met-Uid` impersonation trust — same threat model as the rest of the API. To exercise the flow on real devices the user must rebuild the Android preview / iOS TestFlight to bake `EXPO_PUBLIC_API_URL` and ship the new client code.
- **Build numbers for the reveal-flow ship**: iOS `buildNumber` = `21`, Android `versionCode` = `8`. App version stays `1.0.0`.

## iBeacon BLE pipeline (Build #22 / versionCode 9)
- **Why**: GATT-based scan/advertise (Build #14) never produced a single phone-to-phone detection in the wild — server logs showed zero `/api/ble/resolve` calls in production. iOS strips the service-data field that carried the SHA-256 identity hash whenever the app backgrounds, and the local-name fallback was unreliable across device pairs. The original Flutter MVP used iBeacon ranging and detected peers in ~1 second, so we ported that exact wire format.
- **Wire format**: every device broadcasts an iBeacon `<UUID, major, minor=1>` packet where `major = stableHash(uid)` per the Flutter polynomial-rolling hash `(31 * acc + utf16CodeUnit(c)) % 65535`, range `[0, 65534]`. Proximity UUID is `eb2a1103-b8c5-4384-9549-c18428511674` — same UUID Flutter shipped, kept for protocol continuity. The 8-byte SHA-256 `uidHash` from Build #14 is preserved on the server but no new clients send it.
- **Backend** (`artifacts/api-server`):
  - Added `uidMajor integer` column + `profiles_uid_major_idx` index to `profilesTable`. Computed at every profile upsert via `uidToMajor()` in `lib/uidHash.ts` (must stay byte-identical to the client function in `lib/ble/encode.ts`).
  - `POST /api/ble/resolve` now accepts `{ hashes?: string[], majors?: number[] }` (at least one non-empty, total ≤ 64 each). Runs both lookups in parallel, unions results, collapses entries that match the same uid in both pipelines into a single response entry with both `hash` and `major` set. Returns `400` when both inputs are empty.
- **Native module** (`artifacts/met/modules/expo-met-ble`):
  - **iOS Swift**: added `startBeaconAdvertising(uuid, major, minor)` using `CLBeaconRegion(uuid:major:minor:identifier:).peripheralData(withMeasuredPower: nil)` fed into `CBPeripheralManager.startAdvertising`. Added `startBeaconRanging(uuid)` using `CLLocationManager.startRangingBeacons(satisfying: CLBeaconIdentityConstraint(uuid:))`. Emits `onBeaconRanged` events with `{ uuid, beacons: [{ major, minor, rssi, accuracy, proximity }] }`. The legacy GATT advertise/range methods stay exported for backward compat but are unused by new code.
  - **Android Kotlin**: built iBeacon manufacturer-data frames manually — Apple company ID `0x004C` followed by `[0x02, 0x15, UUID(16BE), major(2BE), minor(2BE), txPower(1)]`. `BluetoothLeAdvertiser.startAdvertising` for broadcast; `BluetoothLeScanner.startScan` (low-latency mode, no filter) parsing manufacturer-specific data per result for ranging. Same `onBeaconRanged` event shape as iOS.
  - **JS surface** (`src/index.ts`): `startBeaconAdvertising`, `stopBeaconAdvertising`, `isBeaconAdvertisingAvailable`, `startBeaconRanging(uuid, listener) → { started, remove }`, `stopBeaconRanging`, `stopAllBeaconRanging`. All wrapped with `requireOptionalNativeModule` + try/catch so Expo Go silently no-ops.
- **Mobile BLE library** (`artifacts/met/lib/ble`):
  - `uuids.ts` — added `MET_IBEACON_UUID`, `MET_IBEACON_MINOR = 1`, `MET_IBEACON_REGION_ID`. Legacy GATT `MET_SERVICE_UUID` kept for older builds in the wild.
  - `encode.ts` — added `uidToMajor(uid)` (paired with the server function).
  - `scanner.ts` — rewritten to subscribe to native iBeacon ranging events instead of `react-native-ble-plx` device scans. Same generation-token + in-flight-set + overflow-requeue race-safety as the GATT version; queues majors instead of hashes; resolve cadence dropped from 4s → 800ms (iBeacon ranging delivers ~1 callback/sec/peer). **Client-side clamps `major` to `[0, 65534]` and drops `minor !== 1`** before queueing, so a foreign/rogue beacon advertising `major === 65535` can't poison the resolve batch via Zod 400.
  - `index.ts` — `startBleProximity` now drives the iBeacon advertiser (not the GATT one); same `BleProximityDetection` shape so AppContext doesn't change.
  - `api/client.ts` — `bleResolve(opts, { hashes?, majors? })`; new code only sends `majors`.
- **Permissions / config plugin** (`plugins/with-met-ble.js`):
  - **Android**: removed `android:usesPermissionFlags="neverForLocation"` from `BLUETOOTH_SCAN` — iBeacon proximity IS location inference, and on Android 12+ the flag causes the OS to filter scan results in ways that break detection. Added explicit `ACCESS_FINE_LOCATION` for redundancy with the `expo-location` plugin (required for BLE scan on Android 6..11).
  - **iOS**: existing `NSBluetoothAlwaysUsageDescription` and `NSLocationWhenInUseUsageDescription` (from `expo-location`) cover both advertising and foreground ranging. Background ranging would additionally require `Always` location authorization and the `location`/`bluetooth-central` background modes — deferred.
- **Verified end-to-end**: profile upsert populates `uidMajor`; `POST /api/ble/resolve` with `{majors:[<computed>]}` returns the right profile; combined `{hashes,majors}` collapses to one entry per uid with both fields set; out-of-range majors return Zod 400.
- **Build numbers**: iOS `buildNumber` = `22`, Android `versionCode` = `9`. App version stays `1.0.0`. **Native module changed → requires a fresh `eas build` (TestFlight + Android preview); cannot be tested via OTA update or in Expo Go.**