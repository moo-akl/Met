import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  deleteNetwork,
  getNetwork,
  resolveNeighborhood,
  updateNetwork,
} from "@workspace/api-client-react";

type Category = "university" | "work" | "neighborhood" | "custom";

const CATEGORIES: Array<{ key: Category; icon: string; labelKey: string }> = [
  { key: "university", icon: "book", labelKey: "networks.categoryUniversity" },
  { key: "work", icon: "briefcase", labelKey: "networks.categoryWork" },
  { key: "neighborhood", icon: "map-pin", labelKey: "networks.categoryNeighborhood" },
  { key: "custom", icon: "users", labelKey: "networks.categoryCustom" },
];

export default function EditNetworkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const networkId = Number(id);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useT();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("custom");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [neighborhoodName, setNeighborhoodName] = useState<string | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNaN(networkId)) return;
    getNetwork(networkId)
      .then((n) => {
        setName(n.name);
        setDescription(n.description ?? "");
        setCategory(n.category as Category);
        setRequiresApproval(n.requiresApproval);
        setIsPublic(n.isPublic);
        setLocationLat(n.locationLat ?? null);
        setLocationLng(n.locationLng ?? null);
        setNeighborhoodName(n.neighborhoodName ?? null);
      })
      .catch(() => setError("Could not load network"))
      .finally(() => setLoading(false));
  }, [networkId]);

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

  async function handleSave() {
    if (!name.trim()) {
      setError("Network name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateNetwork(networkId, {
        name: name.trim(),
        description: description.trim() || null,
        category,
        requiresApproval,
        isPublic,
        locationLat: locationLat ?? null,
        locationLng: locationLng ?? null,
      });
      router.back();
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      t("networks.deleteConfirmTitle"),
      t("networks.deleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("networks.deleteConfirmOk"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteNetwork(networkId);
              router.dismissAll();
              router.replace("/(tabs)/networks" as never);
            } catch {
              setDeleting(false);
              Alert.alert("Error", "Failed to delete network.");
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          { flex: 1, backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const canSubmit = name.trim().length >= 2 && !submitting && !deleting;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {t("networks.editTitle")}
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
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
                        color: active ? colors.primary : colors.mutedForeground,
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
                  <Feather name="x" size={16} color={colors.mutedForeground} />
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

        {/* Public toggle */}
        <View style={styles.field}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {t("networks.isPublicLabel")}
              </Text>
              <Text
                style={[styles.toggleHint, { color: colors.mutedForeground }]}
              >
                {t("networks.isPublicHint")}
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

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

        {/* Save */}
        <Pressable
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? colors.primary : colors.muted },
          ]}
          onPress={handleSave}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{t("networks.editSubmit")}</Text>
          )}
        </Pressable>

        {/* Delete */}
        <Pressable
          style={[
            styles.deleteBtn,
            { borderColor: colors.destructive },
          ]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color={colors.destructive} />
          ) : (
            <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>
              {t("networks.deleteButton")}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17 },
  container: { padding: 20, gap: 20 },
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
    gap: 12,
  },
  toggleHint: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
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
  deleteBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  deleteBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
