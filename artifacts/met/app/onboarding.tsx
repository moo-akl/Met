import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
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

import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import type { SocialLinks, SocialPlatform } from "@/lib/types";

const logo = require("@/assets/images/icon.png");

const SOCIAL_FIELDS: Array<{ key: SocialPlatform; label: string; placeholder: string }> = [
  { key: "instagram", label: "Instagram", placeholder: "your.handle" },
  { key: "x", label: "X", placeholder: "your_handle" },
  { key: "tiktok", label: "TikTok", placeholder: "your.handle" },
  { key: "snapchat", label: "Snapchat", placeholder: "your.handle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "your-name" },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { setProfile } = useApp();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [socials, setSocials] = useState<SocialLinks>({});
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setPhotoUri(res.assets[0].uri);
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
    });
    router.replace("/(tabs)");
  };

  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBotPad = Platform.OS === "web" ? 34 : 0;
  const topPad = (Platform.OS === "web" ? webTopPad : insets.top) + 24;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {step === 0 ? (
        <View
          style={[
            styles.welcome,
            { paddingTop: topPad, paddingBottom: insets.bottom + webBotPad + 24 },
          ]}
        >
          <View style={styles.welcomeBeacon}>
            <Image
              source={logo}
              style={styles.welcomeLogo}
              contentFit="contain"
            />
          </View>
          <View style={styles.welcomeCopy}>
            <Text style={[styles.brand, { color: colors.primary }]}>MET</Text>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Your phone is a beacon.
            </Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
              Met quietly remembers everyone you cross paths with. When you both
              choose, you connect.
            </Text>
          </View>
          <View style={{ width: "100%", paddingHorizontal: 24 }}>
            <PrimaryButton label="Set up your beacon" onPress={() => setStep(1)} />
          </View>
        </View>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={[
            styles.formScroll,
            {
              paddingTop: topPad,
              paddingBottom: insets.bottom + webBotPad + 32,
            },
          ]}
          bottomOffset={20}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepHeader}>
            <Pressable
              onPress={() => setStep((s) => (Math.max(0, s - 1) as 0 | 1 | 2 | 3))}
              hitSlop={12}
            >
              <Feather name="chevron-left" size={24} color={colors.foreground} />
            </Pressable>
            <View style={styles.stepDots}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        step >= i ? colors.primary : colors.secondary,
                      width: step === i ? 22 : 8,
                    },
                  ]}
                />
              ))}
            </View>
            <View style={{ width: 24 }} />
          </View>

          {step === 1 ? (
            <View style={styles.step}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                One real photo.
              </Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
                Just one — clear, recent, and you. This is what someone sees the
                moment you both reveal.
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
                {photoUri ? (
                  <View
                    style={[
                      styles.verifyChip,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Feather name="check" size={12} color={colors.primaryForeground} />
                    <Text
                      style={[
                        styles.verifyText,
                        { color: colors.primaryForeground },
                      ]}
                    >
                      Verified
                    </Text>
                  </View>
                ) : null}
              </Pressable>

              <PrimaryButton
                label="Continue"
                onPress={() => setStep(2)}
                disabled={!photoUri}
              />
            </View>
          ) : null}

          {step === 2 ? (
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
                onPress={() => setStep(3)}
                disabled={!name.trim()}
              />
            </View>
          ) : null}

          {step === 3 ? (
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
                    <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  welcome: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    alignItems: "center",
  },
  welcomeBeacon: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  welcomeLogo: {
    width: 180,
    height: 180,
    borderRadius: 36,
  },
  welcomeCopy: {
    alignItems: "center",
    paddingHorizontal: 8,
    marginBottom: 36,
  },
  brand: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 6,
    marginBottom: 18,
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 12,
  },
  heroSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
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
  dot: { height: 8, borderRadius: 4 },
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
  verifyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifyText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  field: { gap: 6 },
  fieldLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
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
