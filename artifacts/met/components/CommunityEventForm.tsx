import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateTimePicker } from "@/components/DateTimePicker";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";
import { prepareVenueEventImage } from "@/lib/venueEventImage";
import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  getGetEventDetailsQueryKey,
  getGetEventsFeedQueryKey,
  getSearchEventLocationsQueryOptions,
  useCreateCommunityEvent,
  useCreateCommunityEventInviteLink,
  useGetMyVerifiedExplorer,
  useUpdateCommunityEvent,
  type CommunityEventManageResponse,
  type EventFeedItem,
  type EventLocationSearchResult,
} from "@workspace/api-client-react";
import {
  nearestEventLocations,
  type Coordinates,
} from "@/lib/nearestEventLocations";

type Props = {
  mode: "create" | "edit";
  initial?: CommunityEventManageResponse;
  planKind?: "friends" | "hangout";
};

function defaultStart(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(19, 0, 0, 0);
  return date;
}

export default function CommunityEventForm({
  mode,
  initial,
  planKind = "friends",
}: Props) {
  const isEditing = mode === "edit" && Boolean(initial);
  const planMode = true;
  const isHangout = planKind === "hangout";
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useT();
  const { authedUid, encounters } = useApp();
  const { isDark } = useTheme();
  const explorerStatus = useGetMyVerifiedExplorer({
    query: { enabled: !!authedUid, staleTime: 60_000 },
  });
  const connections = useMemo(
    () => encounters.filter((encounter) => encounter.status === "connected"),
    [encounters],
  );

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial?.websiteUrl ?? "");
  const [publicEmail, setPublicEmail] = useState(initial?.publicEmail ?? "");
  const [imageUploading, setImageUploading] = useState(false);
  const [location, setLocation] = useState(initial?.location ?? "");
  const [startsAt, setStartsAt] = useState<Date>(
    initial ? new Date(initial.startsAt) : defaultStart(),
  );
  const visibility: "public" | "invite_only" = isHangout ? "public" : "invite_only";
  const [verifiedExplorersOnly, setVerifiedExplorersOnly] = useState(
    isHangout && (initial?.verifiedExplorersOnly ?? false),
  );
  const [inviteLinkEnabled, setInviteLinkEnabled] = useState(
    !isHangout && (initial?.inviteLinkEnabled ?? false),
  );
  const [requireInvitePasscode, setRequireInvitePasscode] = useState(
    !isHangout && (initial?.invitePasscodeRequired ?? false),
  );
  const [invitePasscode, setInvitePasscode] = useState("");
  const [inviteeUids, setInviteeUids] = useState<string[]>(
    initial?.inviteeUids ?? [],
  );
  const [selectedPlace, setSelectedPlace] = useState<EventLocationSearchResult | null>(() => {
    if (
      !initial?.locationPlaceId ||
      initial.latitude == null ||
      initial.longitude == null
    ) {
      return null;
    }
    return {
      placeId: initial.locationPlaceId,
      label: initial.location ?? "",
      name: initial.location ?? "",
      latitude: initial.latitude,
      longitude: initial.longitude,
    };
  });
  const [locationQuery, setLocationQuery] = useState("");
  const [deviceLocation, setDeviceLocation] = useState<Coordinates | null>(null);
  const locationLookupStarted = useRef(false);
  const [formError, setFormError] = useState("");

  const pickImage = async () => {
    if (!authedUid || imageUploading) return;
    setImageUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const prepared = await prepareVenueEventImage(asset.uri, asset.width);
      const { url } = await api.uploadVenueEventImage({ uid: authedUid }, prepared);
      setImageUrl(url);
      setFormError("");
    } catch (error) {
      setFormError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not upload the photo. Please try again.",
      );
    } finally {
      setImageUploading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setLocationQuery(location.trim()), 450);
    return () => clearTimeout(timer);
  }, [location]);

  const locationSearch = useQuery({
    ...getSearchEventLocationsQueryOptions({ q: locationQuery }),
    enabled: !selectedPlace && locationQuery.length >= 3,
    staleTime: 60_000,
  });
  const createInviteLink = useCreateCommunityEventInviteLink();

  const captureLocationForNearbySuggestions = async () => {
    if (deviceLocation || locationLookupStarted.current) return;
    locationLookupStarted.current = true;
    try {
      if (Platform.OS === "web") {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => setDeviceLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
          }),
          () => undefined,
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
        );
        return;
      }
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted) return;
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setDeviceLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      // Search remains available in provider order when location is unavailable.
    }
  };

  const updateFeedItem = async (event: EventFeedItem) => {
    queryClient.setQueryData<{ events: EventFeedItem[] }>(
      getGetEventsFeedQueryKey(),
      (cached) => {
        if (!cached) return cached;
        if (!isEditing) {
          return {
            events: [
              event,
              ...cached.events.filter(
                (item) => item.eventType !== event.eventType || item.id !== event.id,
              ),
            ],
          };
        }
        return {
          events: cached.events.map((item) =>
            item.eventType === event.eventType && item.id === event.id ? event : item,
          ),
        };
      },
    );
    await queryClient.invalidateQueries({ queryKey: getGetEventsFeedQueryKey() });
    if (isEditing && initial) {
      await queryClient.invalidateQueries({
        queryKey: getGetEventDetailsQueryKey("member", initial.id),
      });
    }
    if (
      !isEditing &&
      event.eventType === "member" &&
      visibility === "invite_only" &&
      inviteLinkEnabled
    ) {
      try {
        const link = await createInviteLink.mutateAsync({ eventId: event.id });
        await Share.share({
          message: `${event.title}\n${link.url}`,
          url: link.url,
          title: event.title,
        });
        const passcode = invitePasscode.trim();
        if (requireInvitePasscode && passcode) {
          Alert.alert(
            t("tabs.events.passcodeProtected"),
            passcode,
            [
              {
                text: t("tabs.events.copyPasscode"),
                onPress: () => void Clipboard.setStringAsync(passcode),
              },
              { text: t("common.done") },
            ],
          );
        }
      } catch {
        Alert.alert(
          t("common.error"),
          t("tabs.events.inviteLinkShareFailed"),
        );
      }
    }
    if (isEditing) router.back();
    else if (planMode) {
      router.replace(`/event-chat/${event.id}` as never);
    } else {
      router.replace("/(tabs)/events" as never);
    }
  };

  const createEvent = useCreateCommunityEvent({
    mutation: {
      onSuccess: updateFeedItem,
      onError: (error) => {
        setFormError(error instanceof Error
          ? error.message
          : isHangout
            ? t("tabs.events.hangoutCreateError")
            : t("common.error"));
      },
    },
  });
  const updateEvent = useUpdateCommunityEvent({
    mutation: {
      onSuccess: updateFeedItem,
      onError: (error) => {
        setFormError(error instanceof Error
          ? error.message
          : isHangout
            ? t("tabs.events.hangoutSaveError")
            : t("common.error"));
      },
    },
  });

  const toggleInvitee = (uid: string) => {
    setInviteeUids((current) =>
      current.includes(uid)
        ? current.filter((item) => item !== uid)
        : [...current, uid],
    );
  };

  const submit = () => {
    setFormError("");
    if (imageUploading) return;
    if (!title.trim()) {
        setFormError(t(isHangout ? "tabs.events.hangoutNameRequired" : "tabs.events.eventNameRequired"));
      return;
    }
    if (isHangout && !location.trim()) {
      setFormError(t("tabs.events.planLocationRequired"));
      return;
    }
    const unchangedLegacyPlanLocation = Boolean(
      isEditing &&
      initial &&
      !initial.locationPlaceId &&
      initial.latitude == null &&
      initial.longitude == null &&
      initial.location === (location.trim() || null),
    );
    if (isHangout && !selectedPlace && !unchangedLegacyPlanLocation) {
      setFormError(t("tabs.events.planPlaceSelectionRequired"));
      return;
    }
    if (!Number.isFinite(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setFormError(t("tabs.events.eventDateMustBeFuture"));
      return;
    }
    if (
      visibility === "invite_only" &&
      inviteeUids.length === 0 &&
      !inviteLinkEnabled
    ) {
      setFormError(t("tabs.events.friendPlanInviteRequired"));
      return;
    }
    if (
      inviteLinkEnabled &&
      requireInvitePasscode &&
      !invitePasscode.trim() &&
      !(isEditing && initial?.invitePasscodeRequired)
    ) {
      setFormError(t("tabs.events.passcodeRequired"));
      return;
    }
    if (
      inviteLinkEnabled &&
      requireInvitePasscode &&
      invitePasscode.trim().length > 0 &&
      invitePasscode.trim().length < 6
    ) {
      setFormError(t("tabs.events.passcodeTooShort"));
      return;
    }
    if (invitePasscode.trim().length > 64) {
      setFormError(t("tabs.events.passcodeTooLong"));
      return;
    }

    const data = {
      title: title.trim(),
      description: description.trim() || null,
      imageUrl: imageUrl.trim() || null,
      contactPhone: contactPhone.trim() || null,
      websiteUrl: websiteUrl.trim()
        ? (/^https?:\/\//i.test(websiteUrl.trim()) ? websiteUrl.trim() : `https://${websiteUrl.trim()}`)
        : null,
      publicEmail: publicEmail.trim() || null,
      startsAt: startsAt.toISOString(),
      endsAt: initial?.endsAt ?? null,
      location: location.trim() || null,
      locationPlaceId: selectedPlace?.placeId ?? null,
      latitude: selectedPlace?.latitude ?? null,
      longitude: selectedPlace?.longitude ?? null,
      visibility,
      verifiedExplorersOnly,
      inviteeUids: visibility === "invite_only" ? inviteeUids : [],
      inviteLinkEnabled: visibility === "invite_only" && inviteLinkEnabled,
      ...(!isEditing ? { joinApprovalRequired: isHangout } : {}),
      invitePasscode:
        visibility !== "invite_only" || !inviteLinkEnabled || !requireInvitePasscode
          ? null
          : invitePasscode.trim() ||
            (isEditing && initial?.invitePasscodeRequired ? undefined : null),
    };

    if (isEditing && initial) {
      updateEvent.mutate({ eventId: initial.id, data });
    } else {
      createEvent.mutate({ data });
    }
  };

  const isPending = createEvent.isPending || updateEvent.isPending;
  const matchingLocations = nearestEventLocations(
    locationSearch.data?.locations ?? [],
    deviceLocation,
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, borderBottomColor: colors.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isEditing
            ? planMode
              ? t(isHangout ? "tabs.events.editHangout" : "tabs.events.editEvent")
              : t("tabs.events.editEvent")
            : planMode
              ? t(isHangout ? "tabs.events.createHangout" : "plans.make")
              : t("tabs.events.create")}
        </Text>
        <View style={styles.back} />
      </View>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { color: colors.text }]}>
          {t(isHangout ? "tabs.events.hangoutName" : "tabs.events.eventName")}
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t(isHangout ? "tabs.events.hangoutName" : "tabs.events.eventName")}
          placeholderTextColor={colors.mutedForeground}
          maxLength={120}
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
          ]}
        />
        {isHangout ? (
          <>
            <Text style={[styles.label, { color: colors.text }]}>
              {t("tabs.events.hangoutCoverPhotoOptional")}
            </Text>
            {imageUrl ? (
              <View style={{ gap: 8 }}>
                <Image
                  source={{ uri: imageUrl }}
                  style={{ width: "100%", height: 180, borderRadius: 14 }}
                  resizeMode="cover"
                  accessibilityLabel={t("tabs.events.hangoutCoverPhotoOptional")}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("tabs.events.removeHangoutPhoto")}
                  onPress={() => setImageUrl("")}
                  style={{ alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 2 }}
                >
                  <Text style={{ color: colors.destructive, fontFamily: "Inter_600SemiBold" }}>
                    {t("tabs.events.removeHangoutPhoto")}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("tabs.events.addHangoutPhoto")}
                testID="button-add-hangout-cover"
                disabled={imageUploading}
                onPress={() => void pickImage()}
                style={({ pressed }) => [{
                  minHeight: 76,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderRadius: 14,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 9,
                  opacity: pressed || imageUploading ? 0.7 : 1,
                }]}
              >
                {imageUploading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Feather name="image" size={18} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
                      {t("tabs.events.addHangoutPhoto")}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </>
        ) : null}
        {planMode ? (
          <View
            style={[
              styles.planIntro,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather name="users" size={18} color={colors.primary} />
            <View style={styles.planIntroCopy}>
              <Text style={[styles.planIntroTitle, { color: colors.text }]}>
                {t(isHangout ? "tabs.events.quickPlanHint" : "tabs.events.friendPlanTitle")}
              </Text>
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                {t(isHangout ? "tabs.events.joinApprovalHint" : "tabs.events.friendPlanHint")}
              </Text>
            </View>
          </View>
        ) : null}
        {isHangout && explorerStatus.data?.isVerifiedExplorer ? (
          <View
            style={[
              styles.inviteLinkCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="explorer-only-plan-toggle"
          >
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: verifiedExplorersOnly }}
              onPress={() => setVerifiedExplorersOnly((current) => !current)}
              style={styles.inviteLinkRow}
            >
              <View style={styles.inviteLinkCopy}>
                <Text style={[styles.inviteLinkTitle, { color: colors.text }]}>
                  {t(planMode ? "verifiedExplorer.hangoutOnly" : "verifiedExplorer.eventOnly")}
                </Text>
                <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                  {t(planMode ? "verifiedExplorer.hangoutOnlyHint" : "verifiedExplorer.eventOnlyHint")}
                </Text>
              </View>
              <Feather
                name={verifiedExplorersOnly ? "check-square" : "square"}
                size={21}
                color={verifiedExplorersOnly ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
          </View>
        ) : null}

        {!planMode ? (
          <>
        <Text style={[styles.label, { color: colors.text }]}>
          {t("tabs.events.eventPhotoOptional")}
        </Text>
        {imageUrl ? (
          <View style={{ gap: 8 }}>
            <Image
              source={{ uri: imageUrl }}
              style={{ width: "100%", height: 180, borderRadius: 14 }}
              resizeMode="cover"
              accessibilityLabel={t("tabs.events.eventPhotoOptional")}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("tabs.events.removeEventPhoto")}
              onPress={() => setImageUrl("")}
              style={{ alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 2 }}
            >
              <Text style={{ color: colors.destructive, fontFamily: "Inter_600SemiBold" }}>
                {t("tabs.events.removeEventPhoto")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("tabs.events.addEventPhoto")}
            disabled={imageUploading}
            onPress={() => void pickImage()}
            style={({ pressed }) => [
              {
                minHeight: 76,
                borderWidth: 1,
                borderStyle: "dashed",
                borderRadius: 14,
                borderColor: colors.border,
                backgroundColor: colors.card,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 9,
                opacity: pressed || imageUploading ? 0.7 : 1,
              },
            ]}
          >
            {imageUploading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Feather name="image" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
                  {t("tabs.events.addEventPhoto")}
                </Text>
              </>
            )}
          </Pressable>
        )}
        <Text style={[styles.label, { color: colors.text }]}>
          {t("tabs.events.contactPhoneOptional")}
        </Text>
        <TextInput
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="+1 555 123 4567"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="phone-pad"
          maxLength={40}
          style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
        />
        <Text style={[styles.label, { color: colors.text }]}>
          {t("tabs.events.websiteOptional")}
        </Text>
        <TextInput
          value={websiteUrl}
          onChangeText={setWebsiteUrl}
          placeholder="https://example.com"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="url"
          autoCapitalize="none"
          maxLength={2000}
          style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
        />
        <Text style={[styles.label, { color: colors.text }]}>
          {t("tabs.events.contactEmailOptional")}
        </Text>
        <TextInput
          value={publicEmail}
          onChangeText={setPublicEmail}
          placeholder="hello@example.com"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={254}
          style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
        />
          </>
        ) : null}
        <Text style={[styles.label, { color: colors.text }]}>
          {t(isHangout ? "tabs.events.hangoutDescription" : "tabs.events.details")}
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t(isHangout ? "tabs.events.hangoutDescription" : "tabs.events.details")}
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={2000}
          style={[
            styles.input,
            styles.multiline,
            { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
          ]}
        />
        <Text style={[styles.label, { color: colors.text }]}>
          {t("tabs.events.location")}
        </Text>
        <TextInput
          value={location}
          onChangeText={(value) => {
            setLocation(value);
            setSelectedPlace(null);
          }}
          onFocus={() => void captureLocationForNearbySuggestions()}
          placeholder={t(
            isHangout
              ? "tabs.events.planLocationSearchHint"
              : "tabs.events.locationSearchHint",
          )}
          placeholderTextColor={colors.mutedForeground}
          maxLength={200}
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.card, borderColor: colors.border },
          ]}
          accessibilityLabel={t("tabs.events.location")}
        />
        {selectedPlace ? (
          <View style={styles.selectedLocation}>
            <Feather name="check-circle" size={15} color={colors.primary} />
            <Text style={[styles.selectedLocationText, { color: colors.primary }]}>
              {selectedPlace.name}
            </Text>
          </View>
        ) : null}
        {!selectedPlace && locationQuery.length >= 3 ? (
          <View
            style={[
              styles.locationResults,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {locationSearch.isFetching ? (
              <View style={styles.searchStatus}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                  {t("tabs.events.searchingPlaces")}
                </Text>
              </View>
            ) : null}
            {!locationSearch.isFetching && matchingLocations.length === 0 ? (
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                {t(
                  planMode
                    ? "tabs.events.planPlaceSelectionRequired"
                    : "tabs.events.noPlaceResults",
                )}
              </Text>
            ) : null}
            {matchingLocations.map((place) => (
              <Pressable
                key={place.placeId}
                accessibilityRole="button"
                onPress={() => {
                  setLocation(place.label);
                  setSelectedPlace(place);
                  setLocationQuery("");
                }}
                style={[styles.locationResult, { borderBottomColor: colors.border }]}
              >
                <Feather name="map-pin" size={16} color={colors.primary} />
                <View style={styles.locationResultCopy}>
                  <Text style={[styles.locationResultName, { color: colors.text }]}>
                    {place.name}
                  </Text>
                  <Text style={[styles.locationResultLabel, { color: colors.mutedForeground }]}>
                    {place.label}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Text style={[styles.attribution, { color: colors.mutedForeground }]}>
              © OpenStreetMap contributors
            </Text>
          </View>
        ) : (
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            {t(
              isHangout
                ? "tabs.events.planPlaceSelectionRequired"
                : "tabs.events.locationSearchHelper",
            )}
          </Text>
        )}

        <DateTimePicker
          label={t("tabs.events.starts")}
          mode="datetime"
          value={startsAt}
          onChange={setStartsAt}
          timePickerPresentation={isHangout ? "wheels" : "sheet"}
          primaryColor={colors.primary}
          labelColor={colors.mutedForeground}
          rowBg={colors.card}
          isDark={isDark}
        />

        {!isHangout ? (
          <>
            <View style={styles.matchesSection}>
            <Text style={[styles.label, { color: colors.text }]}>
              {t("tabs.events.inviteMatches")}
            </Text>
            {connections.length === 0 ? (
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                {t("tabs.events.noMatches")}
              </Text>
            ) : (
              connections.map((connection) => {
                const selected = inviteeUids.includes(connection.id);
                return (
                  <Pressable
                    key={connection.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleInvitee(connection.id)}
                    style={[styles.matchRow, { borderBottomColor: colors.border }]}
                  >
                    <Text style={[styles.matchName, { color: colors.text }]}>
                      {connection.realName}
                    </Text>
                    <Feather
                      name={selected ? "check-square" : "square"}
                      size={21}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                  </Pressable>
                );
              })
            )}
            </View>

          <View
            style={[
              styles.inviteLinkCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: inviteLinkEnabled }}
              onPress={() => setInviteLinkEnabled((current) => !current)}
              style={styles.inviteLinkRow}
            >
              <View style={styles.inviteLinkCopy}>
                <Text style={[styles.inviteLinkTitle, { color: colors.text }]}>
                  {t("tabs.events.inviteLinkTitle")}
                </Text>
                <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                  {t("tabs.events.inviteLinkDescription")}
                </Text>
              </View>
              <Feather
                name={inviteLinkEnabled ? "check-square" : "square"}
                size={21}
                color={inviteLinkEnabled ? colors.primary : colors.mutedForeground}
              />
            </Pressable>
            {inviteLinkEnabled ? (
              <View style={styles.passcodeSection}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: requireInvitePasscode }}
                  onPress={() => setRequireInvitePasscode((current) => !current)}
                  style={styles.inviteLinkRow}
                >
                  <Text style={[styles.matchName, { color: colors.text }]}>
                    {t("tabs.events.passcodeToggle")}
                  </Text>
                  <Feather
                    name={requireInvitePasscode ? "check-square" : "square"}
                    size={21}
                    color={requireInvitePasscode ? colors.primary : colors.mutedForeground}
                  />
                </Pressable>
                {requireInvitePasscode ? (
                  <>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={64}
                      onChangeText={setInvitePasscode}
                      placeholder={
                        isEditing && initial?.invitePasscodeRequired
                          ? t("tabs.events.passcodeKeepPlaceholder")
                          : t("tabs.events.passcodePlaceholder")
                      }
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          borderColor: colors.border,
                          backgroundColor: colors.background,
                        },
                      ]}
                      value={invitePasscode}
                    />
                    <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                      {t("tabs.events.passcodeShareReminder")}
                    </Text>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
          </>
        ) : null}

        {formError ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
            {formError}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={isPending || imageUploading}
          onPress={submit}
          style={[
            styles.submit,
            { backgroundColor: colors.primary, opacity: isPending ? 0.7 : 1 },
          ]}
        >
          {isPending ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
              {isEditing
                ? t("tabs.events.saveChanges")
                : planMode
                  ? t(isHangout ? "tabs.events.createHangout" : "plans.make")
                  : t("tabs.events.submit")}
            </Text>
          )}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  scroll: { flex: 1 },
  form: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18, gap: 12 },
  planIntro: { borderWidth: 1, borderTopLeftRadius: 28, borderBottomRightRadius: 20, padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12, marginVertical: 3 },
  planIntroCopy: { flex: 1 },
  planIntroTitle: { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  label: { fontSize: 14, fontWeight: "700", marginTop: 6 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15 },
  multiline: { minHeight: 104, textAlignVertical: "top", borderTopLeftRadius: 22, borderBottomRightRadius: 22 },
  selectedLocation: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 2 },
  selectedLocationText: { fontSize: 12, fontWeight: "600", flex: 1 },
  locationResults: { borderWidth: 1, borderTopLeftRadius: 24, borderBottomRightRadius: 20, overflow: "hidden" },
  searchStatus: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  locationResult: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locationResultCopy: { flex: 1 },
  locationResultName: { fontSize: 14, fontWeight: "600" },
  locationResultLabel: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  attribution: { fontSize: 10, paddingHorizontal: 12, paddingVertical: 8 },
  visibilityRow: { gap: 10 },
  visibilityOption: { borderWidth: 1, borderTopLeftRadius: 24, borderBottomRightRadius: 18, padding: 15 },
  visibilityTitle: { fontSize: 14, fontWeight: "700" },
  visibilityText: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  matchesSection: { marginTop: 6 },
  inviteLinkCard: { borderWidth: 1, borderTopLeftRadius: 26, borderBottomRightRadius: 20, padding: 15, gap: 14, marginTop: 4 },
  inviteLinkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  inviteLinkCopy: { flex: 1, gap: 4 },
  inviteLinkTitle: { fontSize: 14, fontWeight: "700" },
  passcodeSection: { gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#D8E0DA" },
  helper: { fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  matchRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  matchName: { fontSize: 14, fontWeight: "500" },
  error: { fontSize: 13, fontWeight: "600", marginTop: 6 },
  submit: { minHeight: 52, borderTopLeftRadius: 28, borderBottomRightRadius: 28, alignItems: "center", justifyContent: "center", marginTop: 12 },
  submitText: { fontSize: 15, fontWeight: "700" },
});
