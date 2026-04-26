import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
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

import { AppHeader } from "@/components/AppHeader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SocialLinkRow } from "@/components/SocialLinkRow";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import type { SocialLinks, SocialPlatform } from "@/lib/types";

const SOCIAL_FIELDS: Array<{ key: SocialPlatform; label: string; placeholder: string }> = [
  { key: "instagram", label: "Instagram", placeholder: "your.handle" },
  { key: "facebook", label: "Facebook", placeholder: "your.name" },
  { key: "x", label: "X", placeholder: "your_handle" },
  { key: "tiktok", label: "TikTok", placeholder: "your.handle" },
  { key: "snapchat", label: "Snapchat", placeholder: "your.handle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "your-name" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, setProfile, resetAll } = useApp();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [photoUri, setPhotoUri] = useState<string | null>(profile?.photoUri ?? null);
  const [socials, setSocials] = useState<SocialLinks>(profile?.socials ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing && profile) {
      setName(profile.name);
      setBio(profile.bio);
      setPhotoUri(profile.photoUri);
      setSocials(profile.socials);
    }
  }, [profile, editing]);

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
    setEditing(false);
  };

  const handleSettings = () => {
    if (Platform.OS === "web") {
      if (confirm("Reset profile and rebuild encounters?")) {
        resetAll();
      }
      return;
    }
    Alert.alert("Settings", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset profile",
        style: "destructive",
        onPress: () => resetAll(),
      },
    ]);
  };

  const webBot = Platform.OS === "web" ? 34 : 0;

  const activeSocials = (Object.entries(socials) as [SocialPlatform, string][])
    .filter(([, h]) => h && h.trim());

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="My Profile"
        actions={[{ icon: "settings", onPress: handleSettings }]}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: insets.bottom + webBot + 120,
          paddingHorizontal: 24,
          gap: 20,
        }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.photoArea}>
          <Pressable
            onPress={editing ? pickPhoto : undefined}
            style={styles.photoTarget}
          >
            <View
              style={[
                styles.photoFrame,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
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
            {editing ? (
              <View
                style={[
                  styles.editChip,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Feather name="edit-2" size={12} color="#FFFFFF" />
              </View>
            ) : null}
          </Pressable>

          {editing ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.nameInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />
          ) : (
            <Text style={[styles.name, { color: colors.foreground }]}>
              {profile?.name ?? ""}
            </Text>
          )}

          {editing ? (
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="One sentence about you."
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={120}
              style={[
                styles.bioInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />
          ) : profile?.bio ? (
            <Text style={[styles.bio, { color: colors.mutedForeground }]}>
              {profile.bio}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.divider,
            { backgroundColor: colors.border },
          ]}
        />

        {editing ? (
          <View style={{ gap: 12 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Social handles
            </Text>
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
        ) : (
          <View>
            {activeSocials.length === 0 ? (
              <Text
                style={[
                  styles.emptySocials,
                  { color: colors.mutedForeground },
                ]}
              >
                No social handles added yet.
              </Text>
            ) : (
              activeSocials.map(([platform, handle]) => (
                <SocialLinkRow
                  key={platform}
                  platform={platform}
                  handle={handle}
                />
              ))
            )}
          </View>
        )}

        <View style={{ gap: 12, marginTop: 12 }}>
          {editing ? (
            <>
              <PrimaryButton
                label="Save changes"
                onPress={handleSave}
                loading={saving}
                disabled={!photoUri || !name.trim()}
              />
              <PrimaryButton
                label="Cancel"
                variant="ghost"
                onPress={() => setEditing(false)}
              />
            </>
          ) : (
            <PrimaryButton
              label="Edit Profile"
              variant="secondary"
              onPress={() => setEditing(true)}
            />
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  photoArea: { alignItems: "center", gap: 12 },
  photoTarget: { position: "relative" },
  photoFrame: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photoImg: { width: "100%", height: "100%" },
  editChip: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    marginTop: 4,
  },
  bio: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  nameInput: {
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 4,
    minWidth: 220,
    textAlign: "center",
  },
  bioInput: {
    minHeight: 70,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    minWidth: 280,
    textAlignVertical: "top",
  },
  divider: { height: 1 },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  emptySocials: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 16,
  },
  field: { gap: 6 },
  subLabel: { fontFamily: "Inter_400Regular", fontSize: 12 },
  input: {
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
  },
});
