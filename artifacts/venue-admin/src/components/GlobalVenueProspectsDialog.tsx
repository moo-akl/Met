import { useEffect, useMemo, useRef, useState } from "react";
import {
  sendManualVenueEmail,
  type VenueEmailTemplate,
  type VenueManualEmailInput,
  type VenueOutreachHistoryEntry,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { templatePreview } from "./VenueEmailTemplateManager";
import {
  GLOBAL_VENUE_PROSPECTS,
  type GlobalVenueProspect,
  type VenueFitTier,
} from "./globalVenueProspects";
import {
  getVenueSendErrorMessage,
  isConfirmedVenueSendFailure,
  sendVenueBatch,
  shouldContinueGlobalVenueProspectBatchAfterFailure,
} from "./venue-outreach-worklist";
import {
  capVenueProspectSelection,
  getConfirmedSentOutreachEmails,
  getNextTopFitVenueBatch,
  isManualProspectSelectionAllowed,
  MAX_VENUE_OUTREACH_BATCH,
} from "./global-venue-batch-selection";
import {
  createDefaultVenueIntroCopy,
  createPreviousVenueIntroCopyDefaults,
  removeRepeatedVenueName,
  restoreVenueIntroCopy,
  validateVenueIntroCopy,
  VENUE_INTRO_COPY_LIMITS,
  type VenueIntroProfileCopy,
} from "./venue-intro-profile-copy";
import { ADDITIONAL_STRONG_FIT_VENUE_PROSPECTS } from "./globalVenueAdditionalStrongFitProspects";
import { ADDITIONAL_TOP_FIT_VENUE_PROSPECTS } from "./globalVenueAdditionalTopFitProspects";
import { NEWEST_TOP_FIT_VENUE_PROSPECTS } from "./globalVenueNewestTopFitProspects";
import { BATCH2_TOP_FIT_VENUE_PROSPECTS } from "./globalVenueBatch2Prospects";
import { SPANISH_TOP_FIT_VENUE_PROSPECTS } from "./globalVenueSpanishTopFitProspects";
import { ENGLISH_TOP_FIT_VENUE_PROSPECTS } from "./globalVenueEnglishTopFitProspects";
import { NOVEMBER_2026_HOSPITALITY_PROSPECTS } from "./globalVenueNov2026HospitalityProspects";
import {
  makeNoReplyDrafts,
  NO_REPLY_TEMPLATE_ID,
} from "./venue-no-reply-campaign";

type CampaignMode = "prospects" | "no_reply";
type Draft = GlobalVenueProspect & {
  selected: boolean;
  pdfCopy: VenueIntroProfileCopy;
  placeId?: string;
  venueOwnerProfileId?: number;
  sourceGroupKey?: string;
  attemptedInSession?: boolean;
};
type VenueIntroProfile = Omit<VenueIntroProfileCopy, "venueCategory" | "venueLocation"> & {
  key: string;
  venueCategory?: string;
  venueLocation?: string;
};
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: VenueEmailTemplate[];
  history: VenueOutreachHistoryEntry[];
  suppressedEmails: string[];
  onSent: () => Promise<unknown>;
  mode?: CampaignMode;
};

const DRAFT_STORAGE_KEY = "met-global-venue-prospect-drafts-v1";
const TEMPLATE_ID = "global_venue_prospect";
const SPANISH_TEMPLATE_ID = "global_venue_prospect_es";
const FIRST_CONTACT_TEMPLATE_ID = "global_venue_prospect_first_contact";
const NEW_PROSPECT_IDS = new Set(ADDITIONAL_STRONG_FIT_VENUE_PROSPECTS.map((prospect) => prospect.id));
const NEW_TOP_FIT_IDS = new Set(ADDITIONAL_TOP_FIT_VENUE_PROSPECTS.map((prospect) => prospect.id));
const NEWEST_TOP_FIT_IDS = new Set(NEWEST_TOP_FIT_VENUE_PROSPECTS.map((prospect) => prospect.id));
const BATCH2_TOP_FIT_IDS = new Set(BATCH2_TOP_FIT_VENUE_PROSPECTS.map((prospect) => prospect.id));
const SPANISH_TOP_FIT_IDS = new Set(SPANISH_TOP_FIT_VENUE_PROSPECTS.map((prospect) => prospect.id));
const ENGLISH_TOP_FIT_IDS = new Set(ENGLISH_TOP_FIT_VENUE_PROSPECTS.map((prospect) => prospect.id));
const NOVEMBER_2026_HOSPITALITY_IDS = new Set(NOVEMBER_2026_HOSPITALITY_PROSPECTS.map((prospect) => prospect.id));
const MAX_BATCH_SIZE = MAX_VENUE_OUTREACH_BATCH;
const DRAFTS_PER_PAGE = 20;
const MAX_PDF_BYTES = 6_000_000;
const PDF_PAGE_WIDTH = 960;
const PDF_PAGE_HEIGHT = 540;
const SOURCE_WIDTH = 1920;
const SOURCE_HEIGHT = 1080;

type PreparedPdf = { fileName: string; url: string; blob: Blob; contentBase64: string };
const PDF_COPY_FIELDS: Array<{
  field: keyof VenueIntroProfileCopy;
  label: string;
  multiline?: boolean;
}> = [
  { field: "venueName", label: "Short PDF display name" },
  { field: "venueCategory", label: "Venue category" },
  { field: "venueLocation", label: "Location" },
  { field: "coverCopy", label: "Cover copy", multiline: true },
  { field: "slide2Heading", label: "Slide 2 heading" },
  { field: "slide2Copy", label: "Slide 2 copy", multiline: true },
  { field: "slide3Heading", label: "Slide 3 heading" },
  { field: "slide3Copy", label: "Slide 3 copy", multiline: true },
];

