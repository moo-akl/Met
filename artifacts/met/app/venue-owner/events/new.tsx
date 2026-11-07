/**
 * New Venue Event screen
 *
 * Aurora (dark):  deep #0A0518 bg, translucent glass inputs, white typography.
 * Signal (light): #FAFAF8 editorial bg, clean inputs, #0D0D0D typography.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import { VenueOwnerHeader } from "@/components/VenueOwnerHeader";
import { DateTimePicker } from "@/components/DateTimePicker";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  useCreateVenueOwnerEventInviteLink,
  useGetVenueOwnerMeGuests,
} from "@workspace/api-client-react";
import { prepareVenueEventImage } from "@/lib/venueEventImage";

function defaultStartsAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  return d;
}

export default function NewVenueEventScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [startsAt, setStartsAt] = useState<Date>(defaultStartsAt);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [capacityLimit, setCapacityLimit] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [visibility, setVisibility] = useState<"public" | "invite_only">("public");
  const [inviteeUids, setInviteeUids] = useState<string[]>([]);
  const [requireInvitePasscode, setRequireInvitePasscode] = useState(false);
  const [invitePasscode, setInvitePasscode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createInviteLink = useCreateVenueOwnerEventInviteLink();
  const guestsQuery = useGetVenueOwnerMeGuests(
    { period: "all", limit: 100, offset: 0 },
    { query: { enabled: visibility === "invite_only", staleTime: 30_000 } },
  );

  const vBg = colors.background;
  const vInput = colors.card;
  const vText = colors.text;
  const vMuted = colors.mutedForeground;
  const vLabel = colors.mutedForeground;
  const vPlaceholder = colors.mutedForeground;
  const vToggleLabel = colors.text;
  const vDisabledBtn = colors.muted;
  const accent = colors.primary;

  function handleEndsAtChange(date: Date) {
    setEndsAt(date);
  }

  const pickImage = async () => {
    setImageUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const image = await prepareVenueEventImage(asset.uri, asset.width);
      const { url } = await api.uploadVenueEventImage(
        { uid: authedUid ?? "" },
        image,
      );
      setImageUrl(url);
    } catch (error) {
      Alert.alert(
        "Upload failed",
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Could not upload image. Please try again.",
      );
    } finally {
      setImageUploading(false);
    }
  };

  const endTimeInvalid = endsAt !== null && endsAt.getTime() <= startsAt.getTime();
  const canSubmit = !endTimeInvalid &&
    title.trim().length > 0 &&
    (visibility !== "invite_only" || !requireInvitePasscode ||
      invitePasscode.trim().length >= 6);

  const handleCreate = async () => {
    if (!authedUid || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const { event } = await api.createVenueEvent({ uid: authedUid }, {
        title: title.trim(),
        description: description.trim() || null,
        imageUrl: imageUrl.trim() || null,
        contactPhone: contactPhone.trim() || null,
        websiteUrl: websiteUrl.trim()
          ? (/^https?:\/\//i.test(websiteUrl.trim()) ? websiteUrl.trim() : `https://${websiteUrl.trim()}`)
          : null,
        publicEmail: publicEmail.trim() || null,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt ? endsAt.toISOString() : null,
        capacityLimit: capacityLimit.trim() ? parseInt(capacityLimit, 10) : null,
        isPublished,
        visibility,
        inviteeUids: visibility === "invite_only" ? inviteeUids : [],
        invitePasscode: visibility === "invite_only" && requireInvitePasscode
          ? invitePasscode.trim()
          : null,
      });
      if (visibility === "invite_only" && isPublished) {
        try {
          const link = await createInviteLink.mutateAsync({ eventId: event.id });
          await Share.share({
            message: `${title.trim()}\n${link.url}`,
            url: link.url,
            title: title.trim(),
          });
          if (link.passcodeRequired) {
            Alert.alert(
              "Passcode protected",
              "Share this passcode separately from the invitation link.",
              [
                {
                  text: "Copy passcode",
                  onPress: () => void Clipboard.setStringAsync(invitePasscode.trim()),
                },
                { text: "Done" },
              ],
            );
          }
        } catch (shareError) {
          Alert.alert(
            "Event created",
            shareError instanceof Error
              ? `The event is saved, but the invitation link could not be shared: ${shareError.message}`
              : "The event is saved, but the invitation link could not be shared.",
          );
        }
      } else if (visibility === "invite_only") {
        Alert.alert("Event saved as a draft", "Publish it before sharing the invitation link.");
      } else {
        Alert.alert("Event created!");
      }
      router.back();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  const endsAtValue = endsAt ?? new Date(startsAt.getTime() + 3 * 60 * 60 * 1000);

  return (
    <View style={[styles.root, { backgroundColor: vBg }]}>
      <VenueOwnerHeader title="New Event" onBack={() => router.back()} backLabel="Cancel" />

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Title *" value={title} onChangeText={setTitle} placeholder="Friday Night Quiz"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />
        <Field label="Description" value={description} onChangeText={setDescription}
          placeholder="Details about the event..." multiline numberOfLines={3}
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        <Field label="Contact phone (optional)" value={contactPhone} onChangeText={setContactPhone}
          placeholder="+1 555 123 4567" keyboardType="phone-pad" autoCapitalize="none"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />
        <Field label="Website (optional)" value={websiteUrl} onChangeText={setWebsiteUrl}
          placeholder="https://example.com" keyboardType="url" autoCapitalize="none"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />
        <Field label="Contact email (optional)" value={publicEmail} onChangeText={setPublicEmail}
          placeholder="hello@example.com" keyboardType="email-address" autoCapitalize="none"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        {/* ── Cover Image ── */}
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: vLabel }]}>Cover Image (optional)</Text>
          {imageUrl ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} resizeMode="cover" />
              <Pressable onPress={() => setImageUrl("")} style={styles.imageRemoveBtn}>
                <View style={styles.imageRemoveContent}>
                  <Feather name="x" size={14} color="#fff" />
                  <Text style={styles.imageRemoveText}>Remove</Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={pickImage}
              disabled={imageUploading}
              style={[styles.imagePickerBtn, { backgroundColor: vInput, borderColor: accent + "40" }]}
            >
              {imageUploading
                ? <ActivityIndicator color={accent} />
                : (
                  <View style={styles.imagePickerContent}>
                    <Feather name="image" size={17} color={accent} />
                    <Text style={[styles.imagePickerText, { color: accent }]}>Add cover photo</Text>
                  </View>
                )}
            </Pressable>
          )}
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: vLabel }]}>Who can see this event?</Text>
          <View style={styles.visibilityRow}>
            {(["public", "invite_only"] as const).map((option) => {
              const selected = visibility === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setVisibility(option)}
                  style={[
                    styles.visibilityOption,
                    {
                      backgroundColor: selected ? accent + "18" : vInput,
                      borderColor: selected ? accent : accent + "35",
                    },
                  ]}
                >
                  <Text style={[styles.visibilityTitle, { color: vText }]}>
                    {option === "public" ? "Public" : "Invitation only"}
                  </Text>
                  <Text style={[styles.visibilityDescription, { color: vMuted }]}>
                    {option === "public" ? "Anyone can find this event." : "Invite selected visitors or share a private link."}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {visibility === "invite_only" ? (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: vLabel }]}>Invite visitors</Text>
            <Text style={[styles.visibilityDescription, { color: vMuted }]}>
              Choose checked-in visitors, or share the event link with anyone you invite.
            </Text>
            {guestsQuery.isLoading ? (
              <ActivityIndicator color={accent} style={styles.guestLoading} />
            ) : guestsQuery.isError ? (
              <Text style={[styles.visibilityDescription, { color: colors.destructive }]}>
                Could not load your visitor list. Try again.
              </Text>
            ) : (guestsQuery.data?.guests ?? []).length === 0 ? (
              <Text style={[styles.visibilityDescription, { color: vMuted }]}>
                No checked-in visitors yet. You can still share the invitation link.
              </Text>
            ) : (guestsQuery.data?.guests ?? []).map((guest) => {
              const selected = inviteeUids.includes(guest.uid);
              return (
                <Pressable
                  key={guest.uid}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setInviteeUids((current) => selected
                    ? current.filter((uid) => uid !== guest.uid)
                    : [...current, guest.uid])}
                  style={[styles.guestRow, { borderBottomColor: accent + "25" }]}
                >
                  <Text style={[styles.guestName, { color: vText }]}>
                    {guest.displayName} · {guest.checkinCount}
                  </Text>
                  <Feather name={selected ? "check-square" : "square"} size={20} color={accent} />
                </Pressable>
              );
            })}
            <View style={[styles.toggleRow, { marginTop: 12 }]}>
              <Text style={[styles.toggleLabel, { color: vToggleLabel }]}>Protect link with a passcode</Text>
              <Switch
                value={requireInvitePasscode}
                onValueChange={setRequireInvitePasscode}
                trackColor={{ false: isDark ? "#333" : "rgba(0,0,0,0.12)", true: accent + "80" }}
                thumbColor={requireInvitePasscode ? accent : isDark ? "#888" : "#bbb"}
              />
            </View>
            {requireInvitePasscode ? (
              <>
                <Field
                  label="Passcode (6–64 characters)"
                  value={invitePasscode}
                  onChangeText={setInvitePasscode}
                  placeholder="Create a passcode"
                  autoCapitalize="none"
                  vInput={vInput}
                  vText={vText}
                  vLabel={vLabel}
                  vPlaceholder={vPlaceholder}
                  accent={accent}
                />
                <Text style={[styles.visibilityDescription, { color: vMuted }]}>
                  The invitation link will open in Met. Share the passcode separately.
                </Text>
              </>
            ) : null}
          </View>
        ) : null}

        <DateTimePicker
          label="Start Date & Time"
          mode="datetime"
          value={startsAt}
          onChange={setStartsAt}
          primaryColor={accent}
          labelColor={vLabel}
          rowBg={vInput}
          valueColor={vText}
          chevronColor={vMuted}
          isDark={isDark}
        />

        <View>
          <View style={styles.optionalRow}>
            <Text style={[styles.fieldLabel, { color: vLabel }]}>End Date & Time</Text>
            <Text style={[styles.optionalBadge, { color: vMuted }]}>optional</Text>
            {endsAt !== null && (
              <Pressable onPress={() => setEndsAt(null)} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
            )}
          </View>
          <DateTimePicker
            label=""
            mode="datetime"
            value={endsAtValue}
            onChange={handleEndsAtChange}
            primaryColor={accent}
            labelColor={vLabel}
            rowBg={vInput}
            valueColor={vText}
            chevronColor={vMuted}
            isDark={isDark}
            optional
          />
          {endTimeInvalid && (
            <Text
              accessibilityRole="alert"
              testID="venue-event-schedule-error"
              style={{ color: "#B42318", fontSize: 12, marginTop: 6 }}
            >
              End date and time must be after the start date and time.
            </Text>
          )}
        </View>

        <Field label="Capacity Limit (optional)" value={capacityLimit} onChangeText={setCapacityLimit}
          placeholder="50" keyboardType="number-pad"
          vInput={vInput} vText={vText} vLabel={vLabel} vPlaceholder={vPlaceholder} accent={accent} />

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleLabel, { color: vToggleLabel }]}>Publish immediately</Text>
          <Switch
            value={isPublished}
            onValueChange={setIsPublished}
            trackColor={{ false: isDark ? "#333" : "rgba(0,0,0,0.12)", true: accent + "80" }}
            thumbColor={isPublished ? accent : isDark ? "#888" : "#bbb"}
          />
        </View>

        <Pressable
          style={[styles.submitBtn, { backgroundColor: canSubmit && !submitting ? accent : vDisabledBtn }]}
          onPress={handleCreate}
          disabled={!canSubmit || submitting}
        >
          {submitting
            ? <ActivityIndicator color={canSubmit ? colors.primaryForeground : colors.mutedForeground} />
            : <Text style={[styles.submitBtnText, { color: canSubmit ? colors.primaryForeground : colors.mutedForeground }]}>Create Event</Text>}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, multiline, numberOfLines,
  keyboardType = "default", autoCapitalize = "sentences",
  vInput, vText, vLabel, vPlaceholder, accent,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  multiline?: boolean; numberOfLines?: number;
  keyboardType?: "default" | "url" | "number-pad" | "phone-pad" | "email-address";
  autoCapitalize?: "none" | "sentences";
  vInput: string; vText: string; vLabel: string; vPlaceholder: string; accent: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: vLabel }]}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={vPlaceholder} multiline={multiline}
        numberOfLines={numberOfLines} keyboardType={keyboardType} autoCapitalize={autoCapitalize}
        style={[
          styles.fieldInput,
          multiline && { height: (numberOfLines ?? 1) * 24 + 20, textAlignVertical: "top" },
          { backgroundColor: vInput, borderColor: accent + "40", color: vText },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 24, gap: 18 },
  field: {},
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  imagePickerBtn: { borderWidth: 1, borderStyle: "dashed", borderRadius: 14, paddingVertical: 20, alignItems: "center", justifyContent: "center" },
  imagePickerContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  imagePickerText: { fontSize: 14, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  imagePreviewWrap: { borderRadius: 10, overflow: "hidden", position: "relative" },
  imagePreview: { width: "100%", height: 160, borderRadius: 10 },
  imageRemoveBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  imageRemoveContent: { flexDirection: "row", alignItems: "center", gap: 4 },
  imageRemoveText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  optionalRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  optionalBadge: { fontSize: 11, fontFamily: "Inter_400Regular" },
  clearBtn: { marginLeft: "auto" },
  clearBtnText: { color: "rgba(255,80,80,0.8)", fontSize: 12, fontFamily: "Inter_500Medium" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  visibilityRow: { gap: 9 },
  visibilityOption: { borderWidth: 1, borderRadius: 12, padding: 12 },
  visibilityTitle: { fontSize: 14, fontWeight: "700" },
  visibilityDescription: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  guestLoading: { paddingVertical: 16 },
  guestRow: { minHeight: 46, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  guestName: { fontSize: 13, fontWeight: "500" },
  submitBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
