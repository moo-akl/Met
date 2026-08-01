/**
 * Venue Owner Setup — 3-step registration flow.
 *
 * Step 1: Venue search (enter Place ID or search by name)
 * Step 2: Business details (name, tagline, description)
 * Step 3: Verification (doc URL, notes) + submit
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";
import { useColors } from "@/hooks/useColors";

type Step = 1 | 2 | 3;

export default function VenueOwnerSetupScreen() {
  const { authedUid } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reapply } = useLocalSearchParams<{ reapply?: string }>();
  const isReapply = reapply === "true";

  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Venue
  const [placeId, setPlaceId] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  // Step 2 — Business details
  const [businessName, setBusinessName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");

  // Step 3 — Verification
  const [verificationDocUrl, setVerificationDocUrl] = useState("");
  const [registrationNotes, setRegistrationNotes] = useState("");

  const stepTitles: Record<Step, string> = {
    1: "Your Venue",
    2: "Business Details",
    3: "Verification",
  };
  const stepSubtitles: Record<Step, string> = isReapply
    ? {
        1: "Update your venue details before resubmitting",
        2: "Update your business information",
        3: "Provide updated proof of ownership",
      }
    : {
        1: "Enter the Google Place ID for your venue",
        2: "Tell us about your business",
        3: "Submit proof of ownership for review",
      };

  const canAdvanceStep1 = placeId.trim().length > 0 && placeName.trim().length > 0;
  const canAdvanceStep2 = businessName.trim().length > 0;
  const canSubmit = verificationDocUrl.trim().length > 0;

  const handleSubmit = async () => {
    if (!authedUid || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const body = {
        placeId: placeId.trim(),
        placeName: placeName.trim(),
        businessName: businessName.trim(),
        lat: lat.trim() || undefined,
        lng: lng.trim() || undefined,
        tagline: tagline.trim() || undefined,
        description: description.trim() || undefined,
        verificationDocUrl: verificationDocUrl.trim() || undefined,
        registrationNotes: registrationNotes.trim() || undefined,
      };
      if (isReapply) {
        await api.reapplyVenueOwner({ uid: authedUid }, body);
        Alert.alert(
          "Re-application submitted!",
          "Our team will review your updated application within a few days. You'll get a notification once approved.",
          [{ text: "Done", onPress: () => router.back() }],
        );
      } else {
        await api.registerVenueOwner({ uid: authedUid }, body);
        Alert.alert(
          "Application submitted!",
          "Our team will review your venue within a few days. You'll get a notification once approved.",
          [{ text: "Done", onPress: () => router.back() }],
        );
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to submit. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: "#0F0F12" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {step > 1 && (
          <Pressable
            onPress={() => setStep((s) => (s - 1) as Step)}
            style={styles.backBtn}
            hitSlop={8}
          >
            <Text style={styles.backBtnText}>‹ Back</Text>
          </Pressable>
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.screenTitle}>Venue Owner Portal</Text>
          <Text style={styles.stepIndicator}>Step {step} of 3</Text>
        </View>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${(step / 3) * 100}%`, backgroundColor: colors.primary },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepTitle}>{stepTitles[step]}</Text>
        <Text style={styles.stepSubtitle}>{stepSubtitles[step]}</Text>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <View style={styles.fields}>
            <Field
              label="Google Place ID *"
              value={placeId}
              onChangeText={setPlaceId}
              placeholder="ChIJ..."
              autoCapitalize="none"
              colors={colors}
            />
            <Field
              label="Venue Name *"
              value={placeName}
              onChangeText={setPlaceName}
              placeholder="The Blue Parrot"
              colors={colors}
            />
            <Field
              label="Latitude (optional)"
              value={lat}
              onChangeText={setLat}
              placeholder="51.5074"
              keyboardType="decimal-pad"
              colors={colors}
            />
            <Field
              label="Longitude (optional)"
              value={lng}
              onChangeText={setLng}
              placeholder="-0.1278"
              keyboardType="decimal-pad"
              colors={colors}
            />
          </View>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <View style={styles.fields}>
            <Field
              label="Business Name *"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="The Blue Parrot Bar & Kitchen"
              colors={colors}
            />
            <Field
              label="Tagline (up to 160 chars)"
              value={tagline}
              onChangeText={setTagline}
              placeholder="Where strangers become regulars"
              maxLength={160}
              colors={colors}
            />
            <Field
              label="Description (up to 1000 chars)"
              value={description}
              onChangeText={setDescription}
              placeholder="Tell guests what makes your venue special..."
              multiline
              numberOfLines={4}
              maxLength={1000}
              colors={colors}
            />
          </View>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <View style={styles.fields}>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Please provide a URL to a document proving ownership or management
                authority for this venue (e.g. business licence, utility bill, lease
                agreement). Accepted formats: Google Drive, Dropbox, or any public link.
              </Text>
            </View>
            <Field
              label="Verification Document URL *"
              value={verificationDocUrl}
              onChangeText={setVerificationDocUrl}
              placeholder="https://drive.google.com/..."
              autoCapitalize="none"
              keyboardType="url"
              colors={colors}
            />
            <Field
              label="Additional notes (optional)"
              value={registrationNotes}
              onChangeText={setRegistrationNotes}
              placeholder="Anything the review team should know..."
              multiline
              numberOfLines={3}
              maxLength={500}
              colors={colors}
            />
          </View>
        )}
      </ScrollView>

      {/* Footer CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {step < 3 ? (
          <Pressable
            style={[
              styles.primaryBtn,
              {
                backgroundColor:
                  (step === 1 && canAdvanceStep1) || (step === 2 && canAdvanceStep2)
                    ? colors.primary
                    : "#333",
              },
            ]}
            onPress={() => setStep((s) => (s + 1) as Step)}
            disabled={step === 1 ? !canAdvanceStep1 : !canAdvanceStep2}
          >
            <Text style={styles.primaryBtnText}>Continue →</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.primaryBtn,
              { backgroundColor: canSubmit && !submitting ? colors.primary : "#333" },
            ]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isReapply ? "Submit Re-application" : "Submit Application"}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  keyboardType?: "default" | "decimal-pad" | "url";
  autoCapitalize?: "none" | "sentences";
  colors: { primary: string };
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
  maxLength,
  keyboardType = "default",
  autoCapitalize = "sentences",
  colors,
}: FieldProps) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.25)"
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[
          styles.fieldInput,
          multiline && { height: (numberOfLines ?? 1) * 24 + 20, textAlignVertical: "top" },
          { borderColor: colors.primary + "40" },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: { paddingRight: 12 },
  backBtnText: { color: "rgba(255,255,255,0.6)", fontSize: 16 },
  headerCenter: { flex: 1, alignItems: "center" },
  screenTitle: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  stepIndicator: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  closeBtn: { paddingLeft: 12 },
  closeBtnText: { color: "rgba(255,255,255,0.4)", fontSize: 18 },
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  scroll: { flex: 1 },
  content: { padding: 24 },
  stepTitle: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  stepSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 28,
  },
  fields: { gap: 18 },
  fieldWrapper: {},
  fieldLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: "#1A1A1E",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  infoBox: {
    backgroundColor: "rgba(255,204,0,0.08)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,204,0,0.2)",
    padding: 14,
  },
  infoText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
