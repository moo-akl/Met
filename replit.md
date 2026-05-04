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
- **EAS auth**: Uses App Store Connect API Key (`78GT7G5P5A`) instead of Apple ID password. The `.p8` is at `artifacts/met/.secrets/AuthKey_78GT7G5P5A.p8` (gitignored, chmod 600). Before any `eas build` or `eas submit`, export in the shell session: `EXPO_ASC_API_KEY_PATH` (absolute path), `EXPO_ASC_KEY_ID=78GT7G5P5A`, `EXPO_ASC_ISSUER_ID=ace2baad-b6ed-4999-90c5-7f8cf8feb768`, `EXPO_APPLE_TEAM_ID=AWHU9BTQQX`. `EXPO_TOKEN` is stored as a Replit Secret for non-interactive triggers.
- **Free build path (GitHub Actions)**: `.github/workflows/ios-build.yml` runs `eas build --local` on a free `macos-15` runner — zero EAS cloud credits. Setup docs in `.github/workflows/README.md`. Required GitHub secrets: `EXPO_TOKEN`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID`, `EXPO_APPLE_TEAM_ID`, `EXPO_ASC_API_KEY_BASE64` (base64-encoded `.p8`). Trigger via Actions tab → "Run workflow" or push a `ios-build-*` tag. Free tier ≈ 200 macOS minutes/month → ~10–14 free iOS builds. Output `.ipa` uploaded as workflow artifact (kept 30 days).
- **EAS bash timeout caveat (Replit env)**: `eas build` non-interactively takes 90–150s for credential check + 201MB upload — exceeds the 120s bash limit. Background processes get reaped by Replit. Workaround: configure a one-shot workflow via `configureWorkflow({name: "EAS iOS Build Trigger", command: "...", outputType: "console", autoStart: true})`, poll output with `getWorkflowStatus` until the build URL appears, then `removeWorkflow` to clean up.
- **Modular headers fix (RNFB v24 + Expo SDK 54 + Xcode 26)**: `useFrameworks: "static"` (required by Firebase iOS SDK) makes React-Core a static framework with a module map. RNFB v24 source headers (`RNFBFirestoreModule.h` line 20: `#import <RNFBApp/RNFBSharedUtils.h>`) trigger a modular load of RNFBApp, which transitively imports `<React/RCTBridgeModule.h>`. Modules export DECLARATIONS but **NOT preprocessor macros** — so `RCT_EXTERN`, `RCT_CONCAT`, `RCT_CONCAT2` (defined in `RCTDefines.h`, included by `RCTBridgeModule.h`) are invisible at the .m file's translation-unit scope. When `RCT_EXPORT_MODULE()` / `RCT_EXPORT_METHOD()` (visible because they ARE in `RCTBridgeModule.h` itself) expand inside the .m file, the expansion text contains `RCT_EXTERN` / `RCT_CONCAT` and Clang errors "unknown type name 'RCT_EXTERN'" / "duplicate declaration of method 'RCT_CONCAT'". This is intrinsic to the use_frameworks!+RNFBv24+RN0.81 combo, NOT caused by `use_modular_headers!` (which we never set).
  - The custom plugin `plugins/with-modular-headers.js` injects three things into the Podfile: (1) `$RNFirebaseAsStaticFramework = true` at top — official RNFB opt-in for static framework packaging; (2) `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` on every pod target inside `post_install` to silence the warning; (3) **the actual fix (Build #34)**: `post_install` block patches each `Target Support Files/RNFB*/RNFB*-prefix.pch` file with a macro prelude (`#define RCT_EXTERN extern __attribute__((visibility("default")))`, `#define RCT_CONCAT2(A,B) A##B`, `#define RCT_CONCAT(A,B) RCT_CONCAT2(A,B)`, plus `RCT_EXTERN_C_BEGIN/END`). CocoaPods force-includes the prefix.pch on every .m/.mm in the pod via `-include`, so the macros become visible at .m scope BEFORE any modular React import runs. Sentinel marker `// RNFB-react-macro-prelude-v1` ensures idempotency across repeated `pod install`. Plugin requires `@expo/config-plugins` as a direct devDep (pnpm doesn't hoist it for EAS).
  - **Do NOT add `use_modular_headers!` or `DEFINES_MODULE = YES`** — they make the macro problem WORSE by forcing more headers into module scope.
  - The companion plugin `plugins/with-rnfb-firestore-header-fix.js` prepends `#import <RNFBApp/RNFBAppModule.h>` above each `#import <React/RCTBridgeModule.h>` in the RNFB submodule headers. **This prepend is REDUNDANT** — the original RNFB source already imports `<RNFBApp/RNFBSharedUtils.h>` first, which already triggers the modular RNFBApp load. Plugin is kept as defensive no-op; harmless because both imports stay textual at the header level.
  - To debug Podfile changes locally without burning an EAS build, copy `artifacts/met` to `/tmp/met-prebuild`, symlink `node_modules` from the workspace, and run `npx expo prebuild --platform ios --no-install` — the generated `ios/Podfile` shows exactly what EAS will see. Always `rm -rf ios` before re-prebuilding because `--no-install` reuses the existing folder. To verify the pch patch fired, look for `[with-modular-headers] Patched RNFBFirestore-prefix.pch with React macro prelude` in the EAS install-pods log section.
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
- **Routes** (`artifacts/api-server/src/routes/reveals.ts`): `POST /api/reveals` (upsert: re-sending after accept/decline returns to pending), `GET /api/reveals/inbox`, `GET /api/reveals/outbox`, `POST /api/reveals/accept`, `POST /api/reveals/decline`, `POST /api/reveals/cancel` (sender withdraws own pending request — soft-updates to "declined" so recipient's poll picks up the removal). Inbox/outbox responses inline the peer profile (`RemoteRevealRequestWithProfile`) — same surface area as `/api/profiles/:uid`, no extra leak.
- **Mutual-consent shortcut**: `POST /reveals/accept` runs the inbound update + reverse-pending update inside a single `db.transaction(...)` so both rows flip to accepted atomically (no asymmetric "one side connected, other still waiting" if the process crashes between writes). `decline` is per-direction and never touches the reverse row.
- **Self-target → 400**, **unknown recipient → 404**, **accept with no pending row → 404**.
- **Client API** (`artifacts/met/lib/api/client.ts`): 6 typed wrappers + `RemoteRevealRequest` / `RemoteRevealRequestWithProfile` types. Includes `cancelReveal` for sender-initiated withdrawal.
- **AppContext** (`artifacts/met/contexts/AppContext.tsx`):
  - `sendRevealRequest`, `acceptRevealRequest`, `declineRevealRequest`, `cancelRevealRequest` — pessimistic API-first then local `updateEncounterStatus`. Throw on failure so the encounter screen surfaces a native `Alert`.
  - 20s `setInterval` poller, single-flight (`pollInFlight` ref skips overlapping ticks), gated on `authedUid + permissionsCompleted + api.isConfigured`. Push notifications via FCM/APNs are a follow-up.
  - **Per-peer watermarks** (`revealWatermarks` ref of inbound/outbound `Map<peerUid, updatedAtMs>`): every applied poll entry must have `updatedAt > watermark[peerUid]`. User-driven actions bump the watermark to the API response's `updatedAt` (or for the auto-accepted reverse row, the same response timestamp). Prevents a stale poll response from clobbering a freshly-completed accept/decline/send. Watermarks reset on `authedUid` change.
  - `applyRemoteRevealState` merger handles all status combinations; never downgrades `connected` or `blocked`; bumps watermarks even on no-op branches so unchanged rows aren't re-evaluated forever. **Reconciliation** (Build #41): after processing all inbox items, any local encounter in `request_received` status whose sender is NOT in the current inbox set is reverted to `encounter` — this handles the case where the sender cancelled their request.
  - Inbox entries with no matching local encounter (e.g. QR-only flow where the recipient has never detected the sender) get a fabricated encounter with `lastLocation: "Reveal request"` so the request still surfaces.
- **Encounter screen** (`artifacts/met/app/encounter/[id].tsx`): `confirmSend` calls `sendRevealRequest`; on failure refunds the free reveal via the new atomic `refundFreeReveal()` in `lib/usage.ts` (the same write-chain mutex as `tryConsumeFreeReveal` so refund + concurrent consume can't race; floors at 0). `handleAccept` / `handleDecline` wrap the new context methods with try/catch + Alert.
- **Dev-only 3s auto-accept timer** in encounter/[id].tsx is preserved (gated on `__DEV__`, false in EAS preview/TestFlight). With a working backend it's harmless because watermarks ensure the server's authoritative state wins on subsequent polls.
- **Caveats**: still uses MVP `X-Met-Uid` impersonation trust — same threat model as the rest of the API. To exercise the flow on real devices the user must rebuild the Android preview / iOS TestFlight to bake `EXPO_PUBLIC_API_URL` and ship the new client code.
- **Build numbers for the reveal-flow ship**: iOS `buildNumber` = `21`, Android `versionCode` = `8`. App version stays `1.0.0`.

## Build #42 (iOS buildNumber=42, Android versionCode=20)
- **Email/password auth error handling**: Catch block now maps Firebase error codes to user-friendly localized alerts (`auth/invalid-credential`, `auth/email-already-in-use`, `auth/too-many-requests`, `auth/network-request-failed`, `auth/operation-not-allowed`). Unknown errors include the raw error code in the alert body (even in production) so users can report the exact failure.
- **Profile restoration after re-login**: `tryRestoreExistingProfile()` in `onboarding.tsx` calls `GET /api/profiles/me` after successful auth. If the server has an existing profile (name + photo), it restores it locally and skips straight to the main app tabs — no re-upload required. Falls back to normal onboarding on 404 or transient API errors. All auth paths (`handleApple`, `handleGoogle`, `handleEmailAuth`, resume effect, verify poll) funnel through the async `goToProfileSetup()`.
- **RevenueCat initialization fix**: `isRevenueCatTestMode()` no longer returns `true` for `storeClient` execution environment — store builds now correctly use real platform-specific API keys instead of the missing test key. `getRevenueCatApiKey()` validates only the key needed for the current platform (test key for dev/web, iOS key for iOS, Android key for Android) instead of requiring all three. This fixes subscriptions being silently unavailable on every production build.
- **New API client method**: `api.getMyProfile(opts)` wraps `GET /api/profiles/me`.
- **i18n**: Added `wrongCredentials`, `emailInUse`, `tooManyAttempts`, `networkError`, `emailAuthDisabled` keys across all 9 locales.

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
## On-device BLE debug HUD (Build #23 / versionCode 10)
- **Why**: Build #22 / v9 went out with a structurally-correct iBeacon migration but field testing produced **zero** `/api/ble/resolve` calls, even with confirmed-good runtime conditions (BT permissions granted, BT radio on, both apps in foreground, phones touching). TestFlight/sideloaded APKs have no console, so we had no way to know which native layer was failing without yet another guess-and-rebuild cycle.
- **Approach**: shipped a singleton snapshot store (`lib/ble/debug.ts`) mirroring the `lib/diagnostics.ts` ring-buffer pattern, wired recorders into every BLE pipeline layer, and surfaced a compact read-only card (with copy-to-clipboard) inside the existing **Settings → Diagnostics** view. One screenshot from a failing device now identifies which layer is broken.
- **Recorded signals** (everything is session-scoped, no persistence; recorders are defensive — they never throw and never block callers):
  - **Native module load**: `linked` / `missing` (with reason) — recorded inside `modules/expo-met-ble/src/index.ts` `getNative()`. Distinguishes "Expo Go / not autolinked" from "linked OK".
  - **Self identity**: our uid + computed iBeacon `major` — recorded in `lib/ble/index.ts` `startBleProximity` so a tester can confirm both phones derive different majors.
  - **Scanner start**: outcome + reason (now covers ALL exit paths: API not configured, native unavailable / denied, superseded, success). `recordScannerStart(false, reason)` added to every early return in `scanner.ts`.
  - **Advertiser start**: outcome + reason (`Not attempted`, `Superseded`, `iBeacon advertiser unavailable or denied`, `Advertiser threw: <msg>`).
  - **Raw ranged events**: `rangedEventCount`, `rangedBeaconCount`, `rangedBeaconLastAt`, plus a FIFO of the 8 most-recent unique majors observed. Recorded in `handleRangedEvent` BEFORE any filter — distinguishes "ranger emits nothing" from "ranger emits but everything is filtered".
  - **Per-filter drop counters** (`recordDrop(reason)`): `invalidMajor` (out of `[0, 65534]`), `minorMismatch` (`minor !== 1`), `cooldown` (within the 10-min `FIRE_REEMIT_MS` window for the same peer), `inFlight` (resolve already in progress for that major), `self` (server returned our own uid). Pinpoints exactly which filter is starving the resolve queue when `ranged > 0 && resolve = 0`.
  - **Resolve lifecycle**: attempt count, success/failure counts, last attempt timestamp, last result string (`200 ok — N entries returned (M matched)`), last error message (truncated to 200 chars).
- **UI** (`components/SettingsSheet.tsx`):
  - Inserted at the top of the Diagnostics view, above the existing native-error log. No menu / i18n changes needed — the card is hardcoded English and uses monospace formatting (`Menlo` on iOS, `monospace` on Android).
  - Driven by `useSyncExternalStore(subscribeToBleDebug, getBleDebugSnapshot, getBleDebugSnapshot)` — the store mints a fresh snapshot identity on every recorder call so the UI auto-updates.
  - Copy button writes the result of `formatBleDebugSnapshot()` (a multi-line plain-text dump including timestamps, drop counters, last result/error) to the clipboard via `expo-clipboard`. Tap → "Copied" → reverts after 1.5s.
- **Code-review pass** (architect, evaluate_task): confirmed recorder paths are safe, snapshot identity bumping is correct for `useSyncExternalStore`, and the surfaced fields cover all four primary failure modes (native missing, scanner not started, advertiser not started, resolve failing). One blind spot identified — "ranged events arrive but all filtered" — addressed by adding the per-filter drop counters. One stylistic concern flagged (workspace import from `modules/expo-met-ble/src` into `lib/ble/debug` creates reverse coupling); accepted for now since the module is not published independently.
- **Build numbers**: iOS `buildNumber` = `23`, Android `versionCode` = `10`. App version stays `1.0.0`. **Native module changed → requires fresh `eas build` (TestFlight for iOS, preview APK for Android); cannot be OTA-updated.**

## Surgical iBeacon revert → legacy GATT BLE (Build #24 / versionCode 11)
- **Reason**: User reported phone-to-phone matching had previously worked between two Androids on the legacy GATT pipeline (custom service-UUID + 8-byte hash advertisement). The iBeacon migration (Build #22/v9 onwards) silently produced zero `/api/ble/resolve` calls in the field; even after Build #23/v10 added the on-device debug HUD, the user preferred to roll back to the known-good legacy version while we plan a separate Firestore-based architecture for matching/encounters.
- **Scope of revert**: 12 files restored to commit `cdf6766` (parent of `8b2d7ee`, the iBeacon switch):
  - Mobile BLE: `lib/ble/encode.ts`, `index.ts`, `scanner.ts`, `uuids.ts`, `modules/expo-met-ble/src/index.ts`, `plugins/with-met-ble.js`, `lib/api/client.ts`
  - Server: `routes/ble.ts`, `lib/uidHash.ts`, `routes/profiles.ts`
  - Contract / generated: `lib/api-spec/openapi.yaml`, `lib/db/src/schema/profiles.ts` + regenerated `api-client-react` and `api-zod` outputs.
- **What was kept (NOT reverted)**:
  - `lib/ble/debug.ts` and the **Settings → Diagnostics** BLE Pipeline card from Build #23 — still works, now feeds off the legacy pipeline. iBeacon-specific fields (`ourMajor`, `rangedEvent*`, drop counters) just stay null/zero in the formatted output, which is harmless.
  - All version bumps in `app.json` (preserved from the iBeacon-era builds and incremented further).
  - All non-BLE features: GPS presence, encounters API, reveal-requests API, Firebase Auth, profile QR, contact reveal, etc.
- **Re-wired HUD recorders into the reverted code** (so the card isn't blank):
  - `recordNativeModule(loaded, reason)` in `modules/expo-met-ble/src/index.ts` `getNative()` (covers web / Expo Go / linked-OK / require-threw).
  - `recordSelf(uid, null)` in `lib/ble/index.ts` `startBleProximity` — `major` is `null` on the legacy path (no iBeacon major exists).
  - `recordScannerStart(started, reason)` wraps `lib/ble/scanner.ts`'s `startBleScanner` via a thin outer fn → inner `_startBleScannerImpl`. Single recording site covers every existing early return.
  - `recordAdvertiserStart(started, reason)` after the `startAdvertising` call in `lib/ble/index.ts`.
  - `recordResolveAttempt()` before `api.bleResolve` and `recordResolveResult({...})` on both success and failure paths in `runResolveOnce`.
- **DB note**: The `uid_major` column added by the iBeacon switch is left in place (drizzle-orm tolerates extra DB columns; nothing reads it now). Cleaning it up can wait until the Firestore rebuild.
- **Build numbers**: iOS `buildNumber` = `24`, Android `versionCode` = `11`. App version stays `1.0.0`.
- **Next step (separately planned with user)**: rebuild the matching layer on Firebase Firestore (GPS push every 2 min + nearby check + BLE-triggered encounter writes) using the user's previous app's Firestore rules / Cloud Functions as the reference.

## Firestore matching/encounters/reveals (Build #25 / versionCode 12)
- **Goal**: Rebuild matching, encounters, and reveal-request handshake on Firebase Firestore (project `metapp-b4642`) while keeping Postgres + Express as the source of truth for `/api/profiles` and `/api/ble/resolve`. Symmetric writes happen via the api-server using firebase-admin (no Cloud Functions). Mirrors the old Flutter app's behavior: 50m radius, 2h cooldown, 30m GPS movement filter, isVisible (Ghost Mode), reveal handshake.
- **Auth model**:
  - `lib/firebaseAdmin.ts` initializes firebase-admin from the `FIREBASE_SERVICE_ACCOUNT_JSON` secret.
  - `middlewares/requireUid.ts` rewritten to verify `Authorization: Bearer <id token>` via `admin.auth().verifyIdToken()`. Dev-only fallback to `X-Met-Uid` is gated on `NODE_ENV !== 'production'` so curl flows still work in development without breaking production security.
  - Mobile `lib/api/client.ts` attaches the ID token via `auth().currentUser.getIdToken(false)` on every request (token cache is the Firebase SDK's responsibility). Web preview / Expo Go falls back to the legacy `X-Met-Uid` header since the native bridge isn't linked there.
- **Server-side Firestore mirror** (`artifacts/api-server/src/lib/firestoreMirror.ts`):
  - `mirrorProfileToFirestore(uid, profile)` — writes `displayName`, `photoUrl`, `bio`, `socials`, `isVisible` to `users/{uid}` whenever PUT /api/profiles/me succeeds. Best-effort; Postgres remains source of truth.
  - `recordSymmetricEncounter(myUid, otherUid, location?)` — single Admin SDK batch write to BOTH `users/{me}/met_people/{them}` AND `users/{them}/met_people/{me}` with `lastMet`, `metCount` (FieldValue.increment), and optional GeoPoint.
  - `mirrorRevealRequest`, `mirrorRevealStatus` — write directional `users/{me}/requests/{them}` + `users/{them}/requests/{me}` docs with `direction: 'inbound' | 'outbound'`, status, message.
- **New / augmented routes**:
  - `POST /api/encounters/record` (new) — body `{ otherUid, location?: { lat, lng } }`; calls `recordSymmetricEncounter`. Returns `{ otherUid, metCount, lastMet }`. Self-encounters reject 400.
  - `PUT /api/profiles/me` — augmented to fire `mirrorProfileToFirestore` after the Postgres upsert. Profile schema gained `isVisible: boolean` (DB column `is_visible NOT NULL DEFAULT true`, applied via raw SQL since drizzle-kit push couldn't be piped).
  - `POST /api/reveals` / `/accept` / `/decline` — augmented to also fire the corresponding Firestore mirror.
  - All mirror writes are wrapped in try/catch and never block the Postgres response — Firestore failure logs a warning but doesn't 5xx the request.
- **Firestore rules** (`firestore.rules`, deployable via `scripts/deploy-firestore-rules.sh`):
  - `users/{uid}` — readable when `isVisible == true || isOwner`. Owner can write all fields except `uid` (immutable).
  - `users/{uid}/met_people/{otherUid}` — read by owner only. **Write: false** (only Admin SDK via api-server).
  - `users/{uid}/requests/{otherUid}` — read by owner only. **Write: false** (only Admin SDK via api-server).
  - App Check is enforced in production rules but tolerant in dev (debug provider).
- **Mobile Firestore stack** (`artifacts/met/lib/firestore/`):
  - `client.ts` — lazy init of Firestore + App Check. Web / Expo Go return null cleanly. App Check uses `debug` in `__DEV__` and `playIntegrity` / `appAttestWithDeviceCheckFallback` in release. `_layout.tsx` calls `initializeFirestore()` at boot to warm the singleton.
  - `presence.ts` — replaces the legacy GPS-only proximity loop on native:
    - **Push loop** (every 60s OR 30m movement, whichever first): writes `{ location: GeoPoint, geohash, lastActive: serverTimestamp, uid }` to `users/{uid}` via `merge: true`.
    - **Pull loop** (every 30s): computes geohash bounds for 50m via `geofire-common.geohashQueryBounds`, dispatches one Firestore range query per bound, filters by true distance + `isVisible`, applies persistent 2h cooldown via AsyncStorage, then calls `api.recordEncounter` and emits a `ProximityDetection` to the listener.
    - Same race-safety pattern as legacy: per-session generation token, single-flight in-flight guards, dedup window seeded BEFORE the await.
  - `cooldown.ts` — AsyncStorage-backed `met:cooldown:{myUid}:{otherUid} = epochMs` with 2h window. Cleared on sign-out via `clearCooldownsFor(uid)`.
  - `encounters.ts` — `subscribeToMetPeople(uid, listener)` returns the current met_people snapshot ordered by `lastMet desc`, plus an unsubscribe. `subscribeToRequestsChange(uid, listener)` fires `listener()` on any reveal-request change in Firestore (used to trigger an immediate REST poll).
- **AppContext wiring**:
  - Legacy `startProximity` (api-server backed) AND new `startFirestoreProximity` run in parallel; both feed the same `upsertProximityRef.current`. Per-peer dedup windows in each module prevent duplicate UI emissions.
  - BLE listener now ALSO calls `api.recordEncounter` (with the same 2h AsyncStorage cooldown) so a BLE-detected peer gets a symmetric Firestore encounter even when neither side has a fresh GPS fix.
  - `subscribeToMetPeople` snapshot fabricates encounter cards for peers we haven't seen locally (e.g. the OTHER side detected us first). Tracks fabricated uids in a ref so each peer is only profile-fetched once.
  - `subscribeToRequestsChange` triggers the existing 20s reveal poll on any server-side request change, giving near-instant accept/decline updates without rewriting the watermark-based merge.
- **Ghost Mode** (`hooks/useVisibility.ts`):
  - Existing local toggle now also fires `api.upsertMyProfile({ isVisible })`. Profile mirror to Firestore propagates the flag to `users/{uid}.isVisible`, which other clients' Firestore range queries filter on. Optimistic local update with rollback on server failure.
- **Build numbers**: iOS `buildNumber` = `25`, Android `versionCode` = `12`. App version stays `1.0.0`. **Native module surface unchanged** (no new Expo config plugins — `@react-native-firebase/firestore` and `app-check` are auto-linked, NOT plugin-shaped); existing dev clients keep working but a fresh `eas build` is required for production rollout.
- **Pre-deploy checklist**:
  1. Enable Firestore in Firebase console for project `metapp-b4642` (Native mode, region `nam5` or closest to user base).
  2. Deploy rules via `bash scripts/deploy-firestore-rules.sh` (requires firebase CLI + service account auth).
  3. Set `FIREBASE_SERVICE_ACCOUNT_JSON` secret in production deploy environment (already set for dev).
  4. (Optional) Configure App Check debug token via `EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN` for development testing.
  5. Run `eas build --platform android --profile preview` (skip iOS until Apple Connect is healthy).

### Firestore — known limitations & follow-ups (post-architect review)
- **Profile read scope**: any authenticated app-checked client can read any visible user's full profile doc (uid, displayName, photoUrl, bio, socials, geohash, location). The geohash range query needs broad reads, so we accept this for the MVP. Hardening: split `users/{uid}` into a public `presence` subset (uid, geohash, isVisible) and a private `profile` subset gated on a per-pair handshake.
- **Best-effort mirror**: Postgres writes succeed even if the Firestore mirror fails. A reconciliation worker is out of scope for #25; surfaced for follow-up.
- **N+1 profile fetch from `met_people` stream**: each unknown peer triggers a separate `/api/profiles/{uid}` round-trip. Acceptable for current peer counts; optimize via bulk-profile endpoint OR by mirroring `displayName` + `photoUrl` into the `met_people` doc itself when peer counts grow.
- **Cooldown race fix (applied)**: both `lib/firestore/presence.ts` and the AppContext BLE listener now stamp the AsyncStorage cooldown BEFORE the `recordEncounter` API call. A failure leaves the pair locked for 2h instead of risking a double-increment of `metCount`.
- **App Check enforcement (applied)**: `firestore.rules` now requires `request.app_check_token != null` on every read/write. Mobile client initialises App Check at boot (`lib/firestore/client.ts`) with the debug provider in `__DEV__` and Play Integrity / App Attest in release.
- **Sign-out cleanup (applied)**: both `resetAll` and `signOutAndClear` in AppContext now call `clearCooldownsFor(previousUid)` so a fresh sign-in on a shared device starts with a clean cooldown table.
- **GPS accuracy bump (applied)**: `lib/firestore/presence.ts` now requests `Location.Accuracy.High` (~10m) instead of `Balanced` (~100m on Android) — necessary for reliable matching against a 50m radius.

## Build #41 (iOS buildNumber 41, Android versionCode 19)
- **Cancel reveal request** (full stack): sender can withdraw a pending outbound reveal request.
  - Server: `POST /api/reveals/cancel` — soft-updates the row to `declined` (not hard delete) so outbox poll propagates to sender's other devices. Mirrors `declined` status to Firestore for recipient's real-time listener.
  - Client: `api.cancelReveal()` → `AppContext.cancelRevealRequest()` → encounter screen "Cancel request" ghost button shown in `request_sent` state.
  - Recipient reconciliation: `applyRemoteRevealState` now detects local `request_received` encounters missing from inbox and reverts them to `encounter`.
  - i18n: `cancelReveal` and `cancelRevealTitle` keys added across all 9 locales.
- **Android image fallback** (MetImage.tsx): expo-image's `onError` callback now triggers a per-instance fallback to RN core `<Image>`. Previously, only iOS-specific render crashes (ViewManagerAdapter errors) triggered the fallback; Android load failures were silent. The `MetImage` wrapper now uses a `key` prop tied to the source URI so the fallback state resets when the image source changes.
- **RevenueCat keys**: still needed in `eas.json` — `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` must be added to each build profile's `env` section for EAS builds to have working subscriptions.
