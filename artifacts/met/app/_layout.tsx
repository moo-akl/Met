import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useColors } from "@/hooks/useColors";
import {
  ChatBannerPayload,
  ChatMessageBanner,
} from "@/components/ChatMessageBanner";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { initializeFirestore } from "@/lib/firestore/client";
import { initI18n } from "@/lib/i18n";
import {
  configureNotifications,
  getNotificationPermissionGranted,
  NotifData,
  registerAndUploadPushToken,
  routeNotifTap,
  setupNotificationListeners,
} from "@/lib/notifications";
import messaging from "@react-native-firebase/messaging";
import { initReferrals } from "@/lib/referrals";
import {
  initializeRevenueCat,
  SubscriptionProvider,
  useSubscription,
} from "@/lib/revenuecat";
import { api } from "@/lib/api/client";
import { initTikTok, tiktokTrackLaunch } from "@/lib/tiktok";
import { incrementSessionCount } from "@/lib/storage";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Configure expo-notifications once at module load. Idempotent — sets
// the foreground presentation handler and Android default channel.
try {
  configureNotifications();
} catch (err) {
  console.warn(
    "Notifications init failed:",
    err instanceof Error ? err.message : err,
  );
}

try {
  initializeRevenueCat();
} catch (err) {
  console.warn(
    "RevenueCat unavailable:",
    err instanceof Error ? err.message : err,
  );
}

// Initialize TikTok Business SDK (Android only; no-op on iOS).
// All three env vars must be set in EXPO_PUBLIC_* for tracking to work.
// debug:true routes events through TikTok's test pipeline so they appear
// in Events Manager → Test Events. Controlled via EXPO_PUBLIC_TIKTOK_DEBUG
// so it can be toggled per-build without a code change. Falls back to
// __DEV__ so local/simulator runs also use debug mode automatically.
const tikTokDebug =
  process.env.EXPO_PUBLIC_TIKTOK_DEBUG === "true" || __DEV__;
void initTikTok(
  process.env.EXPO_PUBLIC_TIKTOK_APP_ID ?? "",
  process.env.EXPO_PUBLIC_TIKTOK_TT_APP_ID ?? "",
  process.env.EXPO_PUBLIC_TIKTOK_ACCESS_TOKEN ?? "",
  tikTokDebug,
).then(() => {
  tiktokTrackLaunch();
});

// Initialize @workspace/api-client-react so network-screen hooks can reach
// the API server with the correct base URL and a live Firebase ID token.
setBaseUrl(process.env.EXPO_PUBLIC_API_URL ?? "");
setAuthTokenGetter(async () => {
  try {
    const authMod = await import("@react-native-firebase/auth");
    const user = authMod.default().currentUser;
    if (!user) return null;
    return user.getIdToken(false).catch(() => user.getIdToken(true));
  } catch {
    return null;
  }
});

// Kick off i18n + referrals state load before the first paint we care about.
// They're idempotent and resolve quickly; failures fall back to defaults.
void initI18n();
void initReferrals();

// Warm up Firestore + App Check so the first encounter / nearby query
// doesn't pay the cold-start cost. Resolves to false on web preview /
// Expo Go (no native bridge); the proximity service falls back to its
// legacy api-server-backed path in that case.
void initializeFirestore().catch((err) => {
  console.warn(
    "Firestore unavailable:",
    err instanceof Error ? err.message : err,
  );
});

// Stash a referral code that came in via deep link (`met://r/CODE` or
// universal link with `/r/CODE`) so onboarding can pre-fill it.
let pendingDeepLinkReferral: string | null = null;
export function consumePendingReferral(): string | null {
  const v = pendingDeepLinkReferral;
  pendingDeepLinkReferral = null;
  return v;
}

