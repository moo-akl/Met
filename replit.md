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
- **Settings**: Comprehensive settings sheet with sections for Discovery (visibility, range), Memory (notifications, auto-cleanup), and Account (photo verification, blocked people, sign out, reset, delete).
- **Paywall**: 3-tier paywall (Free, Plus, Pro) implemented with `RevenueCat` offerings for subscriptions, including feature comparison.

### Feature Specifications
- **Home Screen**: Animated beacon, "X people within Nm" counter, "LIVE pulse dot", "vibe pill" (quiet/lively), activity ticker, stat cards, "This week" recap.
- **Recent Encounters**: List of recent encounters, with a "Crossed paths again" pill for repeat encounters. ScanFab to initiate QR scanning.
- **Connections**: Searchable list of connected users. Sortable by recent, most met, or name. Supports tag-based filtering. Each row shows avatar, name, timestamp, and a context-aware preview.
- **Encounter Detail**: Displays full-bleed photo, meeting frequency, first met date, Meeting Spot card, and options to send/accept reveal requests. Auto-redirects to connection detail once connected.
- **Connection Detail**: Shows connection profile (avatar, name, bio, meeting spot, social chips), editable notes and tags, and a conversation section with a message composer (quota-gated).
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