function VenuePdfCopyField({
  id,
  label,
  value,
  maxLength,
  multiline = false,
  error,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  multiline?: boolean;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const inputClassName = `mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm leading-5 text-slate-800 focus:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 ${
    error ? "border-red-400" : "border-slate-300"
  }`;
  const describedBy = error ? `${id}-error` : undefined;
  return (
    <label htmlFor={id} className={multiline ? "block sm:col-span-2" : "block"}>
      <span className="text-xs font-medium text-slate-700">{label}</span>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClassName} min-h-16 resize-y`}
        />
      ) : (
        <input
          id={id}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName}
        />
      )}
      <span className="mt-1 flex items-start justify-between gap-2 text-[11px] text-slate-500">
        {error ? (
          <span id={`${id}-error`} role="alert" className="text-red-700">{error}</span>
        ) : (
          <span>At least 2 characters</span>
        )}
        <span className="shrink-0">{value.length}/{maxLength}</span>
      </span>
    </label>
  );
}

function getNextBatch(
  prospects: GlobalVenueProspect[],
  suppressedEmails: string[],
  history: VenueOutreachHistoryEntry[],
): GlobalVenueProspect[] {
  return getNextTopFitVenueBatch(prospects, suppressedEmails, history);
}

function isEmailOutreachEligible(prospect: Pick<GlobalVenueProspect, "email" | "outreachHoldReason">): boolean {
  return prospect.email.trim().length > 0 && !prospect.outreachHoldReason?.trim();
}

function makeDrafts(
  suppressedEmails: string[],
  history: VenueOutreachHistoryEntry[],
): Draft[] {
  const defaultIds = new Set(getNextBatch(GLOBAL_VENUE_PROSPECTS, suppressedEmails, history).map(({ id }) => id));
  let saved: Record<string, { fitReason?: unknown; pdfCopy?: unknown; selected?: unknown }> = {};
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) saved = JSON.parse(raw) as typeof saved;
  } catch {
    // A malformed local draft should not prevent the admin from rebuilding defaults.
  }
  return GLOBAL_VENUE_PROSPECTS.map((prospect) => {
    const previous = saved[prospect.id];
    const language = prospect.outreachLanguage ?? "en";
    const defaultPdfCopy = createDefaultVenueIntroCopy({
      venueName: prospect.name,
      pdfDisplayName: prospect.pdfDisplayName,
      venueCategory: prospect.category,
      venueLocation: prospect.location,
      coverCopy: prospect.fitReason,
      pdfHook: prospect.pdfHook,
      language,
    });
    const previousPdfCopyDefaults = [
      ...createPreviousVenueIntroCopyDefaults({
        venueName: prospect.name,
        venueCategory: prospect.category,
        venueLocation: prospect.location,
        coverCopy: prospect.fitReason,
      }),
      ...(language === "es" ? [createDefaultVenueIntroCopy({
        venueName: prospect.name,
        pdfDisplayName: prospect.pdfDisplayName,
        venueCategory: prospect.category,
        venueLocation: prospect.location,
        coverCopy: prospect.fitReason,
        pdfHook: prospect.pdfHook,
        language: "en",
      })] : []),
    ];
    const restoredPdfCopy = restoreVenueIntroCopy(
      previous?.pdfCopy,
      defaultPdfCopy,
      previousPdfCopyDefaults,
    );
    const pdfCopy = {
      ...restoredPdfCopy,
      coverCopy: removeRepeatedVenueName(
        removeRepeatedVenueName(restoredPdfCopy.coverCopy, prospect.name, language),
        restoredPdfCopy.venueName,
        language,
      ),
    };
    return {
      ...prospect,
      fitReason: typeof previous?.fitReason === "string" ? previous.fitReason : prospect.fitReason,
      selected: defaultIds.has(prospect.id),
      pdfCopy,
    };
  });
}

function makeIntroProfile(draft: Draft): VenueIntroProfile {
  const { venueCategory, venueLocation, ...copy } = draft.pdfCopy;
  return {
    key: draft.id.slice(0, 120),
    ...copy,
    ...(venueCategory.trim() ? { venueCategory } : {}),
    ...(venueLocation.trim() ? { venueLocation } : {}),
  };
}

function validateDraftPdfCopy(draft: Draft, mode: CampaignMode) {
  const errors = validateVenueIntroCopy(draft.pdfCopy);
  if (mode === "no_reply") {
    if (!draft.pdfCopy.venueCategory.trim()) delete errors.venueCategory;
    if (!draft.pdfCopy.venueLocation.trim()) delete errors.venueLocation;
  }
  return errors;
}

function filenamePart(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "Venue";
}

function waitForPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

async function waitForImages(container: ParentNode) {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    if (!image.complete) {
      await new Promise<void>((resolve, reject) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => reject(new Error(`Could not load slide image: ${image.src}`)), { once: true });
      });
    }
    if (!image.naturalWidth) throw new Error(`Could not load slide image: ${image.src}`);
    if (typeof image.decode === "function") await image.decode();
  }));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The prepared PDF could not be read."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("The prepared PDF could not be encoded."));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export default function GlobalVenueProspectsDialog({
  open,
  onOpenChange,
  templates,
  history,
  suppressedEmails,
  onSent,
  mode = "prospects",
}: Props) {
  const isNoReplyCampaign = mode === "no_reply";
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [step, setStep] = useState<"drafts" | "review" | "result">("drafts");
  const [expandedDraftPreviewIds, setExpandedDraftPreviewIds] = useState<Set<string>>(() => new Set());
  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<string>>(() => new Set());
  const [tierFilter, setTierFilter] = useState<VenueFitTier | "all" | "new" | "newTop" | "newestTop" | "batch2" | "spanish" | "english" | "nov2026">("all");
  const [draftPage, setDraftPage] = useState(0);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");
  const [pdfProgress, setPdfProgress] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [preparingPdfs, setPreparingPdfs] = useState(false);
  const [preparedPdfs, setPreparedPdfs] = useState<Record<string, PreparedPdf>>({});
  const [result, setResult] = useState<{ sent: number; rejected: number; uncertain: number; remaining: number; detail: string } | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const preparationCancelledRef = useRef(false);
  const suppressionRef = useRef(suppressedEmails);
  suppressionRef.current = suppressedEmails;
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    if (!open) return;
    setDrafts(isNoReplyCampaign
      ? makeNoReplyDrafts(historyRef.current, suppressionRef.current)
      : makeDrafts(suppressionRef.current, historyRef.current));
    setTierFilter("all");
    setDraftPage(0);
    setStep("drafts");
    setExpandedDraftPreviewIds(new Set());
    setExpandedReviewIds(new Set());
    setResult(null);
    setPdfError("");
    setPdfProgress("");
  }, [open, isNoReplyCampaign]);

  useEffect(() => {
    if (open) return;
    preparationCancelledRef.current = true;
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setPreparedPdfs({});
    setPdfError("");
    setPdfProgress("");
  }, [open]);

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (isNoReplyCampaign || !drafts.length) return;
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(
        Object.fromEntries(drafts.map((draft) => [draft.id, {
          fitReason: draft.fitReason,
          pdfCopy: draft.pdfCopy,
          selected: draft.selected,
        }])),
      ));
    } catch {
      // Sending remains available if browser storage is unavailable.
    }
  }, [drafts, isNoReplyCampaign]);

  const getTemplateForDraft = (draft: Draft) => {
    const templateId = isNoReplyCampaign
      ? NO_REPLY_TEMPLATE_ID
      : draft.outreachLanguage === "es"
        ? SPANISH_TEMPLATE_ID
        : NOVEMBER_2026_HOSPITALITY_IDS.has(draft.id)
          ? FIRST_CONTACT_TEMPLATE_ID
          : TEMPLATE_ID;
    return templates.find((item) => item.id === templateId);
  };
  const suppressedSet = useMemo(
    () => new Set(suppressedEmails.map((email) => email.trim().toLowerCase())),
    [suppressedEmails],
  );
  const sentHistoryEmails = useMemo(
    () => getConfirmedSentOutreachEmails(history),
    [history],
  );
  const missingTemplateCount = drafts.filter((draft) =>
    isEmailOutreachEligible(draft) &&
    (isNoReplyCampaign || !sentHistoryEmails.has(draft.email.trim().toLowerCase())) &&
    !getTemplateForDraft(draft),
  ).length;
  useEffect(() => {
    if (isNoReplyCampaign || sentHistoryEmails.size === 0) return;
    setDrafts((current) => {
      let changed = false;
      const next = current.map((draft) => {
        if (!draft.selected || !sentHistoryEmails.has(draft.email.trim().toLowerCase())) return draft;
        changed = true;
        return { ...draft, selected: false };
      });
      return changed ? next : current;
    });
  }, [isNoReplyCampaign, sentHistoryEmails]);
  const selectedDrafts = useMemo(
    () => drafts.filter((draft) =>
      draft.selected &&
      isEmailOutreachEligible(draft) &&
      (isNoReplyCampaign || isManualProspectSelectionAllowed(draft, sentHistoryEmails, suppressedSet)) &&
      !suppressedSet.has(draft.email.trim().toLowerCase()),
    ).slice(0, MAX_BATCH_SIZE),
    [drafts, isNoReplyCampaign, sentHistoryEmails, suppressedSet],
  );
  const selectedTemplatesAvailable = selectedDrafts.every((draft) => Boolean(getTemplateForDraft(draft)));
  const invalidReasonCount = isNoReplyCampaign
    ? 0
    : selectedDrafts.filter((draft) => !draft.fitReason.trim()).length;
  const invalidPdfCopyCount = selectedDrafts.filter((draft) =>
    Object.keys(validateDraftPdfCopy(draft, mode)).length > 0,
  ).length;
  const suppressedCount = drafts.filter((draft) =>
    isEmailOutreachEligible(draft) && suppressedSet.has(draft.email.toLowerCase()),
  ).length;
  const previousAttempts = useMemo(() => {
    const attemptsByEmail = new Map<string, VenueOutreachHistoryEntry[]>();
    for (const entry of history) {
      const email = entry.recipientEmail.trim().toLowerCase();
      const attempts = attemptsByEmail.get(email) ?? [];
      attempts.push(entry);
      attemptsByEmail.set(email, attempts);
    }
    return attemptsByEmail;
  }, [history]);
  const uncontactedCount = drafts.filter((draft) =>
    draft.fitTier === "top" &&
    isEmailOutreachEligible(draft) &&
    !suppressedSet.has(draft.email.trim().toLowerCase()) &&
    !previousAttempts.has(draft.email.trim().toLowerCase()),
  ).length;
  const nextBatchCount = isNoReplyCampaign
    ? drafts.filter((draft) =>
      !draft.selected &&
      !draft.attemptedInSession &&
      !suppressedSet.has(draft.email.trim().toLowerCase()),
    ).length
    : Math.min(uncontactedCount, MAX_BATCH_SIZE);
  const tierCounts = useMemo(() => ({
    all: drafts.length,
    top: drafts.filter((draft) => draft.fitTier === "top").length,
    strong: drafts.filter((draft) => draft.fitTier === "strong").length,
    new: drafts.filter((draft) => NEW_PROSPECT_IDS.has(draft.id)).length,
    newTop: drafts.filter((draft) => NEW_TOP_FIT_IDS.has(draft.id)).length,
    newestTop: drafts.filter((draft) => NEWEST_TOP_FIT_IDS.has(draft.id)).length,
    batch2: drafts.filter((draft) => BATCH2_TOP_FIT_IDS.has(draft.id)).length,
    spanish: drafts.filter((draft) => SPANISH_TOP_FIT_IDS.has(draft.id)).length,
    english: drafts.filter((draft) => ENGLISH_TOP_FIT_IDS.has(draft.id)).length,
    nov2026: drafts.filter((draft) => NOVEMBER_2026_HOSPITALITY_IDS.has(draft.id)).length,
  }), [drafts]);
  const visibleDrafts = useMemo(
    () => drafts.filter((draft) => {
      if (tierFilter === "all") return true;
      if (tierFilter === "new") return NEW_PROSPECT_IDS.has(draft.id);
      if (tierFilter === "newTop") return NEW_TOP_FIT_IDS.has(draft.id);
      if (tierFilter === "newestTop") return NEWEST_TOP_FIT_IDS.has(draft.id);
      if (tierFilter === "batch2") return BATCH2_TOP_FIT_IDS.has(draft.id);
      if (tierFilter === "spanish") return SPANISH_TOP_FIT_IDS.has(draft.id);
      if (tierFilter === "english") return ENGLISH_TOP_FIT_IDS.has(draft.id);
      if (tierFilter === "nov2026") return NOVEMBER_2026_HOSPITALITY_IDS.has(draft.id);
      return draft.fitTier === tierFilter;
    }),
    [drafts, tierFilter],
  );
  const draftPageCount = Math.max(1, Math.ceil(visibleDrafts.length / DRAFTS_PER_PAGE));
  const currentDraftPage = Math.min(draftPage, draftPageCount - 1);
  const pageStart = currentDraftPage * DRAFTS_PER_PAGE;
  const pageDrafts = visibleDrafts.slice(pageStart, pageStart + DRAFTS_PER_PAGE);
  const pageRangeStart = pageDrafts.length ? pageStart + 1 : 0;
  const pageRangeEnd = pageStart + pageDrafts.length;
  const pageSelectableCount = pageDrafts.filter((draft) =>
    (isNoReplyCampaign
      ? isEmailOutreachEligible(draft)
      : isManualProspectSelectionAllowed(draft, sentHistoryEmails, suppressedSet)) &&
    !suppressedSet.has(draft.email.trim().toLowerCase()) &&
    (!isNoReplyCampaign || !draft.attemptedInSession),
  ).length;
  const pageUncontactedCount = pageDrafts.filter((draft) => {
    const email = draft.email.trim().toLowerCase();
    return isEmailOutreachEligible(draft) && !suppressedSet.has(email) && !previousAttempts.has(email);
  }).length;
  const pageHasSelected = pageDrafts.some((draft) =>
    draft.selected &&
    (isNoReplyCampaign
      ? isEmailOutreachEligible(draft)
      : isManualProspectSelectionAllowed(draft, sentHistoryEmails, suppressedSet)) &&
    !suppressedSet.has(draft.email.trim().toLowerCase()),
  );

  const updateDraft = (id: string, update: Partial<Draft>) => {
    setDrafts((current) => {
      const target = current.find((draft) => draft.id === id);
      if (!target) return current;
      if (update.selected && (isNoReplyCampaign
        ? !isEmailOutreachEligible(target)
        : !isManualProspectSelectionAllowed(target, sentHistoryEmails, suppressedSet))) return current;
      if (update.selected && target.attemptedInSession) return current;
      if (update.selected && !target.selected && current.filter((draft) => draft.selected).length >= MAX_BATCH_SIZE) return current;
      if (update.selected && suppressedSet.has(target.email.trim().toLowerCase())) return current;
      return current.map((draft) => draft.id === id ? { ...draft, ...update } : draft);
    });
  };
  const updatePdfCopy = (id: string, field: keyof VenueIntroProfileCopy, value: string) => {
    setDrafts((current) => current.map((draft) => draft.id === id
      ? { ...draft, pdfCopy: { ...draft.pdfCopy, [field]: value } }
      : draft));
  };

  const selectNextBatch = () => {
    if (isNoReplyCampaign) {
      const nextIds = new Set(drafts
        .filter((draft) =>
          isEmailOutreachEligible(draft) &&
          !draft.selected &&
          !draft.attemptedInSession &&
          !suppressedSet.has(draft.email.trim().toLowerCase()),
        )
        .slice(0, MAX_BATCH_SIZE)
        .map(({ id }) => id));
      setDrafts((current) => current.map((draft) => ({
        ...draft,
        selected: nextIds.has(draft.id),
      })));
      setDraftPage(0);
      return;
    }
    const nextIds = new Set(capVenueProspectSelection(
      GLOBAL_VENUE_PROSPECTS,
      getNextBatch(GLOBAL_VENUE_PROSPECTS, suppressedEmails, history).map(({ id }) => id),
      MAX_BATCH_SIZE,
      history,
      suppressedEmails,
    ).map(({ id }) => id));
    setDrafts((current) => current.map((draft) => ({ ...draft, selected: nextIds.has(draft.id) })));
    setTierFilter("top");
    setDraftPage(0);
  };
  const selectPageUncontacted = () => {
    const eligible = pageDrafts.filter((draft) =>
      isManualProspectSelectionAllowed(draft, sentHistoryEmails, suppressedSet) &&
      !suppressedSet.has(draft.email.trim().toLowerCase()) &&
      !previousAttempts.has(draft.email.trim().toLowerCase()),
    );
    const pageIds = new Set(pageDrafts.map(({ id }) => id));
    const currentSelectedOutside = drafts.filter((draft) => draft.selected && !pageIds.has(draft.id)).length;
    const capacity = Math.max(0, MAX_BATCH_SIZE - currentSelectedOutside);
    const nextIds = new Set(eligible.slice(0, capacity).map(({ id }) => id));
    setDrafts((current) => current.map((draft) => pageIds.has(draft.id)
      ? { ...draft, selected: nextIds.has(draft.id) }
      : draft));
  };
  const togglePageSelection = () => {
    const pageIds = new Set(pageDrafts.map((draft) => draft.id));
    const shouldSelect = !pageHasSelected;
    const outsideCount = drafts.filter((draft) => draft.selected && !pageIds.has(draft.id)).length;
    const capacity = Math.max(0, MAX_BATCH_SIZE - outsideCount);
    let selectedVisibleCount = 0;
    setDrafts((current) => current.map((draft) => {
      if (!pageIds.has(draft.id)) return draft;
      const eligible = (isNoReplyCampaign
        ? isEmailOutreachEligible(draft)
        : isManualProspectSelectionAllowed(draft, sentHistoryEmails, suppressedSet)) &&
        !suppressedSet.has(draft.email.trim().toLowerCase()) &&
        (!isNoReplyCampaign || !draft.attemptedInSession);
      const select = shouldSelect && eligible && selectedVisibleCount < capacity;
      if (select) selectedVisibleCount += 1;
      return {
        ...draft,
        selected: eligible && (shouldSelect ? select : false),
      };
    }));
  };

  const prepareReview = async () => {
    if (!selectedTemplatesAvailable || !selectedDrafts.length || invalidReasonCount > 0 || invalidPdfCopyCount > 0 || preparingPdfs || sending) return;
    const batch = [...selectedDrafts];
    preparationCancelledRef.current = false;
    setPreparingPdfs(true);
    setPdfError("");
    setPdfProgress(`Preparing venue 1 of ${batch.length}…`);
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setPreparedPdfs({});
    const output: Record<string, PreparedPdf> = {};
    try {
      const [imageModule, pdfModule] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
      const toCanvas = imageModule.toCanvas;
      const jsPDF = pdfModule.jsPDF;
      for (const [index, draft] of batch.entries()) {
        if (preparationCancelledRef.current) throw new Error("PDF preparation was cancelled because the dialog closed.");
        setPdfProgress(`Preparing ${draft.name} · venue ${index + 1} of ${batch.length}`);
        if (Object.keys(validateDraftPdfCopy(draft, mode)).length > 0) {
          throw new Error(`Complete the personalized PDF copy for ${draft.name} before preparing the batch.`);
        }
        const frame = frameRef.current;
        if (!frame) throw new Error("The Met introduction renderer is unavailable.");
        const profile = makeIntroProfile(draft);
        const deckUrl = new URL("/met-venue-intro/allslides", window.location.origin);
        deckUrl.searchParams.set("venueProfile", JSON.stringify(profile));
        if (draft.outreachLanguage === "es") deckUrl.searchParams.set("lang", "es");
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            cleanup();
            reject(new Error(`Timed out loading the Met introduction for ${draft.name}. No emails were sent.`));
          }, 30_000);
          const cleanup = () => {
            window.clearTimeout(timeout);
            frame.removeEventListener("load", onLoad);
            frame.removeEventListener("error", onError);
          };
          const onLoad = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error(`The Met introduction for ${draft.name} could not be loaded.`));
          };
          frame.addEventListener("load", onLoad, { once: true });
          frame.addEventListener("error", onError, { once: true });
          frame.src = deckUrl.toString();
        });
        await waitForPaint();
        const document = frame.contentDocument;
        if (!document) throw new Error(`The Met introduction for ${draft.name} could not be read.`);
        if (document.querySelector("[data-profile-error]")) {
          throw new Error(`The tailored profile for ${draft.name} is invalid.`);
        }
        await document.fonts.ready;
        await waitForImages(document);
        const slideElements = Array.from(document.querySelectorAll<HTMLElement>("[data-slide-id]"));
        if (!slideElements.length) throw new Error(`No Met slides were rendered for ${draft.name}.`);
        const pdf = new jsPDF({
          orientation: "landscape",
          unit: "pt",
          format: [PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT],
          compress: true,
        });
        for (let slideIndex = 0; slideIndex < slideElements.length; slideIndex += 1) {
          if (preparationCancelledRef.current) throw new Error("PDF preparation was cancelled because the dialog closed.");
          setPdfProgress(`${draft.name} · slide ${slideIndex + 1} of ${slideElements.length} · venue ${index + 1} of ${batch.length}`);
          const canvas = await toCanvas(slideElements[slideIndex], {
            backgroundColor: "#fffdf7",
            height: SOURCE_HEIGHT,
            width: SOURCE_WIDTH,
            pixelRatio: 1.5,
            cacheBust: true,
          });
          if (slideIndex > 0) pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT], "landscape");
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT, undefined, "FAST");
          const slideRect = slideElements[slideIndex].getBoundingClientRect();
          const scaleX = PDF_PAGE_WIDTH / SOURCE_WIDTH;
          const scaleY = PDF_PAGE_HEIGHT / SOURCE_HEIGHT;
          slideElements[slideIndex].querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
            const rect = anchor.getBoundingClientRect();
            const left = Math.max(0, rect.left - slideRect.left);
            const top = Math.max(0, rect.top - slideRect.top);
            const right = Math.min(slideRect.width, rect.right - slideRect.left);
            const bottom = Math.min(slideRect.height, rect.bottom - slideRect.top);
            if (right <= left || bottom <= top) return;
            pdf.link(
              left * scaleX,
              top * scaleY,
              (right - left) * scaleX,
              (bottom - top) * scaleY,
              { url: anchor.href },
            );
          });
          canvas.width = 0;
          canvas.height = 0;
        }
        const blob = pdf.output("blob");
        if (!blob.size || blob.size > MAX_PDF_BYTES) {
          throw new Error(`${draft.name}’s PDF is ${blob.size ? "larger than 6 MB" : "empty"}; no emails were sent.`);
        }
        const signature = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
        if (String.fromCharCode(...signature) !== "%PDF") {
          throw new Error(`The PDF for ${draft.name} is invalid; no emails were sent.`);
        }
        const contentBase64 = await blobToBase64(blob);
        if (contentBase64.length > 8_000_000) {
          throw new Error(`The PDF for ${draft.name} exceeds the attachment limit; no emails were sent.`);
        }
        const fileName = `Met - ${filenamePart(profile.venueName)} - Venue Introduction.pdf`;
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);
        output[draft.id] = { fileName, url, blob, contentBase64 };
      }
      if (preparationCancelledRef.current) throw new Error("PDF preparation was cancelled because the dialog closed.");
      setPreparedPdfs(output);
      setExpandedDraftPreviewIds(new Set());
      setExpandedReviewIds(new Set());
      setStep("review");
      setPdfProgress(`Ready · ${batch.length} personalized PDF${batch.length === 1 ? "" : "s"}`);
    } catch (cause) {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
      setPreparedPdfs({});
      setPdfError(cause instanceof Error ? cause.message : "The venue PDFs could not be prepared.");
      setPdfProgress("Preparation stopped. Review the error and try again.");
    } finally {
      setPreparingPdfs(false);
    }
  };

  const send = async () => {
    const blockedSelectedDrafts = !isNoReplyCampaign
      ? drafts.filter((draft) =>
        draft.selected && sentHistoryEmails.has(draft.email.trim().toLowerCase()),
      )
      : [];
    if (blockedSelectedDrafts.length > 0) {
      setDrafts((current) => current.map((draft) =>
        blockedSelectedDrafts.some((blocked) => blocked.id === draft.id)
          ? { ...draft, selected: false }
          : draft,
      ));
      setPdfError("A sent email is already recorded for a selected address. Review the matching entry in the Invited Venues history before any intentional follow-up.");
      return;
    }
    if (!selectedTemplatesAvailable || !selectedDrafts.length || invalidReasonCount > 0 || invalidPdfCopyCount > 0 || sending) return;
    if (selectedDrafts.some((draft) => {
      const pdf = preparedPdfs[draft.id];
      return !pdf || !pdf.blob.size || pdf.blob.size > MAX_PDF_BYTES;
    })) {
      setPdfError("A required personalized PDF is missing or invalid. Return to drafts and prepare the whole batch again.");
      return;
    }
    setSending(true);
    let currentEmail = "";
    try {
      const outcome = await sendVenueBatch(selectedDrafts, async (draft) => {
        currentEmail = draft.email;
        const pdf = preparedPdfs[draft.id];
        if (!pdf || !pdf.blob.size || pdf.blob.size > MAX_PDF_BYTES) {
          throw new Error(`The personalized PDF for ${draft.name} is missing or invalid.`);
        }
        const template = getTemplateForDraft(draft);
        if (!template) throw new Error(`The invitation template for ${draft.name} is unavailable.`);
        const input: VenueManualEmailInput = {
          businessName: draft.name,
          recipientEmail: draft.email,
          templateId: template.id,
          ...(isNoReplyCampaign ? {} : { venueFitReason: draft.fitReason.trim() }),
          ...(draft.placeId ? { placeId: draft.placeId } : {}),
          ...(draft.venueOwnerProfileId ? { venueOwnerProfileId: draft.venueOwnerProfileId } : {}),
          pdfAttachment: { fileName: pdf.fileName, contentBase64: pdf.contentBase64 },
        };
        const response = await sendManualVenueEmail(input);
        if (!response.emailSent || response.recipientEmail.trim().toLowerCase() !== draft.email.trim().toLowerCase()) {
          throw new Error(`Delivery was not confirmed for ${draft.email}.`);
        }
      }, ({ current, total }) => setProgress(`Sending ${current} of ${total}`), Infinity, shouldContinueGlobalVenueProspectBatchAfterFailure);
      const attempted = isNoReplyCampaign
        ? selectedDrafts.length - outcome.notAttemptedCount
        : outcome.sentCount + outcome.failedCount;
      setDrafts((current) => {
        const attemptedIds = new Set(selectedDrafts.slice(0, attempted).map((draft) => draft.id));
        return current.map((draft) => attemptedIds.has(draft.id)
          ? { ...draft, selected: false, attemptedInSession: true }
          : draft);
      });
      const continuedRejectedCount = outcome.continuedFailures.filter(({ error }) =>
        isConfirmedVenueSendFailure(error),
      ).length;
      const continuedUncertainCount = outcome.continuedFailures.length - continuedRejectedCount;
      const rejectedCount = continuedRejectedCount +
        (outcome.error && isConfirmedVenueSendFailure(outcome.error) ? 1 : 0);
      const uncertainCount = continuedUncertainCount +
        (outcome.error && !isConfirmedVenueSendFailure(outcome.error) ? 1 : 0);
      const failureDetails = outcome.continuedFailures.map(({ recipient, error }) =>
        isConfirmedVenueSendFailure(error)
          ? `Rejected before sending to ${recipient.email}: ${getVenueSendErrorMessage(error)}. The batch continued.`
          : `Delivery to ${recipient.email} needs checking: ${getVenueSendErrorMessage(error)} Check Gmail Sent before retrying this address. The batch continued with later addresses.`,
      );
      const stoppedDetail = outcome.error
        ? isConfirmedVenueSendFailure(outcome.error)
          ? `The request for ${currentEmail} was rejected before sending: ${getVenueSendErrorMessage(outcome.error)}. No message was sent to this address; later emails were not attempted.`
          : `Delivery to ${currentEmail} was not confirmed. Check Gmail Sent before retrying that address; later emails were not attempted.`
        : "";
      setResult({
        sent: outcome.sentCount,
        rejected: rejectedCount,
        uncertain: uncertainCount,
        remaining: outcome.notAttemptedCount,
        detail: [...failureDetails, stoppedDetail].filter(Boolean).join(" "),
      });
      setStep("result");
      await onSent();
    } finally {
      setSending(false);
      setProgress("");
    }
  };

  const close = (next: boolean) => {
    if (!sending && !preparingPdfs) onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto border-slate-200 bg-[#fbfaf8] sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl text-[#25324a]">
            {step === "drafts"
              ? isNoReplyCampaign ? "No-reply follow-up drafts" : "Venue invitation drafts"
              : step === "review" ? "Review every email" : "Campaign send results"}
          </DialogTitle>
          <DialogDescription>
            {step === "drafts"
              ? isNoReplyCampaign
                ? "Review venues with a successful earlier email and no Gmail reply recorded. Sync Gmail replies first for the freshest list. Each selected venue gets its own full introduction PDF; nothing sends until you review and confirm."
                : "Filter by fit tier or cohort, review and edit each venue-specific reason, then prepare a batch. All top-fit cohorts, including Batch 2, follow the prospect list order."
              : step === "review"
                ? "Each address receives its own personalized email from the connected Met Gmail account. If one address fails or delivery is uncertain, the batch continues; check Gmail Sent before retrying an uncertain address. Session, permission, and removed-template errors still stop the batch. Nothing is sent until you choose the final send button."
                : "Each attempted message is recorded in Venue Admin outreach history."}
          </DialogDescription>
        </DialogHeader>

        {step === "drafts" && (
          <div className="space-y-4">
            {isNoReplyCampaign ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                <p>
                  {drafts.length} venues have no recorded Gmail reply and have not received this follow-up. Newer unconfirmed or bounced sends are omitted for safety. Up to {MAX_BATCH_SIZE} can be reviewed and sent in one batch.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="button-select-next-no-reply-batch"
                  onClick={selectNextBatch}
                  disabled={!nextBatchCount || sending || preparingPdfs}
                >
                  Select next batch ({Math.min(nextBatchCount, MAX_BATCH_SIZE)})
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                <p>
                  {uncontactedCount} top-fit venues have no outreach history and are not suppressed. The next prepared batch includes up to {MAX_BATCH_SIZE}, in prospect-list order.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={selectNextBatch}
                  disabled={!nextBatchCount || sending || preparingPdfs}
                >
                  Select next batch ({nextBatchCount})
                </Button>
              </div>
            )}
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
              {isNoReplyCampaign ? (
                <p className="text-xs text-slate-600">No-reply venues · {drafts.length} eligible</p>
              ) : (
                <label className="grid gap-1 text-xs font-medium text-slate-700">
                  Venue list
                  <select
                    aria-label="Filter venue drafts by cohort or fit tier"
                    value={tierFilter}
                    onChange={(event) => {
                      setTierFilter(event.target.value as VenueFitTier | "all" | "new" | "newTop" | "newestTop" | "batch2" | "spanish" | "english" | "nov2026");
                      setDraftPage(0);
                    }}
                    className="h-9 min-w-44 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="all">All tiers ({tierCounts.all})</option>
                    <option value="top">Top fit ({tierCounts.top})</option>
                    <option value="strong">Strong fit ({tierCounts.strong})</option>
                    <option value="new">New cafés, bars &amp; pubs ({tierCounts.new})</option>
                    <option value="newTop">New worldwide top-fit venues ({tierCounts.newTop})</option>
                    <option value="nov2026">New hospitality research — Nov 2026 ({tierCounts.nov2026})</option>
                    <option value="newestTop">Latest top-fit venues ({tierCounts.newestTop})</option>
                    <option value="batch2">Batch 2 — 100 additional venues ({tierCounts.batch2})</option>
                    <option value="spanish">Spanish-speaking top-fit venues ({tierCounts.spanish})</option>
                    <option value="english">English-speaking venue cohort ({tierCounts.english})</option>
                  </select>
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                {!isNoReplyCampaign && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={selectPageUncontacted}
                    disabled={!pageUncontactedCount || sending || preparingPdfs}
                  >
                    Select page with no history ({pageUncontactedCount})
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={togglePageSelection}
                  disabled={!pageSelectableCount || sending || preparingPdfs}
                >
                  {pageHasSelected ? "Clear page selection" : "Select page (including prior attempts)"}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>{pageRangeStart}–{pageRangeEnd} of {visibleDrafts.length} matching · Page {currentDraftPage + 1}/{draftPageCount}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  onClick={() => setDraftPage((page) => Math.max(0, page - 1))}
                  disabled={currentDraftPage === 0 || sending || preparingPdfs}
                  aria-label="Previous venue drafts page"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  onClick={() => setDraftPage((page) => Math.min(draftPageCount - 1, page + 1))}
                  disabled={currentDraftPage >= draftPageCount - 1 || sending || preparingPdfs}
                  aria-label="Next venue drafts page"
                >
                  Next
                </Button>
              </div>
            </div>
            {suppressedCount > 0 && (
              <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                {suppressedCount} address{suppressedCount === 1 ? " is" : "es are"} blocked from future outreach and cannot be selected.
              </p>
            )}
            {missingTemplateCount > 0 && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {isNoReplyCampaign
                  ? "The no-reply follow-up template is unavailable. Refresh the template list before sending."
                  : "A personalized invitation template is unavailable. Refresh the template list before sending."}
              </p>
            )}
            <div className="max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
              {!drafts.length && (
                <p role="status" className="rounded-md border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                  No venues currently qualify. Check that Gmail replies are synced, and confirm there are no prior no-reply follow-ups or unresolved delivery records.
                </p>
              )}
              {pageDrafts.map((draft) => {
                const emailEligible = isEmailOutreachEligible(draft);
                const manuallySelectable = isNoReplyCampaign
                  ? emailEligible
                  : isManualProspectSelectionAllowed(draft, sentHistoryEmails, suppressedSet);
                const template = getTemplateForDraft(draft);
                const suppressed = emailEligible && suppressedSet.has(draft.email.toLowerCase());
                const priorAttempts = previousAttempts.get(draft.email.toLowerCase()) ?? [];
                const priorSentAttempts = priorAttempts.filter((entry) =>
                  entry.deliveryStatus === "sent" || entry.sentAt != null,
                );
                const blockedBySentHistory = !isNoReplyCampaign && priorSentAttempts.length > 0;
                const mayBeUnconfirmed = priorAttempts.some((entry) =>
                  entry.deliveryStatus === "sending" || entry.deliveryStatus === "delivery_uncertain");
                const pdfCopyErrors = validateDraftPdfCopy(draft, mode);
                return (
                  <article key={draft.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Include ${draft.name}`}
                        checked={draft.selected && manuallySelectable && !suppressed}
                        disabled={!manuallySelectable || suppressed || sending || preparingPdfs || (isNoReplyCampaign && !!draft.attemptedInSession)}
                        onChange={(event) => updateDraft(draft.id, { selected: event.target.checked })}
                        className="mt-1 h-4 w-4 accent-[#25324a]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-[#25324a]">{draft.name}</h3>
                              {isNoReplyCampaign ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                                  No Gmail reply
                                </span>
                              ) : (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    draft.fitTier === "top"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-indigo-100 text-indigo-800"
                                  }`}
                                >
                                  {draft.fitTier === "top" ? "Top fit" : "Strong fit"}
                                </span>
                              )}
              {!isNoReplyCampaign && BATCH2_TOP_FIT_IDS.has(draft.id) && (
                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                                  Batch 2 · #{draft.fitRank}
                                </span>
                              )}
                            </div>
                            {(draft.location || draft.category) && (
                              <p className="text-xs text-slate-600">{[draft.location, draft.category].filter(Boolean).join(" · ")}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {draft.websiteUrl && <a className="text-xs text-[#256b58] underline" href={draft.websiteUrl} target="_blank" rel="noreferrer">Official website</a>}
                            {draft.contactUrl && <a className="text-xs text-[#256b58] underline" href={draft.contactUrl} target="_blank" rel="noreferrer">Official contact route</a>}
                            {draft.fitEvidenceUrl && (
                              <a className="text-xs text-[#256b58] underline" href={draft.fitEvidenceUrl} target="_blank" rel="noreferrer">
                                Venue-fit source
                              </a>
                            )}
                            {draft.discoverySourceUrl && (
                              <a className="text-xs text-[#256b58] underline" href={draft.discoverySourceUrl} target="_blank" rel="noreferrer">
                                OpenStreetMap discovery · © OpenStreetMap contributors
                              </a>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 break-all text-xs text-slate-700">
                          {draft.email.trim() || "No public business email"}
                        </p>
                        {draft.outreachHoldReason && (
                          <p role="status" className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                            {draft.outreachHoldReason}
                          </p>
                        )}
                        {draft.attemptedInSession && (
                          <p className="mt-2 text-xs font-medium text-amber-800">
                            Already attempted in this campaign session; it cannot be selected again.
                          </p>
                        )}
                        {suppressed && <p className="mt-2 text-xs font-medium text-amber-800">Blocked by the admin outreach suppression list.</p>}
                        {blockedBySentHistory && !suppressed && (
                          <div role="status" className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
                            A sent email is already recorded for this exact address. This first-contact draft is blocked; review the matching entry in the Invited Venues history before any intentional follow-up.
                            <button
                              type="button"
                              onClick={() => close(false)}
                              disabled={sending || preparingPdfs}
                              className="ml-1 font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Close drafts and review history
                            </button>
                          </div>
                        )}
                        {priorAttempts.length > 0 && !blockedBySentHistory && !suppressed && (
                          <p className="mt-2 text-xs font-medium text-amber-800">
                            {priorAttempts.length} prior outreach attempt{priorAttempts.length === 1 ? "" : "s"} in history. Review the worklist before resending; it remains selectable.
                            {mayBeUnconfirmed ? " At least one attempt may be unconfirmed—check Gmail Sent first." : ""}
                          </p>
                        )}
                        {draft.emailEvidenceQuote && draft.emailEvidenceUrl ? (
                          <details className="mt-2 text-xs text-slate-600">
                            <summary className="cursor-pointer font-medium text-[#25324a]">Public email source</summary>
                            <blockquote className="mt-2 border-l-2 border-slate-300 pl-3">{draft.emailEvidenceQuote}</blockquote>
                            <a className="mt-2 inline-block text-[#256b58] underline" href={draft.emailEvidenceUrl} target="_blank" rel="noreferrer">
                              Open source used to verify this email
                            </a>
                          </details>
                        ) : isNoReplyCampaign ? (
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            This is the address used for the earlier outreach. No official contact-source link is stored with this record.
                          </p>
                        ) : null}
                        {draft.fitEvidenceQuote && draft.fitEvidenceUrl && (
                          <details className="mt-2 text-xs text-slate-600">
                            <summary className="cursor-pointer font-medium text-[#25324a]">Venue-fit evidence</summary>
                            <blockquote className="mt-2 border-l-2 border-slate-300 pl-3">{draft.fitEvidenceQuote}</blockquote>
                            <a className="mt-2 inline-block text-[#256b58] underline" href={draft.fitEvidenceUrl} target="_blank" rel="noreferrer">
                              Open source used to verify this fit
                            </a>
                          </details>
                        )}
                        {draft.pdfHookEvidenceQuote && draft.pdfHookSourceUrl && (
                          <details className="mt-2 text-xs text-slate-600">
                            <summary className="cursor-pointer font-medium text-[#25324a]">PDF personalization source</summary>
                            <blockquote className="mt-2 border-l-2 border-slate-300 pl-3">{draft.pdfHookEvidenceQuote}</blockquote>
                            <a className="mt-2 inline-block text-[#256b58] underline" href={draft.pdfHookSourceUrl} target="_blank" rel="noreferrer">
                              Verify this detail on the official venue site
                            </a>
                          </details>
                        )}
                        {isNoReplyCampaign && !draft.category && (
                          <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                            No verified venue category or location is available for this record. The PDF will use general Met copy and the venue name only.
                          </p>
                        )}
                        {!isNoReplyCampaign && <label className="mt-3 block text-xs font-medium text-slate-700">
                          {emailEligible ? "Email-specific venue-fit reason" : "Personalized outreach note"}
                          <span className="mt-1 block font-normal text-slate-500">
                            {emailEligible
                              ? "Used in the invitation email. PDF copy below is edited separately."
                              : "This prospect is held out of email sending; review the contact route and status above."}
                          </span>
                          <textarea
                            value={draft.fitReason}
                            maxLength={500}
                            disabled={sending || preparingPdfs || suppressed}
                            onChange={(event) => updateDraft(draft.id, { fitReason: event.target.value })}
                            className="mt-1 min-h-20 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-800 focus:border-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"
                          />
                        </label>}
                        <details className="mt-3 rounded-md border border-slate-200 bg-[#fbfaf8] p-3">
                          <summary className="cursor-pointer text-xs font-semibold text-[#25324a]">
                            Edit personalized PDF details and copy
                          </summary>
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            {isNoReplyCampaign
                              ? "These fields appear in the attached Met introduction only. The recipient and venue name stay tied to the outreach record."
                              : "These fields appear in the attached Met introduction only. The email recipient and venue name stay tied to the prospect record."}
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {PDF_COPY_FIELDS
                              .filter(({ field }) =>
                                !isNoReplyCampaign ||
                                !["venueCategory", "venueLocation"].includes(field) ||
                                Boolean(draft.pdfCopy[field].trim()),
                              )
                              .map(({ field, label, multiline }) => (
                              <VenuePdfCopyField
                                key={field}
                                id={`pdf-${draft.id}-${field}`}
                                label={label}
                                value={draft.pdfCopy[field]}
                                maxLength={VENUE_INTRO_COPY_LIMITS[field]}
                                multiline={multiline}
                                error={pdfCopyErrors[field]}
                                disabled={sending || preparingPdfs || suppressed}
                                onChange={(value) => updatePdfCopy(draft.id, field, value)}
                              />
                            ))}
                          </div>
                        </details>
                        {emailEligible ? (
                          <details className="mt-3 rounded-md border border-slate-200 bg-[#fbfaf8] p-3">
                            <summary
                              data-testid={`button-preview-venue-invitation-${draft.id}`}
                              className="cursor-pointer text-xs font-semibold text-[#25324a]"
                              onClick={() => {
                                setExpandedDraftPreviewIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(draft.id)) next.delete(draft.id);
                                  else next.add(draft.id);
                                  return next;
                                });
                              }}
                            >
                              {expandedDraftPreviewIds.has(draft.id)
                                ? `Hide ${draft.name}’s draft preview`
                                : `Preview ${draft.name}’s draft`}
                            </summary>
                            {template && expandedDraftPreviewIds.has(draft.id) && (
                              <div className="mt-3">
                                <p className="mb-2 text-xs text-slate-600"><strong>Subject:</strong> {template.subject.replace(/\{\{\s*businessName\s*\}\}/g, draft.name)}</p>
                                {template.body.includes("{{applicationUrl}}") && (
                                  <p className="mb-2 text-xs leading-5 text-slate-600">
                                    The sample application link is for preview only. Each approved send creates a fresh 14-day application invitation.
                                  </p>
                                )}
                                <iframe
                                  title={`${draft.name} invitation preview`}
                                  data-testid={`iframe-venue-invitation-preview-${draft.id}`}
                                  sandbox=""
                                  referrerPolicy="no-referrer"
                                  srcDoc={templatePreview(template.body, template.format, {
                                    businessName: draft.name,
                                    recipientEmail: draft.email,
                                    venueFitReason: draft.fitReason,
                                  })}
                                  className="h-64 w-full border-0 bg-white"
                                />
                              </div>
                            )}
                          </details>
                        ) : draft.contactFormDraft ? (
                          <details className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                            <summary className="cursor-pointer text-xs font-semibold text-amber-950">
                              Personalized contact-form draft
                            </summary>
                            <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-xs leading-5 text-slate-800">
                              {draft.contactFormDraft}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="text-xs text-slate-600">
              {selectedDrafts.length} of {MAX_BATCH_SIZE} selected · The hard batch limit applies to individual and bulk selection. PDF preparation sends nothing.
            </p>
            {invalidReasonCount > 0 && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                Add an email-specific venue reason to {invalidReasonCount} selected draft{invalidReasonCount === 1 ? "" : "s"} to continue.
              </p>
            )}
            {invalidPdfCopyCount > 0 && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                Fix the required personalized PDF fields in {invalidPdfCopyCount} selected draft{invalidPdfCopyCount === 1 ? "" : "s"} before preparing the batch.
              </p>
            )}
            {pdfProgress && <p role="status" className="text-sm font-medium text-[#25324a]">{pdfProgress}</p>}
            {pdfError && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {pdfError}
              </p>
            )}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">You are about to send {selectedDrafts.length} individual emails.</p>
              <p className="mt-1">Every email preview and venue-specific PDF is shown below. Nothing is sent until the final send button is clicked. Sending stops at the first failed or uncertain delivery.</p>
            </div>
            <div className="max-h-[58dvh] space-y-3 overflow-y-auto pr-1">
              {selectedDrafts.map((draft) => {
                const pdf = preparedPdfs[draft.id];
                const template = getTemplateForDraft(draft);
                return (
                  <article key={draft.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#25324a]">{draft.name}</h3>
                        <p className="break-all text-xs text-slate-600">{draft.email}</p>
                        <p className="mt-1 text-xs text-slate-600">
                          PDF: {[
                            draft.pdfCopy.venueName,
                            draft.pdfCopy.venueCategory,
                            draft.pdfCopy.venueLocation,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pdf && (
                          <>
                            <a href={pdf.url} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-[#256b58] hover:bg-emerald-50">
                              Open PDF
                            </a>
                            <a href={pdf.url} download={pdf.fileName} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-[#256b58] hover:bg-emerald-50">
                              Download PDF
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    <details
                      className="mt-3 rounded-md border border-slate-200 bg-[#fbfaf8] p-3"
                      onToggle={(event) => {
                        const expanded = event.currentTarget.open;
                        setExpandedReviewIds((current) => {
                          if (current.has(draft.id) === expanded) return current;
                          const next = new Set(current);
                          if (expanded) next.add(draft.id);
                          else next.delete(draft.id);
                          return next;
                        });
                      }}
                    >
                      <summary className="cursor-pointer text-xs font-semibold text-[#25324a]">
                        {expandedReviewIds.has(draft.id) ? "Hide final email preview" : "Inspect final email preview"}
                      </summary>
                      {template && expandedReviewIds.has(draft.id) && (
                        <div className="mt-3">
                          <p className="mb-2 break-words text-xs text-slate-700"><strong>Subject:</strong> {template.subject.replace(/\{\{\s*businessName\s*\}\}/g, draft.name)}</p>
                          {template.body.includes("{{applicationUrl}}") && (
                            <p className="mb-2 text-xs leading-5 text-slate-600">
                              The sample application link is for preview only. Each approved send creates a fresh 14-day application invitation.
                            </p>
                          )}
                          <iframe
                            title={`${draft.name} final email preview`}
                            loading="lazy"
                            sandbox=""
                            referrerPolicy="no-referrer"
                            srcDoc={templatePreview(template.body, template.format, {
                              businessName: draft.name,
                              recipientEmail: draft.email,
                              venueFitReason: draft.fitReason,
                            })}
                            className="h-60 w-full border-0 bg-white"
                          />
                        </div>
                      )}
                    </details>
                    <details className="mt-3 rounded-md border border-slate-200 bg-[#fbfaf8] p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-[#25324a]">
                        Preview {draft.pdfCopy.venueName} PDF
                      </summary>
                      {pdf && (
                        <iframe
                          title={`${draft.pdfCopy.venueName} personalized Met introduction PDF`}
                          src={pdf.url}
                          className="mt-3 h-[52dvh] w-full border-0 bg-white"
                        />
                      )}
                    </details>
                    {!pdf && <p role="alert" className="mt-3 text-sm font-medium text-red-800">This venue’s PDF is missing. Sending is disabled.</p>}
                  </article>
                );
              })}
            </div>
            {invalidReasonCount > 0 && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                Add an email-specific venue reason to {invalidReasonCount} selected draft{invalidReasonCount === 1 ? "" : "s"} before sending.
              </p>
            )}
            {invalidPdfCopyCount > 0 && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                Fix the required personalized PDF fields in {invalidPdfCopyCount} selected draft{invalidPdfCopyCount === 1 ? "" : "s"} before sending.
              </p>
            )}
            {progress && <p role="status" className="text-sm font-medium text-[#25324a]">{progress}</p>}
            {pdfProgress.startsWith("Ready") && <p role="status" className="text-sm font-medium text-[#256b58]">{pdfProgress}</p>}
            {pdfError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{pdfError}</p>}
          </div>
        )}

        {step === "result" && result && (
          <div role="status" className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <p className="font-semibold text-[#25324a]">{result.sent} sent · {result.rejected} rejected before sending · {result.uncertain} needing a check · {result.remaining} not attempted</p>
            {result.detail && <p className="text-amber-900">{result.detail}</p>}
            <p className="text-slate-600">Attempted addresses are no longer selected in this browser draft, to help prevent accidental duplicate sends.</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "drafts" && (
            <>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={sending || preparingPdfs}>Close</Button>
              <Button type="button" onClick={() => void prepareReview()} disabled={!selectedDrafts.length || !selectedTemplatesAvailable || invalidReasonCount > 0 || invalidPdfCopyCount > 0 || sending || preparingPdfs} className="bg-[#25324a] text-white hover:bg-[#1d283c]">
                {preparingPdfs ? "Preparing PDFs…" : `Prepare ${selectedDrafts.length} email${selectedDrafts.length === 1 ? "" : "s"} and PDFs`}
              </Button>
            </>
          )}
          {step === "review" && (
            <>
              <Button type="button" variant="outline" onClick={() => {
                objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
                objectUrlsRef.current = [];
                setPreparedPdfs({});
                setExpandedDraftPreviewIds(new Set());
                setExpandedReviewIds(new Set());
                setStep("drafts");
              }} disabled={sending}>Back to drafts</Button>
              <Button type="button" onClick={() => void send()} disabled={!selectedTemplatesAvailable || sending || !selectedDrafts.length || invalidReasonCount > 0 || invalidPdfCopyCount > 0 || selectedDrafts.some((draft) => !preparedPdfs[draft.id])} className="bg-[#25324a] text-white hover:bg-[#1d283c]">
                {sending ? "Sending…" : `Send ${selectedDrafts.length} personalized email${selectedDrafts.length === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
          {step === "result" && <Button type="button" onClick={() => close(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
      <iframe
        ref={frameRef}
        aria-hidden="true"
        title="Met venue introduction PDF renderer"
        tabIndex={-1}
        className="pointer-events-none fixed left-[-10000px] top-0 -z-10 border-0"
        style={{ width: SOURCE_WIDTH, height: SOURCE_HEIGHT }}
      />
    </Dialog>
  );
}

type VenueProspectCampaignLauncherProps = Omit<Props, "open" | "onOpenChange"> & {
  disabled: boolean;
  onOpen?: () => void;
};

export function VenueProspectCampaignLauncher({
  disabled,
  onOpen,
  ...dialogProps
}: VenueProspectCampaignLauncherProps) {
  const [open, setOpen] = useState(false);
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !open) onOpen?.();
    setOpen(nextOpen);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="button-open-top-fit-campaign"
        onClick={() => handleOpenChange(true)}
        disabled={disabled}
      >
        Prepare venue invitation drafts
      </Button>
      <GlobalVenueProspectsDialog
        {...dialogProps}
        open={open}
        onOpenChange={handleOpenChange}
      />
    </>
  );
}

type VenueNoReplyCampaignLauncherProps = Omit<Props, "open" | "onOpenChange" | "mode"> & {
  disabled: boolean;
  onOpen?: () => Promise<unknown>;
};

export function VenueNoReplyCampaignLauncher({
  disabled,
  onOpen,
  ...dialogProps
}: VenueNoReplyCampaignLauncherProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openError, setOpenError] = useState("");

  const openCampaign = async () => {
    if (disabled || loading) return;
    setLoading(true);
    setOpenError("");
    try {
      await onOpen?.();
      setOpen(true);
    } catch (cause) {
      setOpenError(cause instanceof Error
        ? cause.message
        : "The latest no-reply list could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-testid="button-open-no-reply-campaign"
        onClick={() => void openCampaign()}
        disabled={disabled || loading}
      >
        {loading ? "Refreshing no-reply list…" : "Prepare no-reply follow-up"}
      </Button>
      {openError && <p role="alert" className="basis-full text-xs text-red-800">{openError}</p>}
      <GlobalVenueProspectsDialog
        {...dialogProps}
        mode="no_reply"
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
