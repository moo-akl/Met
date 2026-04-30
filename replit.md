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