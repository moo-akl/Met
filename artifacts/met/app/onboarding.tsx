import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import type { SocialLinks, SocialPlatform } from "@/lib/types";

type IconName = React.ComponentProps<typeof Feather>["name"];

type Slide = {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: "target",
    iconColor: "#3B82F6",
    iconBg: "#DBEAFE",
    title: "Discover Nearby People",
    body: "Met uses your location to find others nearby. No more missed connections.",
  },
  {
    icon: "shield",
    iconColor: "#3DCC44",
    iconBg: "#DCFCE7",
    title: "Stay Private & Secure",
    body: "We never share your exact location. Only your encounter ID is exchanged locally.",
  },
  {
    icon: "user",
    iconColor: "#F59E0B",
    iconBg: "#FEF3C7",
    title: "Create Your Identity",
    body: "Let's set up your profile so people know who they've met.",
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

type Phase = "intro" | "photo" | "info" | "socials";

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { setProfile } = useApp();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<Phase>("intro");
  const [slide, setSlide] = useState(0);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [socials, setSocials] = useState<SocialLinks>({});
  const [saving, setSaving] = useState(false);

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

  const handleFinish = async () => {
    if (!photoUri || !name.trim()) return;
    setSaving(true);
    await setProfile({
      id: Date.now().toString(),
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
              {current.title}
            </Text>
            <Text style={[styles.introBody, { color: colors.mutedForeground }]}>
              {current.body}
            </Text>
          </View>

          <View style={styles.introFooter}>
            <Pressable
              onPress={() => setPhase("photo")}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={[styles.skipText, { color: colors.primary }]}>
                {isLast ? " " : "Skip"}
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
                onPress={() => setPhase("photo")}
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text style={[styles.getStarted, { color: colors.primary }]}>
                  Get Started
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
          <Pressable
            onPress={() => {
              if (phase === "photo") setPhase("intro");
              else if (phase === "info") setPhase("photo");
              else setPhase("info");
            }}
            hitSlop={12}
          >
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </Pressable>
          <View style={styles.stepDots}>
            {(["photo", "info", "socials"] as Phase[]).map((p, i) => {
              const order = ["photo", "info", "socials"];
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
          <View style={{ width: 24 }} />
        </View>

        {phase === "photo" ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              One real photo.
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Clear, recent, and you. This is what people see when you both
              connect.
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
                      Tap to choose
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>

            <PrimaryButton
              label="Continue"
              onPress={() => setPhase("info")}
              disabled={!photoUri}
            />
          </View>
        ) : null}

        {phase === "info" ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              A name and a sentence.
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Keep your bio short. The shorter, the more honest it feels.
            </Text>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your first name"
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
                Bio
              </Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Architect. Always chasing better light."
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
              label="Continue"
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
              Your social handles.
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Add at least one. Connections see only what you put here.
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
              label="Activate beacon"
              onPress={handleFinish}
              loading={saving}
              disabled={!Object.values(socials).some((v) => v && v.trim())}
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
});
