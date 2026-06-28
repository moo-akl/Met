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
import {
  ChatBannerPayload,
  ChatMessageBanner,
} from "@/components/ChatMessageBanner";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { initializeFirestore } from "@/lib/firestore/client";
import { initI18n } from "@/lib/i18n";
import {
  configureNotifications,
  getNotificationPermissionGranted,
  NotifData,
  registerAndUploadPushToken,
  setupNotificationListeners,
} from "@/lib/notifications";
import { initReferrals } from "@/lib/referrals";
import {
  initializeRevenueCat,
  SubscriptionProvider,
} from "@/lib/revenuecat";

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

function parseReferralFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const m = url.match(/\/r\/([A-Za-z2-9]{6})(?:[/?#]|$)/);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

function parseNetworkInviteFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const m = url.match(/\/join\/([A-Za-z2-9]{8})(?:[/?#]|$)/);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Manages the foreground chat notification banner. Lives inside AppProvider
 * so it can resolve the peer's photo URL from allEncounters.
 */
function ChatBannerController({
  pathnameRef,
  onNavigate,
}: {
  pathnameRef: React.MutableRefObject<string>;
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
  }, [pathnameRef]);

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
 * Runs once per profile load to re-register the Expo push token with the
 * server. Handles users who already granted notification permission before
 * the token upload endpoint existed, and catches token rotations that happen
 * silently (e.g. after app updates or OS reinstalls).
 *
 * Must live inside AppProvider so it can read profile from context.
 */
function PushTokenRegistrar() {
  const { profile } = useApp();
  const registeredUid = React.useRef<string | null>(null);

  useEffect(() => {
    const uid = profile?.id;
    if (!uid || registeredUid.current === uid) return;
    registeredUid.current = uid;

    getNotificationPermissionGranted()
      .then((granted) => {
        if (granted) return registerAndUploadPushToken(uid);
      })
      .catch(() => {});
  }, [profile?.id]);

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
  return (
    <Stack screenOptions={{ headerShown: false }}>
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

  // Capture initial / live deep link → stash any embedded referral code so
  // onboarding (and the referrals screen) can pre-fill it on cold or warm start.
  // Also handles met://n/CODE invite links → navigate to join screen.
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
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
          }, 100);
        }
      })
      .catch(() => {});
    const sub = Linking.addEventListener("url", (e) => {
      const referral = parseReferralFromUrl(e.url);
      if (referral) pendingDeepLinkReferral = referral;
      const networkCode = parseNetworkInviteFromUrl(e.url);
      if (networkCode) {
        setTimeout(() => {
          try {
            router.push({
              pathname: "/network/join/[code]",
              params: { code: networkCode },
            } as never);
          } catch {}
        }, 50);
      }
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

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
          if (data.type === "chat_message") {
            if (!data.chatPeerUid) return;
            router.push(`/chat/${data.chatPeerUid}` as never);
          } else if (data.type === "reveal_accepted") {
            const peerUid = data.fromUid;
            if (!peerUid) return;
            router.push(`/connection/${peerUid}` as never);
          } else {
            const peerUid = data.encounterId ?? data.fromUid;
            if (!peerUid) return;
            router.push(`/encounter/${peerUid}` as never);
          }
        } catch (err) {
          console.warn("[notifications] nav failed", err);
        }
      }, 50);
    });
    return unsubscribe;
  }, [router]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <SubscriptionProvider>
                <AppProvider>
                  <PushTokenRegistrar />
                  <ProfileGate />
                  <RootLayoutNav />
                  <ChatBannerController
                    pathnameRef={pathnameRef}
                    onNavigate={handleBannerNavigate}
                  />
                </AppProvider>
              </SubscriptionProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
