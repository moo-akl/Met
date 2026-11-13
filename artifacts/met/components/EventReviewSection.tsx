import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import {
  getGetEventReviewsQueryKey,
  useCreateEventReview,
  useGetEventReviews,
} from "@workspace/api-client-react";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

type Props = {
  eventType: "venue" | "member";
  eventId: number;
  uid: string | null;
  canReview: boolean;
};

export function EventReviewSection({ eventType, eventId, uid, canReview }: Props) {
  const colors = useColors();
  const { t } = useT();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const reviews = useGetEventReviews(eventType, eventId, {
    query: {
      enabled: !!uid,
      staleTime: 30_000,
      queryKey: [...getGetEventReviewsQueryKey(eventType, eventId), uid ?? "signed-out"],
    },
  });
  const submitReview = useCreateEventReview({
    mutation: {
      onSuccess: async () => {
        setRating(0);
        setReviewText("");
        await queryClient.invalidateQueries({
          queryKey: getGetEventReviewsQueryKey(eventType, eventId),
        });
      },
    },
  });

  const data = reviews.data;
  const alreadyReviewed = Boolean(data?.myReview);
  const errorMessage = submitReview.error instanceof Error
    ? submitReview.error.message
    : reviews.isError
      ? t("tabs.events.reviewsLoadError")
      : "";

  const submit = async () => {
    if (!uid || !canReview || alreadyReviewed || rating < 1) return;
    try {
      await submitReview.mutateAsync({
        eventType,
        eventId,
        data: { rating, reviewText: reviewText.trim() || null },
      });
    } catch {
      // The mutation error is shown below; the one-time review remains unsent.
    }
  };

  return (
    <View
      testID="event-reviews"
      style={{
        gap: 14,
        marginTop: 6,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 18,
        backgroundColor: colors.card,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather name="star" size={17} color={colors.primary} />
        <Text style={{ color: colors.text, fontFamily: "Inter_700Bold", fontSize: 17 }}>
          {t("tabs.events.reviews")}
        </Text>
        {data?.reviewCount ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
            {data.averageRating?.toFixed(1)} · {data.reviewCount}
          </Text>
        ) : null}
      </View>

      {canReview && !alreadyReviewed ? (
        <KeyboardAvoidingView behavior="padding">
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
              {t("tabs.events.reviewPrompt")}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={t("tabs.events.hangoutRatingStar", { rating: value })}
                  accessibilityState={{ selected: value <= rating }}
                  testID={`event-review-star-${value}`}
                  onPress={() => setRating(value)}
                  hitSlop={6}
                >
                  <Text style={{
                    color: value <= rating ? colors.primary : colors.border,
                    fontSize: 28,
                    fontWeight: "700",
                  }}>
                    {value <= rating ? "★" : "☆"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={reviewText}
              onChangeText={setReviewText}
              placeholder={t("tabs.events.reviewPlaceholder")}
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              accessibilityLabel={t("tabs.events.reviewPlaceholder")}
              testID="event-review-text"
              style={{
                minHeight: 84,
                padding: 12,
                color: colors.text,
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                fontSize: 14,
              }}
            />
            <Pressable
              accessibilityRole="button"
              testID="button-submit-event-review"
              disabled={submitReview.isPending || rating < 1}
              onPress={() => void submit()}
              style={{
                minHeight: 44,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: colors.primary,
                opacity: submitReview.isPending || rating < 1 ? 0.55 : 1,
              }}
            >
              {submitReview.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : null}
              <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>
                {t("tabs.events.submitReview")}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : alreadyReviewed ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
            {t("tabs.events.reviewSubmitted")}
          </Text>
          {data?.myReview?.reviewText ? (
            <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>
              {data.myReview.reviewText}
            </Text>
          ) : null}
        </View>
      ) : null}

      {errorMessage ? (
        <Text accessibilityRole="alert" style={{ color: colors.destructive, fontSize: 13 }}>
          {errorMessage}
        </Text>
      ) : null}
      {reviews.isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (data?.reviews.length ?? 0) === 0 ? (
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
          {t("tabs.events.noReviews")}
        </Text>
      ) : (
        <View style={{ gap: 12 }}>
          {data?.reviews.map((review, index) => (
            <View
              key={`${review.reviewerName}-${review.createdAt}-${index}`}
              testID={`event-review-${index}`}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              {review.reviewerPhotoUrl ? (
                <Image
                  source={{ uri: review.reviewerPhotoUrl }}
                  style={{ width: 34, height: 34, borderRadius: 17 }}
                />
              ) : (
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primarySoft,
                  }}
                >
                  <Feather name="user" size={16} color={colors.primary} />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                    {review.reviewerName}
                  </Text>
                  <Text style={{ color: colors.primary, fontSize: 13 }}>
                    {"★".repeat(review.rating)}
                  </Text>
                </View>
                {review.reviewText ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>
                    {review.reviewText}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
