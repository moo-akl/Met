import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import {
  PHOTO_VERIFY_FAIL_REASONS,
  type PhotoVerificationStage,
  runContentCheck,
  runFaceCheck,
} from "@/lib/photoVerify";

type Props = {
  visible: boolean;
  uri: string | null;
  onCancel: () => void;
  onVerified: (uri: string) => void;
};

type Step = "idle" | "face" | "content" | "done" | "error";

export function PhotoVerifier({ visible, uri, onCancel, onVerified }: Props) {
  const colors = useColors();
  const { t } = useT();
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<{
    stage: PhotoVerificationStage;
    reason: string;
  } | null>(null);

  // Monotonically incrementing run id. Any in-flight async operation captures
  // its run id and only mutates state if it still matches `runIdRef.current`,
  // so a cancel + restart (or a quick close) can never trigger a stale
  // `onVerified` or stage update.
  const runIdRef = useRef(0);
  // Latest stable callbacks so async paths don't capture stale closures.
  const onVerifiedRef = useRef(onVerified);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onVerifiedRef.current = onVerified;
    onCancelRef.current = onCancel;
  }, [onVerified, onCancel]);

  const startRun = useCallback(async (runUri: string) => {
    const myRun = ++runIdRef.current;
    setError(null);
    setStep("face");

    const faceOk = await runFaceCheck(runUri);
    if (myRun !== runIdRef.current) return;
    if (!faceOk) {
      setError({ stage: "face", reason: PHOTO_VERIFY_FAIL_REASONS.face });
      setStep("error");
      return;
    }

    setStep("content");
    const contentOk = await runContentCheck(runUri);
    if (myRun !== runIdRef.current) return;
    if (!contentOk) {
      setError({
        stage: "content",
        reason: PHOTO_VERIFY_FAIL_REASONS.content,
      });
      setStep("error");
      return;
    }

    setStep("done");
    // Brief beat so the user sees the green checks before dismissal.
    setTimeout(() => {
      if (myRun !== runIdRef.current) return;
      onVerifiedRef.current(runUri);
    }, 350);
  }, []);

  // Kick off a fresh run whenever the modal opens with a new uri. Closing the
  // modal (visible→false or uri→null) bumps the run id so any pending check
  // is dropped on the floor.
  useEffect(() => {
    if (visible && uri) {
      startRun(uri);
    } else {
      runIdRef.current += 1;
      setStep("idle");
      setError(null);
    }
  }, [visible, uri, startRun]);

  const handleRetry = useCallback(() => {
    if (uri) startRun(uri);
  }, [uri, startRun]);

  const handleCancel = useCallback(() => {
    runIdRef.current += 1;
    onCancelRef.current();
  }, []);

  const faceState: "pending" | "active" | "done" | "fail" =
    step === "idle"
      ? "pending"
      : step === "face"
        ? "active"
        : step === "error" && error?.stage === "face"
          ? "fail"
          : "done";

  const contentState: "pending" | "active" | "done" | "fail" =
    step === "idle" || step === "face"
      ? "pending"
      : step === "content"
        ? "active"
        : step === "error" && error?.stage === "content"
          ? "fail"
          : step === "done"
            ? "done"
            : "pending";

  if (!visible) return null;

  const isWorking = step === "face" || step === "content";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {uri ? (
            <View
              style={[styles.preview, { borderColor: colors.border }]}
              pointerEvents="none"
            >
              <Image
                source={{ uri }}
                style={styles.previewImg}
                contentFit="cover"
              />
              {step === "done" ? (
                <View style={styles.previewBadge}>
                  <Feather name="check" size={16} color="#FFFFFF" />
                </View>
              ) : null}
            </View>
          ) : null}

          <Text style={[styles.title, { color: colors.foreground }]}>
            {step === "error"
              ? t("photoVerifier.errorTitle")
              : step === "done"
                ? t("photoVerifier.doneTitle")
                : t("photoVerifier.workingTitle")}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {step === "error"
              ? error?.stage === "face"
                ? t("photoVerifier.failNoFace")
                : t("photoVerifier.failContent")
              : t("photoVerifier.subText")}
          </Text>

          <View style={{ gap: 10, marginTop: 14, alignSelf: "stretch" }}>
            <Stage
              label={t("photoVerifier.stageFace")}
              state={faceState}
              colors={colors}
            />
            <Stage
              label={t("photoVerifier.stageContent")}
              state={contentState}
              colors={colors}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: 10,
              marginTop: 18,
              alignSelf: "stretch",
            }}
          >
            {step === "error" ? (
              <>
                <Pressable
                  onPress={handleCancel}
                  style={({ pressed }) => [
                    styles.btn,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[styles.btnText, { color: colors.foreground }]}
                  >
                    {t("photoVerifier.chooseAnother")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleRetry}
                  disabled={isWorking}
                  style={({ pressed }) => [
                    styles.btn,
                    {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                      opacity: pressed || isWorking ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.btnText, { color: "#FFFFFF" }]}>
                    {t("photoVerifier.tryAgain")}
                  </Text>
                </Pressable>
              </>
            ) : step === "done" ? (
              <View style={styles.doneRow}>
                <Feather name="check-circle" size={18} color={colors.primary} />
                <Text style={[styles.doneText, { color: colors.primary }]}>
                  {t("photoVerifier.allClear")}
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.btn,
                  {
                    flex: 1,
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[styles.btnText, { color: colors.foreground }]}>
                  {t("photoVerifier.cancel")}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Stage({
  label,
  state,
  colors,
}: {
  label: string;
  state: "pending" | "active" | "done" | "fail";
  colors: ReturnType<typeof useColors>;
}) {
  const tint =
    state === "done"
      ? colors.primary
      : state === "fail"
        ? colors.destructive
        : state === "active"
          ? colors.foreground
          : colors.mutedForeground;
  const bg =
    state === "done"
      ? colors.primary
      : state === "fail"
        ? colors.destructive
        : "transparent";

  return (
    <View style={styles.stageRow}>
      <View
        style={[
          styles.stageDot,
          {
            borderColor:
              state === "pending" ? colors.border : colors.foreground,
            backgroundColor: bg,
          },
        ]}
      >
        {state === "active" ? (
          <ActivityIndicator size="small" color={colors.foreground} />
        ) : state === "done" ? (
          <Feather name="check" size={14} color="#FFFFFF" />
        ) : state === "fail" ? (
          <Feather name="x" size={14} color="#FFFFFF" />
        ) : null}
      </View>
      <Text style={[styles.stageLabel, { color: tint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
      },
      default: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 10,
      },
    }),
  },
  preview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  previewImg: { width: "100%", height: "100%" },
  previewBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#3DCC44",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    textAlign: "center",
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 6,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stageDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stageLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1,
    paddingVertical: 12,
  },
  doneText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
});
