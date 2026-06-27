import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PhotoLightbox } from "@/components/PhotoLightbox";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import {
  getGetAnnouncementAnswersQueryOptions,
  useUpdateAnnouncement,
  type Announcement,
} from "@workspace/api-client-react";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ── Answer Modal ──────────────────────────────────────────────────────────────

interface AnswerModalProps {
  visible: boolean;
  questions: NonNullable<Announcement["questions"]>;
  initialAnswers: Record<number, string>;
  onSubmit: (answers: { questionId: number; text: string }[]) => void;
  onClose: () => void;
}

function AnswerModal({
  visible,
  questions,
  initialAnswers,
  onSubmit,
  onClose,
}: AnswerModalProps) {
  const colors = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<Record<number, string>>(initialAnswers);

  const isComplete = questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

  function handleSubmit() {
    onSubmit(
      questions.map((q) => ({
        questionId: q.id,
        text: (answers[q.id] ?? "").trim(),
      })),
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[amStyles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            amStyles.header,
            {
              borderBottomColor: colors.border,
              paddingTop: insets.top > 0 ? insets.top : 16,
            },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>
              {t("common.cancel")}
            </Text>
          </Pressable>
          <Text style={[amStyles.headerTitle, { color: colors.foreground }]}>
            {t("networks.feedAnswerModalTitle")}
          </Text>
          <Pressable onPress={handleSubmit} disabled={!isComplete} hitSlop={8}>
            <Text
              style={{
                color: isComplete ? colors.primary : colors.mutedForeground,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              {t("networks.feedSubmitAnswers")}
            </Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[
            amStyles.body,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {questions.map((q, i) => (
            <View key={q.id} style={amStyles.questionBlock}>
              <Text style={[amStyles.questionPrompt, { color: colors.foreground }]}>
                {i + 1}. {q.prompt}
              </Text>
              <TextInput
                style={[
                  amStyles.answerInput,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder={t("networks.feedAnswerPlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                value={answers[q.id] ?? ""}
                onChangeText={(text) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: text }))
                }
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const amStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "600" },
  body: { padding: 20, gap: 20 },
  questionBlock: { gap: 8 },
  questionPrompt: { fontSize: 15, fontWeight: "500", lineHeight: 22 },
  answerInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
  },
});

// ── Edit Post Modal ───────────────────────────────────────────────────────────

interface EditPostModalProps {
  visible: boolean;
  item: Announcement;
  onClose: () => void;
  onSaved: () => void;
}

function EditPostModal({ visible, item, onClose, onSaved }: EditPostModalProps) {
  const colors = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState(item.body);
  const updateMutation = useUpdateAnnouncement();

  function handleSave() {
    if (!body.trim()) return;
    updateMutation.mutate(
      { id: item.networkId, annId: item.id, data: { body: body.trim() } },
      {
        onSuccess: () => {
          onSaved();
          onClose();
        },
        onError: () => {
          Alert.alert("Error", "Could not save changes. Please try again.");
        },
      },
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[editStyles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            editStyles.header,
            {
              borderBottomColor: colors.border,
              paddingTop: insets.top > 0 ? insets.top : 16,
            },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ color: colors.mutedForeground, fontSize: 16 }}>
              {t("common.cancel")}
            </Text>
          </Pressable>
          <Text style={[editStyles.headerTitle, { color: colors.foreground }]}>
            {t("networks.feedEditPost")}
          </Text>
          <Pressable
            onPress={handleSave}
            disabled={!body.trim() || updateMutation.isPending}
            hitSlop={8}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={{
                  color: body.trim() ? colors.primary : colors.mutedForeground,
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                {t("common.save")}
              </Text>
            )}
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[editStyles.body, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={[
              editStyles.bodyInput,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            autoFocus
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const editStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "600" },
  body: { padding: 20 },
  bodyInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 160,
  },
});

// ── Responses Modal (admin view of all questionnaire answers) ─────────────────

interface ResponsesModalProps {
  visible: boolean;
  item: Announcement;
  onClose: () => void;
}

function ResponsesModal({ visible, item, onClose }: ResponsesModalProps) {
  const colors = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useQuery({
    ...getGetAnnouncementAnswersQueryOptions(item.networkId, item.id),
    enabled: visible,
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[rStyles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            rStyles.header,
            {
              borderBottomColor: colors.border,
              paddingTop: insets.top > 0 ? insets.top : 16,
            },
          ]}
        >
          <View style={{ width: 60 }} />
          <Text style={[rStyles.headerTitle, { color: colors.foreground }]}>
            {t("networks.feedResponsesModalTitle")}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} style={{ width: 60, alignItems: "flex-end" }}>
            <Text style={{ color: colors.primary, fontSize: 16 }}>{t("common.done")}</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : !data || data.length === 0 ? (
          <View style={rStyles.emptyWrap}>
            <Text style={[rStyles.emptyText, { color: colors.mutedForeground }]}>
              {t("networks.feedResponsesEmpty")}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={[rStyles.body, { paddingBottom: insets.bottom + 24 }]}>
            {data.map((section) => (
              <View key={section.questionId} style={rStyles.section}>
                <Text style={[rStyles.prompt, { color: colors.foreground }]}>
                  {section.prompt}
                </Text>
                {section.answers.length === 0 ? (
                  <Text style={[rStyles.noAnswers, { color: colors.mutedForeground }]}>
                    —
                  </Text>
                ) : (
                  section.answers.map((a) => (
                    <View
                      key={a.uid}
                      style={[rStyles.answerRow, { borderColor: colors.border }]}
                    >
                      <View style={rStyles.answerLeft}>
                        {a.photoUrl ? (
                          <Image source={{ uri: a.photoUrl }} style={rStyles.avatar} />
                        ) : (
                          <View
                            style={[rStyles.avatarFallback, { backgroundColor: colors.border }]}
                          >
                            <Feather name="user" size={10} color={colors.mutedForeground} />
                          </View>
                        )}
                        <Text style={[rStyles.name, { color: colors.mutedForeground }]}>
                          {a.displayName ?? "—"}
                        </Text>
                      </View>
                      <Text style={[rStyles.answerText, { color: colors.foreground }]}>
                        {a.answerText}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const rStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "600" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15 },
  body: { padding: 16, gap: 24 },
  section: { gap: 10 },
  prompt: { fontSize: 15, fontWeight: "600", lineHeight: 22 },
  answerRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  answerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatar: { width: 20, height: 20, borderRadius: 10 },
  avatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 12, fontWeight: "500" },
  answerText: { fontSize: 14, lineHeight: 20 },
  noAnswers: { fontSize: 14 },
});

// ── Poll Section ──────────────────────────────────────────────────────────────

interface PollSectionProps {
  item: Announcement;
  onVote: (optionId: number) => void;
}

function PollSection({ item, onVote }: PollSectionProps) {
  const colors = useColors();
  const { t } = useT();
  const baseOptions = item.options ?? [];
  const serverVote = item.myVoteOptionId ?? null;
  const [optimisticVoteId, setOptimisticVoteId] = useState<number | null>(null);

  const effectiveVoteId = optimisticVoteId ?? serverVote;

  const options = baseOptions.map((o) => {
    if (optimisticVoteId === null || optimisticVoteId === serverVote) return o;
    let voteCount = o.voteCount;
    if (o.id === optimisticVoteId) voteCount += 1;
    if (o.id === serverVote) voteCount = Math.max(0, voteCount - 1);
    return { ...o, voteCount };
  });

  const totalVotes = options.reduce((s, o) => s + o.voteCount, 0);

  return (
    <View style={pollStyles.container}>
      {options.map((option) => {
        const pct = totalVotes > 0 ? option.voteCount / totalVotes : 0;
        const isMyVote = effectiveVoteId === option.id;
        const pctStr = `${Math.round(pct * 100)}%` as const;

        return (
          <Pressable
            key={option.id}
            onPress={() => {
              setOptimisticVoteId(option.id);
              onVote(option.id);
            }}
            style={[
              pollStyles.option,
              {
                borderColor: isMyVote ? colors.primary : colors.border,
                backgroundColor: colors.card,
              },
            ]}
          >
            <View
              style={[
                pollStyles.bar,
                {
                  width: pctStr,
                  backgroundColor: isMyVote
                    ? colors.primary + "28"
                    : colors.mutedForeground + "18",
                },
              ]}
            />
            <View style={pollStyles.optionContent}>
              <View style={pollStyles.optionLeft}>
                {isMyVote && (
                  <Feather
                    name="check-circle"
                    size={13}
                    color={colors.primary}
                    style={{ marginRight: 6 }}
                  />
                )}
                <Text
                  style={[pollStyles.optionLabel, { color: colors.foreground }]}
                  numberOfLines={2}
                >
                  {option.label}
                </Text>
              </View>
              <Text
                style={[
                  pollStyles.optionPct,
                  { color: isMyVote ? colors.primary : colors.mutedForeground },
                ]}
              >
                {pctStr}
              </Text>
            </View>
          </Pressable>
        );
      })}
      <Text style={[pollStyles.voteCount, { color: colors.mutedForeground }]}>
        {t("networks.feedVotes", { count: totalVotes })}
      </Text>
    </View>
  );
}

const pollStyles = StyleSheet.create({
  container: { marginTop: 12, gap: 8 },
  option: {
    borderWidth: 1.5,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  optionLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  optionLabel: { fontSize: 14, flex: 1 },
  optionPct: { fontSize: 13, fontWeight: "600", minWidth: 36, textAlign: "right" },
  voteCount: { fontSize: 12, marginTop: 2 },
});

// ── Questionnaire Section ─────────────────────────────────────────────────────

interface QuestionnaireSectionProps {
  item: Announcement;
  isAdmin: boolean;
  onAnswer: (answers: { questionId: number; text: string }[]) => void;
  onViewResponses: () => void;
}

function QuestionnaireSection({ item, isAdmin, onAnswer, onViewResponses }: QuestionnaireSectionProps) {
  const colors = useColors();
  const { t } = useT();
  const [modalVisible, setModalVisible] = useState(false);
  const questions = item.questions ?? [];
  const hasAnswered = item.hasAnswered ?? false;

  const totalResponders = item.questions
    ? Math.max(...item.questions.map((q) => {
        const ans = q.myAnswer ? 1 : 0;
        return ans;
      }), 0)
    : 0;

  const initialAnswers: Record<number, string> = {};
  for (const q of questions) {
    if (q.myAnswer) initialAnswers[q.id] = q.myAnswer;
  }

  return (
    <View style={qStyles.container}>
      {questions.map((q, i) => (
        <View key={q.id} style={qStyles.row}>
          <Feather
            name="help-circle"
            size={13}
            color={colors.mutedForeground}
            style={{ marginTop: 3 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={[qStyles.prompt, { color: colors.foreground }]}>
              {i + 1}. {q.prompt}
            </Text>
            {q.myAnswer ? (
              <Text
                style={[qStyles.myAnswer, { color: colors.mutedForeground }]}
                numberOfLines={3}
              >
                → {q.myAnswer}
              </Text>
            ) : null}
          </View>
        </View>
      ))}

      <View style={qStyles.btnRow}>
        <Pressable
          onPress={() => setModalVisible(true)}
          style={[
            qStyles.answerBtn,
            {
              backgroundColor: hasAnswered ? colors.card : colors.primary,
              borderColor: hasAnswered ? colors.border : colors.primary,
            },
          ]}
        >
          <Feather
            name={hasAnswered ? "edit-2" : "message-square"}
            size={13}
            color={hasAnswered ? colors.foreground : "#fff"}
          />
          <Text
            style={[
              qStyles.answerBtnText,
              { color: hasAnswered ? colors.foreground : "#fff" },
            ]}
          >
            {hasAnswered ? t("networks.feedAnsweredLabel") : t("networks.feedAnswerBtn")}
          </Text>
        </Pressable>

        {isAdmin && (
          <Pressable
            onPress={onViewResponses}
            style={[
              qStyles.answerBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="eye" size={13} color={colors.mutedForeground} />
            <Text style={[qStyles.answerBtnText, { color: colors.mutedForeground }]}>
              {t("networks.feedViewResponses", { count: totalResponders })}
            </Text>
          </Pressable>
        )}
      </View>

      <AnswerModal
        visible={modalVisible}
        questions={questions}
        initialAnswers={initialAnswers}
        onSubmit={(answers) => {
          setModalVisible(false);
          onAnswer(answers);
        }}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const qStyles = StyleSheet.create({
  container: { marginTop: 12, gap: 8 },
  row: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  prompt: { fontSize: 14, lineHeight: 20 },
  myAnswer: { fontSize: 13, lineHeight: 18, marginTop: 2, fontStyle: "italic" },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  answerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  answerBtnText: { fontSize: 13, fontWeight: "600" },
});

// ── AnnouncementCard (public API) ─────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  post: "bell",
  poll: "bar-chart-2",
  questionnaire: "help-circle",
};

export interface AnnouncementCardProps {
  item: Announcement;
  isAdmin: boolean;
  onDelete: (id: number) => void;
  onPin: (id: number) => void;
  onUnpin: (id: number) => void;
  onVote: (annId: number, optionId: number) => void;
  onAnswer: (
    annId: number,
    answers: { questionId: number; text: string }[],
  ) => void;
  onEdited?: () => void;
}

export function AnnouncementCard({
  item,
  isAdmin,
  onDelete,
  onPin,
  onUnpin,
  onVote,
  onAnswer,
  onEdited,
}: AnnouncementCardProps) {
  const colors = useColors();
  const { t } = useT();
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [responsesModalVisible, setResponsesModalVisible] = useState(false);

  function handleLongPress() {
    if (!isAdmin) return;
    const pinOption = item.isPinned
      ? { text: t("networks.feedUnpin"), onPress: () => onUnpin(item.id) }
      : { text: t("networks.feedPin"), onPress: () => onPin(item.id) };

    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: t("common.cancel"), style: "cancel" },
      pinOption,
    ];

    if (item.type === "post") {
      buttons.push({
        text: t("networks.feedEditPost"),
        onPress: () => setEditModalVisible(true),
      });
    }

    buttons.push({
      text: t("networks.feedDeleteOk"),
      style: "destructive",
      onPress: () => onDelete(item.id),
    });

    Alert.alert(
      item.isPinned ? t("networks.feedUnpin") : t("networks.feedPin"),
      undefined,
      buttons,
    );
  }

  const icon = (TYPE_ICON[item.type] ?? "bell") as React.ComponentProps<
    typeof Feather
  >["name"];

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={400}
      style={[
        cardStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      {/* Header */}
      <View style={cardStyles.header}>
        <View style={cardStyles.headerLeft}>
          {item.isPinned ? (
            <Feather name="bookmark" size={13} color={colors.primary} />
          ) : (
            <Feather name={icon} size={13} color={colors.mutedForeground} />
          )}
          <Text style={[cardStyles.timestamp, { color: colors.mutedForeground }]}>
            {timeAgo(item.createdAt)}
          </Text>
        </View>
        {isAdmin && (
          <Feather name="more-horizontal" size={16} color={colors.mutedForeground} />
        )}
      </View>

      {/* Author */}
      {item.authorDisplayName ? (
        <View style={cardStyles.authorRow}>
          {item.authorPhotoUrl ? (
            <Image
              source={{ uri: item.authorPhotoUrl }}
              style={cardStyles.authorAvatar}
            />
          ) : (
            <View
              style={[
                cardStyles.authorAvatarFallback,
                { backgroundColor: colors.border },
              ]}
            >
              <Feather name="user" size={10} color={colors.mutedForeground} />
            </View>
          )}
          <Text
            style={[cardStyles.authorName, { color: colors.mutedForeground }]}
          >
            {item.authorDisplayName}
          </Text>
        </View>
      ) : null}

      {/* Photo above body */}
      {item.photoUrl ? (
        <Pressable
          onPress={() => setLightboxVisible(true)}
          style={cardStyles.photoWrapper}
        >
          <Image
            source={{ uri: item.photoUrl }}
            style={cardStyles.photo}
            resizeMode="cover"
          />
        </Pressable>
      ) : null}

      {/* Body */}
      <Text style={[cardStyles.body, { color: colors.foreground }]}>{item.body}</Text>

      {/* Poll */}
      {item.type === "poll" ? (
        <PollSection item={item} onVote={(optionId) => onVote(item.id, optionId)} />
      ) : null}

      {/* Questionnaire */}
      {item.type === "questionnaire" ? (
        <QuestionnaireSection
          item={item}
          isAdmin={isAdmin}
          onAnswer={(answers) => onAnswer(item.id, answers)}
          onViewResponses={() => setResponsesModalVisible(true)}
        />
      ) : null}

      {/* Lightbox */}
      {item.photoUrl ? (
        <PhotoLightbox
          uri={item.photoUrl}
          visible={lightboxVisible}
          onClose={() => setLightboxVisible(false)}
        />
      ) : null}

      {/* Edit post modal */}
      {editModalVisible && (
        <EditPostModal
          visible={editModalVisible}
          item={item}
          onClose={() => setEditModalVisible(false)}
          onSaved={() => onEdited?.()}
        />
      )}

      {/* Responses modal */}
      {responsesModalVisible && (
        <ResponsesModal
          visible={responsesModalVisible}
          item={item}
          onClose={() => setResponsesModalVisible(false)}
        />
      )}
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  timestamp: { fontSize: 12 },
  body: { fontSize: 15, lineHeight: 22 },
  photoWrapper: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  photo: { width: "100%", height: 200 },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  authorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  authorAvatarFallback: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  authorName: { fontSize: 12, fontWeight: "500" },
});
