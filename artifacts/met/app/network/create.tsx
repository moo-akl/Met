import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  createNetwork,
  resolveNeighborhood,
} from "@workspace/api-client-react";

type Category = "university" | "work" | "neighborhood" | "custom";

const CATEGORIES: Array<{ key: Category; icon: string; labelKey: string }> = [
  {
    key: "university",
    icon: "book",
    labelKey: "networks.categoryUniversity",
  },
  { key: "work", icon: "briefcase", labelKey: "networks.categoryWork" },
  {
    key: "neighborhood",
    icon: "map-pin",
    labelKey: "networks.categoryNeighborhood",
  },
  { key: "custom", icon: "users", labelKey: "networks.categoryCustom" },
];

export default function CreateNetworkScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("custom");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [neighborhoodName, setNeighborhoodName] = useState<string | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDetectLocation() {
    setDetectingLocation(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLocationLat(lat);
      setLocationLng(lng);

      const result = await resolveNeighborhood({ lat, lng });
      setNeighborhoodName(result.name);
    } catch {
      setError("Could not detect location. Please try again.");
    } finally {
      setDetectingLocation(false);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Network name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const network = await createNetwork({
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        requiresApproval,
        isPublic: true,
        locationLat: locationLat ?? undefined,
        locationLng: locationLng ?? undefined,
        locationRadiusKm: 2,
      });
      router.replace({
        pathname: "/network/[id]",
        params: { id: String(network.id) },
      } as never);
    } catch {
      setError("Failed to create network. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = name.trim().length >= 2 && !submitting;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.heading, { color: colors.foreground }]}>
          {t("networks.createTitle")}
        </Text>

        {/* Name */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t("networks.createNameLabel")}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            placeholder={t("networks.createNamePlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            maxLength={80}
            autoCapitalize="words"
          />
          <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
            {name.length}/80
          </Text>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t("networks.createDescLabel")}
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textarea,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            placeholder={t("networks.createDescPlaceholder")}
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={setDescription}
            maxLength={300}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {t("networks.createCategoryLabel")}
          </Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(({ key, icon, labelKey }) => {
              const active = category === key;
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.catBtn,
                    {
                      backgroundColor: active
                        ? colors.primary + "18"
                        : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setCategory(key)}
                >
                  <Feather
                    name={icon as never}
                    size={20}
                    color={active ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.catLabel,
                      {
                        color: active
                          ? colors.primary
                          : colors.mutedForeground,
                      },
                    ]}
                  >
                    {t(labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Neighborhood location */}
        {category === "neighborhood" && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t("networks.createLocationLabel")}
            </Text>
            {neighborhoodName ? (
              <View
                style={[
                  styles.locationResult,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Feather name="map-pin" size={16} color={colors.primary} />
                <Text
                  style={[styles.locationName, { color: colors.foreground }]}
                >
                  {neighborhoodName}
                </Text>
                <Pressable
                  onPress={() => {
                    setNeighborhoodName(null);
                    setLocationLat(null);
                    setLocationLng(null);
                  }}
                >
                  <Feather
                    name="x"
                    size={16}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[
                  styles.locationBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleDetectLocation}
                disabled={detectingLocation}
              >
                {detectingLocation ? (
                  <>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text
                      style={[
                        styles.locationBtnText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {t("networks.createDetecting")}
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather
                      name="navigation"
                      size={18}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        styles.locationBtnText,
                        { color: colors.primary },
                      ]}
                    >
                      {t("networks.createUseMyLocation")}
                    </Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        )}

        {/* Approval toggle */}
        <View style={styles.field}>
          <View style={styles.toggleRow}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {t("networks.createApprovalLabel")}
            </Text>
            <Switch
              value={requiresApproval}
              onValueChange={setRequiresApproval}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Error */}
        {!!error && (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        )}

        {/* Submit */}
        <Pressable
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? colors.primary : colors.muted },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{t("networks.createSubmit")}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 20 },
  heading: { fontFamily: "Inter_700Bold", fontSize: 24, marginBottom: 4 },
  field: { gap: 6 },
  label: { fontFamily: "Inter_500Medium", fontSize: 14, marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  textarea: { height: 80, paddingTop: 12 },
  charCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "right",
  },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    width: "47%",
  },
  catLabel: { fontFamily: "Inter_500Medium", fontSize: 14 },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  locationBtnText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  locationResult: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  locationName: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitText: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
});
