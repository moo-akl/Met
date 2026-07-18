import { Feather } from "@expo/vector-icons";
import { Image } from "@/components/MetImage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { AppHeader } from "@/components/AppHeader";
import { SortableChips } from "@/components/SortableChips";
import { UserNameHeader } from "@/components/UserNameHeader";
import { TrustScoreBadge } from "@/components/TrustScoreBadge";
import { ReputationRadar, StarDisplay } from "@/components/ReputationRadar";
import { SubscriptionModal } from "@/components/SubscriptionModal";
import { MyQrSheet } from "@/components/MyQrSheet";
import { ShareCardSheet } from "@/components/ShareCardSheet";
import { PhotoVerifier } from "@/components/PhotoVerifier";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SettingsSheet } from "@/components/SettingsSheet";
import { SocialLinkRow } from "@/components/SocialLinkRow";
import { GoldShimmerBorder } from "@/components/GoldShimmerBorder";
import { PioneerModal, loadPioneerModalSeen } from "@/components/PioneerModal";
import { TrophyCase, type Trophy } from "@/components/TrophyCase";
import { PioneerDashboard } from "@/components/PioneerDashboard";
import { useApp } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { useVisibility } from "@/hooks/useVisibility";
import { findBlockedTerm } from "@/lib/contentFilter";
import { ALL_INTERESTS, MAX_INTERESTS } from "@/lib/interests";
import { useT } from "@/lib/i18n";
import { useSubscription } from "@/lib/revenuecat";
import { loadDragHintDismissed, MAX_EXTRA_PHOTOS_BY_TIER, saveDragHintDismissed } from "@/lib/storage";
import { api } from "@/lib/api/client";
import type { SocialLinks, SocialPlatform } from "@/lib/types";

const SOCIAL_FIELDS: Array<{ key: SocialPlatform; labelKey: string }> = [
  { key: "instagram", labelKey: "socials.instagram" },
  { key: "facebook", labelKey: "socials.facebook" },
  { key: "x", labelKey: "socials.x" },
  { key: "tiktok", labelKey: "socials.tiktok" },
  { key: "snapchat", labelKey: "socials.snapchat" },
  { key: "linkedin", labelKey: "socials.linkedin" },
];

type PhotoIntent = "main" | "extra";

