import { Feather, FontAwesome } from "@expo/vector-icons";
import { Image } from "@/components/MetImage";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoVerifier } from "@/components/PhotoVerifier";
import { PrimaryButton } from "@/components/PrimaryButton";
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
import { getLanguage, useT } from "@/lib/i18n";
import { ensureMyCode, recordReferral } from "@/lib/referrals";
import { ALL_INTERESTS, MAX_INTERESTS } from "@/lib/interests";
import type { Profile, SocialLinks, SocialPlatform } from "@/lib/types";

import { consumePendingReferral } from "./_layout";

type IconName = React.ComponentProps<typeof Feather>["name"];

type Slide = {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  titleKey: string;
  bodyKey: string;
};

const SLIDES: Slide[] = [
  {
    icon: "target",
    iconColor: "#3B82F6",
    iconBg: "#DBEAFE",
    titleKey: "onboarding.slide1Title",
    bodyKey: "onboarding.slide1Body",
  },
  {
    icon: "shield",
    iconColor: "#3DCC44",
    iconBg: "#DCFCE7",
    titleKey: "onboarding.slide2Title",
    bodyKey: "onboarding.slide2Body",
  },
  {
    icon: "user",
    iconColor: "#F59E0B",
    iconBg: "#FEF3C7",
    titleKey: "onboarding.slide3Title",
    bodyKey: "onboarding.slide3Body",
  },
];

const SOCIAL_FIELDS: Array<{ key: SocialPlatform; label: string; placeholder: string }> = [
  { key: "instagram", label: "Instagram", placeholder: "your.handle" },
  { key: "facebook", label: "Facebook", placeholder: "your.name" },
  { key: "x", label: "X", placeholder: "your_handle" },
  { key: "tiktok", label: "TikTok", placeholder: "your.handle" },
  { key: "snapchat", label: "Snapchat", placeholder: "your.handle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "your-name" },
];

type Phase =
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
  const router = useRouter();
  const { setProfile, setPermissionsCompleted } = useApp();
  const insets = useSafeAreaInsets();
  const { t, lang } = useT();
  // When opened from the home-page permissions banner with
  // `?startAt=permissions`, we skip the full signup flow and land
  // directly on the activateBeacon step so the user can grant
  // permissions without re-doing onboarding.
  const { startAt } = useLocalSearchParams<{ startAt?: string }>();
  const permissionsOnly = startAt === "permissions";

  const [phase, setPhase] = useState<Phase>(
    permissionsOnly ? "invite" : "intro",
  );
  const [slide, setSlide] = useState(0);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [socials, setSocials] = useState<SocialLinks>({});
  const [interests, setInterests] = useState<string[]>([]);
  const [interestSearch, setInterestSearch] = useState("");
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

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;
  const topPad = (Platform.OS === "web" ? webTop : insets.top) + 24;
  const bottomPad = insets.bottom + webBot + 24;

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
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
      if (!remote || !remote.displayName) return false;
      const restored: Profile = {
        id: remote.uid,
        name: remote.displayName,
        bio: remote.bio ?? "",
        photoUri: remote.photoUrl ?? "",
        socials: (remote.socials ?? {}) as SocialLinks,
        interests: (remote.interests ?? []) as string[],
        verified: true,
        isVisible: remote.isVisible ?? false,
        photoVerifiedAt: Date.now(),
        extraPhotos: [],
      };
      if (!restored.photoUri) return false;
      await setProfile(restored);
      await setPermissionsCompleted(true);
      await ensureMyCode();
      router.replace("/(tabs)");
      return true;
    } catch {
      return false;
    }
  };

  const goToProfileSetup = async () => {
    const restored = await tryRestoreExistingProfile();
    if (!restored) setPhase("photo");
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
        // Apple provides the full name only on the very first sign-in.
        // Pre-populate the name field so the user doesn't have to retype
        // information Apple already supplied (Guideline 4 compliance).
        if (result.fullName) setName(result.fullName);
        await goToProfileSetup();
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
      if (uid) await goToProfileSetup();
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
        await goToProfileSetup();
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
        await goToProfileSetup();
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
    await goToProfileSetup();
  };

  const handleFinish = async () => {
    // When opened from the home-page permissions banner, just open
    // Settings so the user can grant the missing permissions and go back.
    if (permissionsOnly) {
      Linking.openSettings();
      router.back();
      return;
    }
    if (!photoUri || !name.trim()) return;
    setSaving(true);
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
        setSaving(false);
        Alert.alert(
          t("common.signInFailedTitle"),
          t("common.signInFailedBody"),
        );
        return;
      }
    }
    const newProfile: Profile = {
      id: userId,
      name: name.trim(),
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
    router.replace("/(tabs)");
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
        await goToProfileSetup();
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
      if (verified) await goToProfileSetup();
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

  if (phase === "intro") {
    const current = SLIDES[slide];
    const currentTitle = t(current.titleKey);
    const currentBody = t(current.bodyKey);
    const isLast = slide === SLIDES.length - 1;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.introWrap,
            { paddingTop: topPad + 24, paddingBottom: bottomPad },
          ]}
        >
          <View style={styles.introIconArea}>
            <View
              style={[
                styles.introIconWrap,
                { backgroundColor: current.iconBg },
              ]}
            >
              <Feather
                name={current.icon}
                size={56}
                color={current.iconColor}
              />
            </View>
          </View>

          <View style={styles.introTextArea}>
            <Text style={[styles.introTitle, { color: colors.foreground }]}>
              {currentTitle}
            </Text>
            <Text style={[styles.introBody, { color: colors.mutedForeground }]}>
              {currentBody}
            </Text>
          </View>

          <View style={styles.introFooter}>
            <Pressable
              onPress={() => setPhase("auth")}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[styles.skipText, { color: colors.primary }]}>
                {isLast ? " " : t("common.skip")}
              </Text>
            </Pressable>

            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i === slide ? colors.primary : "#CBD5D1",
                      width: i === slide ? 22 : 8,
                    },
                  ]}
                />
              ))}
            </View>

            {isLast ? (
              <Pressable
                onPress={() => setPhase("auth")}
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={[styles.getStarted, { color: colors.primary }]}>
                  {t("onboarding.getStarted")}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setSlide(slide + 1)}
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Feather
                  name="arrow-right"
                  size={24}
                  color={colors.foreground}
                />
              </Pressable>
            )}
          </View>
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
                else if (phase === "socials") setPhase("info");
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
              onPress={() => setPhase("info")}
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
                    onChangeText={(v) =>
                      setSocials((prev) => ({ ...prev, [f.key]: v }))
                    }
                    placeholder={f.placeholder}
                    autoCapitalize="none"
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
                const query = interestSearch.trim().toLocaleLowerCase(lang);
                if (!query) return true;
                return (
                  tag.toLocaleLowerCase(lang).includes(query) ||
                  t(`interestLabels.${tag.toLowerCase()}`).toLocaleLowerCase(lang).includes(query)
                );
              }).map((tag) => {
                const selected = interests.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => {
                      if (selected) {
                        setInterests((prev) => prev.filter((i) => i !== tag));
                      } else if (interests.length < MAX_INTERESTS) {
                        setInterests((prev) => [...prev, tag]);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.interestChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.interestChipText,
                        { color: selected ? "#FFFFFF" : colors.foreground },
                      ]}
                    >
                      {t(`interestLabels.${tag.toLowerCase()}`)}
                    </Text>
                  </Pressable>
                );
              })}
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
