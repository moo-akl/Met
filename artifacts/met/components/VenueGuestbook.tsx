/**
 * VenueGuestbook — handwritten notes left by visitors at a real place.
 *
 * Visual language: a paper guestbook pinned inside the venue page. Notes sit
 * on warm cream paper with faint ruled lines and a slight, deterministic tilt;
 * visit photos are taped-on prints. Text uses the platform's native handwriting
 * face (iOS Noteworthy, Android cursive, web cursive) — no new font loading.
 *
 * Entries never expire. Authors can delete their own notes; everyone else can
 * report a note or block its author (Apple Guideline 1.2).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/contexts/AppContext";
import {
  api,
  ApiError,
  type VenueGuestbookEntry,
  type VenueGuestbookReportReason,
} from "@/lib/api/client";
import { isLegacyUserId } from "@/lib/auth";
import { COMPLETE_PROFILE_HREF } from "@/lib/profileCompletion";

// ─── palette (matches venue page: warm white + coral) ────────────────────────
const CORAL = "#FF385C";
const INK = "#2B2A4C"; // blue-black fountain ink
const INK_SOFT = "#5A5876";
const PAPER = "#FFF9EE";
const PAPER_ALT = "#FBF3E4";
const RULE = "#EADFCB";
const TAPE = "rgba(255, 214, 170, 0.78)";
const TEXT = "#222222";
const TEXT2 = "#484848";
const MUTED = "#9CA3AF";
const CARD = "#FFFFFF";
const BORDER = "#F0F0F0";

const HAND = Platform.select({ ios: "Noteworthy", android: "cursive", default: "cursive" });
const HAND_BOLD = Platform.select({ ios: "Noteworthy-Bold", android: "cursive", default: "cursive" });

const MAX_NOTE = 500;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

const REPORT_REASONS: { key: VenueGuestbookReportReason; label: string }[] = [
  { key: "inappropriate", label: "Inappropriate" },
  { key: "offensive_image", label: "Offensive image" },
  { key: "spam", label: "Spam" },
  { key: "harassment", label: "Harassment" },
  { key: "other", label: "Something else" },
];

function tiltFor(id: number): string {
  const steps = [-1.2, 0.8, -0.4, 1.1, -0.9, 0.5];
  return `${steps[Math.abs(id) % steps.length]}deg`;
}

function visitDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "M";
}

// ─── types ───────────────────────────────────────────────────────────────────
type SheetState =
  | { kind: "menu"; entry: VenueGuestbookEntry }
  | { kind: "report"; entry: VenueGuestbookEntry }
  | { kind: "confirmDelete"; entry: VenueGuestbookEntry }
  | { kind: "confirmBlock"; entry: VenueGuestbookEntry }
  | { kind: "message"; title: string; body: string }
  | null;

interface Draft {
  note: string;
  photoUri: string | null;
  photoBase64: string | null;
  /** Idempotency key; kept across retries of this draft, reset on success/discard. */
  clientId: string | null;
}

const EMPTY_DRAFT: Draft = { note: "", photoUri: null, photoBase64: null, clientId: null };