export function parseReferralFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const m = url.match(/\/r\/([A-Za-z2-9]{6})(?:[/?#]|$)/);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

export function parseNetworkInviteFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const m = url.match(/\/join\/([A-Za-z2-9]{8})(?:[/?#]|$)/);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

export function isVenueOwnerUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    return /(?:\/\/|\/)venue-owner(?:[/?#]|$)/.test(url);
  } catch {
    return false;
  }
}

/**
 * A minimal router interface — matches the subset of expo-router's router
 * that deep-link routing uses. Using an interface rather than the full
 * expo-router type makes this function easily testable without native modules.
 */
export interface MinimalRouter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  push: (url: any) => void;
}

/**
 * Route a deep-link URL to the appropriate in-app screen.
 *
 * Priority order (matches handleUrl in RootLayout):
 *   1. venue-owner URL  → /onboarding?venueOwner=1
 *   2. /r/<code>        → stash pendingDeepLinkReferral (no navigation; consumed at onboarding)
 *   3. /join/<code>     → /network/join/[code]
 *
 * Navigation is deferred by `delay` ms so the router is mounted before the
 * push fires (relevant for cold-start deep links).  Tests should pass delay=0.
 *
 * Exported so it can be unit-tested without rendering the full component tree.
 */
export function routeDeepLink(
  url: string | null,
  router: MinimalRouter,
  delay = 50,
): void {
  if (isVenueOwnerUrl(url)) {
    setTimeout(() => {
      try {
        router.push("/onboarding?venueOwner=1");
      } catch {}
    }, delay);
    return;
  }

  const referral = parseReferralFromUrl(url);
  if (referral) pendingDeepLinkReferral = referral;

  const networkCode = parseNetworkInviteFromUrl(url);
  if (networkCode) {
    setTimeout(() => {
      try {
        router.push({
          pathname: "/network/join/[code]",
          params: { code: networkCode },
        } as never);
      } catch {}
    }, delay);
  }
}

/**
 * Manages the foreground chat notification banner. Lives inside AppProvider
 * so it can resolve the peer's photo URL from allEncounters.
 */
function ChatBannerController({
  pathnameRef,
  tappedIdsRef,
  onNavigate,
}: {
  pathnameRef: React.MutableRefObject<string>;
  tappedIdsRef: React.MutableRefObject<Set<string>>;
  onNavigate: (chatPeerUid: string) => void;
}) {
  const { allEncounters } = useApp();
  const encountersRef = useRef(allEncounters);
  const [chatBanner, setChatBanner] = useState<ChatBannerPayload | null>(null);

  useEffect(() => {
    encountersRef.current = allEncounters;
  }, [allEncounters]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(
      (notification) => {
        // If the user already tapped this notification (tap listener fired
        // first, e.g. Android heads-up banner tapped immediately), skip the
        // in-app banner to avoid double-handling the same notification.
        const notifId = notification.request.identifier;
        if (tappedIdsRef.current.has(notifId)) return;

        const data = (notification.request.content.data ?? {}) as NotifData;
        if (data.type !== "chat_message" || !data.chatPeerUid) return;

        const currentPath = pathnameRef.current;
        const chatPathPrefix = `/chat/${data.chatPeerUid}`;
        if (
          currentPath === chatPathPrefix ||
          currentPath.startsWith(`${chatPathPrefix}/`)
        ) {
          return;
        }

        const title = notification.request.content.title ?? "New message";
        const body = notification.request.content.body ?? "";
        const encounter = encountersRef.current.find(
          (e) => e.id === data.chatPeerUid,
        );
        const avatarUrl = encounter?.photoUri || null;

        setChatBanner({
          chatPeerUid: data.chatPeerUid,
          senderName: title,
          messagePreview: body,
          avatarUrl,
        });
      },
    );
    return () => sub.remove();
  }, [pathnameRef, tappedIdsRef]);

  const handleDismiss = useCallback(() => setChatBanner(null), []);

  return (
    <ChatMessageBanner
      payload={chatBanner}
      onNavigate={onNavigate}
      onDismiss={handleDismiss}
    />
  );
}

/**
 * Syncs the device's active RevenueCat subscription tier to Postgres so
 * server-side gates (profile-view limits, spotlight, etc.) stay accurate.
 * Must live inside both SubscriptionProvider and AppProvider.
 */
function SubscriptionSyncer() {
  const { tier, isSubscriptionReady } = useSubscription();
  const { authedUid } = useApp();

  useEffect(() => {
    if (!authedUid || !isSubscriptionReady) return;
    api
      .syncSubscription(
        { uid: authedUid },
        { tier, status: tier === "free" ? "inactive" : "active" },
      )
      .catch(() => {});
  }, [authedUid, tier, isSubscriptionReady]);

  return null;
}

/**
 * Runs once per profile load to re-register the Expo push token with the
 * server. Handles users who already granted notification permission before
 * the token upload endpoint existed, and catches token rotations that happen
 * silently (e.g. after app updates or OS reinstalls).
 *
 * Must live inside AppProvider so it can read profile from context.
 */
function PushTokenRegistrar() {
  const { authedUid } = useApp();
  const registeredUid = React.useRef<string | null>(null);

  // Initial registration: runs once per Firebase UID on app start.
  useEffect(() => {
    if (!authedUid || registeredUid.current === authedUid) return;
    registeredUid.current = authedUid;

    getNotificationPermissionGranted()
      .then((granted) => {
        if (granted) return registerAndUploadPushToken(authedUid);
      })
      .catch(() => {});
  }, [authedUid]);

  // Token refresh: FCM silently rotates tokens (e.g. after app updates or
  // OS reinstall). Re-upload whenever the token changes so the server always
  // has a valid FCM token.
  useEffect(() => {
    if (!authedUid) return;
    const unsubscribe = messaging().onTokenRefresh((newToken) => {
      import("@/lib/api/client")
        .then(({ api }) => api.registerPushToken({ uid: authedUid }, newToken))
        .catch(() => {});
    });
    return unsubscribe;
  }, [authedUid]);

  return null;
}

function ProfileGate() {
  const { ready, profile, permissionsCompleted } = useApp();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!ready) return;
    const root = segments[0];
    const inOnboarding = root === "onboarding";
    const inPermissions = root === "permissions";

    if (!profile) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }
    if (!permissionsCompleted) {
      if (!inPermissions) router.replace("/permissions");
      return;
    }
    // Fully set-up users may visit /permissions or /onboarding voluntarily
    // (e.g. from the home-page banner). Don't redirect them away.
  }, [ready, profile, permissionsCompleted, segments, router]);

  return null;
}

