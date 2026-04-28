import { Feather, FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
  getCurrentUserId,
  sendPasswordReset,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { ensureMyCode, recordReferral } from "@/lib/referrals";
import type { SocialLinks, SocialPlatform } from "@/lib/types";

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

type Phase = "intro" | "auth" | "photo" | "info" | "socials" | "invite";

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { setProfile } = useApp();
  const insets = useSafeAreaInsets();
  const { t } = useT();

  const [phase, setPhase] = useState<Phase>("intro");
  const [slide, setSlide] = useState(0);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [socials, setSocials] = useState<SocialLinks>({});
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
  const [authBusy, setAuthBusy] = useState(false);

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
  // Auth handlers — all funnel into setPhase("photo") on success so the
  // user lands on the first profile-setup step with a Firebase UID
  // already attached to the session.
  // ------------------------------------------------------------------
  const goToProfileSetup = () => setPhase("photo");

  const showSignInError = () =>
    Alert.alert(
      t("onboarding.signInError"),
      t("onboarding.signInErrorBody"),
    );

  const handleApple = async () => {
    setAuthBusy(true);
    try {
      // Returns null when the user cancels the Apple sheet — silent.
      const uid = await signInWithApple();
      if (uid) goToProfileSetup();
    } catch {
      showSignInError();
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogle = async () => {
    setAuthBusy(true);
    try {
      // Returns null when the user cancels the Google sheet — silent.
      const uid = await signInWithGoogle();
      if (uid) goToProfileSetup();
    } catch {
      showSignInError();
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailAuth = async () => {
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
        await signUpWithEmail(email, authPassword);
      }
      goToProfileSetup();
    } catch {
      showSignInError();
    } finally {
      setAuthBusy(false);
    }
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
  const handleWebSkip = () => goToProfileSetup();

  const handleFinish = async () => {
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
    await setProfile({
      id: userId,
      name: name.trim(),
      bio: bio.trim(),
      photoUri,
      socials,
      verified: true,
      isVisible: true,
      photoVerifiedAt: Date.now(),
      extraPhotos: [],
    });
    router.replace("/(tabs)");
  };

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
          ) : (
            <Pressable
              onPress={() => {
                if (phase === "auth") setPhase("intro");
                else if (phase === "info") setPhase("photo");
                else if (phase === "socials") setPhase("info");
                else if (phase === "invite") setPhase("socials");
              }}
              hitSlop={12}
            >
              <Feather name="chevron-left" size={24} color={colors.foreground} />
            </Pressable>
          )}
          {phase === "auth" ? (
            <View style={{ flex: 1 }} />
          ) : (
            <View style={styles.stepDots}>
              {(["photo", "info", "socials", "invite"] as Phase[]).map((p, i) => {
                const order = ["photo", "info", "socials", "invite"];
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
              <TextInput
                value={authPassword}
                onChangeText={setAuthPassword}
                placeholder={t("onboarding.passwordPlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
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
              label={t("common.continue")}
              onPress={() => setPhase("invite")}
              disabled={!Object.values(socials).some((v) => v && v.trim())}
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
});