function safeUUID(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === "function") return g.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── component ───────────────────────────────────────────────────────────────
export function VenueGuestbook({
  placeId,
  placeName,
  isDemo,
  qrVerified,
}: {
  placeId: string;
  placeName: string;
  isDemo: boolean;
  qrVerified: boolean;
}) {
  const { authedUid } = useApp();
  const router = useRouter();
  const canNetwork = !isDemo && !!authedUid && !!placeId;
  const writesAllowed = canNetwork && !isLegacyUserId(authedUid ?? "");

  const [entries, setEntries] = useState<VenueGuestbookEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [canPost, setCanPost] = useState(false);
  const [eligibility, setEligibility] = useState<"profile" | "checkin" | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const [sheet, setSheet] = useState<SheetState>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const genRef = useRef(0);

  const loadFirst = useCallback(async () => {
    if (!canNetwork || !authedUid) {
      setLoading(false);
      return;
    }
    const gen = ++genRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const page = await api.getVenueGuestbook({ uid: authedUid }, placeId);
      if (gen !== genRef.current) return;
      setEntries(page.entries);
      setNextCursor(page.nextCursor);
      setCanPost(page.canPost);
      setEligibility(page.eligibility);
    } catch {
      if (gen === genRef.current) setLoadError(true);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [authedUid, canNetwork, placeId]);

  useEffect(() => { void loadFirst(); }, [loadFirst]);

  // A fresh QR check-in may change eligibility — re-read the page.
  useEffect(() => {
    if (qrVerified && eligibility === "checkin") void loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrVerified]);

  const loadMore = async () => {
    if (!authedUid || nextCursor == null || loadingMore) return;
    setLoadingMore(true);
    setMoreError(false);
    const gen = genRef.current;
    try {
      const page = await api.getVenueGuestbook({ uid: authedUid }, placeId, nextCursor);
      if (gen !== genRef.current) return;
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...page.entries.filter((e) => !seen.has(e.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  // ── composer ──────────────────────────────────────────────────────────────
  const openComposer = () => {
    if (!writesAllowed) {
      setSheet({
        kind: "message",
        title: isDemo ? "Sample venue" : "Sign in to sign the book",
        body: isDemo
          ? "This is an illustrative preview. Notes can't be left here."
          : "Leaving a note needs a signed-in Met account.",
      });
      return;
    }
    setSubmitError(null);
    setPhotoError(null);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    if (submitting) return;
    setComposerOpen(false); // draft is kept until it's posted or discarded
  };

  const discardDraft = () => {
    if (submitting) return;
    setDraft(EMPTY_DRAFT);
    setConsent(false);
    setComposerOpen(false);
  };

  const pickPhoto = async () => {
    if (submitting || picking) return;
    setPhotoError(null);
    setPicking(true);
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setPhotoError("Photo access is off. You can enable it in Settings.");
          return;
        }
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.72,
        base64: true,
        exif: false,
        allowsEditing: Platform.OS !== "web",
        aspect: [4, 5],
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const resize = asset.width > 1600 || asset.height > 1600
        ? [{ resize: asset.width >= asset.height ? { width: 1600 } : { height: 1600 } }]
        : [];
      // Normalizes HEIC/PNG and camera orientation into a compact JPEG.
      // Re-encoding discards original EXIF; the server strips it again.
      const converted = await manipulateAsync(asset.uri, resize, {
        compress: 0.72, format: SaveFormat.JPEG, base64: true,
      });
      const b64 = converted.base64 ?? null;
      if (!b64) {
        setPhotoError("We couldn't read that photo. Try another one.");
        return;
      }
      if (Math.floor((b64.length * 3) / 4) > MAX_PHOTO_BYTES) {
        setPhotoError("That photo is over 4 MB. Try a smaller one.");
        return;
      }
      setDraft((d) => ({ ...d, photoUri: converted.uri, photoBase64: b64, clientId: null }));
    } catch {
      setPhotoError("We couldn't open your photos. Please try again.");
    } finally {
      setPicking(false);
    }
  };

  const trimmed = draft.note.trim();
  const canSubmit = trimmed.length >= 1 && trimmed.length <= MAX_NOTE && consent && !submitting;

  const submit = async () => {
    if (!canSubmit || !authedUid || !writesAllowed) return;
    setSubmitting(true);
    setSubmitError(null);
    const clientId = draft.clientId ?? safeUUID();
    if (!draft.clientId) setDraft((d) => ({ ...d, clientId }));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      await api.createVenueGuestbookEntry({ uid: authedUid, signal: controller.signal }, placeId, {
        note: trimmed,
        clientId,
        ...(draft.photoBase64 ? { photoBase64: draft.photoBase64 } : {}),
      });
      setDraft(EMPTY_DRAFT);
      setConsent(false);
      setComposerOpen(false);
      await loadFirst();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 422
          ? "This photo couldn't be accepted by our safety check. Remove it or choose a different photo from your visit."
          : err instanceof ApiError && err.status === 503
          ? "Photo checks are temporarily unavailable. Your note is saved here, so try again in a few minutes or post without the photo."
          : err instanceof ApiError && err.status === 403
          ? "You'll need a completed profile and a QR check-in here to sign."
          : err instanceof ApiError && err.status === 413
            ? "That photo is too large. Try a smaller one."
            : "Your note didn't send. It's still here — try again.";
      setSubmitError(msg);
    } finally {
      clearTimeout(timeout);
      setSubmitting(false);
    }
  };

  // ── moderation actions ────────────────────────────────────────────────────
  const runAction = async (fn: () => Promise<unknown>, removeId: number | null, removeUid: string | null, done: { title: string; body: string }) => {
    if (!authedUid || !writesAllowed) return;
    setSheetBusy(true);
    try {
      await fn();
      setEntries((prev) =>
        prev.filter((e) => (removeId == null || e.id !== removeId) && (removeUid == null || e.authorUid !== removeUid)),
      );
      setSheet({ kind: "message", ...done });
    } catch {
      setSheet({ kind: "message", title: "Something went wrong", body: "Please try again in a moment." });
    } finally {
      setSheetBusy(false);
    }
  };

  const doDelete = (entry: VenueGuestbookEntry) =>
    runAction(
      () => api.deleteVenueGuestbookEntry({ uid: authedUid! }, placeId, entry.id),
      entry.id, null,
      { title: "Note removed", body: "Your note has been taken out of the guestbook." },
    );
  const doReport = (entry: VenueGuestbookEntry, reason: VenueGuestbookReportReason) =>
    runAction(
      () => api.reportVenueGuestbookEntry({ uid: authedUid! }, placeId, entry.id, reason),
      entry.id, null,
      { title: "Thanks for telling us", body: "The note is hidden for you. Our team reviews every report within 24 hours." },
    );
  const doBlock = (entry: VenueGuestbookEntry) =>
    runAction(
      () => api.blockVenueGuestbookAuthor({ uid: authedUid! }, placeId, entry.id),
      null, entry.authorUid,
      { title: `${entry.displayName} blocked`, body: "You won't see their guestbook notes at any venue." },
    );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <View>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>GUESTBOOK</Text>
          <Text style={s.title}>Left behind at {placeName}</Text>
          <Text style={s.subtitle}>Notes and photos from people who were here. Kept for good.</Text>
        </View>
      </View>

      {/* Eligibility / sign CTA */}
      {canNetwork && !loading && !loadError && (
        canPost ? (
          <Pressable
            style={({ pressed }) => [s.signCta, pressed && { opacity: 0.85 }]}
            onPress={openComposer}
            accessibilityRole="button"
            accessibilityLabel="Sign the guestbook"
            testID="guestbook-sign"
          >
            <Feather name="feather" size={18} color={CORAL} />
            <Text style={s.signCtaText}>{draft.note || draft.photoUri ? "Continue your note" : "Sign the guestbook"}</Text>
            <Feather name="chevron-right" size={18} color={MUTED} />
          </Pressable>
        ) : eligibility === "profile" ? (
          <GateCard
            icon="user"
            title="Finish your profile to sign"
            body="Guestbook notes show your name and photo, so a complete profile comes first."
            cta="Complete profile"
            onPress={() => router.push(COMPLETE_PROFILE_HREF as never)}
          />
        ) : eligibility === "checkin" ? (
          <GateCard
            icon="maximize"
            title="Here right now? Scan in to sign"
            body="Only visitors who scan the venue's QR code can leave a note."
            cta="Open scanner"
            onPress={() =>
              router.push({ pathname: "/qr-scan", params: { placeId, placeName } } as never)
            }
          />
        ) : null
      )}

      {/* List */}
      {isDemo ? (
        <View style={{ gap: 18 }}>
          <Text style={s.sampleBanner}>SAMPLE CONTENT FOR PREVIEW ONLY. These are not real visitor posts.</Text>
          {SAMPLE_ENTRIES.map((e, i) => (
            <NoteCard key={e.id} entry={e} sample photoSource={i === 0 ? SAMPLE_PHOTO : undefined} />
          ))}
        </View>
      ) : !authedUid ? (
        <EmptyBook text="Sign in to read notes visitors left here." />
      ) : loading ? (
        <View style={{ gap: 14 }}>
          {[0, 1].map((i) => (
            <View key={i} style={[s.note, s.skeleton, { transform: [{ rotate: tiltFor(i) }] }]}>
              <View style={[s.skelLine, { width: "40%" }]} />
              <View style={[s.skelLine, { width: "90%" }]} />
              <View style={[s.skelLine, { width: "70%" }]} />
            </View>
          ))}
        </View>
      ) : loadError ? (
        <View style={s.errorBox}>
          <Feather name="cloud-off" size={20} color={MUTED} />
          <Text style={s.errorText}>The guestbook didn't load.</Text>
          <Pressable onPress={() => void loadFirst()} accessibilityRole="button" style={s.retryBtn}>
            <Text style={s.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : entries.length === 0 ? (
        <EmptyBook text={canPost ? "No one has signed yet. The first page is yours." : "No notes yet. The first page is still blank."} />
      ) : (
        <View style={{ gap: 18 }}>
          {entries.map((e) => (
            <NoteCard
              key={e.id}
              entry={e}
              onMenu={() => setSheet({ kind: "menu", entry: e })}
              onPhoto={() => e.photoUrl && setViewerUrl(e.photoUrl)}
            />
          ))}
          {nextCursor != null && (
            <Pressable
              onPress={() => void loadMore()}
              disabled={loadingMore}
              style={s.moreBtn}
              accessibilityRole="button"
              accessibilityLabel="Load older notes"
            >
              {loadingMore ? (
                <ActivityIndicator color={INK_SOFT} />
              ) : (
                <Text style={s.moreText}>{moreError ? "Couldn't load. Tap to retry" : "Turn back a page"}</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      {/* ── Composer ── */}
      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={closeComposer}>
        <Composer
          placeName={placeName}
          draft={draft}
          setNote={(note) => setDraft((d) => ({ ...d, note, clientId: null }))}
          removePhoto={() => setDraft((d) => ({ ...d, photoUri: null, photoBase64: null, clientId: null }))}
          pickPhoto={() => void pickPhoto()}
          picking={picking}
          consent={consent}
          toggleConsent={() => !submitting && setConsent((c) => !c)}
          submitting={submitting}
          canSubmit={canSubmit}
          submit={() => void submit()}
          close={closeComposer}
          discard={discardDraft}
          submitError={submitError}
          photoError={photoError}
        />
      </Modal>

      {/* ── Action sheet ── */}
      <Modal visible={sheet !== null} transparent animationType="fade" onRequestClose={() => !sheetBusy && setSheet(null)}>
        <ActionSheet
          sheet={sheet}
          busy={sheetBusy}
          isMine={(e) => e.authorUid === authedUid}
          close={() => !sheetBusy && setSheet(null)}
          setSheet={setSheet}
          onDelete={(e) => void doDelete(e)}
          onReport={(e, r) => void doReport(e, r)}
          onBlock={(e) => void doBlock(e)}
        />
      </Modal>

      {/* ── Photo viewer ── */}
      <Modal visible={viewerUrl !== null} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <PhotoViewer url={viewerUrl} close={() => setViewerUrl(null)} />
      </Modal>
    </View>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

// Read-only illustrative fixtures for the store screenshot demo only.
const SAMPLE_PHOTO = require("../assets/images/rewards_trophy.jpg") as number;
const SAMPLE_ENTRIES: VenueGuestbookEntry[] = [
  {
    id: -1, authorUid: "sample-guestbook-1", displayName: "Sample visitor",
    avatarUrl: null, photoUrl: null, createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    note: "Came in for one coffee, stayed for three and a long talk at the community table. Thank you for the window seat.",
  },
  {
    id: -2, authorUid: "sample-guestbook-2", displayName: "Sample visitor",
    avatarUrl: null, photoUrl: null, createdAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    note: "Rainy Tuesday, warm room. I'll be back on Saturday for the records.",
  },
];

function NoteCard({ entry, onMenu, onPhoto, sample, photoSource }: { entry: VenueGuestbookEntry; onMenu?: () => void; onPhoto?: () => void; sample?: boolean; photoSource?: number }) {
  return (
    <View style={[s.note, { transform: [{ rotate: tiltFor(entry.id) }] }]}>
      <View style={s.margin} />
      {sample ? <Text style={s.sampleTag}>SAMPLE MEMORY</Text> : null}
      {photoSource != null ? (
        <View style={[s.print, { transform: [{ rotate: "-2.5deg" }] }]} accessibilityLabel="Sample photo">
          <View style={s.tape} />
          <Image source={photoSource} style={s.printImg} contentFit="cover" />
        </View>
      ) : entry.photoUrl ? (
        <Pressable
          onPress={onPhoto}
          style={[s.print, { transform: [{ rotate: entry.id % 2 ? "2deg" : "-2.5deg" }] }]}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Photo from ${entry.displayName}'s visit. Open full size`}
        >
          <View style={s.tape} />
          <Image source={{ uri: entry.photoUrl }} style={s.printImg} contentFit="cover" transition={200} />
        </Pressable>
      ) : null}
      <Text style={s.noteText}>{entry.note}</Text>
      <View style={s.signRow}>
        {entry.avatarUrl ? (
          <Image source={{ uri: entry.avatarUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarInitials}>{initials(entry.displayName)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.signName} numberOfLines={1}>— {entry.displayName}</Text>
          <Text style={s.signDate}>{visitDate(entry.createdAt)}</Text>
        </View>
        {onMenu ? <Pressable onPress={onMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="Note options" style={s.menuBtn}>
          <Feather name="more-horizontal" size={18} color={MUTED} />
        </Pressable> : null}
      </View>
    </View>
  );
}

function GateCard({ icon, title, body, cta, onPress }: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; body: string; cta: string; onPress: () => void }) {
  return (
    <View style={s.gate}>
      <View style={s.gateIcon}><Feather name={icon} size={18} color={CORAL} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.gateTitle}>{title}</Text>
        <Text style={s.gateBody}>{body}</Text>
        <Pressable onPress={onPress} style={s.gateBtn} accessibilityRole="button">
          <Text style={s.gateBtnText}>{cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EmptyBook({ text }: { text: string }) {
  return (
    <View style={[s.note, s.empty]}>
      <View style={s.margin} />
      <Feather name="book-open" size={22} color={INK_SOFT} />
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

function Composer(p: {
  placeName: string;
  draft: Draft;
  setNote: (n: string) => void;
  removePhoto: () => void;
  pickPhoto: () => void;
  picking: boolean;
  consent: boolean;
  toggleConsent: () => void;
  submitting: boolean;
  canSubmit: boolean;
  submit: () => void;
  close: () => void;
  discard: () => void;
  submitError: string | null;
  photoError: string | null;
}) {
  const insets = useSafeAreaInsets();
  const len = p.draft.note.length;
  const hasDraft = !!p.draft.note || !!p.draft.photoUri;
  return (
    <View style={s.modalRoot}>
      <Pressable style={s.backdrop} onPress={p.close} accessibilityLabel="Close composer" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16), maxHeight: "92%" }]}>
        <View style={s.sheetTop}>
          <Pressable onPress={p.close} disabled={p.submitting} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <Feather name="x" size={22} color={p.submitting ? MUTED : TEXT} />
          </Pressable>
          <Text style={s.sheetTitle}>Sign the guestbook</Text>
          {hasDraft ? (
            <Pressable onPress={p.discard} disabled={p.submitting} hitSlop={10} accessibilityRole="button">
              <Text style={[s.discard, p.submitting && { color: MUTED }]}>Discard</Text>
            </Pressable>
          ) : <View style={{ width: 52 }} />}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={[s.note, s.composeNote]}>
            <View style={s.margin} />
            <Text style={s.composeLead}>Dear {p.placeName},</Text>
            <TextInput
              value={p.draft.note}
              onChangeText={(t) => p.setNote(t.slice(0, MAX_NOTE))}
              editable={!p.submitting}
              multiline
              maxLength={MAX_NOTE}
              placeholder="What will you remember about today?"
              placeholderTextColor="#B8AE9C"
              style={s.composeInput}
              accessibilityLabel="Your guestbook note"
              testID="guestbook-note-input"
            />
            <Text style={[s.counter, len > MAX_NOTE - 40 && { color: CORAL }]}>{len}/{MAX_NOTE}</Text>
          </View>

          {p.draft.photoUri ? (
            <View style={s.previewWrap}>
              <View style={[s.print, s.previewPrint]}>
                <View style={s.tape} />
                <Image source={{ uri: p.draft.photoUri }} style={s.previewImg} contentFit="cover" />
              </View>
              <Pressable onPress={p.removePhoto} disabled={p.submitting} style={s.removePhoto} accessibilityRole="button" accessibilityLabel="Remove photo">
                <Feather name="trash-2" size={14} color={TEXT2} />
                <Text style={s.removePhotoText}>Remove photo</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={p.pickPhoto} disabled={p.submitting || p.picking} style={s.addPhoto} accessibilityRole="button" accessibilityLabel="Add a photo from your visit">
              {p.picking ? <ActivityIndicator color={INK_SOFT} /> : <Feather name="image" size={18} color={INK_SOFT} />}
              <Text style={s.addPhotoText}>Add a photo from your visit (optional)</Text>
            </Pressable>
          )}
          {p.photoError ? <Text style={s.inlineError}>{p.photoError}</Text> : null}

          <Pressable onPress={p.toggleConsent} style={s.consentRow} accessibilityRole="checkbox" accessibilityState={{ checked: p.consent, disabled: p.submitting }}>
            <View style={[s.checkbox, p.consent && s.checkboxOn]}>
              {p.consent ? <Feather name="check" size={14} color="#FFF" /> : null}
            </View>
            <Text style={s.consentText}>
              I understand this note{p.draft.photoUri ? " and photo" : ""} will be public on this venue's page with my name and profile photo, and stays until I delete it. I'll keep it kind and only share photos I took.
            </Text>
          </Pressable>

          {p.submitError ? <Text style={s.inlineError}>{p.submitError}</Text> : null}

          <Pressable
            onPress={p.submit}
            disabled={!p.canSubmit}
            style={[s.submit, !p.canSubmit && { opacity: 0.45 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !p.canSubmit, busy: p.submitting }}
            testID="guestbook-submit"
          >
            {p.submitting ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitText}>Leave my note</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

function ActionSheet(p: {
  sheet: SheetState;
  busy: boolean;
  isMine: (e: VenueGuestbookEntry) => boolean;
  close: () => void;
  setSheet: (s: SheetState) => void;
  onDelete: (e: VenueGuestbookEntry) => void;
  onReport: (e: VenueGuestbookEntry, r: VenueGuestbookReportReason) => void;
  onBlock: (e: VenueGuestbookEntry) => void;
}) {
  const insets = useSafeAreaInsets();
  const sh = p.sheet;
  if (!sh) return null;
  const Row = ({ label, onPress, danger, icon }: { label: string; onPress: () => void; danger?: boolean; icon?: React.ComponentProps<typeof Feather>["name"] }) => (
    <Pressable onPress={onPress} disabled={p.busy} style={({ pressed }) => [s.row, pressed && { backgroundColor: "#F7F4EF" }]} accessibilityRole="button">
      {icon ? <Feather name={icon} size={17} color={danger ? CORAL : TEXT2} /> : null}
      <Text style={[s.rowText, danger && { color: CORAL }]}>{label}</Text>
    </Pressable>
  );
  let title = "";
  let body: string | null = null;
  let content: React.ReactNode = null;
  if (sh.kind === "menu") {
    const mine = p.isMine(sh.entry);
    title = mine ? "Your note" : `Note by ${sh.entry.displayName}`;
    content = mine ? (
      <Row icon="trash-2" danger label="Delete my note" onPress={() => p.setSheet({ kind: "confirmDelete", entry: sh.entry })} />
    ) : (
      <>
        <Row icon="flag" label="Report note" onPress={() => p.setSheet({ kind: "report", entry: sh.entry })} />
        <Row icon="slash" danger label={`Block ${sh.entry.displayName}`} onPress={() => p.setSheet({ kind: "confirmBlock", entry: sh.entry })} />
      </>
    );
  } else if (sh.kind === "report") {
    title = "Why are you reporting this?";
    body = "The note will be hidden for you right away.";
    content = REPORT_REASONS.map((r) => <Row key={r.key} label={r.label} onPress={() => p.onReport(sh.entry, r.key)} />);
  } else if (sh.kind === "confirmDelete") {
    title = "Delete your note?";
    body = "It will be removed from this guestbook. This can't be undone.";
    content = <Row icon="trash-2" danger label="Delete" onPress={() => p.onDelete(sh.entry)} />;
  } else if (sh.kind === "confirmBlock") {
    title = `Block ${sh.entry.displayName}?`;
    body = "You won't see any of their guestbook notes, at this venue or any other.";
    content = <Row icon="slash" danger label="Block" onPress={() => p.onBlock(sh.entry)} />;
  } else {
    title = sh.title;
    body = sh.body;
  }
  return (
    <View style={s.modalRoot}>
      <Pressable style={s.backdrop} onPress={p.close} accessibilityLabel="Dismiss" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) }]}>
        <Text style={s.actionTitle}>{title}</Text>
        {body ? <Text style={s.actionBody}>{body}</Text> : null}
        {p.busy ? <ActivityIndicator color={CORAL} style={{ marginVertical: 16 }} /> : content}
        <Pressable onPress={p.close} disabled={p.busy} style={s.cancelBtn} accessibilityRole="button">
          <Text style={s.cancelText}>{sh.kind === "message" ? "Done" : "Cancel"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PhotoViewer({ url, close }: { url: string | null; close: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.viewer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close photo" />
      {url ? <Image source={{ uri: url }} style={s.viewerImg} contentFit="contain" accessibilityLabel="Visit photo, full size" /> : null}
      <Pressable
        onPress={close}
        style={[s.viewerClose, { top: insets.top + (Platform.OS === "web" ? 67 : 12) }]}
        accessibilityRole="button"
        accessibilityLabel="Close photo viewer"
        hitSlop={10}
      >
        <Feather name="x" size={22} color="#FFF" />
      </Pressable>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: { flexDirection: "row", marginBottom: 14 },
  kicker: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: MUTED, letterSpacing: 1.2, marginBottom: 4 },
  title: { fontSize: 22, fontFamily: HAND_BOLD, color: INK, fontWeight: Platform.OS === "android" ? "700" : undefined },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT2, marginTop: 4, lineHeight: 19 },

  signCta: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER, borderStyle: "dashed", borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 18,
  },
  signCtaText: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: TEXT },

  gate: {
    flexDirection: "row", gap: 12, backgroundColor: CARD, borderRadius: 14, borderWidth: 1,
    borderColor: BORDER, padding: 14, marginBottom: 18,
  },
  gateIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${CORAL}14`, alignItems: "center", justifyContent: "center" },
  gateTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: TEXT },
  gateBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: TEXT2, lineHeight: 19, marginTop: 2 },
  gateBtn: { alignSelf: "flex-start", backgroundColor: CORAL, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginTop: 10 },
  gateBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFF" },

  note: {
    backgroundColor: PAPER, borderRadius: 4, paddingVertical: 16, paddingRight: 16, paddingLeft: 30,
    borderWidth: 1, borderColor: RULE,
    shadowColor: "#7A5A2E", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  margin: { position: "absolute", left: 18, top: 0, bottom: 0, width: 1, backgroundColor: `${CORAL}55` },
  noteText: { fontSize: 18, lineHeight: 27, fontFamily: HAND, color: INK },
  signRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 10 },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  avatarFallback: { backgroundColor: PAPER_ALT, borderWidth: 1, borderColor: RULE, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 11, fontFamily: "Inter_700Bold", color: INK_SOFT },
  signName: { fontSize: 16, fontFamily: HAND_BOLD, color: INK },
  signDate: { fontSize: 11, fontFamily: "Inter_500Medium", color: MUTED, marginTop: 1 },
  menuBtn: { padding: 4 },

  print: {
    alignSelf: "flex-start", backgroundColor: "#FFFDF8", padding: 8, paddingBottom: 22, marginBottom: 14,
    shadowColor: "#3B2A14", shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  printImg: { width: 168, height: 210, backgroundColor: PAPER_ALT },
  tape: {
    position: "absolute", top: -9, alignSelf: "center", left: "32%", width: 64, height: 20,
    backgroundColor: TAPE, transform: [{ rotate: "-4deg" }], zIndex: 2,
  },

  skeleton: { gap: 10 },
  sampleBanner: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: CORAL, letterSpacing: 0.6 },
  sampleTag: { alignSelf: "flex-start", fontSize: 10, fontFamily: "Inter_700Bold", color: CORAL, letterSpacing: 1, marginBottom: 8 },
  skelLine: { height: 12, borderRadius: 6, backgroundColor: RULE },
  empty: { alignItems: "center", gap: 10, paddingVertical: 26 },
  emptyText: { fontSize: 17, fontFamily: HAND, color: INK_SOFT, textAlign: "center", lineHeight: 25 },
  errorBox: { alignItems: "center", gap: 8, paddingVertical: 20, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER },
  errorText: { fontSize: 14, fontFamily: "Inter_500Medium", color: TEXT2 },
  retryBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  retryText: { fontSize: 14, fontFamily: "Inter_700Bold", color: CORAL },
  moreBtn: { alignSelf: "center", paddingHorizontal: 18, paddingVertical: 10, minHeight: 40, justifyContent: "center" },
  moreText: { fontSize: 17, fontFamily: HAND_BOLD, color: INK_SOFT, textDecorationLine: "underline" },

  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(34,28,20,0.4)" },
  sheet: { backgroundColor: "#FBF8F3", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  sheetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  sheetTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: TEXT },
  discard: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: CORAL },
  composeNote: { minHeight: 200, marginBottom: 14 },
  composeLead: { fontSize: 18, fontFamily: HAND_BOLD, color: INK, marginBottom: 4 },
  composeInput: { fontSize: 18, lineHeight: 27, fontFamily: HAND, color: INK, minHeight: 130, textAlignVertical: "top", padding: 0 },
  counter: { alignSelf: "flex-end", fontSize: 11, fontFamily: "Inter_500Medium", color: MUTED, marginTop: 6 },
  addPhoto: {
    flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#D9CDB8",
    borderRadius: 12, padding: 14, marginBottom: 8,
  },
  addPhotoText: { fontSize: 14, fontFamily: "Inter_500Medium", color: INK_SOFT },
  previewWrap: { alignItems: "center", marginBottom: 8, marginTop: 8 },
  previewPrint: { alignSelf: "center", transform: [{ rotate: "-1.5deg" }] },
  previewImg: { width: 180, height: 225, backgroundColor: PAPER_ALT },
  removePhoto: { flexDirection: "row", alignItems: "center", gap: 6, padding: 6 },
  removePhotoText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: TEXT2 },
  inlineError: { fontSize: 13, fontFamily: "Inter_500Medium", color: CORAL, marginBottom: 8 },
  consentRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginVertical: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#C9BFAE", alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxOn: { backgroundColor: CORAL, borderColor: CORAL },
  consentText: { flex: 1, fontSize: 12.5, fontFamily: "Inter_400Regular", color: TEXT2, lineHeight: 18 },
  submit: { backgroundColor: CORAL, borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 6, marginBottom: 6 },
  submitText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },

  actionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: TEXT, marginBottom: 4 },
  actionBody: { fontSize: 14, fontFamily: "Inter_400Regular", color: TEXT2, lineHeight: 20, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#EFE9DF" },
  rowText: { fontSize: 15, fontFamily: "Inter_500Medium", color: TEXT },
  cancelBtn: { marginTop: 12, paddingVertical: 13, borderRadius: 12, backgroundColor: "#EFE9DF", alignItems: "center" },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: TEXT },

  viewer: { flex: 1, backgroundColor: "rgba(15,12,8,0.94)", alignItems: "center", justifyContent: "center" },
  viewerImg: { width: "100%", height: "80%" },
  viewerClose: {
    position: "absolute", right: 16, width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center",
  },
});