function RootLayoutNav() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="permissions" />
      <Stack.Screen
        name="encounter/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="connection/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="chat/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="scan"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="paywall"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="referrals"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="network/[id]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="network/create"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="network/join/[code]"
        options={{ presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="leaderboard/[placeId]"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="venue-owner/setup"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="venue-owner/rejected"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="venue-owner/dashboard"
        options={{ presentation: "card", animation: "slide_from_right" }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const pathnameRef = useRef(pathname);
  // Shared set of notification identifiers that the tap listener has already
  // processed. The foreground-delivery listener checks this before showing
  // the in-app banner so a notification that was immediately tapped (e.g.
  // Android heads-up) doesn't also pop up as a banner.
  const tappedIdsRef = useRef<Set<string>>(new Set());

  // Capture initial / live deep links. Referrals are stashed for onboarding;
  // network invites and venue-owner registration links navigate directly.
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => routeDeepLink(url, router, 100))
      .catch(() => {});
    const sub = Linking.addEventListener("url", (e) => {
      routeDeepLink(e.url, router, 50);
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Increment session count once per cold start so session-gated features
  // (value tour, leaderboard pulse, hub tooltip) can track how new the user is.
  useEffect(() => {
    incrementSessionCount().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref so the foreground listener can read the current pathname
  // without being recreated on every navigation change.
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const handleBannerNavigate = useCallback(
    (chatPeerUid: string) => {
      try {
        router.push(`/chat/${chatPeerUid}` as never);
      } catch (err) {
        console.warn("[notifications] banner nav failed", err);
      }
    },
    [router],
  );

  // Wire notification taps → deep-link to the matching encounter screen.
  // Cold-start taps are also picked up here via getLastNotificationResponseAsync.
  useEffect(() => {
    const unsubscribe = setupNotificationListeners((data) => {
      // Slight defer so the router is mounted before we navigate when
      // the notification was a cold-start tap.
      setTimeout(() => {
        try {
          routeNotifTap(data, router);
        } catch (err) {
          console.warn("[notifications] nav failed", err);
        }
      }, 50);
    }, tappedIdsRef.current);
    return unsubscribe;
  }, [router]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider>
            <KeyboardProvider>
              <SubscriptionProvider>
                <AppProvider>
                  <SubscriptionSyncer />
                  <PushTokenRegistrar />
                  <ProfileGate />
                  <RootLayoutNav />
                  <ChatBannerController
                    pathnameRef={pathnameRef}
                    tappedIdsRef={tappedIdsRef}
                    onNavigate={handleBannerNavigate}
                  />
                </AppProvider>
              </SubscriptionProvider>
            </KeyboardProvider>
            </ThemeProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
