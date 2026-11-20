import { Feather } from "@expo/vector-icons";
import {
  useGetVenueOwnerMeEvent,
  getGetVenueOwnerMeEventQueryKey,
  getGetVenueOwnerMeEventsQueryKey,
  useCreateVenueOwnerMeEvent,
  useUpdateVenueOwnerMeEvent,
  type VenueManagerEventResponse,
} from "@workspace/api-client-react";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateTimePicker } from "@/components/DateTimePicker";
import { EventWelcomeNoteEditor } from "@/components/EventWelcomeNoteEditor";
import { EventPhotoUploadStatus } from "@/components/EventPhotoUploadStatus";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { useApp } from "@/contexts/AppContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { useVenueOwner } from "@/hooks/useVenueOwner";
import {
  getActiveVenueBusinessHeaders,
} from "@/lib/api/client";
import {
  getInitialCommunityEventWebsiteUrl,
  normalizeCommunityEventWebsiteUrl,
} from "@/lib/communityEventWebsite";
import { useVenueEventPhotoUploads } from "@/lib/useVenueEventPhotoUploads";
import {
  resolveEventWelcomeNoteStyle,
} from "@/lib/eventWelcomeNoteStyle";
import type { EventWelcomeNoteStyle } from "@workspace/api-client-react";

type Mode = "create" | "edit";
type ReminderOffset = 24 | 2;
type ManagedVenueEvent = VenueManagerEventResponse["event"];

type Props = {
  mode: Mode;
};

function defaultStart(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(19, 0, 0, 0);
  return date;
}

export default function VenueOwnerEventForm({ mode }: Props) {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const eventId = Number(rawId);
  const validEventId =
    mode === "edit" && Number.isSafeInteger(eventId) && eventId > 0;
  const { authedUid } = useApp();
  const {
    profile,
    isLoading: ownerLoading,
    error: ownerError,
    branchError,
    activeBusinessId,
  } = useVenueOwner();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const router = useRouter();
  const headers = getActiveVenueBusinessHeaders();
  const queryClient = useQueryClient();
  const eventQuery = useGetVenueOwnerMeEvent(validEventId ? eventId : 0, {
    query: {
      enabled: mode === "edit" && validEventId && !!authedUid &&
        !ownerLoading && profile?.isApproved === true,
      queryKey: [
        ...getGetVenueOwnerMeEventQueryKey(validEventId ? eventId : 0),
        authedUid ?? "signed-out",
        activeBusinessId ?? "no-branch",
      ],
    },
    request: { headers },
  });
  const createEvent = useCreateVenueOwnerMeEvent({
    request: { headers },
  });
  const updateEvent = useUpdateVenueOwnerMeEvent({
    request: { headers },
  });
  const event = eventQuery.data?.event;
  const isLoading =
    ownerLoading || (mode === "edit" && validEventId && eventQuery.isLoading);
  const accessError = ownerError || branchError || profile?.isApproved !== true;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  if (!validEventId && mode === "edit") {
    return (
      <StateScreen
        title="Edit event"
        message="This event link is invalid."
        onBack={() => router.back()}
        colors={colors}
      />
    );
  }
  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <VenueOwnerHeader
          title={mode === "create" ? "New event" : "Edit event"}
          onBack={() => router.back()}
        />
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }
  if (accessError) {
    return (
      <StateScreen
        title={mode === "create" ? "New event" : "Edit event"}
        message="Your approved venue access could not be confirmed."
        onBack={() => router.back()}
        colors={colors}
      />
    );
  }
  if (mode === "edit" && eventQuery.isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <VenueOwnerHeader title="Edit event" onBack={() => router.back()} />
        <View style={styles.state}>
          <Feather name="alert-circle" size={28} color={colors.destructive} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>
            This event couldn't be loaded.
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="venue-owner-event-edit-retry"
            onPress={() => void eventQuery.refetch()}
            style={[styles.retryButton, { borderColor: colors.primary }]}
          >
            <Text style={[styles.retryButtonText, { color: colors.primary }]}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  if (mode === "edit" && !event) {
    return (
      <StateScreen
        title="Edit event"
        message="This event isn't available for the selected venue."
        onBack={() => router.back()}
        colors={colors}
      />
    );
  }

  return (
    <EventFormFields
      key={`${mode}:${event?.id ?? "new"}:${activeBusinessId ?? "legacy"}`}
      mode={mode}
      initial={event}
      authedUid={authedUid}
      colors={colors}
      isDark={isDark}
      insetsBottom={insets.bottom + webBottomInset}
      createEvent={createEvent}
      updateEvent={updateEvent}
      onBack={() => router.back()}
      onSaved={async (savedId) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getGetVenueOwnerMeEventsQueryKey(),
          }),
          savedId
            ? queryClient.invalidateQueries({
                queryKey: getGetVenueOwnerMeEventQueryKey(savedId),
              })
            : Promise.resolve(),
        ]);
        router.replace("/venue-owner/events" as never);
      }}
    />
  );
}

