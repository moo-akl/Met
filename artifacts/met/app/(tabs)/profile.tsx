import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
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

import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import type { SocialLinks, SocialPlatform } from "@/lib/types";

const SOCIAL_FIELDS: Array<{ key: SocialPlatform; label: string; placeholder: string }> = [
  { key: "instagram", label: "Instagram", placeholder: "your.handle" },
  { key: "x", label: "X", placeholder: "your_handle" },
  { key: "tiktok", label: "TikTok", placeholder: "your.handle" },
  { key: "snapchat", label: "Snapchat", placeholder: "your.handle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "your-name" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, encounters, setProfile, resetAll } = useApp();

  const [name, setName] = useState(profile?.name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [photoUri, setPhotoUri] = useState<string | null>(profile?.photoUri ?? null);
  const [socials, setSocials] = useState<SocialLinks>(profile?.socials ?? {});
  const [saving, setSaving] = useState(false);

  const stats = useMemo(
    () => ({
      total: encounters.length,
      connected: encounters.filter((e) => e.status === "connected").length,
      pending: encounters.filter(
        (e) => e.status === "request_sent" || e.status === "request_received",
      ).length,
    }),
    [encounters],
  );

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

  const handleSave = async () => {
    if (!photoUri || !name.trim() || !profile) return;
    setSaving(true);
    await setProfile({
      ...profile,
      name: name.trim(),
      bio: bio.trim(),
      photoUri,
      socials,
    });
    setSaving(false);
  };

  const handleReset = () => {
    if (Platform.OS === "web") {
      resetAll();
      return;
    }
    Alert.alert(
      "Reset profile?",
      "This will clear your profile and rebuild your encounters.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: () => resetAll() },
      ],
    );
  };

  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={{
          paddingTop: insets.top + webTop + 16,
          paddingBottom: insets.bottom + webBot + 120,
          paddingHorizontal: 20,
          gap: 24,
        }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.foreground }]}>You</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            What people see the moment you both reveal.
          </Text>
        </View>

        <View style={styles.photoRow}>
          <Pressable onPress={pickPhoto} style={styles.photoTarget}>
            <View
              style={[
                styles.photoFrame,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
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
                <Feather name="camera" size={28} color={colors.mutedForeground} />
              )}
            </View>
            <View style={styles.photoEditBadge}>
              <View
                style={[
                  styles.editChip,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Feather name="edit-2" size={11} color={colors.primaryForeground} />
              </View>
            </View>
          </Pressable>

          <View style={styles.statsCol}>
            <Stat value={stats.total} label="Encounters" colors={colors} />
            <Stat value={stats.connected} label="Connections" colors={colors} />
            <Stat value={stats.pending} label="Pending" colors={colors} />
          </View>
        </View>

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
            placeholder="One sentence about you."
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

        <View style={styles.section}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Social handles
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
        </View>

        <View style={{ gap: 12 }}>
          <PrimaryButton
            label="Save changes"
            onPress={handleSave}
            loading={saving}
            disabled={!photoUri || !name.trim()}
          />
          <PrimaryButton
            label="Reset profile"
            onPress={handleReset}
            variant="ghost"
          />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function Stat({
  value,
  label,
  colors,
}: {
  value: number;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  head: { gap: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28 },
  sub: { fontFamily: "Inter_400Regular", fontSize: 14 },
  photoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  photoTarget: { position: "relative" },
  photoFrame: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photoImg: { width: "100%", height: "100%" },
  photoEditBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
  },
  editChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  statsCol: { flex: 1, gap: 8 },
  stat: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 22 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 13 },
  field: { gap: 6 },
  section: { gap: 12 },
  fieldLabel: {
    fontFamily: "Inter_600SemiBold",
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
  inputMulti: { height: 96, paddingTop: 14, textAlignVertical: "top" },
  counter: { fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right" },
});
