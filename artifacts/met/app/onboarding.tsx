import { Feather, FontAwesome } from "@expo/vector-icons";
import { Image } from "@/components/MetImage";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoVerifier } from "@/components/PhotoVerifier";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RadarView } from "@/components/RadarView";
import { SortableChips } from "@/components/SortableChips";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  getCurrentUserEmail,
  getCurrentUserId,
  isCurrentUserEmailVerified,
  reloadAndCheckVerified,
  sendPasswordReset,
  sendVerificationEmail,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
} from "@/lib/auth";
import { api, ApiError } from "@/lib/api/client";
import { getLanguage, setLanguage, SUPPORTED_LANGUAGES, useT, type LangCode } from "@/lib/i18n";
import { validateHandle, checkHandleReachable } from "@/lib/socialValidation";
import { ensureMyCode, recordReferral } from "@/lib/referrals";
import { ALL_INTERESTS, MAX_INTERESTS } from "@/lib/interests";
import { loadDragHintDismissed, loadProfile, loadValueTourSeen, saveDragHintDismissed } from "@/lib/storage";
import { ValueTour } from "@/components/ValueTour";
import type { Profile, SocialLinks, SocialPlatform } from "@/lib/types";

import { consumePendingReferral } from "./_layout";
import {
  tiktokIdentify,
  tiktokTrackRegistration,
} from "@/lib/tiktok";

type IconName = React.ComponentProps<typeof Feather>["name"];

type Slide = {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  titleKey: string;
  bodyKey: string;
};

function getSlides(primary: string, border: string): Slide[] {
  return [
    {
      icon: "target",
      iconColor: "#60A5FA",
      iconBg: "rgba(96,165,250,0.15)",
      titleKey: "onboarding.slide1Title",
      bodyKey: "onboarding.slide1Body",
    },
    {
      icon: "shield",
      iconColor: primary,
      iconBg: border,
      titleKey: "onboarding.slide2Title",
      bodyKey: "onboarding.slide2Body",
    },
    {
      icon: "user",
      iconColor: "#FBBF24",
      iconBg: "rgba(251,191,36,0.15)",
      titleKey: "onboarding.slide3Title",
      bodyKey: "onboarding.slide3Body",
    },
  ];
}