function StateScreen({
  title,
  message,
  onBack,
  colors,
}: {
  title: string;
  message: string;
  onBack: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <VenueOwnerHeader title={title} onBack={onBack} />
      <View style={styles.state}>
        <Feather name="alert-circle" size={28} color={colors.destructive} />
        <Text style={[styles.stateText, { color: colors.mutedForeground }]}>{message}</Text>
      </View>
    </View>
  );
}

function EventFormFields({
  mode,
  initial,
  authedUid,
  colors,
  isDark,
  insetsBottom,
  createEvent,
  updateEvent,
  onBack,
  onSaved,
}: {
  mode: Mode;
  initial?: ManagedVenueEvent;
  authedUid: string | null;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
  insetsBottom: number;
  createEvent: ReturnType<typeof useCreateVenueOwnerMeEvent>;
  updateEvent: ReturnType<typeof useUpdateVenueOwnerMeEvent>;
  onBack: () => void;
  onSaved: (eventId: number | null) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [welcomeNote, setWelcomeNote] = useState(initial?.welcomeNote ?? "");
  const [welcomeNoteStyle, setWelcomeNoteStyle] = useState<EventWelcomeNoteStyle>(
    () => resolveEventWelcomeNoteStyle(initial?.welcomeNoteStyle),
  );
  const initialGalleryUrls =
    initial?.galleryPhotos?.length
      ? initial.galleryPhotos
      : initial?.imageUrl
        ? [initial.imageUrl]
        : [];
  const photoUploads = useVenueEventPhotoUploads(authedUid, initialGalleryUrls);
  const galleryPhotos = photoUploads.uploadedUrls;
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(
    getInitialCommunityEventWebsiteUrl(initial?.websiteUrl),
  );
  const [publicEmail, setPublicEmail] = useState(initial?.publicEmail ?? "");
  const [startsAt, setStartsAt] = useState<Date>(
    initial ? new Date(initial.startsAt) : defaultStart(),
  );
  const [hasEndTime, setHasEndTime] = useState(Boolean(initial?.endsAt));
  const [endsAt, setEndsAt] = useState<Date>(
    initial?.endsAt
      ? new Date(initial.endsAt)
      : new Date(defaultStart().getTime() + 2 * 60 * 60 * 1000),
  );
  const [capacity, setCapacity] = useState(
    initial?.capacityLimit == null ? "" : String(initial.capacityLimit),
  );
  const [reminders, setReminders] = useState<ReminderOffset[]>(
    (initial?.reminderOffsetsHours ?? [24, 2]) as ReminderOffset[],
  );
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [visibility, setVisibility] = useState<"public" | "invite_only">(
    initial?.visibility === "invite_only" ? "invite_only" : "public",
  );
  const [isPickingPhotos, setIsPickingPhotos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const pickImages = async () => {
    if (!authedUid || isPickingPhotos) return;
    const remaining = 10 - photoUploads.photos.length;
    if (remaining <= 0) return;
    setIsPickingPhotos(true);
    setFormError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 1,
      });
      if (result.canceled || result.assets.length === 0) return;
      photoUploads.addPhotos(
        result.assets
          .slice(0, remaining)
          .map((asset) => ({ uri: asset.uri, width: asset.width })),
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not select event photos.",
      );
    } finally {
      setIsPickingPhotos(false);
    }
  };

  const toggleReminder = (hours: ReminderOffset) => {
    setReminders((current) =>
      current.includes(hours)
        ? current.filter((item) => item !== hours)
        : [...current, hours].sort((a, b) => b - a),
    );
  };

  const submit = async () => {
    setFormError("");
    if (photoUploads.hasPendingUploads) {
      setFormError("Wait for photo uploads to finish before saving.");
      return;
    }
    if (photoUploads.hasFailedUploads) {
      setFormError("Retry or remove failed photo uploads before saving.");
      return;
    }
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError("Add an event name.");
      return;
    }
    if (mode === "create" && startsAt.getTime() <= Date.now()) {
      setFormError("Choose a start time in the future.");
      return;
    }
    if (hasEndTime && endsAt.getTime() <= startsAt.getTime()) {
      setFormError("The end time must be after the start time.");
      return;
    }
    const capacityLimit = capacity.trim() ? Number(capacity) : null;
    if (
      capacityLimit !== null &&
      (!Number.isSafeInteger(capacityLimit) || capacityLimit < 1)
    ) {
      setFormError("Capacity must be a positive whole number.");
      return;
    }
    const data = {
      title: cleanTitle,
      description: description.trim() || null,
      welcomeNote: welcomeNote.trim() || null,
      welcomeNoteStyle,
      imageUrl: galleryPhotos[0] ?? null,
      galleryPhotos,
      contactPhone: contactPhone.trim() || null,
      websiteUrl: normalizeCommunityEventWebsiteUrl(websiteUrl),
      publicEmail: publicEmail.trim() || null,
      startsAt: startsAt.toISOString(),
      endsAt: hasEndTime ? endsAt.toISOString() : null,
      capacityLimit,
      reminderOffsetsHours: reminders,
      isPublished,
      visibility,
    };
    setSaving(true);
    try {
      if (mode === "create") {
        const response = await createEvent.mutateAsync({ data });
        await onSaved(response.event.id);
      } else if (initial) {
        const response = await updateEvent.mutateAsync({
          eventId: initial.id,
          data,
        });
        await onSaved(response.event.id);
      }
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "The event could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStart = (date: Date) => {
    setStartsAt(date);
    if (hasEndTime && endsAt <= date) {
      setEndsAt(new Date(date.getTime() + 2 * 60 * 60 * 1000));
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <VenueOwnerHeader
        title={mode === "create" ? "New event" : "Edit event"}
        onBack={onBack}
      />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.formContent,
          { paddingBottom: insetsBottom + 28 },
        ]}
        bottomOffset={72}
        keyboardDismissMode="on-drag"
      >
        <View style={styles.intro}>
          <Text style={[styles.heading, { color: colors.text }]}>
            {mode === "create" ? "Bring people together" : "Update your event"}
          </Text>
          <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
            {mode === "create"
              ? "Create an event guests can find and RSVP to in Met."
              : "Changes appear in Met for guests who can see this event."}
          </Text>
        </View>

        <FormSection title="Event details" colors={colors}>
          <FieldLabel label="Event name" required colors={colors} />
          <TextInput
            accessibilityLabel="Event name"
            testID="venue-event-title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Friday live music"
            placeholderTextColor={colors.mutedForeground}
            maxLength={120}
            returnKeyType="next"
            style={inputStyle}
          />
          <FieldLabel label="Description" colors={colors} />
          <TextInput
            accessibilityLabel="Event description"
            testID="venue-event-description"
            value={description}
            onChangeText={setDescription}
            placeholder="What should guests know?"
            placeholderTextColor={colors.mutedForeground}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            style={[inputStyle, styles.multiline]}
          />
          <EventWelcomeNoteEditor
            value={welcomeNote}
            onChangeText={setWelcomeNote}
            style={welcomeNoteStyle}
            onStyleChange={setWelcomeNoteStyle}
            colors={colors}
            testIDPrefix="venue-event-welcome-note"
          />
          <View style={styles.photosHeading}>
            <View style={styles.photosCopy}>
              <FieldLabel label="Photos" colors={colors} />
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                Add up to 10 event photos.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add event photos"
              testID="venue-event-add-photos"
              disabled={isPickingPhotos || photoUploads.photos.length >= 10}
              onPress={() => void pickImages()}
              style={({ pressed }) => [
                styles.addPhotoButton,
                { borderColor: colors.primary, opacity: pressed ? 0.65 : 1 },
              ]}
            >
              {isPickingPhotos ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="plus" size={16} color={colors.primary} />
              )}
              <Text style={[styles.addPhotoText, { color: colors.primary }]}>
                Add
              </Text>
            </Pressable>
          </View>
          {photoUploads.photos.length ? (
            <View style={styles.photoGrid}>
              {photoUploads.photos.map((photo, index) => (
                <View key={photo.id} style={styles.photoItem}>
                  <Image
                    testID={`venue-event-photo-image-${index}`}
                    source={{ uri: photo.localUri }}
                    style={styles.photo}
                  />
                  <EventPhotoUploadStatus
                    photo={photo}
                    testID={`venue-event-photo-${index}`}
                    onRetry={() => photoUploads.retryPhoto(photo.id)}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    testID={`venue-event-remove-photo-${index}`}
                    onPress={() => photoUploads.removePhoto(photo.id)}
                    style={[styles.removePhoto, { backgroundColor: colors.card }]}
                    hitSlop={6}
                  >
                    <Feather name="x" size={15} color={colors.text} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </FormSection>

        <FormSection title="Schedule" colors={colors}>
          <DateTimePicker
            label="Starts"
            mode="datetime"
            value={startsAt}
            onChange={updateStart}
            primaryColor={colors.primary}
            labelColor={colors.mutedForeground}
            rowBg={colors.card}
            valueColor={colors.text}
            chevronColor={colors.mutedForeground}
            isDark={isDark}
          />
          <View style={styles.optionalRow}>
            <View style={styles.optionalCopy}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>End time</Text>
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                Optional
              </Text>
            </View>
            <ToggleButton
              selected={hasEndTime}
              label={hasEndTime ? "Add end time" : "Add"}
              testID="venue-event-toggle-end-time"
              onPress={() => {
                if (!hasEndTime && endsAt <= startsAt) {
                  setEndsAt(new Date(startsAt.getTime() + 2 * 60 * 60 * 1000));
                }
                setHasEndTime((current) => !current);
              }}
              colors={colors}
            />
          </View>
          {hasEndTime ? (
            <DateTimePicker
              label="Ends"
              mode="datetime"
              value={endsAt}
              onChange={setEndsAt}
              primaryColor={colors.primary}
              labelColor={colors.mutedForeground}
              rowBg={colors.card}
              valueColor={colors.text}
              chevronColor={colors.mutedForeground}
              isDark={isDark}
              optional
            />
          ) : null}
        </FormSection>

        <FormSection title="Guest settings" colors={colors}>
          <FieldLabel label="Visibility" colors={colors} />
          <View style={[styles.segment, { backgroundColor: colors.muted }]}>
            <SegmentOption
              label="Public"
              selected={visibility === "public"}
              onPress={() => setVisibility("public")}
              colors={colors}
              testID="venue-event-visibility-public"
            />
            <SegmentOption
              label="Invitation only"
              selected={visibility === "invite_only"}
              onPress={() => setVisibility("invite_only")}
              colors={colors}
              testID="venue-event-visibility-invite"
            />
          </View>
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            {visibility === "public"
              ? "Published events appear in Met's Events feed."
              : "After publishing, share the invitation link from your event list."}
          </Text>

          <FieldLabel label="Capacity" colors={colors} />
          <TextInput
            accessibilityLabel="Event capacity"
            testID="venue-event-capacity"
            value={capacity}
            onChangeText={(value) => setCapacity(value.replace(/[^\d]/g, ""))}
            placeholder="Unlimited"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            maxLength={6}
            style={inputStyle}
          />

          <FieldLabel label="RSVP reminders" colors={colors} />
          <View style={styles.reminders}>
            {([24, 2] as const).map((hours) => {
              const selected = reminders.includes(hours);
              return (
                <Pressable
                  key={hours}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`Remind guests ${hours} hours before`}
                  testID={`venue-event-reminder-${hours}`}
                  onPress={() => toggleReminder(hours)}
                  style={[
                    styles.reminderChip,
                    {
                      backgroundColor: selected ? colors.primarySoft : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather
                    name={selected ? "check-circle" : "circle"}
                    size={16}
                    color={selected ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[styles.reminderText, { color: colors.text }]}>
                    {hours === 24 ? "24 hours before" : "2 hours before"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </FormSection>

        <FormSection title="Contact" colors={colors}>
          <FieldLabel label="Phone" colors={colors} />
          <TextInput
            accessibilityLabel="Public event phone"
            value={contactPhone}
            onChangeText={setContactPhone}
            placeholder="Optional"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            maxLength={40}
            style={inputStyle}
          />
          <FieldLabel label="Website" colors={colors} />
          <TextInput
            accessibilityLabel="Public event website"
            value={websiteUrl}
            onChangeText={setWebsiteUrl}
            placeholder="https://"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={2000}
            style={inputStyle}
          />
          <FieldLabel label="Public email" colors={colors} />
          <TextInput
            accessibilityLabel="Public event email"
            value={publicEmail}
            onChangeText={setPublicEmail}
            placeholder="Optional"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={254}
            style={inputStyle}
          />
        </FormSection>

        <FormSection title="Publishing" colors={colors}>
          <View style={styles.optionalRow}>
            <View style={styles.optionalCopy}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                {isPublished ? "Published" : "Draft"}
              </Text>
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                {isPublished
                  ? "Guests can find this event when it's public."
                  : "Only venue managers can see this draft."}
              </Text>
            </View>
            <ToggleButton
              selected={isPublished}
              label={isPublished ? "Published" : "Draft"}
              testID="venue-event-toggle-published"
              onPress={() => setIsPublished((current) => !current)}
              colors={colors}
            />
          </View>
        </FormSection>

        {formError ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>
            {formError}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === "create" ? "Create event" : "Save event changes"}
          testID="venue-event-save"
          disabled={
            saving ||
            photoUploads.hasPendingUploads ||
            photoUploads.hasFailedUploads
          }
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: colors.primary,
              opacity:
                saving ||
                photoUploads.hasPendingUploads ||
                photoUploads.hasFailedUploads
                  ? 0.55
                  : pressed
                    ? 0.8
                    : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="check" size={18} color={colors.primaryForeground} />
              <Text style={[styles.saveText, { color: colors.primaryForeground }]}>
                {mode === "create" ? "Create event" : "Save changes"}
              </Text>
            </>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          testID="venue-event-cancel"
          onPress={onBack}
          style={styles.cancelButton}
        >
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function FormSection({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function FieldLabel({
  label,
  required = false,
  colors,
}: {
  label: string;
  required?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Text style={[styles.fieldLabel, { color: colors.text }]}>
      {label}{required ? <Text style={{ color: colors.destructive }}> *</Text> : null}
    </Text>
  );
}

function ToggleButton({
  selected,
  label,
  testID,
  onPress,
  colors,
}: {
  selected: boolean;
  label: string;
  testID: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: selected }}
      testID={testID}
      onPress={onPress}
      style={[
        styles.toggle,
        {
          backgroundColor: selected ? colors.primarySoft : colors.muted,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.toggleText, { color: selected ? colors.primary : colors.mutedForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SegmentOption({
  label,
  selected,
  onPress,
  colors,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      testID={testID}
      onPress={onPress}
      style={[
        styles.segmentOption,
        { backgroundColor: selected ? colors.card : "transparent" },
      ]}
    >
      <Text style={[styles.segmentText, { color: selected ? colors.text : colors.mutedForeground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  stateText: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  retryButton: { minHeight: 42, borderWidth: 1, borderRadius: 999, justifyContent: "center", paddingHorizontal: 20 },
  retryButtonText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  formContent: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  intro: { paddingHorizontal: 2, gap: 5, marginBottom: 2 },
  heading: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subheading: { fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
  section: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 2 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginTop: 6 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { minHeight: 96, paddingTop: 12 },
  helper: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular" },
  photosHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4 },
  photosCopy: { flex: 1 },
  addPhotoButton: { minHeight: 36, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 5 },
  addPhotoText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  photoItem: { width: 88, height: 88 },
  photo: { width: "100%", height: "100%", borderRadius: 12 },
  removePhoto: { position: "absolute", top: 4, right: 4, width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  optionalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  optionalCopy: { flex: 1, gap: 3 },
  toggle: { minHeight: 38, minWidth: 76, borderWidth: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  toggleText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  segment: { flexDirection: "row", borderRadius: 14, padding: 4 },
  segmentOption: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 11, paddingHorizontal: 6 },
  segmentText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  reminders: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reminderChip: { minHeight: 38, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 },
  reminderText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  error: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_500Medium" },
  saveButton: { minHeight: 52, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 2 },
  saveText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  cancelButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
