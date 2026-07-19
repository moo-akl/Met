/**
 * EnhancedHubSheet
 *
 * Full-screen bottom sheet shown when a user taps a "Verified Partner" hub.
 * Displays the business logo, name, Verified Partner badge, description,
 * upcoming events, a horizontal photo gallery, and business reviews.
 *
 * Also shows the check-in button (if applicable) and a leaderboard link.
 */

import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useSlideUpModal } from "@/hooks/useSlideUpModal";
import { api, type BusinessProfileSummary } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BusinessEvent {
  eventId: number;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
}

interface BusinessReview {
  reviewId: number;
  reviewerId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface EnhancedHubSheetProps {
  visible: boolean;
  onClose: () => void;
  businessProfile: BusinessProfileSummary;
  placeName: string;
  isCheckedIn: boolean;
  onViewLeaderboard: () => void;
  onCheckin?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventDate(isoString: string): string {
  const d = new Date(isoString);
  const dateStr = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateStr} · ${timeStr}`;
}

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ fontSize: size, color: i <= Math.round(rating) ? "#F59E0B" : "#D1D5DB" }}>
          ★
        </Text>
      ))}
    </View>
  );
}

function InteractiveStarPicker({
  value,
  onChange,
  size = 32,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={6}>
          <Text style={{ fontSize: size, color: i <= value ? "#F59E0B" : "#D1D5DB" }}>
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Section: Skeleton placeholder
// ---------------------------------------------------------------------------

function SkeletonRow({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View
      style={[
        styles.skeletonRow,
        { backgroundColor: colors.muted },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EnhancedHubSheet({
  visible,
  onClose,
  businessProfile,
  placeName,
  isCheckedIn,
  onViewLeaderboard,
  onCheckin,
}: EnhancedHubSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { authedUid } = useApp();
  const webBot = Platform.OS === "web" ? 34 : 0;

  const { isMounted, panelStyle, backdropStyle, panGesture } = useSlideUpModal(
    visible,
    onClose,
  );

  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(false);

  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [totalReviews, setTotalReviews] = useState(0);
  const [reviews, setReviews] = useState<BusinessReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(false);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hasCheckedInBefore, setHasCheckedInBefore] = useState(false);

  const myExistingReview = reviews.find((r) => r.reviewerId === authedUid) ?? null;
  const isOwner = authedUid === businessProfile.ownerId;
  const canReview = !isOwner && (isCheckedIn || hasCheckedInBefore || myExistingReview !== null);

  const fetchData = useCallback(() => {
    if (!authedUid) return;
    const uid = authedUid;
    const { businessId } = businessProfile;

    setEventsLoading(true);
    setEventsError(false);
    setReviewsLoading(true);
    setReviewsError(false);

    api
      .getBusinessEvents({ uid }, businessId)
      .then((data) => { setEvents(data.events); })
      .catch(() => { setEventsError(true); })
      .finally(() => { setEventsLoading(false); });

    api
      .getBusinessReviews({ uid }, businessId)
      .then((data) => {
        setAvgRating(data.averageRating);
        setTotalReviews(data.totalReviews);
        setReviews(data.reviews.slice(0, 5));
      })
      .catch(() => { setReviewsError(true); })
      .finally(() => { setReviewsLoading(false); });

    // Best-effort: check if the user has ever checked in here before (gates
    // the review button for past visitors who aren't currently checked in).
    if (!isCheckedIn) {
      api
        .getMyBusinessCheckin({ uid }, businessId)
        .then((data) => { setHasCheckedInBefore(data.hasCheckedIn); })
        .catch(() => { /* leave false — fail-safe */ });
    }
  }, [authedUid, businessProfile, isCheckedIn]);

  // Reset check-in eligibility whenever the business changes so a previous
  // hub's hasCheckedInBefore never leaks across to a different hub.
  useEffect(() => {
    setHasCheckedInBefore(false);
  }, [businessProfile.businessId]);

  // Fetch events + reviews when sheet opens
  useEffect(() => {
    if (!visible) return;
    fetchData();
  }, [visible, fetchData]);

  // Pre-populate form with existing review when reviews load
  useEffect(() => {
    if (myExistingReview && !showReviewForm) {
      setDraftRating(myExistingReview.rating);
      setDraftComment(myExistingReview.comment ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myExistingReview?.reviewId]);

  const handleOpenReviewForm = () => {
    if (myExistingReview) {
      setDraftRating(myExistingReview.rating);
      setDraftComment(myExistingReview.comment ?? "");
    } else {
      setDraftRating(0);
      setDraftComment("");
    }
    setSubmitError(null);
    setShowReviewForm(true);
  };

  const handleSubmitReview = async () => {
    if (!authedUid || draftRating === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const submitted = await api.submitBusinessReview(
        { uid: authedUid },
        businessProfile.businessId,
        { rating: draftRating, comment: draftComment.trim() || null },
      );
      // Update reviews list immediately — upsert into current list
      setReviews((prev) => {
        const filtered = prev.filter((r) => r.reviewerId !== authedUid);
        return [submitted, ...filtered];
      });
      // Refresh aggregate rating
      fetchData();
      setShowReviewForm(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit review";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const upcomingEvents = events.filter(
    (e) => new Date(e.startTime) >= new Date(),
  );

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.backdropWrapper, backdropStyle]}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={panelStyle}>
              <Pressable
                onPress={(e) => e.stopPropagation()}
                style={[
                  styles.sheet,
                  {
                    backgroundColor: colors.card,
                    paddingBottom: insets.bottom + webBot + 20,
                  },
                ]}
              >
                {/* Drag handle */}
                <View style={styles.handle} />

                {/* Close button */}
                <Pressable
                  style={[styles.closeBtn, { backgroundColor: colors.muted }]}
                  onPress={onClose}
                  hitSlop={10}
                >
                  <Feather name="x" size={18} color={colors.foreground} />
                </Pressable>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.scrollContent}
                >
                  {/* -------------------------------------------------------- */}
                  {/* Header: logo + Verified Partner badge + name + desc      */}
                  {/* -------------------------------------------------------- */}
                  <View style={styles.header}>
                    {businessProfile.logoUrl ? (
                      <Image
                        source={{ uri: businessProfile.logoUrl }}
                        style={styles.logo}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[styles.logoPlaceholder, { backgroundColor: colors.muted }]}
                      >
                        <Feather name="briefcase" size={28} color={colors.mutedForeground} />
                      </View>
                    )}

                    {/* Verified Partner badge */}
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedStar}>★</Text>
                      <Text style={styles.verifiedText}>Verified Partner</Text>
                    </View>

                    <Text style={[styles.businessName, { color: colors.foreground }]}>
                      {businessProfile.name}
                    </Text>

                    <Text style={[styles.placeName, { color: colors.mutedForeground }]}>
                      📍 {placeName}
                    </Text>

                    {businessProfile.description ? (
                      <Text style={[styles.description, { color: colors.foreground }]}>
                        {businessProfile.description}
                      </Text>
                    ) : null}
                  </View>

                  {/* -------------------------------------------------------- */}
                  {/* Action buttons: Leaderboard + (Check-in if applicable)   */}
                  {/* -------------------------------------------------------- */}
                  <View style={styles.actionRow}>
                    <Pressable
                      onPress={() => {
                        onClose();
                        setTimeout(onViewLeaderboard, 120);
                      }}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        styles.actionBtnSecondary,
                        {
                          backgroundColor: colors.muted,
                          borderColor: colors.border,
                          opacity: pressed ? 0.7 : 1,
                          flex: onCheckin ? 1 : undefined,
                        },
                      ]}
                    >
                      <Feather name="award" size={16} color={colors.foreground} />
                      <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                        Leaderboard
                      </Text>
                    </Pressable>

                    {onCheckin ? (
                      <Pressable
                        onPress={() => {
                          onClose();
                          setTimeout(onCheckin!, 120);
                        }}
                        style={({ pressed }) => [
                          styles.actionBtn,
                          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, flex: 1 },
                        ]}
                      >
                        <Feather name="map-pin" size={16} color={colors.primaryForeground} />
                        <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>
                          {isCheckedIn ? "Checked in ✓" : "Check in"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {/* -------------------------------------------------------- */}
                  {/* Upcoming Events                                           */}
                  {/* -------------------------------------------------------- */}
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                      Upcoming Events
                    </Text>

                    {eventsLoading ? (
                      <>
                        <SkeletonRow colors={colors} />
                        <SkeletonRow colors={colors} />
                      </>
                    ) : eventsError ? (
                      <Pressable
                        onPress={fetchData}
                        style={[styles.emptyBox, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      >
                        <Feather name="refresh-cw" size={18} color={colors.mutedForeground} />
                        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                          Couldn't load events — tap to retry
                        </Text>
                      </Pressable>
                    ) : upcomingEvents.length === 0 ? (
                      <View style={[styles.emptyBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                        <Feather name="calendar" size={18} color={colors.mutedForeground} />
                        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                          No upcoming events
                        </Text>
                      </View>
                    ) : (
                      upcomingEvents.map((event) => (
                        <View
                          key={event.eventId}
                          style={[
                            styles.eventCard,
                            { backgroundColor: colors.background, borderColor: colors.border },
                          ]}
                        >
                          <View style={[styles.eventAccent, { backgroundColor: colors.primary }]} />
                          <View style={styles.eventBody}>
                            <Text style={[styles.eventTitle, { color: colors.foreground }]}>
                              {event.title}
                            </Text>
                            <Text style={[styles.eventTime, { color: colors.mutedForeground }]}>
                              {formatEventDate(event.startTime)}
                              {" → "}
                              {formatEventDate(event.endTime)}
                            </Text>
                            {event.description ? (
                              <Text style={[styles.eventDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                                {event.description}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))
                    )}
                  </View>

                  {/* -------------------------------------------------------- */}
                  {/* Photo Gallery                                             */}
                  {/* -------------------------------------------------------- */}
                  {businessProfile.mediaUrls.length > 0 ? (
                    <View style={styles.section}>
                      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                        Photos
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.galleryRow}
                      >
                        {businessProfile.mediaUrls.map((uri, idx) => (
                          <Image
                            key={`${uri}-${idx}`}
                            source={{ uri }}
                            style={styles.galleryImage}
                            resizeMode="cover"
                          />
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}

                  {/* -------------------------------------------------------- */}
                  {/* Reviews                                                   */}
                  {/* -------------------------------------------------------- */}
                  <View style={styles.section}>
                    <View style={styles.reviewsHeader}>
                      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                        Reviews
                      </Text>
                      {avgRating !== null && totalReviews > 0 ? (
                        <View style={styles.ratingRow}>
                          <StarRating rating={avgRating} size={16} />
                          <Text style={[styles.ratingLabel, { color: colors.mutedForeground }]}>
                            {avgRating.toFixed(1)} ({totalReviews})
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Owner cannot review their own hub */}
                    {isOwner ? (
                      <Text style={[styles.ownerReviewNote, { color: colors.mutedForeground }]}>
                        {"You can't review your own hub"}
                      </Text>
                    ) : null}

                    {/* Write a review button — only when eligible */}
                    {canReview && !showReviewForm ? (
                      <Pressable
                        onPress={handleOpenReviewForm}
                        style={({ pressed }) => [
                          styles.writeReviewBtn,
                          {
                            backgroundColor: colors.primary,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Feather name="edit-2" size={14} color={colors.primaryForeground} />
                        <Text style={[styles.writeReviewBtnText, { color: colors.primaryForeground }]}>
                          {myExistingReview ? "Edit your review" : "Write a review"}
                        </Text>
                      </Pressable>
                    ) : null}

                    {/* Inline review form */}
                    {showReviewForm ? (
                      <View
                        style={[
                          styles.reviewForm,
                          { backgroundColor: colors.background, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.reviewFormTitle, { color: colors.foreground }]}>
                          {myExistingReview ? "Edit your review" : "Write a review"}
                        </Text>

                        <InteractiveStarPicker value={draftRating} onChange={setDraftRating} />

                        <TextInput
                          value={draftComment}
                          onChangeText={setDraftComment}
                          placeholder="Share your experience (optional)"
                          placeholderTextColor={colors.mutedForeground}
                          multiline
                          numberOfLines={3}
                          style={[
                            styles.reviewTextInput,
                            {
                              color: colors.foreground,
                              backgroundColor: colors.muted,
                              borderColor: colors.border,
                            },
                          ]}
                          maxLength={1000}
                        />

                        {submitError ? (
                          <Text style={styles.reviewFormError}>{submitError}</Text>
                        ) : null}

                        <View style={styles.reviewFormActions}>
                          <Pressable
                            onPress={() => setShowReviewForm(false)}
                            style={({ pressed }) => [
                              styles.reviewFormCancelBtn,
                              {
                                backgroundColor: colors.muted,
                                borderColor: colors.border,
                                opacity: pressed ? 0.7 : 1,
                              },
                            ]}
                          >
                            <Text style={[styles.reviewFormCancelText, { color: colors.foreground }]}>
                              Cancel
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={handleSubmitReview}
                            disabled={submitting || draftRating === 0}
                            style={({ pressed }) => [
                              styles.reviewFormSubmitBtn,
                              {
                                backgroundColor: colors.primary,
                                opacity: submitting || draftRating === 0 ? 0.5 : pressed ? 0.8 : 1,
                                flex: 1,
                              },
                            ]}
                          >
                            {submitting ? (
                              <ActivityIndicator size="small" color={colors.primaryForeground} />
                            ) : (
                              <Text style={[styles.reviewFormSubmitText, { color: colors.primaryForeground }]}>
                                {myExistingReview ? "Update review" : "Submit review"}
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ) : null}

                    {reviewsLoading ? (
                      <>
                        <SkeletonRow colors={colors} />
                        <SkeletonRow colors={colors} />
                        <SkeletonRow colors={colors} />
                      </>
                    ) : reviewsError ? (
                      <Pressable
                        onPress={fetchData}
                        style={[styles.emptyBox, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      >
                        <Feather name="refresh-cw" size={18} color={colors.mutedForeground} />
                        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                          Couldn't load reviews — tap to retry
                        </Text>
                      </Pressable>
                    ) : reviews.length === 0 ? (
                      <View style={[styles.emptyBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                        <Feather name="message-square" size={18} color={colors.mutedForeground} />
                        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                          No reviews yet
                        </Text>
                      </View>
                    ) : (
                      reviews.map((review) => (
                        <View
                          key={review.reviewId}
                          style={[
                            styles.reviewCard,
                            review.reviewerId === authedUid
                              ? { backgroundColor: colors.background, borderColor: colors.primary }
                              : { backgroundColor: colors.background, borderColor: colors.border },
                          ]}
                        >
                          <View style={styles.reviewTop}>
                            <StarRating rating={review.rating} />
                            <View style={styles.reviewTopRight}>
                              {review.reviewerId === authedUid ? (
                                <Text style={[styles.reviewYouLabel, { color: colors.primary }]}>You</Text>
                              ) : null}
                              <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>
                                {new Date(review.createdAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </Text>
                            </View>
                          </View>
                          {review.comment ? (
                            <Text style={[styles.reviewComment, { color: colors.foreground }]}>
                              {review.comment}
                            </Text>
                          ) : null}
                        </View>
                      ))
                    )}
                  </View>
                </ScrollView>
              </Pressable>
            </Animated.View>
          </GestureDetector>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrapper: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    maxHeight: "92%",
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 8,
  },
  closeBtn: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 0,
  },
  header: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 8,
    gap: 6,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 4,
  },
  logoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  verifiedStar: {
    fontSize: 12,
    color: "#D97706",
  },
  verifiedText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#92400E",
    letterSpacing: 0.3,
  },
  businessName: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
    marginTop: 4,
  },
  placeName: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    marginBottom: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  actionBtnSecondary: {
    borderWidth: 1,
  },
  actionBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  section: {
    marginTop: 24,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    marginBottom: 2,
  },
  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  eventCard: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  eventAccent: {
    width: 4,
  },
  eventBody: {
    flex: 1,
    padding: 12,
    gap: 3,
  },
  eventTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  eventTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  eventDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  galleryRow: {
    gap: 10,
    paddingVertical: 4,
  },
  galleryImage: {
    width: 160,
    height: 110,
    borderRadius: 12,
  },
  reviewsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  reviewCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  reviewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewYouLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  reviewDate: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  reviewComment: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  ownerReviewNote: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
  writeReviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  writeReviewBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  reviewForm: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  reviewFormTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  reviewTextInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  reviewFormError: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#EF4444",
  },
  reviewFormActions: {
    flexDirection: "row",
    gap: 8,
  },
  reviewFormCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewFormCancelText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  reviewFormSubmitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewFormSubmitText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  skeletonRow: {
    height: 52,
    borderRadius: 12,
  },
});