const SOCIAL_FIELDS: Array<{ key: SocialPlatform; label: string; placeholder: string }> = [
  { key: "instagram", label: "Instagram", placeholder: "your.handle" },
  { key: "facebook", label: "Facebook", placeholder: "your.name" },
  { key: "x", label: "X", placeholder: "your_handle" },
  { key: "tiktok", label: "TikTok", placeholder: "your.handle" },
  { key: "snapchat", label: "Snapchat", placeholder: "your.handle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "your-name" },
];

type Phase =
  | "language"
  | "valueTour"
  | "intro"
  | "auth"
  | "verify"
  | "photo"
  | "info"
  | "socials"
  | "interests"
  | "invite";

// Resend cooldown after sending a verification email — Firebase will
// rate-limit aggressively if we let users spam this button.
const RESEND_COOLDOWN_MS = 60 * 1000;
// How often we silently re-check Firebase to see if the user verified
// their email in another tab/app.
const VERIFY_POLL_MS = 5 * 1000;

// Public legal documents — required to be visible at sign-up time per
// App Store Guideline 1.2 (User Generated Content) and Play Store policy.
const TERMS_URL =
  "https://doc-hosting.flycricket.io/met-terms-conditions/de6cbb09-1b5f-4203-aba7-c70fe3fa4932/terms";
const PRIVACY_URL =
  "https://doc-hosting.flycricket.io/met-privacy-policy/fdc825e1-e02f-4a47-8169-e8bb9c4f54c9/privacy";

export default function OnboardingScreen() {
  const colors = useColors();
  const slides = getSlides(colors.primary, colors.border);
  const router = useRouter();
  const { setProfile, setPermissionsCompleted, permissionsCompleted } = useApp();
  const insets = useSafeAreaInsets();
  const { t, lang } = useT();
  // When opened from the home-page permissions banner with
  // `?startAt=permissions`, we skip the full signup flow and land
  // directly on the activateBeacon step so the user can grant
  // permissions without re-doing onboarding.
  const { startAt, venueOwner } = useLocalSearchParams<{
    startAt?: string;
    venueOwner?: string;
  }>();
  const permissionsOnly = startAt === "permissions";
  // The registration form needs a Firebase account, but venue applicants
  // should not be forced through the optional personal-profile setup first.
  // This intent survives authentication and email verification.
  const [venueOwnerIntent, setVenueOwnerIntent] = useState(
    venueOwner === "1",
  );

  const [phase, setPhase] = useState<Phase>(
    permissionsOnly ? "invite" : "language",
  );
  const [selectedLang, setSelectedLang] = useState<LangCode>(getLanguage());
  const [slide, setSlide] = useState(0);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  // True when the name was provided directly by Apple Sign-In.
  // In that case we skip the info (name/bio) step so users aren't asked
  // to re-enter information Apple already supplied (App Store Guideline 4).
  const [nameFromApple, setNameFromApple] = useState(false);
  // True whenever the user authenticated via Apple Sign-In, regardless of
  // whether Apple supplied a name. Used to unblock the info-step Continue
  // button in the rare edge case the name field is still empty.
  const [fromAppleSignIn, setFromAppleSignIn] = useState(false);
  const [socials, setSocials] = useState<SocialLinks>({});
  const [interests, setInterests] = useState<string[]>([]);
  const [interestSearch, setInterestSearch] = useState("");
  const [showDragHint, setShowDragHint] = useState(false);
  const [saving, setSaving] = useState(false);
  // Referral code the user is redeeming. Pre-filled from any deep-link
  // (`met://r/CODE`) the system captured before onboarding mounted.
  const [inviteCode, setInviteCode] = useState<string>(
    () => consumePendingReferral() ?? "",
  );
  const [inviteApplied, setInviteApplied] = useState<boolean | null>(null);
  // Auth-screen state — gates onboarding behind real sign-in.
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordVisible, setAuthPasswordVisible] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  // EULA acceptance — required by App Store Guideline 1.2 (User Generated
  // Content). Gate ALL sign-in methods (Apple, Google, email) behind an
  // explicit checkbox confirming the user is 18+ and accepts our Terms +
  // Privacy Policy. Reset per session — never persisted.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [socialErrors, setSocialErrors] = useState<Partial<Record<SocialPlatform, string>>>({});
  const [socialVerifying, setSocialVerifying] = useState<Partial<Record<SocialPlatform, boolean>>>({});
  const [socialVerified, setSocialVerified] = useState<Partial<Record<SocialPlatform, boolean>>>({});
  // Verify-email-screen state. `verifyEmail` is the address the user
  // signed up with (shown in the body copy). `resendCooldownEndsAt` is
  // a wall-clock timestamp; `cooldownRemaining` is a tick that drives
  // the countdown label.
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendCooldownEndsAt, setResendCooldownEndsAt] = useState<number | null>(
    null,
  );
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  // Guard against double-mount (StrictMode) running our resume effect
  // twice and overwriting the user's chosen phase.
  const resumedRef = useRef(false);
  const socialFloatAnims = useRef<Animated.Value[]>(
    Array.from({ length: 5 }, () => new Animated.Value(0))
  );
  const shieldPulseAnim = useRef(new Animated.Value(0));

  useEffect(() => {
    if (phase === "interests") {
      let cancelled = false;
      loadDragHintDismissed().then((dismissed) => {
        if (!cancelled) setShowDragHint(!dismissed);
      });
      return () => { cancelled = true; };
    }
  }, [phase]);

  const validateSocial = useCallback(async (platform: SocialPlatform, handle: string) => {
    const clean = handle.replace(/^@/, "").trim();
    if (!clean) {
      setSocialErrors((prev) => { const n = { ...prev }; delete n[platform]; return n; });
      setSocialVerified((prev) => { const n = { ...prev }; delete n[platform]; return n; });
      return;
    }
    const { valid, message } = validateHandle(platform, clean);
    if (!valid) {
      setSocialErrors((prev) => ({ ...prev, [platform]: message }));
      setSocialVerified((prev) => { const n = { ...prev }; delete n[platform]; return n; });
      return;
    }
    setSocialVerifying((prev) => ({ ...prev, [platform]: true }));
    setSocialErrors((prev) => { const n = { ...prev }; delete n[platform]; return n; });
    try {
      const reachable = await checkHandleReachable(platform, clean);
      if (!reachable) {
        setSocialErrors((prev) => ({ ...prev, [platform]: t("onboarding.socialNotReachable") }));
      } else {
        setSocialVerified((prev) => ({ ...prev, [platform]: true }));
      }
    } catch {
      // network errors don't block the user
    } finally {
      setSocialVerifying((prev) => { const n = { ...prev }; delete n[platform]; return n; });
    }
  }, [t]);

  const handleInterestsReorder = useCallback((newItems: string[]) => {
    setInterests((prev) => {
      if (showDragHint) {
        const changed = prev.length !== newItems.length || prev.some((v, i) => v !== newItems[i]);
        if (changed) {
          setShowDragHint(false);
          void saveDragHintDismissed();
        }
      }
      return newItems;
    });
  }, [showDragHint]);

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;
  const topPad = (Platform.OS === "web" ? webTop : insets.top) + 24;
  const bottomPad = insets.bottom + webBot + 24;

  const pickPhoto = async () => {
    // On Android the native UCrop "Done" button is hidden behind the gesture
    // navigation bar, so we skip the in-picker crop UI there.
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: Platform.OS === "ios",
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setPendingPhotoUri(res.assets[0].uri);
    }
  };

  // ------------------------------------------------------------------
  // Auth handlers — all funnel into goToProfileSetup() on success.
  // If the user already has a server-side profile (re-login after
  // logout), we restore it locally and skip straight to the main app.
  // ------------------------------------------------------------------
  const tryRestoreExistingProfile = async (): Promise<boolean> => {
    try {
      const uid = await getCurrentUserId();
      if (!uid) return false;
      if (!api.isConfigured()) return false;
      const remote = await api.getMyProfile({ uid });
      // A 404 throws ApiError and is caught below → false (new user).
      // A missing displayName means a prior sign-in bug left the record
      // blank; restore with a placeholder rather than re-running onboarding.
      if (!remote) return false;
      // Resolve the best available display name.
      // Priority: real server name > Firebase Auth displayName > empty string.
      // "Apple User" is a stale placeholder written by earlier buggy builds —
      // treat it the same as blank and overwrite it with the real Firebase name.
      const STALE_NAMES = ["Apple User"];
      let resolvedName = remote.displayName || "";
      if (!resolvedName || STALE_NAMES.includes(resolvedName)) {
        try {
          const authMod = await import("@react-native-firebase/auth");
          const firebaseName =
            authMod.default().currentUser?.displayName ?? null;
          if (firebaseName && !STALE_NAMES.includes(firebaseName)) {
            resolvedName = firebaseName;
          }
        } catch {
          // Firebase not available on this platform — keep whatever we have.
        }
      }
      // Load locally stored profile so we can fall back to its interests if
      // the server returns an empty array (e.g. column just added, first sync
      // after migration). Server interests win when non-empty.
      const local = await loadProfile();
      const restored: Profile = {
        id: remote.uid,
        name: resolvedName,
        bio: remote.bio ?? "",
        photoUri: remote.photoUrl ?? "",
        socials: (remote.socials ?? {}) as SocialLinks,
        interests:
          remote.interests && remote.interests.length > 0
            ? (remote.interests as string[])
            : (local?.interests ?? []),
        verified: true,
        isVisible: remote.isVisible ?? false,
        photoVerifiedAt: Date.now(),
        extraPhotos: [],
      };
      // Do NOT gate on photoUri — the photo upload in handleFinish is
      // best-effort and can silently fail. A profile that exists on the
      // server (confirmed by the 200 above) is valid and must be restored.
      // The user can update their photo from Profile settings if it is
      // missing; forcing them through full re-onboarding wipes everything.
      await setProfile(restored);
      await setPermissionsCompleted(true);
      await ensureMyCode();
      if (venueOwnerIntent) {
        try {
          await api.getMyVenueOwnerProfile({ uid });
          router.replace("/venue-owner/dashboard");
        } catch (err) {
          if ((err as ApiError).status === 404) {
            router.replace("/venue-owner/setup");
          } else {
            router.replace("/(tabs)");
          }
        }
      } else {
        router.replace("/(tabs)");
      }
      return true;
    } catch {
      return false;
    }
  };

  const goToProfileSetup = async (method: "email" | "google" | "apple") => {
    const restored = await tryRestoreExistingProfile();
    if (!restored) {
      // New user — registration is complete (they passed auth).
      tiktokTrackRegistration(method);
      if (venueOwnerIntent) {
        router.replace("/venue-owner/setup");
      } else {
        setPhase("photo");
      }
    }
    // Identify the user for both new and returning sessions.
    try {
      const authMod = await import("@react-native-firebase/auth");
      const uid = authMod.default().currentUser?.uid;
      if (uid) tiktokIdentify(uid);
    } catch {
      // Firebase not available — skip identify.
    }
  };

  const showSignInError = () =>
    Alert.alert(
      t("onboarding.signInError"),
      t("onboarding.signInErrorBody"),
    );

  // EULA gate — every auth path funnels through this. Returning false
  // pops an alert and aborts; the call sites simply early-return.
  const requireTerms = (): boolean => {
    if (termsAccepted) return true;
    Alert.alert(
      t("onboarding.termsRequiredTitle"),
      t("onboarding.termsRequiredBody"),
    );
    return false;
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const handleApple = async () => {
    if (!requireTerms()) return;
    setAuthBusy(true);
    try {
      // Returns null when the user cancels the Apple sheet — silent.
      const result = await signInWithApple();
      if (result) {
        setFromAppleSignIn(true);
        // Always skip the info/name step for Apple users — we either have
        // the name from Apple or from the Firebase cache; if neither is
        // available the user will be redirected there from handleFinish.
        setNameFromApple(true);
        if (result.fullName) {
          // First sign-in: Apple sent the name directly.
          setName(result.fullName);
        } else {
          // Subsequent sign-in: Apple doesn't resend the name, but
          // auth.ts persists it to Firebase on first sign-in via
          // updateProfile. Read it back from the cached user object.
          try {
            const authMod = await import("@react-native-firebase/auth");
            const fbName =
              authMod.default().currentUser?.displayName ?? null;
            const firstName = fbName?.split(" ")[0]?.trim() ?? null;
            if (firstName) setName(firstName);
          } catch {
            // Firebase module unavailable — name stays empty and
            // handleFinish will redirect to the info step as a fallback.
          }
        }
        await goToProfileSetup("apple");
      }
    } catch {
      showSignInError();
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (!requireTerms()) return;
    setAuthBusy(true);
    try {
      // Returns null when the user cancels the Google sheet — silent.
      const uid = await signInWithGoogle();
      if (uid) await goToProfileSetup("google");
    } catch {
      showSignInError();
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!requireTerms()) return;
    const email = authEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert(
        t("onboarding.invalidEmail"),
        t("onboarding.invalidEmailBody"),
      );
      return;
    }
    if (authPassword.length < 6) {
      Alert.alert(
        t("onboarding.weakPassword"),
        t("onboarding.weakPasswordBody"),
      );
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === "signin") {
        await signInWithEmail(email, authPassword);
      } else {
        // signUpWithEmail also fires off a verification email.
        await signUpWithEmail(email, authPassword);
      }
      // Email/password accounts MUST verify before they can use the
      // app. SSO providers (Apple/Google) come back already verified
      // and bypass this gate via handleApple/handleGoogle.
      const verified = await isCurrentUserEmailVerified();
      if (verified) {
        await goToProfileSetup("email");
        return;
      }
      // Sign-in path: an existing unverified account exists. Re-issue
      // a verification link so the user has a fresh one to click.
      if (authMode === "signin") {
        try {
          await sendVerificationEmail();
        } catch {
          // Best-effort — the verify screen exposes a manual resend
          // button if this silently fails.
        }
      }
      setVerifyEmail(email);
      setResendCooldownEndsAt(Date.now() + RESEND_COOLDOWN_MS);
      setPhase("verify");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      const msg = (err as { message?: string })?.message ?? "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        Alert.alert(
          t("onboarding.signInError"),
          t("onboarding.wrongCredentials"),
        );
      } else if (code === "auth/email-already-in-use") {
        Alert.alert(
          t("onboarding.signInError"),
          t("onboarding.emailInUse"),
        );
      } else if (code === "auth/too-many-requests") {
        Alert.alert(
          t("onboarding.signInError"),
          t("onboarding.tooManyAttempts"),
        );
      } else if (code === "auth/network-request-failed") {
        Alert.alert(
          t("onboarding.signInError"),
          t("onboarding.networkError"),
        );
      } else if (code === "auth/operation-not-allowed") {
        Alert.alert(
          t("onboarding.signInError"),
          t("onboarding.emailAuthDisabled"),
        );
      } else {
        Alert.alert(
          t("onboarding.signInError"),
          code ? `${t("onboarding.signInErrorBody")} (${code})` : t("onboarding.signInErrorBody"),
        );
      }
    } finally {
      setAuthBusy(false);
    }
  };

  // --- Verify-phase handlers ---------------------------------------

  const handleCheckVerified = async () => {
    setVerifyBusy(true);
    try {
      const verified = await reloadAndCheckVerified();
      if (verified) {
        await goToProfileSetup("email");
      } else {
        Alert.alert(
          t("onboarding.verifyNotYetTitle"),
          t("onboarding.verifyNotYetBody"),
        );
      }
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleResendVerify = async () => {
    if (resendBusy) return;
    if (resendCooldownEndsAt && resendCooldownEndsAt > Date.now()) return;
    setResendBusy(true);
    try {
      await sendVerificationEmail();
      setResendCooldownEndsAt(Date.now() + RESEND_COOLDOWN_MS);
      Alert.alert(
        t("onboarding.verifyResentTitle"),
        t("onboarding.verifyResentBody"),
      );
    } catch {
      showSignInError();
    } finally {
      setResendBusy(false);
    }
  };

  const handleChangeEmail = async () => {
    // Sign the unverified user out so the auth screen starts fresh.
    try {
      await signOut();
    } catch {
      // Best-effort.
    }
    setVerifyEmail(null);
    setResendCooldownEndsAt(null);
    setAuthEmail("");
    setAuthPassword("");
    setAuthMode("signup");
    setPhase("auth");
  };

  const handleForgotPassword = async () => {
    const email = authEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert(
        t("onboarding.invalidEmail"),
        t("onboarding.invalidEmailBody"),
      );
      return;
    }
    try {
      await sendPasswordReset(email);
      Alert.alert(
        t("onboarding.forgotPasswordSent"),
        t("onboarding.forgotPasswordSentBody"),
      );
    } catch {
      showSignInError();
    }
  };

  // Web preview only — handleFinish will issue a local- ID since there's
  // no signed-in Firebase user. Hidden on native, where real auth is
  // required.
  const handleWebSkip = async () => {
    if (!requireTerms()) return;
    await goToProfileSetup("email");
  };

  const handleFinish = async () => {
    // When opened from the home-page permissions banner, just open
    // Settings so the user can grant the missing permissions and go back.
    if (permissionsOnly) {
      Linking.openSettings();
      router.back();
      return;
    }
    let finalName = name.trim();
    // Safety net: if the name is still empty for an Apple sign-in user
    // (e.g. Apple didn't provide it on this sign-in), try Firebase Auth
    // cached displayName as a last resort.
    if (!finalName && fromAppleSignIn) {
      try {
        const authMod = await import("@react-native-firebase/auth");
        const fbName = authMod.default().currentUser?.displayName ?? null;
        if (fbName && fbName !== "Apple User") finalName = fbName;
      } catch {
        // Firebase not available — fall through to the guard below.
      }
    }
    if (!photoUri) {
      Alert.alert(t("onboarding.missingPhotoTitle"), t("onboarding.missingPhotoBody"));
      return;
    }
    if (!finalName) {
      // This should never fire in the normal flow — the photo step's
      // Continue button now routes to the info step when name is empty.
      // Guard here only as a true last resort.
      Alert.alert(t("onboarding.infoTitle"), t("onboarding.missingNameBody"));
      return;
    }
    setSaving(true);
    try {
      // Generate this user's own referral code on the way in.
      await ensureMyCode();
      // Optional: redeem an invite code if the user typed/deep-linked one.
      const code = inviteCode.trim().toUpperCase();
      if (code) {
        const result = await recordReferral(code);
        setInviteApplied(result === "accepted");
      }
      let userId = await getCurrentUserId();
      if (!userId) {
        if (Platform.OS === "web") {
          // Web preview only — no native sign-in available, so the dev
          // "Skip sign-in" button drops us here. Issue a local- ID so the
          // rest of onboarding can be exercised in the browser. Real
          // builds always come in with a Firebase UID.
          userId = "local-" + Math.random().toString(36).slice(2, 10);
        } else {
          Alert.alert(
            t("common.signInFailedTitle"),
            t("common.signInFailedBody"),
          );
          return;
        }
      }
      const newProfile: Profile = {
        id: userId,
        name: finalName,
        bio: bio.trim(),
        photoUri,
        socials,
        interests,
        verified: true,
        isVisible: false,
        photoVerifiedAt: Date.now(),
        extraPhotos: [],
      };
      await setProfile(newProfile);
      if (api.isConfigured() && !/^local-/.test(userId)) {
        try {
          let remotePhotoUrl: string | null = null;
          if (photoUri && !/^https?:\/\//i.test(photoUri)) {
            const FileSystem = await import("expo-file-system/legacy");
            const base64 = await FileSystem.readAsStringAsync(photoUri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const lower = photoUri.toLowerCase();
            const contentType = lower.endsWith(".png")
              ? "image/png"
              : lower.endsWith(".webp")
                ? "image/webp"
                : "image/jpeg";
            const uploaded = await api.uploadProfilePhoto(
              { uid: userId },
              { base64, contentType },
            );
            remotePhotoUrl = uploaded.photoUrl;
            await setProfile({ ...newProfile, photoUri: remotePhotoUrl });
          } else {
            remotePhotoUrl = photoUri;
          }
          await api.upsertMyProfile(
            { uid: userId },
            {
              displayName: newProfile.name,
              photoUrl: remotePhotoUrl,
              bio: newProfile.bio || null,
              socials: newProfile.socials as Record<string, string>,
              interests: newProfile.interests ?? [],
              isVisible: false,
              preferredLocale: getLanguage(),
            },
          );
        } catch {
          // Best-effort — the background effect in AppContext will retry.
        }
      }
      // Navigate directly to the correct screen rather than relying on
      // ProfileGate to redirect — avoids the race where ProfileGate and
      // handleFinish both call router.replace in the same render cycle.
      if (venueOwnerIntent) {
        router.replace(
          permissionsCompleted
            ? "/venue-owner/setup"
            : "/permissions?venueOwner=1",
        );
      } else {
        router.replace(permissionsCompleted ? "/(tabs)" : "/permissions");
      }
    } catch (err) {
      Alert.alert(t("common.error"), t("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------------------------------------
  // Resume mid-flow on app re-open. If a Firebase user is already
  // signed in but unverified, jump past the intro/auth slides directly
  // to the verify phase. If they're signed in AND verified (e.g. they
  // tapped the email link and reopened the app), jump to profile setup.
  // ------------------------------------------------------------------
  useEffect(() => {
    // When opened voluntarily from the home banner (?startAt=permissions),
    // the user is already set up — skip the auto-restore that would redirect
    // them straight back to tabs.
    if (permissionsOnly) return;
    if (resumedRef.current) return;
    let cancelled = false;
    (async () => {
      const uid = await getCurrentUserId();
      if (cancelled || !uid) return;
      // If the persisted Firebase session belongs to an Apple sign-in
      // user, pre-populate the name and skip the info step — exactly
      // as handleApple does on a live sign-in.  This handles the case
      // where the user was already signed in (e.g. after a local-profile
      // wipe) and the resume effect re-runs goToProfileSetup directly.
      try {
        const authMod = await import("@react-native-firebase/auth");
        const fbUser = authMod.default().currentUser;
        if (fbUser) {
          const isApple = fbUser.providerData?.some(
            (p) => p.providerId === "apple.com",
          );
          if (isApple) {
            setFromAppleSignIn(true);
            setNameFromApple(true);
            const firstName =
              fbUser.displayName?.split(" ")[0]?.trim() ?? null;
            if (firstName) setName(firstName);
          }
        }
      } catch {
        // Firebase module unavailable on this platform — no-op.
      }
      const email = await getCurrentUserEmail();
      // Reload from server in case verification happened on another
      // device since the cached user was last touched.
      const verified = await reloadAndCheckVerified();
      if (cancelled) return;
      resumedRef.current = true;
      if (email && !verified) {
        setVerifyEmail(email);
        setResendCooldownEndsAt(Date.now() + RESEND_COOLDOWN_MS);
        setPhase("verify");
      } else {
        // Verified email, or non-email provider (Apple/Google) —
        // try restoring from server first, otherwise show profile setup.
        await goToProfileSetup("email");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // While the verify screen is mounted, silently re-check the user's
  // emailVerified flag every few seconds so the user doesn't have to
  // tap "Continue" if they verified on another device.
  useEffect(() => {
    if (phase !== "verify") return;
    const id = setInterval(async () => {
      const verified = await reloadAndCheckVerified();
      if (verified) await goToProfileSetup("email");
    }, VERIFY_POLL_MS);
    return () => clearInterval(id);
  }, [phase]);

  // 1Hz tick for the resend-cooldown countdown label.
  useEffect(() => {
    if (!resendCooldownEndsAt) {
      setCooldownRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((resendCooldownEndsAt - Date.now()) / 1000),
      );
      setCooldownRemaining(remaining);
      if (remaining === 0) setResendCooldownEndsAt(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [resendCooldownEndsAt]);

  useEffect(() => {
    if (phase !== "intro") return;
    const loops = [
      ...socialFloatAnims.current.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 1800 + i * 250, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 1800 + i * 250, useNativeDriver: true }),
          ])
        )
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shieldPulseAnim.current, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(shieldPulseAnim.current, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [phase]);

  if (phase === "language") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.introWrap,
            { paddingTop: topPad + 48, paddingBottom: bottomPad },
          ]}
        >
          <View style={styles.introTextArea}>
            <Text style={[styles.introTitle, { color: colors.foreground }]}>
              {t("language.pickerTitle")}
            </Text>
            <Text style={[styles.introBody, { color: colors.mutedForeground }]}>
              {t("onboarding.languageSub")}
            </Text>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 10, paddingVertical: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {SUPPORTED_LANGUAGES.map((lang) => {
              const active = selectedLang === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => setSelectedLang(lang.code)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 18,
                    paddingVertical: 14,
                    borderRadius: colors.radius,
                    borderWidth: 1.5,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.border : colors.card,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "600" }}>
                      {lang.native}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>
                      {lang.label}
                    </Text>
                  </View>
                  {active && <Feather name="check-circle" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => {
              void (async () => {
                setLanguage(selectedLang);
                const seen = await loadValueTourSeen().catch(() => true);
                setPhase(seen ? "intro" : "valueTour");
              })();
            }}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              borderRadius: colors.radius,
              paddingVertical: 16,
              alignItems: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: colors.primaryForeground, fontSize: 17, fontWeight: "700" }}>
              {t("common.continue")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === "valueTour") {
    return (
      <ValueTour
        onDone={() => setPhase("auth")}
      />
    );
  }

  if (phase === "intro") {
    const isLast = slide === slides.length - 1;
    const ORBIT_R = 108;
    const SOCIAL_SIZE = 300;

    const socialItems = [
      { name: "instagram" as const, color: "#E1306C", angle: -90 },
      { name: "twitter" as const, color: "#1DA1F2", angle: -22 },
      { name: "snapchat-ghost" as const, color: "#F7CA00", angle: 54 },
      { name: "linkedin" as const, color: "#0A66C2", angle: 130 },
      { name: "facebook" as const, color: "#1877F2", angle: 206 },
    ];

    const badges = ["PROXIMITY", "PRIVACY FIRST", "LINK UP"];
    const accentColors = [colors.primary, "#60A5FA", "#FBBF24"];
    const accent = accentColors[slide] ?? colors.primary;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top nav */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: topPad,
            paddingHorizontal: 24,
            paddingBottom: 4,
          }}
        >
          <Pressable
            onPress={() => setPhase("language")}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </Pressable>
          <Pressable
            onPress={() => setPhase("auth")}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: colors.mutedForeground }}>
              {t("common.skip")}
            </Text>
          </Pressable>
        </View>

        {/* Slide visual */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {slide === 0 && (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <View
                style={{
                  position: "absolute",
                  width: 290,
                  height: 290,
                  borderRadius: 145,
                  backgroundColor: `${colors.primary}0C`,
                  borderWidth: 1,
                  borderColor: `${colors.primary}20`,
                }}
              />
              <RadarView
                size={260}
                blips={[
                  { initials: "AB", angle: 42, radiusFraction: 0.52 },
                  { initials: "SK", angle: 127, radiusFraction: 0.68 },
                  { initials: "MR", angle: 218, radiusFraction: 0.38 },
                  { initials: "JL", angle: 305, radiusFraction: 0.60 },
                ]}
              />
            </View>
          )}

          {slide === 1 && (
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Animated.View
                style={{
                  position: "absolute",
                  width: 240,
                  height: 240,
                  borderRadius: 120,
                  borderWidth: 1,
                  borderColor: "#60A5FA",
                  opacity: shieldPulseAnim.current.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.22] }),
                  transform: [{ scale: shieldPulseAnim.current.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.08] }) }],
                }}
              />
              <Animated.View
                style={{
                  position: "absolute",
                  width: 178,
                  height: 178,
                  borderRadius: 89,
                  borderWidth: 1,
                  borderColor: "#60A5FA",
                  opacity: shieldPulseAnim.current.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.28] }),
                  transform: [{ scale: shieldPulseAnim.current.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.04] }) }],
                }}
              />
              <View
                style={{
                  width: 118,
                  height: 118,
                  borderRadius: 59,
                  backgroundColor: "rgba(96,165,250,0.12)",
                  borderWidth: 1.5,
                  borderColor: "rgba(96,165,250,0.35)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="shield" size={52} color="#60A5FA" />
              </View>
              <View style={{ flexDirection: "row", gap: 24, marginTop: 28 }}>
                {[0, 1].map((i) => (
                  <View
                    key={i}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: "rgba(96,165,250,0.10)",
                      borderWidth: 1,
                      borderColor: "rgba(96,165,250,0.25)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "rgba(96,165,250,0.55)", fontSize: 20, fontFamily: "Inter_700Bold" }}>?</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {slide === 2 && (
            <View style={{ width: SOCIAL_SIZE, height: SOCIAL_SIZE, alignItems: "center", justifyContent: "center" }}>
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: colors.primary,
                  shadowOpacity: 0.5,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 10,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 38, fontFamily: "Inter_700Bold" }}>M</Text>
              </View>

              {socialItems.map((item, i) => {
                const rad = (item.angle * Math.PI) / 180;
                const cx = SOCIAL_SIZE / 2 + ORBIT_R * Math.cos(rad) - 24;
                const cy = SOCIAL_SIZE / 2 + ORBIT_R * Math.sin(rad) - 24;
                return (
                  <Animated.View
                    key={i}
                    style={{
                      position: "absolute",
                      left: cx,
                      top: cy,
                      transform: [{
                        translateY: socialFloatAnims.current[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -10],
                        }),
                      }],
                    }}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: item.color,
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: item.color,
                        shadowOpacity: 0.4,
                        shadowRadius: 8,
                        shadowOffset: { width: 0, height: 3 },
                        elevation: 6,
                      }}
                    >
                      <FontAwesome name={item.name} size={22} color="#FFFFFF" />
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>

        {/* Text content */}
        <View style={{ paddingHorizontal: 28, paddingBottom: 16, gap: 14 }}>
          <View
            style={{
              alignSelf: "flex-start",
              borderRadius: 100,
              paddingHorizontal: 12,
              paddingVertical: 5,
              backgroundColor: `${accent}18`,
              borderWidth: 1,
              borderColor: `${accent}40`,
            }}
          >
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.5, color: accent }}>
              {badges[slide]}
            </Text>
          </View>

          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 34, lineHeight: 40, color: colors.foreground }}>
            {t(slides[slide].titleKey)}
          </Text>

          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 23, color: colors.mutedForeground }}>
            {t(slides[slide].bodyKey)}
          </Text>
        </View>

        {/* Bottom nav */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 28,
            paddingBottom: bottomPad + 8,
            paddingTop: 4,
          }}
        >
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={{
                  height: 6,
                  width: i === slide ? 20 : 6,
                  borderRadius: 3,
                  backgroundColor: i === slide ? colors.primary : `${colors.primary}30`,
                }}
              />
            ))}
          </View>

          <Pressable
            onPress={() => (isLast ? setPhase("auth") : setSlide(slide + 1))}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.primary,
              borderRadius: colors.radius,
              paddingHorizontal: 22,
              paddingVertical: 14,
              opacity: pressed ? 0.82 : 1,
            })}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 16, color: colors.primaryForeground }}>
              {isLast ? t("onboarding.getStarted") : t("common.continue")}
            </Text>
            {!isLast && (
              <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.formScroll,
          { paddingTop: topPad, paddingBottom: bottomPad + 8 },
        ]}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stepHeader}>
          {phase === "photo" ? (
            // Sign-in is committed by this point; hide back to avoid
            // confusing re-entry into the auth screen.
            <View style={{ width: 24 }} />
          ) : phase === "verify" ? (
            // Back from verify signs the unverified user out and
            // returns them to the auth screen — same effect as the
            // "Use a different email" link below.
            <Pressable onPress={handleChangeEmail} hitSlop={12}>
              <Feather name="chevron-left" size={24} color={colors.foreground} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                if (permissionsOnly) { router.back(); return; }
                if (phase === "auth") setPhase("intro");
                else if (phase === "info") setPhase("photo");
                else if (phase === "socials") setPhase(nameFromApple ? "photo" : "info");
                else if (phase === "interests") setPhase("socials");
                else if (phase === "invite") setPhase("interests");
              }}
              hitSlop={12}
            >
              <Feather name="chevron-left" size={24} color={colors.foreground} />
            </Pressable>
          )}
          {phase === "auth" || phase === "verify" ? (
            <View style={{ flex: 1 }} />
          ) : (
            <View style={styles.stepDots}>
              {(["photo", "info", "socials", "interests", "invite"] as Phase[]).map((p, i) => {
                const order = ["photo", "info", "socials", "interests", "invite"];
                const currentIndex = order.indexOf(phase);
                const active = i <= currentIndex;
                return (
                  <View
                    key={p}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: active ? colors.primary : "#CBD5D1",
                        width: i === currentIndex ? 22 : 8,
                      },
                    ]}
                  />
                );
              })}
            </View>
          )}
          <View style={{ width: 24 }} />
        </View>

        {phase === "auth" ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              {t("onboarding.signInTitle")}
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              {t("onboarding.signInSub")}
            </Text>

            {/* EULA acceptance — required by App Store Guideline 1.2 and
                Play Store policy for apps with user-generated content. The
                checkbox gates Apple/Google/email auth via requireTerms(). */}
            <Pressable
              onPress={() => setTermsAccepted((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
              accessibilityLabel={t("onboarding.termsAgreementCheckbox")}
              accessibilityHint={t("onboarding.termsRequiredBody")}
              style={({ pressed }) => [
                styles.termsRow,
                {
                  backgroundColor: colors.card,
                  borderColor: termsAccepted ? colors.primary : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.termsCheckbox,
                  {
                    backgroundColor: termsAccepted
                      ? colors.primary
                      : "transparent",
                    borderColor: termsAccepted
                      ? colors.primary
                      : colors.border,
                  },
                ]}
              >
                {termsAccepted ? (
                  <Feather name="check" size={14} color="#fff" />
                ) : null}
              </View>
              <Text style={[styles.termsText, { color: colors.foreground }]}>
                {t("onboarding.termsAgreementCheckbox")}{" "}
                <Text
                  style={[styles.termsLink, { color: colors.primary }]}
                  accessibilityRole="link"
                  onPress={(e) => {
                    e.stopPropagation();
                    openLink(TERMS_URL);
                  }}
                >
                  {t("onboarding.termsAgreementTerms")}
                </Text>{" "}
                {t("onboarding.termsAgreementAnd")}{" "}
                <Text
                  style={[styles.termsLink, { color: colors.primary }]}
                  accessibilityRole="link"
                  onPress={(e) => {
                    e.stopPropagation();
                    openLink(PRIVACY_URL);
                  }}
                >
                  {t("onboarding.termsAgreementPrivacy")}
                </Text>
                .
              </Text>
            </Pressable>
            <Text
              style={[styles.termsSafety, { color: colors.mutedForeground }]}
            >
              {t("onboarding.termsAgreementSafety")}
            </Text>

            {Platform.OS === "ios" ? (
              <Pressable
                onPress={handleApple}
                disabled={authBusy}
                style={({ pressed }) => [
                  styles.ssoBtn,
                  {
                    backgroundColor: "#000",
                    opacity: pressed || authBusy ? 0.7 : 1,
                  },
                ]}
              >
                <FontAwesome name="apple" size={18} color="#fff" />
                <Text style={[styles.ssoBtnText, { color: "#fff" }]}>
                  {t("onboarding.continueWithApple")}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleGoogle}
              disabled={authBusy}
              style={({ pressed }) => [
                styles.ssoBtn,
                {
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed || authBusy ? 0.7 : 1,
                },
              ]}
            >
              <FontAwesome name="google" size={18} color={colors.foreground} />
              <Text style={[styles.ssoBtnText, { color: colors.foreground }]}>
                {t("onboarding.continueWithGoogle")}
              </Text>
            </Pressable>

            <View style={styles.divider}>
              <View
                style={[styles.dividerLine, { backgroundColor: colors.border }]}
              />
              <Text
                style={[styles.dividerText, { color: colors.mutedForeground }]}
              >
                {t("onboarding.orWithEmail")}
              </Text>
              <View
                style={[styles.dividerLine, { backgroundColor: colors.border }]}
              />
            </View>

            <View style={styles.modeRow}>
              <Pressable
                onPress={() => setAuthMode("signin")}
                style={[
                  styles.modeTab,
                  {
                    borderBottomColor:
                      authMode === "signin" ? colors.primary : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    {
                      color:
                        authMode === "signin"
                          ? colors.foreground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {t("onboarding.signInTab")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAuthMode("signup")}
                style={[
                  styles.modeTab,
                  {
                    borderBottomColor:
                      authMode === "signup" ? colors.primary : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    {
                      color:
                        authMode === "signup"
                          ? colors.foreground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {t("onboarding.signUpTab")}
                </Text>
              </Pressable>
            </View>

            <View style={styles.field}>
              <TextInput
                value={authEmail}
                onChangeText={setAuthEmail}
                placeholder={t("onboarding.emailPlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
            </View>

            <View style={styles.field}>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={authPassword}
                  onChangeText={setAuthPassword}
                  placeholder={t("onboarding.passwordPlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!authPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                />
                <Pressable
                  onPress={() => setAuthPasswordVisible((v) => !v)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={
                    authPasswordVisible
                      ? t("onboarding.hidePassword")
                      : t("onboarding.showPassword")
                  }
                  style={({ pressed }) => [
                    styles.passwordToggle,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Feather
                    name={authPasswordVisible ? "eye-off" : "eye"}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
            </View>

            <PrimaryButton
              label={
                authMode === "signin"
                  ? t("onboarding.signInBtn")
                  : t("onboarding.signUpBtn")
              }
              onPress={handleEmailAuth}
              disabled={
                authBusy || !authEmail.trim() || authPassword.length < 6
              }
              loading={authBusy}
            />

            <Pressable
              onPress={() => {
                setVenueOwnerIntent(true);
                setAuthMode("signup");
              }}
              disabled={authBusy}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.venueOwnerSentence,
                { opacity: pressed || authBusy ? 0.65 : 1 },
              ]}
            >
              <Text style={[styles.forgotText, { color: colors.primary }]}>
                {t("onboarding.venueOwnerCta")}
              </Text>
              <Text
                style={[
                  styles.venueOwnerSentenceSub,
                  { color: colors.mutedForeground },
                ]}
              >
                {t("onboarding.venueOwnerCtaSub")}
              </Text>
            </Pressable>

            {authMode === "signin" ? (
              <Pressable onPress={handleForgotPassword} hitSlop={8}>
                <Text style={[styles.forgotText, { color: colors.primary }]}>
                  {t("onboarding.forgotPassword")}
                </Text>
              </Pressable>
            ) : null}

            {Platform.OS === "web" && __DEV__ ? (
              // Dev-only escape hatch so the web preview can advance to
              // the rest of onboarding without native auth modules. Hidden
              // in any production web build.
              <Pressable onPress={handleWebSkip} hitSlop={8}>
                <Text
                  style={[styles.webSkipText, { color: colors.mutedForeground }]}
                >
                  {t("onboarding.webPreviewSkip")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {phase === "verify" ? (
          <View style={styles.step}>
            <View
              style={[
                styles.verifyIconWrap,
                { backgroundColor: "#DBEAFE" },
              ]}
            >
              <Feather name="mail" size={40} color="#3B82F6" />
            </View>

            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              {t("onboarding.verifyTitle")}
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              {t("onboarding.verifyBody", { email: verifyEmail ?? "" })}
            </Text>

            <PrimaryButton
              label={
                verifyBusy
                  ? t("onboarding.verifyCheckingEmail")
                  : t("onboarding.verifyContinue")
              }
              onPress={handleCheckVerified}
              disabled={verifyBusy}
              loading={verifyBusy}
            />

            <Pressable
              onPress={handleResendVerify}
              disabled={resendBusy || cooldownRemaining > 0}
              hitSlop={8}
              style={({ pressed }) => ({
                opacity: pressed || resendBusy || cooldownRemaining > 0 ? 0.6 : 1,
              })}
            >
              <Text style={[styles.forgotText, { color: colors.primary }]}>
                {cooldownRemaining > 0
                  ? t("onboarding.verifyResendCooldown", {
                      seconds: cooldownRemaining,
                    })
                  : t("onboarding.verifyResend")}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleChangeEmail}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text
                style={[
                  styles.webSkipText,
                  { color: colors.mutedForeground, marginTop: 16 },
                ]}
              >
                {t("onboarding.verifyChangeEmail")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {phase === "photo" ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              {t("onboarding.photoTitle")}
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              {t("onboarding.photoSub")}
            </Text>

            <Pressable onPress={pickPhoto} style={styles.photoTarget}>
              <View
                style={[
                  styles.photoFrame,
                  {
                    backgroundColor: colors.card,
                    borderColor: photoUri ? colors.primary : colors.border,
                  },
                ]}
              >
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.photoImg}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Feather
                      name="camera"
                      size={32}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.photoHint,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {t("onboarding.tapToChoose")}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>

            <PrimaryButton
              label={t("common.continue")}
              onPress={() => {
                // If we have a name (from Apple, Firebase cache, or manual
                // entry on a prior pass through the info step) AND the user
                // came from Apple, skip directly to socials.
                // Otherwise always show the info step so the user can enter
                // their name. This handles the common case where Apple doesn't
                // resend the name on subsequent sign-ins (Apple's one-shot
                // policy) and we have no Firebase cached displayName yet.
                if (name.trim() && nameFromApple) {
                  setPhase("socials");
                } else {
                  setPhase("info");
                }
              }}
              disabled={!photoUri}
            />
          </View>
        ) : null}

        {phase === "info" ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              {t("onboarding.infoTitle")}
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              {t("onboarding.infoSub")}
            </Text>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                {t("onboarding.nameLabel")}
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t("onboarding.namePlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                {t("onboarding.bioLabel")}
              </Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder={t("onboarding.bioPlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={120}
                style={[
                  styles.input,
                  styles.inputMulti,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
              <Text style={[styles.counter, { color: colors.mutedForeground }]}>
                {bio.length}/120
              </Text>
            </View>

            <PrimaryButton
              label={t("common.continue")}
              onPress={() => setPhase("socials")}
              disabled={!name.trim()}
            />
          </View>
        ) : null}

        {/* Photo verifier overlay — face + content check on every new pick. */}
        <PhotoVerifier
          visible={pendingPhotoUri !== null}
          uri={pendingPhotoUri}
          onCancel={() => setPendingPhotoUri(null)}
          onVerified={(uri) => {
            setPhotoUri(uri);
            setPendingPhotoUri(null);
          }}
        />

        {phase === "socials" ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              {t("onboarding.socialsTitle")}
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              {t("onboarding.socialsSub")}
            </Text>

            <View style={{ gap: 12 }}>
              {SOCIAL_FIELDS.map((f) => (
                <View key={f.key} style={styles.field}>
                  <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>
                    {f.label}
                  </Text>
                  <TextInput
                    value={socials[f.key] ?? ""}
                    onChangeText={(v) => {
                      setSocials((prev) => ({ ...prev, [f.key]: v }));
                      if (socialErrors[f.key]) setSocialErrors((prev) => { const n = { ...prev }; delete n[f.key]; return n; });
                      if (socialVerified[f.key]) setSocialVerified((prev) => { const n = { ...prev }; delete n[f.key]; return n; });
                    }}
                    onBlur={() => validateSocial(f.key, socials[f.key] ?? "")}
                    placeholder={f.placeholder}
                    autoCapitalize="none"
                    placeholderTextColor={colors.mutedForeground}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.card,
                        borderColor: socialErrors[f.key]
                          ? colors.destructive
                          : socialVerified[f.key]
                          ? colors.primary
                          : colors.border,
                        color: colors.foreground,
                      },
                    ]}
                  />
                  {socialVerifying[f.key] && (
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                      {t("onboarding.socialVerifying")}
                    </Text>
                  )}
                  {!socialVerifying[f.key] && socialErrors[f.key] && (
                    <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 4 }}>
                      {socialErrors[f.key]}
                    </Text>
                  )}
                  {!socialVerifying[f.key] && !socialErrors[f.key] && socialVerified[f.key] && (
                    <Text style={{ color: colors.primary, fontSize: 12, marginTop: 4 }}>
                      {t("onboarding.socialVerified")}
                    </Text>
                  )}
                </View>
              ))}
            </View>

            <PrimaryButton
              label={
                Object.values(socials).some((v) => v && v.trim())
                  ? t("common.continue")
                  : t("common.skip")
              }
              onPress={() => setPhase("interests")}
            />
          </View>
        ) : null}

        {phase === "interests" ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              {t("onboarding.interestsTitle")}
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              {t("onboarding.interestsSub", { count: MAX_INTERESTS })}
            </Text>

            {interests.length > 0 ? (
              <SortableChips
                items={interests}
                onReorder={handleInterestsReorder}
                style={{ gap: 10 }}
                showDragHint={showDragHint && interests.length > 1}
                dragHintLabel={t("onboarding.dragReorderHint")}
                renderChip={(tag, isPlaceholder) => (
                  <Pressable
                    onPress={
                      isPlaceholder
                        ? undefined
                        : () => setInterests((prev) => prev.filter((i) => i !== tag))
                    }
                    style={({ pressed }) => [
                      styles.interestChip,
                      {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary,
                        opacity: isPlaceholder ? 0.3 : pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.interestChipText,
                        { color: isPlaceholder ? "transparent" : "#FFFFFF" },
                      ]}
                    >
                      {t(`interestLabels.${tag.toLowerCase()}`)}
                    </Text>
                    {!isPlaceholder && (
                      <Feather name="x" size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    )}
                  </Pressable>
                )}
              />
            ) : null}

            <TextInput
              value={interestSearch}
              onChangeText={setInterestSearch}
              placeholder={t("onboarding.interestsSearchPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />

            <View style={styles.interestsGrid}>
              {ALL_INTERESTS.filter((tag) => {
                if (interests.includes(tag)) return false;
                const query = interestSearch.trim().toLocaleLowerCase(lang);
                if (!query) return true;
                return (
                  tag.toLocaleLowerCase(lang).includes(query) ||
                  t(`interestLabels.${tag.toLowerCase()}`).toLocaleLowerCase(lang).includes(query)
                );
              }).map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => {
                    if (interests.length < MAX_INTERESTS) {
                      setInterests((prev) => [...prev, tag]);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.interestChip,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.interestChipText,
                      { color: colors.foreground },
                    ]}
                  >
                    {t(`interestLabels.${tag.toLowerCase()}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.interestsCount, { color: colors.mutedForeground }]}>
              {t("onboarding.interestsSelectedCount", {
                current: interests.length,
                max: MAX_INTERESTS,
              })}
            </Text>

            <PrimaryButton
              label={interests.length > 0 ? t("common.continue") : t("common.skip")}
              onPress={() => { setInterestSearch(""); setPhase("invite"); }}
            />
          </View>
        ) : null}

        {phase === "invite" ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              {t("onboarding.inviteTitle")}
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              {t("onboarding.inviteSub")}
            </Text>

            {!permissionsOnly ? (
            <View style={styles.field}>
              <Text
                style={[styles.fieldLabel, { color: colors.mutedForeground }]}
              >
                {t("onboarding.inviteCodeLabel")}
              </Text>
              <TextInput
                value={inviteCode}
                onChangeText={(v) => {
                  setInviteCode(v.toUpperCase().slice(0, 6));
                  setInviteApplied(null);
                }}
                placeholder={t("onboarding.inviteCodePlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                    letterSpacing: 4,
                    fontFamily: "Inter_700Bold",
                    fontSize: 18,
                  },
                ]}
              />
              {inviteApplied === false ? (
                <Text style={[styles.counter, { color: colors.destructive }]}>
                  {t("onboarding.inviteCodeInvalid")}
                </Text>
              ) : null}
            </View>
            ) : null}

            <PrimaryButton
              label={t("onboarding.activateBeacon")}
              onPress={handleFinish}
              loading={saving}
            />
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  introWrap: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: "space-between",
  },
  introIconArea: {
    alignItems: "center",
    paddingTop: 40,
  },
  introIconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  introTextArea: {
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 14,
  },
  introTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    textAlign: "center",
  },
  introBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  introFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
    minHeight: 40,
  },
  skipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    minWidth: 60,
  },
  getStarted: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  dot: { height: 8, borderRadius: 4 },
  formScroll: {
    paddingHorizontal: 24,
    gap: 28,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepDots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  step: { gap: 18 },
  stepTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    lineHeight: 32,
  },
  stepSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
    marginTop: -10,
  },
  photoTarget: {
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  photoFrame: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photoImg: { width: "100%", height: "100%" },
  photoPlaceholder: { alignItems: "center", gap: 8 },
  photoHint: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  interestsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
  },
  interestChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  interestsCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    marginTop: -8,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  subLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  input: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
  venueOwnerSentence: {
    alignItems: "center",
    gap: 4,
    marginTop: 14,
    paddingVertical: 2,
  },
  venueOwnerSentenceSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  inputMulti: {
    height: 96,
    paddingTop: 14,
    textAlignVertical: "top",
  },
  passwordWrap: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 48,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "right",
  },
  ssoBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ssoBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
  },
  modeTabText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  forgotText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
  },
  webSkipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  termsCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  termsText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 19,
  },
  termsLink: {
    fontFamily: "Inter_600SemiBold",
    textDecorationLine: "underline",
  },
  termsSafety: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
    marginTop: -10,
  },
});