export default function ProfileScreen() {
  const colors = useColors();
  const { isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, lang } = useT();
  const { profile, setProfile, authedUid } = useApp();
  const { isVisible, toggle: toggleVisibility } = useVisibility();
  const { tier } = useSubscription();

  const profileSteps = profile
    ? [
        !!(profile.name ?? "").trim(),
        !!profile.verified,
        (profile.bio ?? "").trim().length > 0,
        Object.keys(profile.socials ?? {}).length > 0,
        (profile.interests ?? []).length > 0,
      ]
    : [];
  const profileScore = profileSteps.filter(Boolean).length;
  const profileTotal = profileSteps.length;
  const profileIncomplete = !!profile && profileScore < profileTotal;

  const [editing, setEditing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [reviewSummary, setReviewSummary] = useState<{
    count: number;
    hasEnough: boolean;
    averageRating?: number;
    vibeTags?: Record<string, number>;
    communityStanding?: number;
  } | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(profile?.photoUri ?? null);
  const [socials, setSocials] = useState<SocialLinks>(profile?.socials ?? {});
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [interestSearch, setInterestSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDragHint, setShowDragHint] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [trophies, setTrophies] = useState<{
    placeId: string;
    placeName: string | null;
    month: string;
    rank: number;
    checkinCount: number;
  }[]>([]);

  const [myTrophies, setMyTrophies] = useState<Trophy[]>([]);
  const [myTrophiesLoading, setMyTrophiesLoading] = useState(false);

  const [isPioneer, setIsPioneer] = useState(profile?.isPioneer ?? false);
  const [prizeEligible, setPrizeEligible] = useState(false);
  const [pioneerModalVisible, setPioneerModalVisible] = useState(false);
  const [pioneerDashboardVisible, setPioneerDashboardVisible] = useState(false);

  // Photo verification overlay state. `pendingIntent` distinguishes a
  // main-photo replacement (handled in edit mode, awaits Save) from an extra
  // photo (writes to profile immediately on verified).
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<PhotoIntent>("main");

  // Bottom-sheet for tapping an existing extra photo (Set as main / Remove).
  const [photoMenuFor, setPhotoMenuFor] = useState<string | null>(null);

  const extraPhotos = profile?.extraPhotos ?? [];
  const maxExtras = MAX_EXTRA_PHOTOS_BY_TIER[tier];
  const canAddMore = extraPhotos.length < maxExtras;

  useEffect(() => {
    if (!editing && profile) {
      setName(profile.name);
      setBio(profile.bio);
      setPhotoUri(profile.photoUri);
      setSocials(profile.socials ?? {});
      setInterests(profile.interests ?? []);
      setInterestSearch("");
    }
  }, [profile, editing]);

  useEffect(() => {
    if (editing) {
      let cancelled = false;
      loadDragHintDismissed().then((dismissed) => {
        if (!cancelled) setShowDragHint(!dismissed);
      });
      return () => { cancelled = true; };
    }
  }, [editing]);

  useEffect(() => {
    if (!authedUid || !api.isConfigured()) return;
    let cancelled = false;
    api.getMyProfile({ uid: authedUid }).then((remote) => {
      if (cancelled) return;
      const pioneer = remote.isPioneer ?? false;
      setIsPioneer(pioneer);
      if (pioneer && profile) {
        void setProfile({ ...profile, isPioneer: true });
      }
      if (pioneer) {
        // Check prize eligibility via leaderboard
        api.getPioneerLeaderboard({ uid: authedUid }).then((lb) => {
          if (cancelled) return;
          const entry = lb.leaderboard.find((e) => e.uid === authedUid);
          setPrizeEligible(entry?.random_prize_eligibility ?? false);
        }).catch(() => {});
        // Auto-show modal if not seen before
        loadPioneerModalSeen().then((seen) => {
          if (!cancelled && !seen) setPioneerModalVisible(true);
        }).catch(() => {});
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedUid]);

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

  const pickPhoto = async (intent: PhotoIntent) => {
    // On Android the native UCrop "Done" button is hidden behind the gesture
    // navigation bar, so we skip the in-picker crop UI there.  The image is
    // displayed clipped to a circle/square via borderRadius on the view side.
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: Platform.OS === "ios",
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setPendingIntent(intent);
      setPendingPhotoUri(res.assets[0].uri);
    }
  };

  // Tap-on-photo while editing: if no photo, jump straight to picker. If a
  // photo already exists, present the user with replace/remove choices.
  // "Remove" only clears the local edit-form photo — Save remains disabled
  // until they pick a new one (a profile photo is always required).
  const handleMainPhotoPress = () => {
    if (!photoUri) {
      void pickPhoto("main");
      return;
    }
    Alert.alert(
      t("profile.photoMenuTitle"),
      undefined,
      [
        {
          text: t("profile.photoReplace"),
          onPress: () => void pickPhoto("main"),
        },
        {
          text: t("profile.photoRemove"),
          style: "destructive",
          onPress: () => setPhotoUri(null),
        },
        { text: t("common.cancel"), style: "cancel" },
      ],
      { cancelable: true },
    );
  };


  // Fetch monthly champion trophies earned by this user.
  useEffect(() => {
    if (!authedUid) return;
    api
      .getChampionBadges({ uid: authedUid }, authedUid)
      .then((badges) => setTrophies(badges))
      .catch(() => {});
  }, [authedUid]);

  // Fetch the new trophy collection (rank 1–3 monthly wins).
  useEffect(() => {
    if (!authedUid) return;
    setMyTrophiesLoading(true);
    api
      .getTrophies({ uid: authedUid })
      .then((data) => setMyTrophies(data.trophies))
      .catch(() => {})
      .finally(() => setMyTrophiesLoading(false));
  }, [authedUid]);

  // Fetch trust score for the current user.
  useEffect(() => {
    if (!authedUid) return;
    const ctrl = new AbortController();
    api
      .getUserStats({ uid: authedUid, signal: ctrl.signal }, authedUid)
      .then((s) => {
        setTrustScore(s.trustScore);
        setAverageRating(typeof s.averageRating === "number" ? s.averageRating : null);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [authedUid]);

  // Fetch review summary (category scores) for the current user.
  useEffect(() => {
    if (!authedUid) return;
    const ctrl = new AbortController();
    api
      .getReviewSummary({ uid: authedUid, signal: ctrl.signal }, authedUid)
      .then(setReviewSummary)
      .catch(() => {});
    return () => ctrl.abort();
  }, [authedUid]);

  const handlePhotoVerified = async (uri: string) => {
    if (pendingIntent === "main") {
      // Update local edit form; persists when the user hits Save.
      setPhotoUri(uri);
      setPendingPhotoUri(null);
      return;
    }
    // Extra photo — persist immediately so users can add several without an
    // explicit Save button context.
    if (profile) {
      const next = [...(profile.extraPhotos ?? []), uri].slice(0, maxExtras);
      await setProfile({ ...profile, extraPhotos: next });
    }
    setPendingPhotoUri(null);
  };

  const handleAddExtra = () => {
    if (tier === "free") {
      router.push("/paywall");
      return;
    }
    if (!canAddMore) return;
    pickPhoto("extra");
  };

  const handlePromoteExtra = async (uri: string) => {
    if (!profile) return;
    const oldMain = profile.photoUri;
    const nextExtras = (profile.extraPhotos ?? []).map((u) =>
      u === uri ? oldMain : u,
    );
    await setProfile({
      ...profile,
      photoUri: uri,
      extraPhotos: nextExtras,
      // Promoting an already-verified extra carries verification forward.
      verified: true,
      photoVerifiedAt: Date.now(),
    });
    setPhotoMenuFor(null);
  };

  const handleRemoveExtra = async (uri: string) => {
    if (!profile) return;
    const next = (profile.extraPhotos ?? []).filter((u) => u !== uri);
    await setProfile({ ...profile, extraPhotos: next });
    setPhotoMenuFor(null);
  };

  const handleSave = async () => {
    if (!photoUri || !name.trim() || !profile) return;
    // Content filter (App Store Review Guideline 1.2 — UGC must have a
    // method for filtering objectionable content). We block save when
    // either the display name or the bio contains a slur / harassment
    // term and surface a non-shaming message that points the user at
    // edit mode rather than auto-moderating silently.
    const offending =
      findBlockedTerm(name) ?? findBlockedTerm(bio);
    if (offending) {
      Alert.alert(
        "Please edit your profile",
        "Your name or bio contains language that isn't allowed on Met. Please remove it and try again.",
      );
      return;
    }
    setSaving(true);
    const photoChanged = photoUri !== profile.photoUri;

    let finalPhotoUri = photoUri;
    let photoVerification: { verified?: boolean; photoVerifiedAt?: number } = {};

    if (photoChanged) {
      if (!/^https?:\/\//i.test(photoUri)) {
        // Local file — upload to the server, which runs face detection.
        // Throws ApiError (with the server's message) on 4xx/5xx.
        try {
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
          const result = await api.uploadProfilePhoto(
            { uid: authedUid ?? "" },
            { base64, contentType },
          );
          finalPhotoUri = result.photoUrl;
          photoVerification = { verified: true, photoVerifiedAt: Date.now() };
        } catch (err: unknown) {
          setSaving(false);
          const msg =
            err instanceof Error
              ? err.message
              : "Photo upload failed. Please try again.";
          Alert.alert("Photo not accepted", msg);
          return;
        }
      } else {
        // Already an https:// URL (e.g. a promoted extra photo that was
        // previously uploaded and verified by the server).
        photoVerification = { verified: true, photoVerifiedAt: Date.now() };
      }
    }

    await setProfile({
      ...profile,
      name: name.trim(),
      bio: bio.trim(),
      photoUri: finalPhotoUri,
      socials,
      interests,
      ...photoVerification,
    });
    setSaving(false);
    setEditing(false);
  };

  const handleSettings = () => {
    setSettingsOpen(true);
  };

  const webBot = Platform.OS === "web" ? 34 : 0;

  const activeSocials = (
    Object.entries(socials ?? {}) as [SocialPlatform, string][]
  ).filter(([, h]) => h && h.trim());

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={t("appHeader.titleProfile")}
        visibility={{ isVisible, onToggle: toggleVisibility }}
        actions={[
          { icon: "share-2", onPress: () => setShareCardOpen(true) },
          { icon: "grid", onPress: () => setQrOpen(true) },
          { icon: "settings", onPress: handleSettings },
        ]}
      />
      {profile ? (
        <MyQrSheet
          visible={qrOpen}
          onClose={() => setQrOpen(false)}
          profile={profile}
        />
      ) : null}
      {profile ? (
        <ShareCardSheet
          visible={shareCardOpen}
          onClose={() => setShareCardOpen(false)}
          profile={profile}
        />
      ) : null}
      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
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
        {profileIncomplete ? (
          <View
            style={{
              backgroundColor: "#EFF6FF",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#3B82F6",
              padding: 14,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="user-check" size={16} color="#2563EB" />
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 13,
                  color: "#1E3A5F",
                  flex: 1,
                }}
              >
                {t("home.profileBannerTitle")}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 13,
                  color: "#2563EB",
                }}
              >
                {profileScore}/{profileTotal}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {profileSteps.map((done, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: done ? "#2563EB" : "#BFDBFE",
                  }}
                />
              ))}
            </View>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: "#1D4ED8",
                lineHeight: 17,
              }}
            >
              {!(profile?.name ?? "").trim()
                ? t("home.profileBannerNoName")
                : profile && !profile.verified && Object.keys(profile.socials ?? {}).length === 0
                  ? t("home.profileBannerBoth")
                  : profile && !profile.verified
                    ? t("home.profileBannerNoPhoto")
                    : !(profile?.bio ?? "").trim()
                      ? t("home.profileBannerNoBio")
                      : (profile?.interests ?? []).length === 0
                        ? t("home.profileBannerNoInterests")
                        : t("home.profileBannerNoSocials")}
            </Text>
          </View>
        ) : null}

        <View style={styles.photoArea}>
          <Pressable
            onPress={editing ? handleMainPhotoPress : undefined}
            style={styles.photoTarget}
          >
            {isPioneer && !editing && photoUri ? (
              <GoldShimmerBorder size={130}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photoImg}
                  contentFit="cover"
                />
              </GoldShimmerBorder>
            ) : (
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
            )}
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
              placeholder={t("profile.namePlaceholder")}
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
            <View style={{ alignItems: "center", gap: 6 }}>
              <UserNameHeader
                name={profile?.name ?? ""}
                nameStyle={[styles.name, { color: colors.foreground }]}
                isPioneer={isPioneer}
                trustScore={trustScore ?? 0}
                isSubscriber={tier !== "free"}
                hasPhoto={!!photoUri}
              />
              {trustScore !== null ? (
                <TrustScoreBadge score={trustScore} size="sm" showScore />
              ) : null}
              {averageRating !== null && averageRating > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <StarDisplay rating={averageRating} size={14} />
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground }}>
                    {averageRating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
              {isPioneer && (
                <Pressable
                  onPress={() => setPioneerModalVisible(true)}
                  style={styles.pioneerBadge}
                >
                  <Feather name="award" size={11} color="#D4AF37" />
                  <Text style={styles.pioneerBadgeText}>MET PIONEER</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setPioneerDashboardVisible(true)}
                style={styles.pioneerLeaderboardLink}
              >
                <Feather name="users" size={11} color="#D4AF37" style={{ marginRight: 3 }} />
                <Text style={styles.pioneerLeaderboardLinkText}>
                  {t("pioneer.leaderboardBtn")}
                </Text>
              </Pressable>
              {prizeEligible ? (
                <View style={styles.prizeBadge}>
                  <Feather name="gift" size={11} color="#FFD700" />
                  <Text style={styles.prizeBadgeText}>Eligible for Pioneer Monthly Reward</Text>
                </View>
              ) : null}
            </View>
          )}

          {editing ? (
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder={t("profile.bioPlaceholder")}
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

        <View style={styles.photosSection}>
          <View style={styles.photosHeader}>
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              {t("profile.photos")}
            </Text>
            <Text
              style={[styles.photosCount, { color: colors.mutedForeground }]}
            >
              {1 + extraPhotos.length}
              {tier === "free" ? "" : ` / ${1 + maxExtras}`}
            </Text>
          </View>
          <View style={styles.photosGrid}>
            <View
              style={[
                styles.photoTile,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.primary,
                },
              ]}
            >
              {profile?.photoUri ? (
                <Image
                  source={{ uri: profile.photoUri }}
                  style={styles.photoTileImg}
                  contentFit="cover"
                />
              ) : null}
              <View
                style={[
                  styles.photoTileBadge,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={styles.photoTileBadgeText}>{t("profile.photoMain")}</Text>
              </View>
            </View>

            {extraPhotos.map((uri) => (
              <Pressable
                key={uri}
                onPress={() => setPhotoMenuFor(uri)}
                style={({ pressed }) => [
                  styles.photoTile,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Image
                  source={{ uri }}
                  style={styles.photoTileImg}
                  contentFit="cover"
                />
              </Pressable>
            ))}

            {tier === "free" ? (
              <Pressable
                onPress={handleAddExtra}
                style={({ pressed }) => [
                  styles.photoTile,
                  styles.photoTileAdd,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="lock" size={20} color={colors.mutedForeground} />
                <Text
                  style={[
                    styles.photoTileLockText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {t("profile.photoLockPlus")}
                </Text>
              </Pressable>
            ) : canAddMore ? (
              <Pressable
                onPress={handleAddExtra}
                style={({ pressed }) => [
                  styles.photoTile,
                  styles.photoTileAdd,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="plus" size={22} color={colors.foreground} />
                <Text
                  style={[
                    styles.photoTileAddText,
                    { color: colors.foreground },
                  ]}
                >
                  {t("profile.photoAdd")}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {tier === "free" ? (
            <Text
              style={[styles.photosHint, { color: colors.mutedForeground }]}
            >
              {t("profile.photosHintFree")}
            </Text>
          ) : !canAddMore ? (
            <Text
              style={[styles.photosHint, { color: colors.mutedForeground }]}
            >
              {tier === "plus"
                ? t("profile.photosHintLimitPlus")
                : t("profile.photosHintLimitPro")}
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.divider,
            { backgroundColor: colors.border },
          ]}
        />


        {trophies.length > 0 ? (
          <View style={{ gap: 12, marginTop: 4 }}>
            {/* Header row with public/private toggle */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Image
                  source={require("@/assets/images/rewards_trophy.jpg")}
                  style={{ width: 32, height: 32, borderRadius: 6 }}
                  contentFit="cover"
                />
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  Rewards Collection
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Feather
                  name={(profile?.rewardsPublic ?? true) ? "eye" : "eye-off"}
                  size={13}
                  color={colors.mutedForeground}
                />
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>
                  {(profile?.rewardsPublic ?? true) ? "Public" : "Private"}
                </Text>
                <Switch
                  value={profile?.rewardsPublic ?? true}
                  onValueChange={async (val) => {
                    if (!profile) return;
                    await setProfile({ ...profile, rewardsPublic: val });
                  }}
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={colors.muted}
                />
              </View>
            </View>
            {trophies.map((trophy, i) => {
              const rank = trophy.rank as 1 | 2 | 3;
              const RANK_CONFIG = {
                1: {
                  bg: "#FFF8E1",
                  border: "#FFD700",
                  accent: "#B8860B",
                  label: "CHAMPION",
                  icon: "🏆",
                },
                2: {
                  bg: "#F5F5F5",
                  border: "#C0C0C0",
                  accent: "#707070",
                  label: "RUNNER-UP",
                  icon: "🥈",
                },
                3: {
                  bg: "#FBF0E8",
                  border: "#CD7F32",
                  accent: "#8B4513",
                  label: "3RD PLACE",
                  icon: "🥉",
                },
              } as const;
              const cfg = RANK_CONFIG[rank] ?? RANK_CONFIG[3];
              const monthLabel = new Date(trophy.month + "T00:00:00").toLocaleDateString(
                undefined,
                { month: "long", year: "numeric" },
              );
              return (
                <View
                  key={`${trophy.placeId}-${trophy.month}-${i}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: cfg.bg,
                    borderWidth: 1.5,
                    borderColor: cfg.border,
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <Text style={{ fontSize: 32 }}>{cfg.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: "Inter_700Bold",
                        fontSize: 10,
                        color: cfg.accent,
                        letterSpacing: 1,
                        marginBottom: 3,
                      }}
                    >
                      {cfg.label}
                    </Text>
                    <Text
                      style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: "#1a1a1a" }}
                      numberOfLines={1}
                    >
                      {trophy.placeName ?? trophy.placeId}
                    </Text>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: cfg.accent, marginTop: 2 }}>
                      {monthLabel} · {trophy.checkinCount} check-ins
                    </Text>
                  </View>
                  <Image
                    source={require("@/assets/images/rewards_trophy.jpg")}
                    style={{ width: 44, height: 44, borderRadius: 8, opacity: 0.85 }}
                    contentFit="cover"
                  />
                </View>
              );
            })}
          </View>
        ) : null}

        {__DEV__ ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              DEV: Tier override
            </Text>
            {(["free", "plus", "pro"] as const).map((t2) => (
              <Pressable
                key={t2}
                onPress={() =>
                  api
                    .devSetTier({ uid: authedUid ?? "" }, { tier: t2 })
                    .then(() => Alert.alert("Dev", `Tier set to ${t2}`))
                    .catch((e: unknown) =>
                      Alert.alert("Error", e instanceof Error ? e.message : String(e)),
                    )
                }
                style={[
                  styles.upgradeBanner,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
                  Set tier: {t2}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {editing ? (
          <View style={{ gap: 12 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              {t("profile.socialHandles")}
            </Text>
            {SOCIAL_FIELDS.map((f) => (
              <View key={f.key} style={styles.field}>
                <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>
                  {t(f.labelKey)}
                </Text>
                <TextInput
                  value={socials[f.key] ?? ""}
                  onChangeText={(v) =>
                    setSocials((prev) => ({ ...prev, [f.key]: v }))
                  }
                  placeholder={t("socials.placeholder")}
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
                {t("profile.noSocials")}
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

        {/* Interests section */}
        <View
          style={[styles.divider, { backgroundColor: colors.border }]}
        />
        {editing ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {t("encounter.interestsLabel")}
              </Text>
              <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>
                {interests.length}/{MAX_INTERESTS}
              </Text>
            </View>
            {interests.length > 0 ? (
              <SortableChips
                items={interests}
                onReorder={handleInterestsReorder}
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
                styles.searchInput,
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
          </View>
        ) : interests.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              {t("encounter.interestsLabel")}
            </Text>
            <View style={styles.interestsGrid}>
              {interests.map((tag) => (
                <View
                  key={tag}
                  style={[
                    styles.interestChip,
                    styles.interestChipReadOnly,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.interestChipText, { color: colors.foreground }]}>
                    {t(`interestLabels.${tag.toLowerCase()}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ gap: 12, marginTop: 12 }}>
          {editing ? (
            <>
              <PrimaryButton
                label={t("profile.saveChanges")}
                onPress={handleSave}
                loading={saving}
                disabled={!photoUri || !name.trim()}
              />
              <PrimaryButton
                label={t("profile.cancelBtn")}
                variant="ghost"
                onPress={() => setEditing(false)}
              />
            </>
          ) : (
            <PrimaryButton
              label={t("profile.editProfileBtn")}
              variant="secondary"
              onPress={() => setEditing(true)}
            />
          )}
        </View>

        {!editing ? (
          <>
            <TrophyCase trophies={myTrophies} loading={myTrophiesLoading} />
            <ReputationRadar summary={reviewSummary} />
            {tier === "free" ? (
              <Pressable
                onPress={() => setUpgradeModalVisible(true)}
                style={[
                  styles.upgradeBanner,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.upgradeBannerLeft}>
                  <Feather name="zap" size={18} color="#F5B700" />
                  <View style={{ gap: 1 }}>
                    <Text style={[styles.upgradeBannerTitle, { color: colors.foreground }]}>
                      {t("subscription.upgradeBanner")}
                    </Text>
                    <Text style={[styles.upgradeBannerSub, { color: colors.mutedForeground }]}>
                      {t("subscription.upgradeBannerSub")}
                    </Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name={isDark ? "moon" : "sun"} size={16} color={colors.primary} />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 15,
                color: colors.foreground,
              }}
            >
              {isDark ? "Dark Theme" : "Bright Theme"}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={colors.muted}
          />
        </View>
      </KeyboardAwareScrollView>

      <PhotoVerifier
        visible={pendingPhotoUri !== null}
        uri={pendingPhotoUri}
        onCancel={() => setPendingPhotoUri(null)}
        onVerified={handlePhotoVerified}
      />

      <ActionSheet
        visible={photoMenuFor !== null}
        onClose={() => setPhotoMenuFor(null)}
        title={t("profile.photoMenuTitle")}
        message={t("profile.photoMenuMessage")}
        actions={[
          {
            label: t("profile.photoSetMain"),
            onPress: () => {
              if (photoMenuFor) handlePromoteExtra(photoMenuFor);
            },
          },
          {
            label: t("profile.photoRemove"),
            destructive: true,
            onPress: () => {
              if (photoMenuFor) handleRemoveExtra(photoMenuFor);
            },
          },
        ]}
      />

      <SubscriptionModal
        visible={upgradeModalVisible}
        onDismiss={() => setUpgradeModalVisible(false)}
      />

      <PioneerModal
        visible={pioneerModalVisible}
        onClose={() => setPioneerModalVisible(false)}
      />

      <PioneerDashboard
        visible={pioneerDashboardVisible}
        onClose={() => setPioneerDashboardVisible(false)}
      />
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
  pioneerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(212,175,55,0.12)",
    borderWidth: 1,
    borderColor: "#D4AF37",
  },
  pioneerBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.5,
    color: "#D4AF37",
    textTransform: "uppercase",
  },
  pioneerLeaderboardLink: {
    paddingVertical: 2,
  },
  pioneerLeaderboardLinkText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "#D4AF37",
    opacity: 0.8,
  },
  prizeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(255,215,0,0.10)",
    borderWidth: 1,
    borderColor: "#FFD700",
  },
  prizeBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "#FFD700",
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
  photosSection: { gap: 10 },
  photosHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  photosCount: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  upgradeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  upgradeBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  upgradeBannerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  upgradeBannerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 1,
  },
  photoTile: {
    width: 78,
    height: 78,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  photoTileImg: { width: "100%", height: "100%" },
  photoTileBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  photoTileBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: "#FFFFFF",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  photoTileAdd: { gap: 4, borderStyle: "dashed" },
  photoTileAddText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  photoTileLockText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  photosHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
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
  searchInput: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  interestsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
  },
  interestChipReadOnly: {
    borderWidth: 1,
  },
  interestChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
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
