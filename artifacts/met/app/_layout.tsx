import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { initializeFirestore } from "@/lib/firestore/client";
import { initI18n } from "@/lib/i18n";
import {
  configureNotifications,
  getNotificationPermissionGranted,
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
    </Stack>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Capture initial / live deep link → stash any embedded referral code so
  // onboarding (and the referrals screen) can pre-fill it on cold or warm start.
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        const code = parseReferralFromUrl(url);
        if (code) pendingDeepLinkReferral = code;
      })
      .catch(() => {});
    const sub = Linking.addEventListener("url", (e) => {
      const code = parseReferralFromUrl(e.url);
      if (code) pendingDeepLinkReferral = code;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Wire notification taps → deep-link to the matching encounter screen.
  // Cold-start taps are also picked up here via getLastNotificationResponseAsync.
  useEffect(() => {
    const unsubscribe = setupNotificationListeners((data) => {
      const peerUid = data.encounterId ?? data.fromUid;
      if (!peerUid) return;
      // Slight defer so the router is mounted before we navigate when
      // the notification was a cold-start tap.
      setTimeout(() => {
        try {
          if (data.type === "reveal_accepted") {
            router.push(`/connection/${peerUid}` as never);
          } else {
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
          <GestureHandlerRootView>
            <KeyboardProvider>
              <SubscriptionProvider>
                <AppProvider>
                  <PushTokenRegistrar />
                  <ProfileGate />
                  <RootLayoutNav />
                </AppProvider>
              </SubscriptionProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
