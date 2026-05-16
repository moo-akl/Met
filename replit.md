# Met

Met is a proximity-based social networking application for discovering and connecting with people encountered in real life.

## Run & Operate

- **Run Dev**: `npx expo start`
- **Run API Server**: `pnpm --filter @workspace/api-server run start`
- **Build API Codegen**: `pnpm --filter @workspace/api-spec run codegen`
- **DB Push**: `pnpm --filter @workspace/api-server run db:push`
- **Verify Firebase Key Restrictions**: `pnpm --filter @workspace/scripts run check-firebase-keys`
- **Apply Firebase Key Restrictions**: `tsx scripts/src/check-firebase-key-restrictions.ts --apply --sha1=<upload-SHA1> --sha1=<debug-SHA1>`
- **Required Env Vars**:
    - `EXPO_PUBLIC_API_URL`: API server URL (e.g., `https://metapp.replit.app`)
    - `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase Admin SDK credentials (for API server)
    - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` (for EAS builds)

## Stack

- **Framework**: Expo SDK 54, React Native
- **Routing**: `expo-router`
- **State Management**: `AsyncStorage` (client-side persistence), `react-query`
- **Backend**: Node.js, Express, Postgres (via Drizzle ORM)
- **Authentication**: `@react-native-firebase/auth` (Apple, Google, Email/Password)
- **Database**: Firebase Firestore (for matching, encounters, reveals)
- **Validation**: Zod (implied by Drizzle and API contracts)
- **Build Tool**: EAS Build

## Where things live

- **App Source**: `app/` (Expo Router pages)
- **Components**: `components/`
- **Libraries/Utils**: `lib/`
- **API Server**: `artifacts/api-server/`
- **DB Schema**: `lib/db/src/schema/{profiles,encounters,presence,reveals}.ts`
- **API Contracts**: `lib/api-spec/openapi.yaml`
- **Native Modules**: `artifacts/met/modules/expo-met-ble/`
- **Firebase Rules**: `firestore.rules`
- **Cloud Functions**: `functions/src/` (mirrors Firestore reveal status into Postgres)

## Architecture decisions

- **Anonymous-by-default**: Interactions are proximity-based and require mutual consent for identity reveal.
- **Hybrid Proximity Detection**: Combines GPS polling (longer range, less frequent) and BLE (short range, immediate) for robust peer discovery.
- **Dual Backend**: Postgres (Drizzle) as source of truth for profiles and core data, Firebase Firestore for real-time matching, encounters, and reveal requests, mirroring key data from Postgres.
- **Client-side Cooldowns**: `AsyncStorage` used for rate-limiting encounter creation to prevent spam and ensure unique interactions.
- **iBeacon Revert to GATT BLE**: Reverted from iBeacon to legacy GATT BLE advertising due to iOS background limitations, with GATT-on-detection for improved iOS background compatibility.

## Product

- **Proximity-based Discovery**: Users find others they've crossed paths with.
- **Mutual Reveal System**: Requires both users to agree to reveal identity before connecting.
- **Profile Management**: Edit photo, name, bio, social handles; photo verification.
- **Subscription Tiers**: Free, Plus, and Pro tiers with varying feature access (encounters, reveals, privacy modes).
- **Referral Program**: Invite friends to unlock premium features.
- **Internationalization**: Supports 9 languages with RTL support for Arabic.
- **Reporting System**: Allows users to report others for inappropriate behavior.

## User preferences

I prefer simple language and clear explanations.
I want iterative development with regular updates.
Please ask before making any major architectural changes or introducing new dependencies.
I prefer to focus on core features before moving to optimizations.
Do not make changes to files related to `lib/revenuecat.tsx` unless explicitly instructed.
I prefer to use functional components and hooks in React Native.
Ensure all UI changes are responsive and adhere to the established theme.
Prioritize performance and user experience in all development tasks.

## Firebase Credential Injection

`google-services.json` (Android) and `GoogleService-Info.plist` (iOS) are **not committed to git**. They are injected automatically at EAS build time via `artifacts/met/plugins/with-firebase-credentials.js`, which reads two EAS secrets and writes the files before the native build starts.

### How it works

The plugin reads the env vars as **string content** (raw JSON / XML) and writes them directly to disk. This means the EAS secrets must be stored as `--type string` (the full file content), **not** `--type file` (which only stores a path).

### First-time setup (or after rotating credentials)

Run these two commands once from the `artifacts/met/` directory (you need the EAS CLI and must be logged in):

```bash
# Android — stores the full JSON content of google-services.json as a string secret
eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type string --value "$(cat google-services.json)"

# iOS — stores the full XML content of GoogleService-Info.plist as a string secret
eas secret:create --scope project --name GOOGLE_SERVICE_INFO_PLIST --type string --value "$(cat GoogleService-Info.plist)"
```

After uploading, **delete the local copies** — they should never be committed:

```bash
rm google-services.json GoogleService-Info.plist
```

### Rotating credentials

When Firebase credentials change (e.g. new Firebase project, regenerated config):

1. Download the new `google-services.json` from the Firebase Console → Project Settings → Android app.
2. Download the new `GoogleService-Info.plist` from the Firebase Console → Project Settings → iOS app.
3. Delete the old secrets in the EAS dashboard (expo.dev → your project → Secrets), or use:
   ```bash
   eas secret:delete --name GOOGLE_SERVICES_JSON
   eas secret:delete --name GOOGLE_SERVICE_INFO_PLIST
   ```
4. Re-run the `eas secret:create` commands above with the new files.
5. Trigger a new EAS build — no code changes are needed.

### Local native builds

For local prebuild (`expo prebuild`) without EAS, export the env vars in your shell before running:

```bash
export GOOGLE_SERVICES_JSON="$(cat google-services.json)"
export GOOGLE_SERVICE_INFO_PLIST="$(cat GoogleService-Info.plist)"
npx expo prebuild
```

## Gotchas

- **Firebase Credentials**: `google-services.json` and `GoogleService-Info.plist` are injected from EAS secrets at build time — see *Firebase Credential Injection* above. Never commit these files to git.
- **API Server Deployment**: Any changes to `artifacts/api-server/` require republishing the API server (`https://metapp.replit.app`) *before* shipping new mobile builds. Failure to do so causes "server unreachable" errors or 404s.
- **Android `versionCode`**: Must be incremented by 1 for *every* new Android build uploaded to Play Store, regardless of `expo.version`.
- **iOS `buildNumber`**: Must be incremented by 1 for *every* new iOS build uploaded to TestFlight/App Store.
- **Native Module Changes**: Updates to `artifacts/met/modules/expo-met-ble/` require a fresh `eas build` (cannot be OTA updated).
- **BLE Testing**: Requires physical devices and EAS dev/production builds (not supported in Expo Go, simulator, or emulator).

## Pointers

- **Expo Documentation**: [https://docs.expo.dev/](https://docs.expo.dev/)
- **React Native Firebase**: [https://rnfirebase.io/](https://rnfirebase.io/)
- **RevenueCat Docs**: [https://www.revenuecat.com/docs/](https://www.revenuecat.com/docs/)
- **Drizzle ORM**: [https://orm.drizzle.team/](https://orm.drizzle.team/)
- **Firebase Firestore**: [https://firebase.google.com/docs/firestore](https://firebase.google.com/docs/firestore)