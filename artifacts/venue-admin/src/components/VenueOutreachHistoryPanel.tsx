import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListVenueEmailTemplates,
  getListVenueEmailTemplatesQueryKey,
  clearFailedVenueOutreach,
  syncGmailVenueOutreachBounces,
  sendManualVenueEmail,
  type VenueEmailTemplate,
  getGetVenueOutreachHistoryQueryKey,
  getListVenueApplicationsQueryKey,
  useGetVenueOutreachHistory,
  useUpdateVenueOutreachPlaceId,
  useUpdateVenueOutreachFollowUp,
  useUpdateVenueOutreachManualInterest,
  useCreateVenueOutreachManualReplyEvent,
  useDeleteVenueOutreachHistory,
  useDeleteAdminVenue,
  useLinkGmailBounceToVenueOutreach,
  useUpdateVenueOutreachEmailSuppression,
  usePreviewGmailVenueOutreachBounceReconciliation,
  useApplyGmailVenueOutreachBounceReconciliation,
  useSyncGmailVenueOutreachReplies,
  useClassifyPendingVenueOutreachReplies,
  type VenueOutreachHistoryEntry,
  type VenueOutreachHistoryResponse,
  type VenueOutreachPlaceIdInput,
  type SyncVenueOutreachBouncesResult,
  type LinkGmailBounceToVenueOutreachInput,
  type GmailBounceReconciliationPreviewResult,
} from "@workspace/api-client-react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  MapPin,
  Mail,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  VenueNoReplyCampaignLauncher,
  VenueProspectCampaignLauncher,
} from "@/components/GlobalVenueProspectsDialog";
import { DEFAULT_WORKLIST_FILTERS, dedupeRecipientEmails, dedupeVenueHistory, filterVenueGroups, getVenueSendErrorMessage, hasConfirmedReply, hasManualReplyConfirmation, hasPersonalizedApproach, hasApplicationOrRegistrationInProgress, isConfirmedVenueSendFailure, isFollowUpDue, lastSuccessfulEmail, latestGmailReply, latestManualReplyEvent, manualReplyHistory, sendVenueBatch, shouldContinueVenueBatchAfterFailure, sortVenueGroups, venueApplication, type VenueGroup, type WorklistSort } from "@/components/venue-outreach-worklist";
import VenueOutreachFilters, { emailTemplateLabel } from "@/components/VenueOutreachFilters";
import VenueEmailTemplateManager, { templatePreview } from "@/components/VenueEmailTemplateManager";
import PastedVenueEmailDialog from "@/components/PastedVenueEmailDialog";

type Props = { onClose: () => void; initialSearch?: string };
type TemplateValue = string;
type FollowUpDraft = { note: string; dueDate: string };
type VenueDeleteDialogState =
  | { kind: "outreach-history"; group: VenueGroup }
  | { kind: "venue-profile"; profileId: number; businessName: string; groupKey: string };
type BounceLinkNotice = {
  kind: "unmatched" | "ambiguous";
  gmailMessageId: string;
  gmailThreadId: string | null;
  recipientEmail: string;
  originalSentAt: string | null;
  status: string | null;
  reason: string;
  matchingReason?: SyncVenueOutreachBouncesResult["unmatchedNotices"][number]["matchingReason"];
  candidateIds?: string[];
};

function prettify(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function deliveryLabel(status: VenueOutreachHistoryEntry["deliveryStatus"]): string {
  return {
    sending: "Sending",
    sent: "Sent",
    delivery_uncertain: "Check Sent",
    failed: "Failed",
    bounced: "Bounced",
  }[status];
}

function unmatchedMatchingReasonLabel(
  reason: SyncVenueOutreachBouncesResult["unmatchedNotices"][number]["matchingReason"],
): string {
  return {
    missing_original_message_id: "The original message ID is missing, so this notice could not be matched to a send.",
    no_eligible_send_candidate: "No eligible send record was found for this notice.",
    recipient_mismatch: "The notice recipient does not match the original send.",
    multiple_recipients: "The notice covers multiple recipients and needs manual review.",
  }[reason];
}

function deliveryClasses(status: VenueOutreachHistoryEntry["deliveryStatus"]): string {
  return {
    sending: "border-sky-200 bg-sky-50 text-sky-700",
    sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
    delivery_uncertain: "border-amber-200 bg-amber-50 text-amber-800",
    failed: "border-rose-200 bg-rose-50 text-rose-700",
    bounced: "border-red-300 bg-red-50 text-red-800",
  }[status];
}

function linkLabel(status: VenueOutreachHistoryEntry["linkStatus"]): string {
  return {
    none: "No link",
    active: "Active",
    expired: "Expired",
    used: "Used",
    superseded: "Superseded",
    unknown: "Link state unknown",
  }[status];
}

function linkClasses(status: VenueOutreachHistoryEntry["linkStatus"]): string {
  return {
    none: "text-slate-500",
    active: "text-emerald-700",
    expired: "text-slate-500",
    used: "text-indigo-700",
    superseded: "text-slate-500",
    unknown: "text-amber-700",
  }[status];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The outreach history could not be loaded.";
}

function ResendDialog({
  entry,
  open,
  busy,
  onOpenChange,
  onResend,
  templates,
}: {
  entry: VenueOutreachHistoryEntry | null;
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onResend: (entry: VenueOutreachHistoryEntry, recipientEmail: string, template: TemplateValue) => void;
  templates: VenueEmailTemplate[];
}) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [template, setTemplate] = useState<TemplateValue>("contact_request");

  const entryKey = entry?.id ?? "";
  const needsSentCheck = entry?.deliveryStatus === "delivery_uncertain";
  const options = templates.map((template) => ({ value: template.id, label: template.name }));

  useEffect(() => {
    if (entry) {
      setRecipientEmail(entry.recipientEmail);
      setTemplate(templates.some((template) => template.id === entry.template) ? entry.template : "");
    }
  }, [entryKey]); // Deliberately reset only when a different row is opened.

  if (!entry) return null;

  const trimmedEmail = recipientEmail.trim();
  const canSubmit =
    trimmedEmail.length > 3 &&
    trimmedEmail.includes("@") &&
    templates.some((option) => option.id === template) &&
    !busy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-slate-200 bg-[#fbfaf8] p-0 text-slate-950 shadow-2xl">
        <DialogHeader className="border-b border-slate-200 bg-[#f3f0ea] px-6 py-5 pr-12 text-left">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <Mail className="h-3.5 w-3.5" />
            Resend tracked email
          </div>
          <DialogTitle className="font-serif text-2xl font-medium tracking-[-0.03em]">Confirm the next send</DialogTitle>
          <DialogDescription className="mt-2 max-w-md text-sm leading-6 text-slate-600">
            This creates a new outreach record. The original send remains in the history below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-lg border border-slate-200 bg-white/80 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{entry.businessName}</p>
            <p className="mt-1 text-xs text-slate-500">
              Previous send: {deliveryLabel(entry.deliveryStatus)} · {formatDate(entry.sentAt ?? entry.createdAt)}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-2">
              <Label htmlFor="resend-recipient" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                Recipient
              </Label>
              <Input
                id="resend-recipient"
                data-testid="input-resend-recipient"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                type="email"
                autoComplete="email"
                className="h-11 border-slate-300 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resend-template" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                Template
              </Label>
              <div className="relative">
                <select
                  id="resend-template"
                  data-testid="select-resend-template"
                  value={template}
                  onChange={(event) => setTemplate(event.target.value as TemplateValue)}
                  className="h-11 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 pr-9 text-sm text-slate-800 outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">Choose an email template</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-slate-500" />
              </div>
            </div>
          </div>

          {needsSentCheck && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3.5">
              <p className="text-sm font-semibold text-amber-950">Check Gmail Sent before sending again</p>
              <p className="mt-1 text-xs leading-5 text-amber-900/80">
                Delivery could not be confirmed. A second send may create a duplicate. Check the connected Gmail Sent folder first.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-200 bg-[#f7f5f1] px-6 py-4">
          <Button type="button" variant="ghost" data-testid="button-cancel-resend" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="button-confirm-resend"
            onClick={() => onResend(entry, trimmedEmail, template)}
            disabled={!canSubmit}
            className="bg-[#25324a] text-white hover:bg-[#1d283c]"
          >
            {busy ? "Sending…" : "Send again"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type VenueSearchPlace = {
  placeId: string;
  placeName: string;
  address: string | null;
  category: string | null;
};

function canEditPlaceId(entry: VenueOutreachHistoryEntry): boolean {
  const id = Number(entry.id);
  return Number.isSafeInteger(id) && id > 0 && String(id) === entry.id;
}

function canLinkBounceToEntry(entry: VenueOutreachHistoryEntry): boolean {
  const id = Number(entry.id);
  return Number.isSafeInteger(id) &&
    id > 0 &&
    String(id) === entry.id &&
    ["sent", "delivery_uncertain", "sending"].includes(entry.deliveryStatus);
}

function OutreachPlaceDialog({
  entry,
  open,
  busy,
  onOpenChange,
  onSave,
}: {
  entry: VenueOutreachHistoryEntry | null;
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (entry: VenueOutreachHistoryEntry, placeId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueSearchPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<VenueSearchPlace | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const entryKey = entry?.id ?? "";

  useEffect(() => {
    if (!entry) return;
    setQuery(entry.businessName);
    setResults([]);
    setSelectedPlace(entry.placeId
      ? {
          placeId: entry.placeId,
          placeName: entry.businessName,
          address: null,
          category: null,
        }
      : null);
    setError("");
  }, [entryKey]);

  if (!entry) return null;

  const searchPlaces = async () => {
    const searchQuery = query.trim();
    if (searchQuery.length < 2 || searching) return;
    setSearching(true);
    setError("");
    setResults([]);
    try {
      const response = await fetch(
        `/api/admin/venue-owner/places/search?query=${encodeURIComponent(searchQuery)}`,
        { credentials: "include" },
      );
      const data = await response.json().catch(() => ({})) as {
        places?: VenueSearchPlace[];
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "Venue search failed.");
      setResults(data.places ?? []);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Venue search failed.");
    } finally {
      setSearching(false);
    }
  };

  const placeIdChanged = (selectedPlace?.placeId ?? null) !== (entry.placeId ?? null);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-slate-200 bg-[#fbfaf8] sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#25324a]">
            <MapPin className="h-5 w-5" />
            Choose the Maps location
          </DialogTitle>
          <DialogDescription>
            Link this specific email to the correct branch. Emails for the same Google Maps location will be grouped together, even when the recipient changes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white/80 p-3">
            <p className="text-sm font-semibold text-slate-900">{entry.businessName}</p>
            <p className="mt-1 text-xs text-slate-500">{entry.recipientEmail} · {formatDate(entry.createdAt)}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`outreach-place-query-${entry.id}`}>Search Google Maps</Label>
            <div className="flex gap-2">
              <Input
                id={`outreach-place-query-${entry.id}`}
                data-testid={`input-outreach-place-query-${entry.id}`}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setResults([]);
                  setSelectedPlace(null);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchPlaces();
                  }
                }}
                placeholder="Venue name and city"
                maxLength={150}
                disabled={busy || searching}
              />
              <Button
                type="button"
                variant="outline"
                data-testid={`button-search-outreach-place-${entry.id}`}
                onClick={() => void searchPlaces()}
                disabled={busy || searching || query.trim().length < 2}
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">{searching ? "Searching…" : "Search"}</span>
              </Button>
            </div>
            {selectedPlace && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3" data-testid={`selected-outreach-place-${entry.id}`}>
                <p className="text-sm font-medium text-emerald-950">Selected: {selectedPlace.placeName}</p>
                {selectedPlace.address && <p className="mt-1 text-xs text-emerald-900/80">{selectedPlace.address}</p>}
                <p className="mt-1 break-all text-xs text-emerald-900/80">Google Place ID: {selectedPlace.placeId}</p>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-red-700" data-testid={`error-outreach-place-search-${entry.id}`}>{error}</p>}
            {results.length > 0 && (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2">
                {results.map((place) => (
                  <button
                    key={place.placeId}
                    type="button"
                    data-testid={`button-choose-outreach-place-${place.placeId}`}
                    aria-pressed={selectedPlace?.placeId === place.placeId}
                    onClick={() => setSelectedPlace(place)}
                    disabled={busy}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selectedPlace?.placeId === place.placeId
                        ? "border-[#25324a] bg-[#25324a]/5"
                        : "border-slate-200 hover:bg-white"
                    }`}
                  >
                    <span className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#25324a]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">{place.placeName}</span>
                        {place.address && <span className="mt-1 block text-xs text-slate-600">{place.address}</span>}
                        <span className="mt-1 block break-all text-[11px] text-slate-500">Place ID: {place.placeId}</span>
                      </span>
                      {selectedPlace?.placeId === place.placeId && <Check className="h-4 w-4 shrink-0 text-emerald-700" />}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            data-testid={`button-clear-outreach-place-${entry.id}`}
            onClick={() => onSave(entry, null)}
            disabled={busy || !entry.placeId}
          >
            Clear Maps location
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" data-testid={`button-cancel-outreach-place-${entry.id}`} onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button
              type="button"
              data-testid={`button-save-outreach-place-${entry.id}`}
              onClick={() => selectedPlace && onSave(entry, selectedPlace.placeId)}
              disabled={busy || !selectedPlace || !placeIdChanged}
              className="bg-[#25324a] text-white hover:bg-[#1d283c]"
            >
              {busy ? "Saving…" : "Save location"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VenueOutreachHistoryPanel({ onClose, initialSearch = "" }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState({ ...DEFAULT_WORKLIST_FILTERS, search: initialSearch });
  const [selectedEntry, setSelectedEntry] = useState<VenueOutreachHistoryEntry | null>(null);
  const [placeIdEntry, setPlaceIdEntry] = useState<VenueOutreachHistoryEntry | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [sort, setSort] = useState<WorklistSort>("replied");
  const [followUpDrafts, setFollowUpDrafts] = useState<Record<string, FollowUpDraft>>({});
  const [savingFollowUpKey, setSavingFollowUpKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkTemplate, setBulkTemplate] = useState<TemplateValue>("contact_request");
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [pastedListOpen, setPastedListOpen] = useState(false);
  const [clearFailedOpen, setClearFailedOpen] = useState(false);
  const [clearFailedBusy, setClearFailedBusy] = useState(false);
  const [bounceSyncBusy, setBounceSyncBusy] = useState(false);
  const [bounceSyncResult, setBounceSyncResult] = useState<SyncVenueOutreachBouncesResult | null>(null);
  const [bounceReconciliationOpen, setBounceReconciliationOpen] = useState(false);
  const [bounceReconciliationPreview, setBounceReconciliationPreview] = useState<GmailBounceReconciliationPreviewResult | null>(null);
  const [classificationConfirmOpen, setClassificationConfirmOpen] = useState(false);
  const [bounceLinkNotice, setBounceLinkNotice] = useState<BounceLinkNotice | null>(null);
  const [bounceLinkSendId, setBounceLinkSendId] = useState("");
  const [onePerAddress, setOnePerAddress] = useState(true);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; current: number; total: number } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ sent: number; rejected: number; uncertain: number; notAttempted: number; detail: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<VenueDeleteDialogState | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const historyQuery = useGetVenueOutreachHistory({
    query: { queryKey: getGetVenueOutreachHistoryQueryKey(), staleTime: 0, refetchOnMount: "always" },
    request: { cache: "no-store" },
  });
  const templatesQuery = useListVenueEmailTemplates({
    query: { queryKey: getListVenueEmailTemplatesQueryKey(), staleTime: 0, refetchOnMount: "always" },
  });
  const emailTemplates = templatesQuery.data ?? [];
  const selectedTemplate = emailTemplates.find((template) => template.id === bulkTemplate);
  useEffect(() => {
    if (templatesQuery.isSuccess && bulkTemplate && !selectedTemplate) {
      setBulkTemplate("");
      setBulkConfirmOpen(false);
    }
  }, [templatesQuery.data, bulkTemplate, templatesQuery.isSuccess]);
  const followUpMutation = useUpdateVenueOutreachFollowUp();
  const manualInterestMutation = useUpdateVenueOutreachManualInterest();
  const manualReplyMutation = useCreateVenueOutreachManualReplyEvent();
  const placeIdMutation = useUpdateVenueOutreachPlaceId();
  const bounceLinkMutation = useLinkGmailBounceToVenueOutreach();
  const suppressionMutation = useUpdateVenueOutreachEmailSuppression();
  const bounceReconciliationPreviewMutation = usePreviewGmailVenueOutreachBounceReconciliation();
  const bounceReconciliationApplyMutation = useApplyGmailVenueOutreachBounceReconciliation();
  const gmailRepliesMutation = useSyncGmailVenueOutreachReplies();
  const classifyRepliesMutation = useClassifyPendingVenueOutreachReplies();
  const outreachHistoryDeleteMutation = useDeleteVenueOutreachHistory();
  const venueDeleteMutation = useDeleteAdminVenue();
  const entries = historyQuery.data?.emails ?? [];
  const suppressedEmails = historyQuery.data?.suppressedEmails ?? [];
  const suppressedEmailSet = new Set(suppressedEmails.map((email) => email.trim().toLowerCase()));
  const isEmailSuppressed = (email: string) => suppressedEmailSet.has(email.trim().toLowerCase());
  const eligibleBounceEntries = entries.filter(canLinkBounceToEntry);
  const linkableBounceEntries = bounceLinkNotice
    ? eligibleBounceEntries.filter((entry) =>
        entry.recipientEmail.trim().toLowerCase() === bounceLinkNotice.recipientEmail.trim().toLowerCase() &&
        (bounceLinkNotice.kind !== "ambiguous" || bounceLinkNotice.candidateIds?.includes(entry.id) === true))
    : [];
  const selectedBounceEntry = linkableBounceEntries.find((entry) => entry.id === bounceLinkSendId) ?? null;
  const failedEmailCount = entries.filter((entry) =>
    entry.deliveryStatus === "failed" && entry.sentAt === null,
  ).length;
  const bouncedEmailCount = entries.filter((entry) => entry.deliveryStatus === "bounced").length;
  const cleanupEmailCount = failedEmailCount + bouncedEmailCount;
  const pendingDeliveryCount = entries.filter((entry) =>
    entry.deliveryStatus === "sending" || entry.deliveryStatus === "delivery_uncertain",
  ).length;
  const templateLabels = {
    ...Object.fromEntries(entries.filter((entry) => entry.templateName).map((entry) => [entry.template, entry.templateName!])),
    ...Object.fromEntries(emailTemplates.map((template) => [template.id, template.name])),
  };

  const venueGroups = useMemo(() => dedupeVenueHistory(entries), [entries]);
  const bouncedGroups = useMemo(
    () => venueGroups.filter((group) => group.latest.deliveryStatus === "bounced"),
    [venueGroups],
  );
  const filteredGroups = useMemo(
    () => sortVenueGroups(filterVenueGroups(venueGroups, filters), sort),
    [venueGroups, filters, sort],
  );
  const historyTemplates = useMemo(() => Array.from(new Set(entries.map((entry) => entry.template)))
    .sort((a, b) => emailTemplateLabel(a).localeCompare(emailTemplateLabel(b))), [entries]);

  const selectedGroups = venueGroups.filter((group) => selectedKeys.includes(group.key));
  const blockedSelectedCount = selectedGroups.filter((group) => isEmailSuppressed(group.latest.recipientEmail)).length;
  const visibleKeys = new Set(filteredGroups.map((group) => group.key));
  const hiddenSelectedCount = selectedGroups.filter((group) => !visibleKeys.has(group.key)).length;
  const recipientsForBulk = (onePerAddress ? dedupeRecipientEmails(selectedGroups) : selectedGroups)
    .filter((group) => !isEmailSuppressed(group.latest.recipientEmail));
  const allVenuesSelected = venueGroups.length > 0 && venueGroups.every((group) => selectedKeys.includes(group.key));
  const selectVisible = () => setSelectedKeys((current) => {
    const visible = filteredGroups.map((group) => group.key);
    const allVisibleSelected = visible.length > 0 && visible.every((key) => current.includes(key));
    if (allVisibleSelected) return current.filter((key) => !visible.includes(key));
    return Array.from(new Set([...current, ...visible]));
  });
  const toggleVenue = (key: string) => setSelectedKeys((current) => {
    if (current.includes(key)) return current.filter((value) => value !== key);
    return [...current, key];
  });
  const selectAllVenues = () => {
    setSelectedKeys(allVenuesSelected ? [] : venueGroups.map((group) => group.key));
    setBulkResult(null);
  };
  const selectBouncedForRetry = () => {
    setFilters({ ...DEFAULT_WORKLIST_FILTERS, view: "all", status: "bounced" });
    setSelectedKeys(bouncedGroups.map((group) => group.key));
    setBulkTemplate("");
    setOnePerAddress(true);
    setBulkResult(null);
    if (bouncedGroups.length > 0) {
      toast({
        title: "Bounced recipients selected",
        description: "Choose one shared template, then review the recipients and confirm the bulk send.",
      });
    }
  };

  const sendManual = async (entry: VenueOutreachHistoryEntry, recipientEmail: string, templateId: string) => {
    const retryOfLogId = Number(entry.id);
    const isSameAddressRetry = entry.deliveryStatus === "bounced" &&
      Number.isSafeInteger(retryOfLogId) &&
      retryOfLogId > 0 &&
      entry.recipientEmail.trim().toLowerCase() === recipientEmail.trim().toLowerCase();
    const sent = await sendManualVenueEmail({
      businessName: entry.businessName, recipientEmail, templateId,
      ...(entry.placeId ? { placeId: entry.placeId } : {}),
      ...(entry.venueOwnerProfileId != null ? { venueOwnerProfileId: entry.venueOwnerProfileId } : {}),
      ...(isSameAddressRetry ? { retryOfLogId } : {}),
    });
    if (!sent.emailSent) throw new Error(`Delivery was not confirmed for ${recipientEmail}.`);
  };

  const setEmailSuppression = async (email: string, suppressed: boolean) => {
    try {
      const result = await suppressionMutation.mutateAsync({ data: { email, suppressed } });
      queryClient.setQueryData<VenueOutreachHistoryResponse>(
        getGetVenueOutreachHistoryQueryKey(),
        (current) => current
          ? {
              ...current,
              suppressedEmails: result.suppressed
                ? [...new Set([...current.suppressedEmails, result.email])]
                : current.suppressedEmails.filter((blocked) => blocked !== result.email),
            }
          : current,
      );
      toast({
        title: result.suppressed ? "Future emails stopped" : "Email allowed again",
        description: result.suppressed
          ? `${result.email} is blocked from future Venue Admin outreach. Past email history is unchanged.`
          : `${result.email} can be used for Venue Admin outreach again.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Email setting not changed",
        description: error instanceof Error ? error.message : "The email outreach setting could not be updated.",
      });
    }
  };

  const emailSuppressionButton = (email: string, testId: string) => {
    const suppressed = isEmailSuppressed(email);
    return (
      <Button
        type="button"
        variant="outline"
        data-testid={testId}
        onClick={() => void setEmailSuppression(email, !suppressed)}
        disabled={suppressionMutation.isPending}
        className="ml-2 h-7 px-2 text-xs"
      >
        {suppressionMutation.isPending
          ? "Saving…"
          : suppressed
            ? "Allow future emails"
            : "Stop future emails"}
      </Button>
    );
  };

  const runBulkSend = async () => {
    const recipients = recipientsForBulk.map((group) => group.latest);
    setBulkSending(true);
    setBulkProgress({ completed: 0, current: 1, total: recipients.length });
    let currentEmail = "";
    try {
      const result = await sendVenueBatch(recipients,
        (entry) => {
          currentEmail = entry.recipientEmail;
          return sendManual(entry, entry.recipientEmail, bulkTemplate);
        }, setBulkProgress, Infinity, shouldContinueVenueBatchAfterFailure);
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      setBulkConfirmOpen(false);
      const terminalIsConfirmedNotSent = Boolean(result.error && isConfirmedVenueSendFailure(result.error));
      const rejectionDetails = result.continuedFailures.map(({ recipient, error }) =>
        `Rejected before sending to ${recipient.recipientEmail}: ${getVenueSendErrorMessage(error)}. The batch continued.`,
      );
      const stoppedDetail = result.error
        ? terminalIsConfirmedNotSent
          ? `The request for ${currentEmail} was rejected before sending: ${getVenueSendErrorMessage(result.error)}. Later recipients were not attempted.`
          : `Delivery to ${currentEmail} was not confirmed. Check Gmail Sent before retrying this address; later recipients were not attempted.`
        : "";
      setBulkResult({
        sent: result.sentCount,
        rejected: result.continuedFailures.length + (terminalIsConfirmedNotSent ? 1 : 0),
        uncertain: result.error && !terminalIsConfirmedNotSent ? 1 : 0,
        notAttempted: result.notAttemptedCount,
        detail: [...rejectionDetails, stoppedDetail].filter(Boolean).join(" "),
      });
      setSelectedKeys([]);
    } finally {
      setBulkSending(false);
      setBulkProgress(null);
    }
  };

  const runGmailReplySync = async () => {
    try {
      const result = await gmailRepliesMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      const replyNoun = result.matchedReplyCount === 1 ? "reply" : "replies";
      const pendingClassification = result.classificationPendingCount === 1
        ? " 1 reply is awaiting optional AI classification."
        : result.classificationPendingCount > 1
          ? ` ${result.classificationPendingCount} replies are awaiting optional AI classification.`
          : " No replies are awaiting AI classification.";
      toast({
        title: "Gmail metadata sync complete",
        description: `Scanned ${result.scannedCount} messages and matched ${result.matchedReplyCount} ${replyNoun}. No AI classification was run.${pendingClassification}${result.truncated ? " The 1,000-message limit was reached; some older replies may not have been checked." : ""}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gmail replies could not be checked",
        description: error instanceof Error
          ? error.message
          : "Check the connected Gmail access and try again.",
      });
    }
  };

  const runClassifyPendingReplies = async () => {
    setClassificationConfirmOpen(false);
    try {
      const result = await classifyRepliesMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      const pending = result.classificationPendingCount === 1
        ? "1 reply remains pending."
        : `${result.classificationPendingCount} replies remain pending.`;
      const failures = result.classificationFailedCount > 0
        ? ` ${result.classificationFailedCount} failed and can be retried.`
        : "";
      const deferred = result.deferredCount > 0
        ? ` ${result.deferredCount} were deferred by the per-run limit.`
        : "";
      toast({
        title: "AI reply classification complete",
        description: `Attempted ${result.attemptedReplyCount}; classified ${result.classifiedReplyCount}. ${pending}${failures}${deferred}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "AI reply classification could not be completed",
        description: error instanceof Error
          ? error.message
          : "Try again later.",
      });
    }
  };

  const counts = useMemo(() => ({
    total: venueGroups.length,
    worklist: venueGroups.filter((group) =>
      hasApplicationOrRegistrationInProgress(group) || hasPersonalizedApproach(group),
    ).length,
    archived: venueGroups.filter((group) =>
      !hasApplicationOrRegistrationInProgress(group) && !hasPersonalizedApproach(group),
    ).length,
    replied: venueGroups.filter(hasConfirmedReply).length,
    interested: venueGroups.filter((group) =>
      latestGmailReply(group)?.gmailReplyClassification === "interested",
    ).length,
    rejected: venueGroups.filter((group) =>
      latestGmailReply(group)?.gmailReplyClassification === "rejected",
    ).length,
    noReply: venueGroups.filter((group) =>
      lastSuccessfulEmail(group) !== null && !hasConfirmedReply(group),
    ).length,
    followup: venueGroups.filter((group) => isFollowUpDue(group)).length,
    attention: venueGroups.filter((group) => group.events.some((entry) =>
      entry.deliveryStatus === "delivery_uncertain" ||
      entry.deliveryStatus === "failed" ||
      entry.deliveryStatus === "bounced",
    )).length,
    failed: venueGroups.filter((group) => group.events.some((entry) =>
      entry.deliveryStatus === "failed" || entry.deliveryStatus === "bounced",
    )).length,
  }), [venueGroups]);

  const handleResend = async (
    entry: VenueOutreachHistoryEntry,
    recipientEmail: string,
    template: TemplateValue,
  ) => {
    setResendingId(entry.id);
    try {
      await sendManual(entry, recipientEmail, template);
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      setSelectedEntry(null);
      toast({
        title: "Email sent",
        description: `A new ${templateLabels[template] ?? emailTemplateLabel(template)} email was sent to ${recipientEmail}.`,
      });
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      setSelectedEntry(null);
      toast({
        variant: "destructive",
        title: "Send not confirmed",
        description: error instanceof Error
          ? error.message
          : "The delivery state is unknown. Refresh the history and check Gmail Sent before trying again.",
      });
    } finally {
      setResendingId(null);
    }
  };

  const saveFollowUp = async (entry: VenueOutreachHistoryEntry) => {
    const draft = followUpDrafts[entry.venueKey] ?? {
      note: entry.nextActionNote ?? "",
      dueDate: entry.nextActionDueDate ?? "",
    };
    setSavingFollowUpKey(entry.venueKey);
    try {
      await followUpMutation.mutateAsync({
        data: {
          venueKey: entry.venueKey,
          nextActionNote: draft.note.trim() || null,
          nextActionDueDate: draft.dueDate || null,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      toast({ title: "Follow-up saved", description: `Next-contact details for ${entry.businessName} are up to date.` });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Follow-up not saved",
        description: error instanceof Error ? error.message : "The next-contact details could not be saved.",
      });
    } finally {
      setSavingFollowUpKey(null);
    }
  };

  const saveManualInterest = async (
    entry: VenueOutreachHistoryEntry,
    manualInterestLevel: VenueOutreachHistoryEntry["manualInterestLevel"],
  ) => {
    try {
      await manualInterestMutation.mutateAsync({
        data: { venueKey: entry.venueKey, manualInterestLevel },
      });
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Classification not saved",
        description: error instanceof Error ? error.message : "The manual interest label could not be saved.",
      });
    }
  };

  const saveManualReply = async (
    entry: VenueOutreachHistoryEntry,
    action: "mark_replied" | "undo_mark",
  ) => {
    try {
      await manualReplyMutation.mutateAsync({
        data: { venueKey: entry.venueKey, action },
      });
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      toast({
        title: action === "mark_replied" ? "Reply marked" : "Reply mark undone",
        description: action === "mark_replied"
          ? `${entry.businessName} will be excluded from no-reply follow-ups.`
          : `The manual reply mark for ${entry.businessName} was removed.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Reply status not saved",
        description: error instanceof Error
          ? error.message
          : "The manual reply status could not be saved.",
      });
    }
  };

  const openDeleteDialog = (dialog: VenueDeleteDialogState) => {
    setDeleteConfirmName("");
    setDeleteDialog(dialog);
  };

  const closeDeleteDialog = () => {
    if (outreachHistoryDeleteMutation.isPending || venueDeleteMutation.isPending) return;
    setDeleteConfirmName("");
    setDeleteDialog(null);
  };

  const removeOutreachHistory = async () => {
    if (deleteDialog?.kind !== "outreach-history" ||
      deleteConfirmName.trim() !== deleteDialog.group.latest.businessName.trim()) return;
    try {
      const result = await outreachHistoryDeleteMutation.mutateAsync({
        data: {
          venueKey: deleteDialog.group.key,
          eventIds: deleteDialog.group.events.map((event) => event.id),
          confirm: true,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      setSelectedKeys((current) => current.filter((key) => key !== deleteDialog.group.key));
      setDeleteDialog(null);
      setDeleteConfirmName("");
      toast({
        title: "Outreach history removed",
        description: `${result.deletedEmailCount} records removed. ${result.revokedInvitationCount} invitation links revoked. The venue and application were kept; Gmail messages and email blocks remain unchanged.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Outreach history not removed",
        description: getVenueSendErrorMessage(error),
      });
    }
  };

  const permanentlyDeleteVenue = async () => {
    if (deleteDialog?.kind !== "venue-profile" ||
      deleteConfirmName.trim() !== deleteDialog.businessName.trim()) return;
    try {
      const result = await venueDeleteMutation.mutateAsync({ id: deleteDialog.profileId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListVenueApplicationsQueryKey() }),
      ]);
      setSelectedKeys((current) => current.filter((key) => key !== deleteDialog.groupKey));
      setDeleteDialog(null);
      setDeleteConfirmName("");
      toast({
        title: "Venue permanently deleted",
        description: `${deleteDialog.businessName} and its associated venue data were deleted. ${result.message}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Venue was not deleted",
        description: getVenueSendErrorMessage(error),
      });
    }
  };

  const savePlaceId = async (entry: VenueOutreachHistoryEntry, placeId: string | null) => {
    if (!canEditPlaceId(entry)) return;
    const input: VenueOutreachPlaceIdInput = { placeId };
    try {
      await placeIdMutation.mutateAsync({ id: Number(entry.id), data: input });
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      setPlaceIdEntry(null);
      toast({
        title: placeId ? "Maps location saved" : "Maps location cleared",
        description: placeId
          ? `This email is now grouped by the selected Google Maps location.`
          : `This email will use its previous venue grouping again.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Maps location not saved",
        description: error instanceof Error ? error.message : "The outreach location could not be updated.",
      });
    }
  };

  const clearFilters = () => setFilters({ ...DEFAULT_WORKLIST_FILTERS });
  const runClearFailed = async () => {
    if (clearFailedBusy || cleanupEmailCount === 0) return;
    setClearFailedBusy(true);
    try {
      const result = await clearFailedVenueOutreach({
        confirm: true,
        expectedFailedEmailCount: failedEmailCount,
        expectedBouncedEmailCount: bouncedEmailCount,
      });
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      setSelectedKeys([]);
      setClearFailedOpen(false);
      toast({
        title: "Failed and bounced records cleared",
        description: `${result.clearedBouncedEmailCount} bounced and ${result.clearedFailedEmailCount} confirmed unsent records were removed from Venue Admin. Gmail messages remain in Gmail.`,
      });
    } catch (error) {
      await historyQuery.refetch();
      toast({
        variant: "destructive",
        title: "Cleanup was not completed",
        description: error instanceof Error ? error.message : "The Venue Admin records could not be cleared.",
      });
    } finally {
      setClearFailedBusy(false);
    }
  };

  const runGmailBounceSync = async () => {
    if (bounceSyncBusy) return;
    setBounceSyncBusy(true);
    setBounceSyncResult(null);
    try {
      const result = await syncGmailVenueOutreachBounces({ confirm: true });
      setBounceSyncResult(result);
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      toast({
        title: "Gmail bounce sync complete",
        description: `${result.matchedCount} matched; ${result.repeatBouncesClearedCount} repeat bounces cleared; ${result.ambiguousCount} need review; ${result.unmatchedCount} actionable notices are unmatched; ${result.noHistoryCount} notices have no outreach-history match.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gmail bounce sync failed",
        description: error instanceof Error
          ? error.message
          : "Could not read Gmail delivery notices. Check the connected Gmail access and try again.",
      });
    } finally {
      setBounceSyncBusy(false);
    }
  };

  const runGmailBounceReconciliationPreview = async () => {
    if (bounceReconciliationPreviewMutation.isPending || bounceReconciliationApplyMutation.isPending) return;
    const sourceToken = bounceSyncResult?.reconciliationSourceToken;
    if (!sourceToken) {
      toast({
        variant: "destructive",
        title: "Sync Gmail bounces first",
        description: "Run a fresh Gmail bounce sync, then review the candidate links from that scan.",
      });
      return;
    }
    try {
      const preview = await bounceReconciliationPreviewMutation.mutateAsync({
        data: { confirm: true, sourceToken },
      });
      setBounceReconciliationPreview(preview);
      setBounceReconciliationOpen(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not verify Gmail bounce links",
        description: error instanceof Error
          ? error.message
          : "Gmail and outreach history could not be checked. No records were changed.",
      });
    }
  };

  const applyGmailBounceReconciliation = async () => {
    if (
      !bounceReconciliationPreview ||
      bounceReconciliationPreview.verifiedCandidateCount < 1 ||
      bounceReconciliationApplyMutation.isPending
    ) return;
    try {
      const result = await bounceReconciliationApplyMutation.mutateAsync({
        data: {
          planToken: bounceReconciliationPreview.planToken,
          confirm: true,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      setBounceSyncResult(null);
      setBounceReconciliationOpen(false);
      setBounceReconciliationPreview(null);
      toast({
        title: "Gmail bounce reconciliation complete",
        description: `${result.appliedCount} verified ${result.appliedCount === 1 ? "send was" : "sends were"} updated. Other notices and send records were left unchanged.`,
      });
    } catch (error) {
      setBounceReconciliationPreview(null);
      setBounceReconciliationOpen(false);
      toast({
        variant: "destructive",
        title: "Reconciliation not applied",
        description: error instanceof Error
          ? error.message
          : "A notice or send changed after preview. No records were changed; create a fresh preview.",
      });
    }
  };

  const linkBounceToSend = async () => {
    if (!bounceLinkNotice || !selectedBounceEntry || bounceLinkMutation.isPending) return;
    const id = Number(selectedBounceEntry.id);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    const input: LinkGmailBounceToVenueOutreachInput = {
      gmailMessageId: bounceLinkNotice.gmailMessageId,
      confirm: true,
    };
    try {
      const result = await bounceLinkMutation.mutateAsync({ id, data: input });
      setBounceSyncResult((current) => current ? {
        ...current,
        matchedCount: current.matchedCount + (result.repeatBounceCleared ? 0 : 1),
        repeatBouncesClearedCount: current.repeatBouncesClearedCount +
          (result.repeatBounceCleared ? 1 : 0),
        ...(bounceLinkNotice.kind === "ambiguous"
          ? {
              ambiguousCount: Math.max(0, current.ambiguousCount - 1),
              ambiguousMatches: current.ambiguousMatches.filter(
                (notice) => notice.gmailMessageId !== bounceLinkNotice.gmailMessageId,
              ),
            }
          : {
              unmatchedCount: Math.max(0, current.unmatchedCount - 1),
              unmatchedByReason: bounceLinkNotice.matchingReason
                ? {
                    ...current.unmatchedByReason,
                    [bounceLinkNotice.matchingReason]: Math.max(
                      0,
                      current.unmatchedByReason[bounceLinkNotice.matchingReason] - 1,
                    ),
                  }
                : current.unmatchedByReason,
              unmatchedNotices: current.unmatchedNotices.filter(
                (notice) => notice.gmailMessageId !== bounceLinkNotice.gmailMessageId,
              ),
            }),
      } : current);
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      toast({
        title: result.repeatBounceCleared ? "Repeat bounce cleared from Venue Admin" : "Gmail notice linked",
        description: result.repeatBounceCleared
          ? `The retry and earlier bounced history for ${bounceLinkNotice.recipientEmail} were cleared from Venue Admin. Gmail messages were left untouched.`
          : `The bounce notice for ${bounceLinkNotice.recipientEmail} was linked to ${selectedBounceEntry.businessName}.`,
      });
      setBounceLinkNotice(null);
      setBounceLinkSendId("");
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      toast({
        variant: "destructive",
        title: "Gmail notice not linked",
        description: error instanceof Error
          ? error.message
          : "The send is no longer eligible or the notice was already linked. Refresh the history and review again.",
      });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#e9e7e2] text-slate-950" data-testid="panel-venue-outreach-history">
      <header className="border-b border-slate-300/80 bg-[#25324a] text-white">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              data-testid="button-close-outreach-history"
              onClick={onClose}
              className="h-9 w-9 shrink-0 rounded-full p-0 text-slate-200 hover:bg-white/10 hover:text-white"
              aria-label="Close invitation history"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 border-l border-white/20 pl-4">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-[#e4b87a]" />
                Met venue admin
              </p>
              <h1 className="mt-1 truncate font-serif text-2xl tracking-[-0.035em] sm:text-[28px]">Invitation history</h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-right sm:flex">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-300">Private workspace</p>
              <p className="mt-1 text-xs text-slate-200">Contacted venues and invitation links</p>
            </div>
            <div className="ml-3 h-8 w-px bg-white/15" />
            <Button
              type="button"
              variant="ghost"
              data-testid="button-refresh-outreach-history-header"
              onClick={() => historyQuery.refetch()}
              disabled={historyQuery.isFetching}
              className="h-9 gap-2 text-slate-200 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${historyQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-5 py-6 sm:px-8 sm:py-8">
        <div className="mb-7 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9b6b37]">Tracked sends</p>
            <h2 className="font-serif text-3xl tracking-[-0.04em] text-[#1f2938] sm:text-[38px]">Invited venues</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              One row per venue, with every prior email kept in its history. The active worklist keeps venues with an application or registration in progress and venues sent a personalized invitation; archived history is never deleted.
            </p>
          </div>
          <div className="flex gap-2 self-start lg:self-end">
            <div className="rounded-md border border-slate-300 bg-[#f7f5f1] px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Venues</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#25324a]" data-testid="text-total-outreach-count">{counts.total}</p>
            </div>
            <div className="rounded-md border border-slate-300 bg-[#f7f5f1] px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Venues needing attention</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#9b6b37]" data-testid="text-attention-outreach-count">{counts.attention}</p>
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-slate-300 bg-[#f7f5f1] shadow-[0_12px_35px_rgba(37,50,74,0.07)]" data-testid="section-outreach-history">
          <VenueOutreachFilters filters={filters} onChange={setFilters} sort={sort} onSortChange={setSort}
            templates={historyTemplates} templateLabels={templateLabels} counts={counts} resultCount={filteredGroups.length} />

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/80 bg-[#f1eee8] px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <button type="button" data-testid="button-select-visible-venues" onClick={selectVisible} disabled={filteredGroups.length === 0 || bulkSending} className="font-semibold text-[#25324a] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50">
                {filteredGroups.length > 0 && filteredGroups.every((group) => selectedKeys.includes(group.key)) ? "Clear matching selection" : `Select all matching venues (${filteredGroups.length})`}
              </button>
              <button
                type="button"
                data-testid="button-select-all-contacted-venues"
                onClick={selectAllVenues}
                disabled={venueGroups.length === 0 || bulkSending}
                title="Select every venue across the full history without changing the email template."
                className="font-semibold text-[#25324a] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {allVenuesSelected
                  ? "Clear all venues"
                  : `Select all venues — entire history (${venueGroups.length})`}
              </button>
              <span className="text-slate-600" data-testid="text-selected-venue-count">{selectedKeys.length} selected{hiddenSelectedCount > 0 ? ` · ${hiddenSelectedCount} hidden by filters` : ""}</span>
              {selectedKeys.length > 0 && (
                <button type="button" data-testid="button-clear-selected-venues" onClick={() => setSelectedKeys([])} disabled={bulkSending} className="font-medium text-slate-600 underline-offset-4 hover:underline">
                  Clear selection
                </button>
              )}
              <span className="text-xs text-slate-500">Any template · any venue · no batch-size limit</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <VenueProspectCampaignLauncher
                disabled={bulkSending || templatesQuery.isLoading || templatesQuery.isError || historyQuery.isLoading || historyQuery.isError}
                onOpen={() => void templatesQuery.refetch()}
                templates={emailTemplates}
                history={entries}
                suppressedEmails={suppressedEmails}
                onSent={() => queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() })}
              />
              <VenueNoReplyCampaignLauncher
                disabled={bulkSending || templatesQuery.isLoading || templatesQuery.isError || historyQuery.isLoading || historyQuery.isError}
                onOpen={async () => {
                  const [templateResult, historyResult] = await Promise.all([
                    templatesQuery.refetch(),
                    historyQuery.refetch(),
                  ]);
                  if (templateResult.isError || historyResult.isError) {
                    throw new Error("Could not refresh templates or outreach history. Retry before preparing the campaign.");
                  }
                }}
                templates={emailTemplates}
                history={entries}
                suppressedEmails={suppressedEmails}
                onSent={() => queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() })}
              />
              <Button type="button" variant="outline" data-testid="button-paste-email-list" onClick={() => setPastedListOpen(true)} disabled={bulkSending || templatesQuery.isLoading || templatesQuery.isError}>Send pasted list</Button>
              <Button type="button" variant="outline" onClick={() => setTemplateManagerOpen(true)} disabled={bulkSending || templatesQuery.isLoading || templatesQuery.isError} data-testid="button-manage-email-templates">Manage templates</Button>
              <Button type="button" variant="outline" data-testid="button-sync-gmail-replies" onClick={() => void runGmailReplySync()}
                disabled={bulkSending || !!resendingId || bounceSyncBusy || clearFailedBusy || gmailRepliesMutation.isPending || classifyRepliesMutation.isPending || followUpMutation.isPending || placeIdMutation.isPending || bounceReconciliationPreviewMutation.isPending || bounceReconciliationApplyMutation.isPending}>
                {gmailRepliesMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                {gmailRepliesMutation.isPending ? "Checking Gmail replies…" : "Sync Gmail replies"}
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="button-classify-gmail-replies"
                onClick={() => setClassificationConfirmOpen(true)}
                disabled={bulkSending || !!resendingId || bounceSyncBusy || clearFailedBusy || gmailRepliesMutation.isPending || classifyRepliesMutation.isPending || followUpMutation.isPending || placeIdMutation.isPending || bounceReconciliationPreviewMutation.isPending || bounceReconciliationApplyMutation.isPending}
              >
                {classifyRepliesMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {classifyRepliesMutation.isPending ? "Classifying replies…" : "Classify pending replies with AI"}
              </Button>
              <Button type="button" variant="outline" data-testid="button-sync-gmail-bounces" onClick={() => void runGmailBounceSync()}
                disabled={bulkSending || !!resendingId || bounceSyncBusy || clearFailedBusy || followUpMutation.isPending || placeIdMutation.isPending || bounceReconciliationPreviewMutation.isPending || bounceReconciliationApplyMutation.isPending}>
                {bounceSyncBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {bounceSyncBusy ? "Checking Gmail…" : "Sync Gmail bounces"}
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="button-preview-gmail-bounce-reconciliation"
                onClick={() => void runGmailBounceReconciliationPreview()}
                disabled={!bounceSyncResult?.reconciliationSourceToken || bulkSending || !!resendingId || bounceSyncBusy || clearFailedBusy || followUpMutation.isPending || placeIdMutation.isPending || bounceReconciliationPreviewMutation.isPending || bounceReconciliationApplyMutation.isPending}
              >
                {bounceReconciliationPreviewMutation.isPending
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <ShieldCheck className="mr-2 h-4 w-4" />}
                {bounceReconciliationPreviewMutation.isPending
                  ? "Verifying Gmail…"
                  : bounceSyncResult?.reconciliationSourceToken
                    ? "Review stale Gmail links"
                    : bounceSyncResult
                      ? "Review unavailable"
                      : "Sync Gmail to review stale links"}
              </Button>
              <Button type="button" variant="outline" data-testid="button-clear-bounced-failed-outreach" onClick={() => setClearFailedOpen(true)}
                disabled={bulkSending || !!resendingId || bounceSyncBusy || clearFailedBusy || followUpMutation.isPending || placeIdMutation.isPending}>
                Clear bounced + failed ({cleanupEmailCount})
              </Button>
              <Button
                type="button"
                variant="outline"
                data-testid="button-select-bounced-for-retry"
                onClick={selectBouncedForRetry}
                disabled={bouncedGroups.length === 0 || bulkSending || !!resendingId || bounceSyncBusy || templatesQuery.isError || templatesQuery.isLoading}
              >
                Select bounced for retry ({bouncedGroups.length})
              </Button>
              <select aria-label="Shared bulk template" data-testid="select-bulk-template" value={bulkTemplate} disabled={bulkSending || templatesQuery.isLoading}
                onChange={(event) => { setBulkTemplate(event.target.value); setBulkConfirmOpen(false); }}
                className="h-9 max-w-[270px] rounded-md border border-slate-300 bg-white px-2 text-xs">
                <option value="">Choose an email template</option>
                {emailTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              <Button type="button" data-testid="button-bulk-send-preview" disabled={recipientsForBulk.length === 0 || !selectedTemplate || bulkSending || templatesQuery.isError} onClick={() => { setBulkResult(null); setBulkConfirmOpen(true); }} className="h-9 gap-2 bg-[#25324a] text-white hover:bg-[#1d283c]">
                <Send className="h-3.5 w-3.5" /> Review send ({recipientsForBulk.length})
              </Button>
            </div>
          </div>
          <p className="border-b border-slate-200 bg-white px-5 py-2 text-xs text-slate-500">
            Gmail sync reads notices and updates matched Venue Admin records; it never deletes Gmail messages. “Review stale Gmail links” still verifies the original Sent message before a separate confirmation. Select bounced recipients to prepare a bulk retry with one shared template; a retry bounce clears the related Venue Admin rows on the next sync.
          </p>
          {bounceSyncResult && (
            <div
              role="status"
              data-testid="status-gmail-bounce-sync"
              className={`border-b px-5 py-3 text-sm ${
                bounceSyncResult.ambiguousCount > 0 || bounceSyncResult.unmatchedCount > 0 || bounceSyncResult.truncated
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : "border-emerald-200 bg-emerald-50 text-emerald-950"
              }`}
            >
              <p>
                Checked {bounceSyncResult.scannedCount} Gmail messages: {bounceSyncResult.matchedCount} confirmed failures matched, {bounceSyncResult.repeatBouncesClearedCount} repeat bounces cleared from Venue Admin, {bounceSyncResult.ambiguousCount} ambiguous, {bounceSyncResult.unmatchedCount} actionable unmatched, {bounceSyncResult.noHistoryCount} with no Venue Admin email-history match.
              </p>
              {bounceSyncResult.unmatchedCount > 0 && (
                <p className="mt-1 text-xs">
                  Actionable unmatched reasons: missing original ID {bounceSyncResult.unmatchedByReason.missing_original_message_id} · no eligible send {bounceSyncResult.unmatchedByReason.no_eligible_send_candidate} · recipient mismatch {bounceSyncResult.unmatchedByReason.recipient_mismatch} · multiple recipients {bounceSyncResult.unmatchedByReason.multiple_recipients}.
                </p>
              )}
              {bounceSyncResult.unmatchedByReason.no_eligible_send_candidate > 0 && (
                <div
                  className="mt-3 rounded-md border border-amber-200 bg-white/80 p-3"
                  data-testid="notice-stale-gmail-links"
                >
                  <p className="text-xs leading-5">
                    “No eligible send” means this sync could not match a notice’s original Message-ID to an active outreach row. The standard sync does not search Gmail Sent for a replacement, so some notices may have stale stored IDs. The separate review checks Gmail Sent, recipient, and send time, and only allows changes if all 136 one-to-one matches verify; it will not bulk-link all unmatched notices.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="button-review-stale-links-from-sync"
                    onClick={() => void runGmailBounceReconciliationPreview()}
                    disabled={!bounceSyncResult.reconciliationSourceToken || bulkSending || !!resendingId || bounceSyncBusy || clearFailedBusy || followUpMutation.isPending || placeIdMutation.isPending || bounceReconciliationPreviewMutation.isPending || bounceReconciliationApplyMutation.isPending}
                    className="mt-2 h-8 border-amber-300 bg-white text-xs"
                  >
                    {bounceSyncResult.reconciliationSourceToken
                      ? `Review the ${bounceSyncResult.reconciliationCandidateCount}-row set`
                      : bounceSyncResult.truncated
                        ? "This Gmail scan reached its message limit, so no review token was created."
                        : bounceSyncResult.reconciliationCandidateCount > 250
                          ? "The safe review limit is 250 candidate messages."
                          : "This scan returned no reviewable stale-link candidates."}
                  </Button>
                </div>
              )}
              {cleanupEmailCount > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-white/70 p-3">
                  <p className="text-xs">
                    {bouncedEmailCount} bounced and {failedEmailCount} confirmed unsent failed records are ready to clear from Venue Admin. Use the cleanup action above.
                  </p>
                </div>
              )}
              {bounceSyncResult.ambiguousMatches.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="font-semibold">Review these ambiguous notices; no send records were changed:</p>
                  <ul className="list-disc space-y-1 pl-5 text-xs">
                    {bounceSyncResult.ambiguousMatches.map((item, index) => (
                      <li key={`${item.recipientEmail}-${item.originalSentAt ?? index}`}>
                        {item.recipientEmail} · original send {formatDate(item.originalSentAt)} · possible matches: {item.candidates.map((candidate) => `${candidate.businessName} (${formatDate(candidate.createdAt)})`).join(", ")} · {item.gmailThreadId ? <a href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(item.gmailThreadId)}`} target="_blank" rel="noreferrer" className="font-medium underline">Open notice in Gmail</a> : <span className="text-slate-500">Gmail conversation link unavailable</span>}
                        {emailSuppressionButton(item.recipientEmail, `button-suppress-ambiguous-email-${index}`)}
                        {item.candidates.length > 0 && eligibleBounceEntries.some((entry) =>
                          item.candidates.some((candidate) =>
                            candidate.id === entry.id &&
                            entry.recipientEmail.trim().toLowerCase() === item.recipientEmail.trim().toLowerCase())) && (
                          <Button
                            type="button"
                            variant="outline"
                            data-testid={`button-link-ambiguous-gmail-notice-${index}`}
                            className="ml-2 h-7 border-amber-300 bg-white px-2 text-xs text-amber-950 hover:bg-amber-100"
                            onClick={() => {
                              setBounceLinkSendId("");
                              setBounceLinkNotice({
                                kind: "ambiguous",
                                gmailMessageId: item.gmailMessageId,
                                gmailThreadId: item.gmailThreadId,
                                recipientEmail: item.recipientEmail,
                                originalSentAt: item.originalSentAt,
                                status: null,
                                reason: "",
                                candidateIds: item.candidates.map((candidate) => candidate.id),
                              });
                            }}
                          >
                            Choose send…
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {bounceSyncResult.unmatchedNotices.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="font-semibold">Review these unmatched notices; no send records were changed:</p>
                  <ul className="list-disc space-y-1 pl-5 text-xs">
                    {bounceSyncResult.unmatchedNotices.map((notice, index) => (
                      <li key={`${notice.gmailMessageId}-${index}`}>
                        {notice.recipientEmail} · original send {formatDate(notice.originalSentAt)}
                        {notice.status ? ` · ${notice.status}` : ""}
                        {notice.reason ? ` · ${notice.reason}` : ""}
                        {` · ${unmatchedMatchingReasonLabel(notice.matchingReason)}`}
                        {" · "}
                        {notice.gmailThreadId ? <a href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(notice.gmailThreadId)}`} target="_blank" rel="noreferrer" className="font-medium underline">Open notice in Gmail</a> : <span className="text-slate-500">Gmail conversation link unavailable</span>}
                        {emailSuppressionButton(notice.recipientEmail, `button-suppress-unmatched-email-${index}`)}
                        {!["multiple_recipients", "recipient_mismatch"].includes(notice.matchingReason) &&
                          notice.originalSentAt !== null &&
                          eligibleBounceEntries.some((entry) => entry.recipientEmail.trim().toLowerCase() === notice.recipientEmail.trim().toLowerCase()) && (
                          <Button
                            type="button"
                            variant="outline"
                            data-testid={`button-review-link-gmail-notice-${index}`}
                            className="ml-2 h-7 border-amber-300 bg-white px-2 text-xs text-amber-950 hover:bg-amber-100"
                            onClick={() => {
                              setBounceLinkSendId("");
                              setBounceLinkNotice({ kind: "unmatched", ...notice });
                            }}
                          >
                            Link to send…
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {bounceSyncResult.noHistoryCount > 0 && (
                <details className="mt-3 rounded-md border border-slate-200 bg-white/80 p-3 text-xs text-slate-700">
                  <summary className="cursor-pointer font-semibold text-slate-800">
                    {bounceSyncResult.noHistoryCount} notices have no matching Venue Admin email history and are outside the action queue
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {bounceSyncResult.noHistoryNotices.map((notice, index) => (
                      <li key={`${notice.gmailMessageId}-${index}`}>
                        {notice.recipientEmail} · {notice.status ?? "No status"} · {notice.reason || "No diagnostic"}
                        {" · "}
                        {notice.gmailThreadId
                          ? <a href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(notice.gmailThreadId)}`} target="_blank" rel="noreferrer" className="font-medium underline">Open in Gmail</a>
                          : <span className="text-slate-500">Gmail conversation link unavailable</span>}
                      </li>
                    ))}
                  </ul>
                  {bounceSyncResult.noHistoryCount > bounceSyncResult.noHistoryNotices.length && (
                    <p className="mt-2">Showing the first {bounceSyncResult.noHistoryNotices.length}.</p>
                  )}
                </details>
              )}
              {bounceSyncResult.unmatchedCount > bounceSyncResult.unmatchedNotices.length && (
                <p className="mt-2 text-xs">Only the first {bounceSyncResult.unmatchedNotices.length} unmatched notices are listed here.</p>
              )}
              {bounceSyncResult.ambiguousCount > bounceSyncResult.ambiguousMatches.length && (
                <p className="mt-2 text-xs">Only the first {bounceSyncResult.ambiguousMatches.length} ambiguous notices are listed here.</p>
              )}
              {bounceSyncResult.truncated && (
                <p className="mt-2 text-xs">The scan reached its 1,000-message limit. Older notices were not checked.</p>
              )}
            </div>
          )}
          {suppressedEmails.length > 0 && (
            <div className="border-b border-amber-200 bg-amber-50/70 px-5 py-3" data-testid="section-suppressed-outreach-emails">
              <p className="text-sm font-semibold text-amber-950">Future outreach blocked for {suppressedEmails.length} {suppressedEmails.length === 1 ? "address" : "addresses"}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {suppressedEmails.map((email) => (
                  <li key={email} className="flex items-center gap-2 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-800">
                    <span>{email}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      data-testid={`button-allow-email-${encodeURIComponent(email)}`}
                      onClick={() => void setEmailSuppression(email, false)}
                      disabled={suppressionMutation.isPending}
                      className="h-6 px-1.5 text-xs text-[#25324a]"
                    >
                      Allow again
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-5 py-2 text-xs text-slate-600">
            <span>All application and delivery states can be selected. Selecting a template never clears your selection.</span>
            <label className="flex items-center gap-2"><input type="checkbox" data-testid="checkbox-one-per-address" checked={onePerAddress} onChange={(event) => setOnePerAddress(event.target.checked)} disabled={bulkSending} />One email per address</label>
          </div>
          {templatesQuery.isError && <div role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800">Email templates could not be loaded. <button type="button" onClick={() => templatesQuery.refetch()} className="underline">Try again</button></div>}

          {historyQuery.isLoading ? (
            <div className="space-y-3 p-5" data-testid="state-outreach-history-loading">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="grid gap-3 rounded-lg border border-slate-200 bg-white/70 p-4 sm:grid-cols-[1.4fr_1.3fr_1fr_auto]">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </div>
          ) : historyQuery.isError ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center" data-testid="state-outreach-history-error">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-700">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-900">History is unavailable</h3>
              <p className="mt-1 max-w-sm text-sm leading-6 text-slate-600">{getErrorMessage(historyQuery.error)}</p>
              <Button type="button" data-testid="button-retry-outreach-history" onClick={() => historyQuery.refetch()} className="mt-5 gap-2 bg-[#25324a] text-white hover:bg-[#1d283c]">
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center" data-testid="state-outreach-history-empty">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-300 bg-white text-[#25324a]">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-serif text-2xl text-slate-900">No outreach yet</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                Emails sent from Venue Admin will appear here with their delivery status and any linked application details.
              </p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center" data-testid="state-outreach-history-filtered-empty">
              <Search className="h-6 w-6 text-slate-400" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">No matching sends</h3>
              <p className="mt-1 text-sm text-slate-600">Try another venue, recipient, send type, or delivery state.</p>
              <Button type="button" variant="ghost" data-testid="button-clear-outreach-filters-empty" onClick={clearFilters} className="mt-3 text-[#25324a]">
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto" data-testid="list-outreach-history">
              <div className="min-w-[940px]">
                <div className="grid grid-cols-[32px_1.25fr_1.45fr_1.2fr_1fr_1fr_106px] gap-4 border-b border-slate-200 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span><span className="sr-only">Select</span></span>
                  <span>Venue</span>
                  <span>Recipient</span>
                  <span>Last emailed</span>
                  <span>Next follow-up</span>
                  <span>Latest delivery</span>
                  <span className="text-right">Action</span>
                </div>
                {filteredGroups.map((group) => {
                  const entry = group.latest;
                  const lastSent = lastSuccessfulEmail(group);
                  const application = venueApplication(group);
                  const reply = latestGmailReply(group);
                  const manualReplyEvent = latestManualReplyEvent(group);
                  const manualReplyEvents = manualReplyHistory(group);
                  const manualReplyConfirmed = hasManualReplyConfirmation(group);
                  const profileIds = [...new Set(group.events
                    .map((event) => event.venueOwnerProfileId)
                    .filter((id): id is number => id !== null))];
                  const replyClassificationLabel = reply?.gmailReplyClassification === "interested"
                    ? "Interested"
                    : reply?.gmailReplyClassification === "rejected"
                      ? "Rejected"
                      : reply?.gmailReplyClassification === "other"
                        ? "Other reply"
                        : reply?.gmailReplyClassification === "uncertain"
                          ? "Needs review"
                          : "Awaiting classification";
                  return (
                    <div key={group.key} data-testid={`row-outreach-${entry.id}`} className="border-b border-slate-200/80 last:border-b-0">
                    <div className="grid grid-cols-[32px_1.25fr_1.45fr_1.2fr_1fr_1fr_106px] items-center gap-4 px-5 py-4 hover:bg-white/45">
                      <input type="checkbox" aria-label={`Select ${entry.businessName}`} data-testid={`checkbox-select-venue-${entry.id}`} checked={selectedKeys.includes(group.key)} onChange={() => toggleVenue(group.key)} disabled={bulkSending} className="h-4 w-4 accent-[#25324a] disabled:opacity-30" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900" data-testid={`text-outreach-business-${entry.id}`}>{entry.businessName}</p>
                        <p className="mt-1 text-[11px] text-slate-500" data-testid={`status-outreach-application-${entry.id}`}>
                          {application?.applicationStatus ? `Application: ${prettify(application.applicationStatus)}` : "No application"}
                          {application?.applicationId != null ? ` · #${application.applicationId}` : ""}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-slate-600" data-testid={`text-outreach-agent-${entry.id}`}>
                          Agent: {entry.assignedAgentName ?? (entry.assignedAgentId == null ? "Unassigned" : `Agent #${entry.assignedAgentId}`)}
                        </p>
                        <label className="mt-2 block text-[10px] font-medium text-slate-600">
                          Manual interest
                          <select
                            aria-label={`Manual interest for ${entry.businessName}`}
                            data-testid={`select-manual-interest-${entry.id}`}
                            value={entry.manualInterestLevel ?? ""}
                            disabled={manualInterestMutation.isPending}
                            onChange={(event) => {
                              const value = event.target.value as VenueOutreachHistoryEntry["manualInterestLevel"] | "";
                              void saveManualInterest(entry, value || null);
                            }}
                            className="ml-2 h-7 rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-700 disabled:opacity-60"
                          >
                            <option value="">Not classified</option>
                            <option value="top_interest">Top interest</option>
                            <option value="interest">Interest</option>
                            <option value="no_interest">No interest</option>
                          </select>
                        </label>
                        {(!reply || manualReplyConfirmed) && (
                          <Button
                            type="button"
                            variant="ghost"
                            data-testid={`button-manual-reply-${entry.id}`}
                            disabled={manualReplyMutation.isPending}
                            onClick={() => void saveManualReply(entry, manualReplyConfirmed ? "undo_mark" : "mark_replied")}
                            className="mt-1 h-7 justify-start px-0 text-[11px] font-semibold text-[#256b58] hover:bg-transparent hover:underline disabled:opacity-50"
                          >
                            {manualReplyConfirmed ? "Undo reply mark" : "Mark as replied"}
                          </Button>
                        )}
                        {canEditPlaceId(entry) && (
                          <Button
                            type="button"
                            variant="ghost"
                            data-testid={`button-edit-outreach-place-${entry.id}`}
                            onClick={() => setPlaceIdEntry(entry)}
                            className="mt-1 h-auto justify-start p-0 text-[11px] font-medium text-[#25324a] hover:bg-transparent hover:underline"
                          >
                            <MapPin className="mr-1 h-3 w-3" />
                            {entry.placeId ? "Change Maps location" : "Set Maps location"}
                          </Button>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-700" data-testid={`text-outreach-recipient-${entry.id}`}>{entry.recipientEmail}</p>
                        {isEmailSuppressed(entry.recipientEmail) && <p className="mt-1 text-[11px] font-medium text-amber-800">Future outreach blocked for this address</p>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700">{lastSent ? formatDate(lastSent.sentAt ?? lastSent.createdAt) : "No successful email"}</p>
                        <p className="mt-1 text-[11px] text-slate-500" data-testid={`text-outreach-template-${entry.id}`}>{lastSent ? templateLabels[lastSent.template] ?? emailTemplateLabel(lastSent.template) : "—"}</p>
                        {reply && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {reply.gmailThreadId
                              ? <a href={`https://mail.google.com/mail/u/0/#all/${encodeURIComponent(reply.gmailThreadId)}`} target="_blank" rel="noreferrer" data-testid={`link-outreach-gmail-reply-${entry.id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 underline underline-offset-2">Replied via Gmail · {formatDate(reply.gmailRepliedAt)}</a>
                              : <p data-testid={`text-outreach-gmail-reply-${entry.id}`} className="text-[11px] font-semibold text-emerald-800">Replied via Gmail · {formatDate(reply.gmailRepliedAt)}</p>}
                            <span data-testid={`badge-outreach-reply-classification-${entry.id}`}
                              className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              {replyClassificationLabel}
                            </span>
                          </div>
                        )}
                        {manualReplyEvent && (
                          <p
                            data-testid={`text-outreach-manual-reply-${entry.id}`}
                            title={`Recorded by ${manualReplyEvent.actorUid}`}
                            className={`mt-1 text-[11px] font-semibold ${manualReplyConfirmed ? "text-emerald-800" : "text-slate-500"}`}
                          >
                            {manualReplyConfirmed ? "Admin confirmed reply" : "Manual reply mark undone"} · {formatDate(manualReplyEvent.createdAt)}
                          </p>
                        )}
                        {lastSent && !reply && !manualReplyConfirmed && <p data-testid={`text-outreach-no-reply-${entry.id}`} className="mt-1 text-[11px] text-slate-500">No reply recorded</p>}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm ${isFollowUpDue(group) ? "font-semibold text-amber-800" : "text-slate-700"}`}>
                          {entry.nextActionDueDate ?? (entry.nextActionNote?.trim() ? "No date set" : "No plan")}
                        </p>
                        {entry.nextActionNote && <p className="mt-1 truncate text-[11px] text-slate-500" title={entry.nextActionNote}>{entry.nextActionNote}</p>}
                      </div>
                      <div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${deliveryClasses(entry.deliveryStatus)}`} data-testid={`status-outreach-delivery-${entry.id}`}>
                          {entry.deliveryStatus === "sent" ? <CheckCircle2 className="h-3 w-3" /> : entry.deliveryStatus === "delivery_uncertain" ? <Clock3 className="h-3 w-3" /> : entry.deliveryStatus === "bounced" ? <AlertCircle className="h-3 w-3" /> : null}
                          {deliveryLabel(entry.deliveryStatus)}
                        </span>
                        <p className="mt-1 text-[11px] text-slate-500">{formatDate(entry.createdAt)}</p>
                      </div>
                      <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            data-testid={`button-resend-outreach-${entry.id}`}
                            onClick={() => setSelectedEntry(entry)}
                            disabled={bulkSending || resendingId === entry.id || templatesQuery.isLoading || templatesQuery.isError}
                            className="h-9 gap-1.5 border-slate-300 bg-[#fbfaf8] px-3 text-xs text-[#25324a] hover:bg-white"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Email
                          </Button>
                      </div>
                    </div>
                    <details data-testid={`details-venue-history-${entry.id}`} className="group border-t border-slate-200/70 bg-white/35 px-5 py-2">
                      <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-xs font-semibold text-[#25324a]">
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" /> History · {group.events.length} {group.events.length === 1 ? "email" : "emails"}
                      </summary>
                      <ol className="ml-2 mt-2 space-y-2 border-l border-slate-300 pl-4 pb-2">
                        {group.events.map((event) => (
                          <li key={event.id} data-testid={`item-venue-history-${event.id}`} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div>
                              <span className="font-semibold text-slate-800">{prettify(event.kind)} · {templateLabels[event.template] ?? emailTemplateLabel(event.template)}</span><span className="ml-2 text-slate-500">{event.recipientEmail} · {formatDate(event.createdAt)}</span>
                              {event.linkStatus !== "none" && <p className={`mt-1 ${linkClasses(event.linkStatus)}`}>Invitation link: {linkLabel(event.linkStatus)}{event.expiresAt ? ` · expires ${formatDate(event.expiresAt)}` : ""}</p>}
                              {event.deliveryStatus === "bounced" && (
                                <p className="mt-1 max-w-xl text-red-800" data-testid={`text-outreach-bounce-reason-${event.id}`}>
                                  Gmail reported {event.deliveryFailureStatus ?? "a delivery failure"}{event.deliveryFailureReason ? ` · ${event.deliveryFailureReason}` : ""}.
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`font-semibold ${event.deliveryStatus === "sent" ? "text-emerald-700" : event.deliveryStatus === "delivery_uncertain" ? "text-amber-800" : event.deliveryStatus === "bounced" ? "text-red-800" : "text-slate-600"}`}>{deliveryLabel(event.deliveryStatus)}</span>
                              {canEditPlaceId(event) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  data-testid={`button-edit-outreach-place-timeline-${event.id}`}
                                  onClick={() => setPlaceIdEntry(event)}
                                  className="h-7 px-2 text-xs text-[#25324a]"
                                >
                                  {event.placeId ? "Change location" : "Set location"}
                                </Button>
                              )}
                              {emailSuppressionButton(event.recipientEmail, `button-suppress-history-email-${event.id}`)}
                              <Button type="button" variant="ghost" data-testid={`button-resend-outreach-timeline-${event.id}`} onClick={() => setSelectedEntry(event)} disabled={bulkSending || !!resendingId || templatesQuery.isError || templatesQuery.isLoading} className="h-7 px-2 text-xs">Email</Button>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {manualReplyEvents.length > 0 && (
                        <section
                          aria-label={`Manual reply audit for ${entry.businessName}`}
                          data-testid={`list-manual-reply-audit-${entry.id}`}
                          className="mb-3 rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2"
                        >
                          <p className="text-[11px] font-semibold text-emerald-900">Manual reply status history</p>
                          <ol className="mt-1 space-y-1">
                            {manualReplyEvents.map((event) => (
                              <li key={event.id} className="text-[11px] text-emerald-900">
                                {event.action === "mark_replied" ? "Marked as replied" : "Reply mark undone"} · {formatDate(event.createdAt)} · {event.actorUid}
                              </li>
                            ))}
                          </ol>
                        </section>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                        <p className="max-w-xl text-[11px] leading-5 text-slate-500">
                          Remove only these outreach records, or permanently delete a linked venue profile and its associated data.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            data-testid={`button-remove-outreach-history-${entry.id}`}
                            disabled={bulkSending || group.events.length > 5000}
                            title={group.events.length > 5000 ? "Refresh the history before removing this large group." : undefined}
                            onClick={() => openDeleteDialog({ kind: "outreach-history", group })}
                            className="h-8 gap-1.5 border-rose-200 bg-white px-2.5 text-xs text-rose-800 hover:bg-rose-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove outreach history
                          </Button>
                          {profileIds.map((profileId) => (
                            <Button
                              key={profileId}
                              type="button"
                              variant="destructive"
                              data-testid={`button-delete-outreach-venue-${entry.id}-${profileId}`}
                              disabled={bulkSending}
                              onClick={() => openDeleteDialog({
                                kind: "venue-profile",
                                profileId,
                                businessName: entry.businessName,
                                groupKey: group.key,
                              })}
                              className="h-8 gap-1.5 px-2.5 text-xs"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {profileIds.length === 1 ? "Permanently delete venue" : `Delete venue profile #${profileId}`}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </details>
                    <details data-testid={`details-venue-follow-up-${entry.id}`} className="group border-t border-slate-200/70 bg-white/55 px-5 py-2">
                      <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-xs font-semibold text-[#25324a]">
                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                        Next follow-up · {entry.nextActionDueDate ?? (entry.nextActionNote ? "Note saved" : "No plan")}
                      </summary>
                      <div className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_190px_auto] sm:items-end">
                        {(() => {
                          const draft = followUpDrafts[entry.venueKey] ?? {
                            note: entry.nextActionNote ?? "",
                            dueDate: entry.nextActionDueDate ?? "",
                          };
                          return (
                            <>
                              <div className="space-y-1.5">
                                <Label htmlFor={`follow-up-note-${entry.id}`} className="text-xs font-medium text-slate-600">Next action</Label>
                                <textarea
                                  id={`follow-up-note-${entry.id}`}
                                  data-testid={`input-follow-up-note-${entry.id}`}
                                  value={draft.note}
                                  maxLength={1000}
                                  onChange={(event) => setFollowUpDrafts((current) => ({
                                    ...current,
                                    [entry.venueKey]: { ...draft, note: event.target.value },
                                  }))}
                                  placeholder="Call the owner, send details, or note the handoff"
                                  className="min-h-20 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label htmlFor={`follow-up-date-${entry.id}`} className="text-xs font-medium text-slate-600">Due date</Label>
                                <Input
                                  id={`follow-up-date-${entry.id}`}
                                  data-testid={`input-follow-up-date-${entry.id}`}
                                  type="date"
                                  value={draft.dueDate}
                                  onChange={(event) => setFollowUpDrafts((current) => ({
                                    ...current,
                                    [entry.venueKey]: { ...draft, dueDate: event.target.value },
                                  }))}
                                  className="h-10 border-slate-300 bg-white"
                                />
                              </div>
                              <Button
                                type="button"
                                data-testid={`button-save-follow-up-${entry.id}`}
                                onClick={() => void saveFollowUp(entry)}
                                disabled={savingFollowUpKey === entry.venueKey}
                                className="h-10 bg-[#25324a] text-white hover:bg-[#1d283c]"
                              >
                                {savingFollowUpKey === entry.venueKey ? "Saving…" : "Save plan"}
                              </Button>
                            </>
                          );
                        })()}
                      </div>
                    </details>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <div className="mt-5 flex items-start gap-3 rounded-lg border border-slate-300/80 bg-[#f3f0ea] px-4 py-3.5 text-xs leading-5 text-slate-600" data-testid="text-outreach-history-note">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#9b6b37]" />
          <p><span className="font-semibold text-slate-800">Delivery note:</span> Gmail delivery signals can occasionally arrive late. When a row says “Check Sent,” confirm the message in Gmail before sending again.</p>
        </div>
      </main>

      <ResendDialog
        templates={emailTemplates}
        entry={selectedEntry}
        open={Boolean(selectedEntry)}
        busy={Boolean(selectedEntry && resendingId === selectedEntry.id)}
        onOpenChange={(open) => {
          if (!open && !resendingId) setSelectedEntry(null);
        }}
        onResend={handleResend}
      />
      <VenueEmailTemplateManager open={templateManagerOpen} onOpenChange={(open) => {
        setTemplateManagerOpen(open);
        if (open) void templatesQuery.refetch();
      }} templates={emailTemplates}
        onChanged={async (templateId) => {
          setBulkConfirmOpen(false);
          await queryClient.invalidateQueries({ queryKey: getListVenueEmailTemplatesQueryKey() });
          if (templateId) setBulkTemplate(templateId);
        }} />
      <PastedVenueEmailDialog open={pastedListOpen} onOpenChange={(open) => {
        setPastedListOpen(open);
        if (open) void templatesQuery.refetch();
      }} templates={emailTemplates}
        onSent={() => queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() })} />
      <OutreachPlaceDialog
        entry={placeIdEntry}
        open={Boolean(placeIdEntry)}
        busy={placeIdMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !placeIdMutation.isPending) setPlaceIdEntry(null);
        }}
        onSave={(entry, placeId) => void savePlaceId(entry, placeId)}
      />
      <Dialog
        open={deleteDialog !== null}
        onOpenChange={(open) => { if (!open) closeDeleteDialog(); }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-slate-200 bg-[#fbfaf8] sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-800">
              <Trash2 className="h-5 w-5" />
              {deleteDialog?.kind === "outreach-history" ? "Remove outreach history?" : "Permanently delete venue?"}
            </DialogTitle>
            <DialogDescription>
              {deleteDialog?.kind === "outreach-history"
                ? `This permanently removes ${deleteDialog.group.events.length} Venue Admin history records for ${deleteDialog.group.latest.businessName}, including follow-up details and the manual interest label. Any active invitation links attached to these records will be revoked. The venue profile and application remain.`
                : `This permanently deletes ${deleteDialog?.businessName ?? "this venue"} and its associated venue data, including its profile and application history. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          {deleteDialog?.kind === "outreach-history" && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
              Gmail messages are not deleted, and email blocks remain in place. This action removes the records from Venue Admin only.
            </p>
          )}
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-venue-outreach-delete" className="text-xs font-bold uppercase tracking-wider">
              Type the venue name to confirm
            </Label>
            <Input
              id="confirm-venue-outreach-delete"
              data-testid="input-confirm-venue-outreach-delete"
              placeholder={deleteDialog?.kind === "outreach-history"
                ? deleteDialog.group.latest.businessName
                : deleteDialog?.businessName ?? ""}
              value={deleteConfirmName}
              onChange={(event) => setDeleteConfirmName(event.target.value)}
              autoComplete="off"
              disabled={outreachHistoryDeleteMutation.isPending || venueDeleteMutation.isPending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              data-testid="button-cancel-venue-outreach-delete"
              onClick={closeDeleteDialog}
              disabled={outreachHistoryDeleteMutation.isPending || venueDeleteMutation.isPending}
            >
              Cancel
            </Button>
            {deleteDialog?.kind === "outreach-history" ? (
              <Button
                type="button"
                variant="destructive"
                data-testid="button-confirm-remove-outreach-history"
                onClick={() => void removeOutreachHistory()}
                disabled={
                  outreachHistoryDeleteMutation.isPending ||
                  historyQuery.isFetching ||
                  deleteConfirmName.trim() !== deleteDialog.group.latest.businessName.trim()
                }
              >
                {outreachHistoryDeleteMutation.isPending ? "Removing…" : "Remove history"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                data-testid="button-confirm-permanent-venue-delete"
                onClick={() => void permanentlyDeleteVenue()}
                disabled={
                  venueDeleteMutation.isPending ||
                  deleteConfirmName.trim() !== (deleteDialog?.businessName ?? "").trim()
                }
              >
                {venueDeleteMutation.isPending ? "Deleting…" : "Delete venue"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={bounceReconciliationOpen}
        onOpenChange={(open) => {
          if (bounceReconciliationApplyMutation.isPending) return;
          setBounceReconciliationOpen(open);
          if (!open) setBounceReconciliationPreview(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto border-slate-200 bg-[#fbfaf8]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-[#25324a]">Review verified Gmail links</DialogTitle>
            <DialogDescription>
              This read-only preview includes only one-to-one matches confirmed against Gmail Sent, the recipient, and send time. The apply plan expires {bounceReconciliationPreview ? formatDate(bounceReconciliationPreview.expiresAt) : "soon"}.
            </DialogDescription>
          </DialogHeader>
          {bounceReconciliationPreview && (
            <div className="space-y-3">
              <p role="status" data-testid="status-gmail-bounce-reconciliation-preview" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                {bounceReconciliationPreview.verifiedCandidateCount === 0
                  ? "No verified stale links were found. No records have been changed."
                  : `${bounceReconciliationPreview.verifiedCandidateCount} verified ${bounceReconciliationPreview.verifiedCandidateCount === 1 ? "send is" : "sends are"} ready for review. The server scanned ${bounceReconciliationPreview.scannedCount} Gmail messages.`}
              </p>
              {bounceReconciliationPreview.candidates.length > 0 && (
                <div className="max-h-[50dvh] overflow-y-auto rounded-md border border-slate-200 bg-white">
                  <ol className="divide-y divide-slate-100 text-sm" data-testid="list-gmail-bounce-reconciliation-candidates">
                    {bounceReconciliationPreview.candidates.map((candidate) => (
                      <li key={candidate.logId} data-testid={`row-gmail-bounce-reconciliation-${candidate.logId}`} className="grid gap-1 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <span className="font-medium text-slate-900">{candidate.businessName}</span>
                        <span className="text-slate-700">{candidate.recipientEmail}</span>
                        <span className="text-xs text-slate-500 sm:col-span-2">
                          Original send: {formatDate(candidate.originalSentAt)} · Admin record: {formatDate(candidate.sentAt)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <p className="text-xs leading-5 text-slate-600">
                Applying replaces each listed row’s stored RFC Message-ID and marks that same row bounced. If any notice, Sent message, or row changed after preview, the server aborts the entire update. Ambiguous, unmatched, and no-history notices are not included.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid="button-cancel-gmail-bounce-reconciliation"
              onClick={() => {
                setBounceReconciliationOpen(false);
                setBounceReconciliationPreview(null);
              }}
              disabled={bounceReconciliationApplyMutation.isPending}
            >
              Cancel
            </Button>
            {bounceReconciliationPreview && bounceReconciliationPreview.verifiedCandidateCount > 0 && (
              <Button
                type="button"
                data-testid="button-confirm-gmail-bounce-reconciliation"
                onClick={() => void applyGmailBounceReconciliation()}
                disabled={bounceReconciliationApplyMutation.isPending}
                className="bg-[#25324a] text-white hover:bg-[#1d283c]"
              >
                {bounceReconciliationApplyMutation.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Revalidating and applying…</>
                  : `Confirm: update ${bounceReconciliationPreview.verifiedCandidateCount} ${bounceReconciliationPreview.verifiedCandidateCount === 1 ? "send" : "sends"}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(bounceLinkNotice)}
        onOpenChange={(open) => {
          if (!open && !bounceLinkMutation.isPending) {
            setBounceLinkNotice(null);
            setBounceLinkSendId("");
          }
        }}
      >
        <DialogContent className="max-w-xl border-slate-200 bg-[#fbfaf8]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-[#25324a]">Review Gmail notice link</DialogTitle>
            <DialogDescription>
              Confirm the notice and send record before changing the delivery history. The notice can only be linked once.
            </DialogDescription>
          </DialogHeader>
          {bounceLinkNotice && (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <p className="font-semibold">Gmail notice recipient</p>
                <p className="mt-1">{bounceLinkNotice.recipientEmail}</p>
                <p className="mt-1 text-xs">
                  {bounceLinkNotice.kind === "ambiguous"
                    ? "This notice matched multiple sends. Choose only after reviewing the send details."
                    : unmatchedMatchingReasonLabel(bounceLinkNotice.matchingReason!)}
                </p>
                <p className="mt-1 text-xs">Original send: {formatDate(bounceLinkNotice.originalSentAt)}</p>
                {bounceLinkNotice.status && <p className="mt-1 text-xs">Status: {bounceLinkNotice.status}</p>}
                {bounceLinkNotice.reason && <p className="mt-1 text-xs">Reason: {bounceLinkNotice.reason}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="select-gmail-bounce-send">Choose an eligible send</Label>
                <select
                  id="select-gmail-bounce-send"
                  data-testid="select-gmail-bounce-send"
                  value={bounceLinkSendId}
                  onChange={(event) => setBounceLinkSendId(event.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">Choose a send record</option>
                  {linkableBounceEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.businessName} · {entry.recipientEmail} · {formatDate(entry.sentAt ?? entry.createdAt)}
                    </option>
                  ))}
                </select>
              </div>
              {selectedBounceEntry && (
                <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                  <p className="font-semibold text-slate-900">Selected send</p>
                  <dl className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1 text-slate-700">
                    <dt>Venue</dt><dd>{selectedBounceEntry.businessName}</dd>
                    <dt>Recipient</dt><dd>{selectedBounceEntry.recipientEmail}</dd>
                    <dt>Template</dt><dd>{selectedBounceEntry.templateName ?? emailTemplateLabel(selectedBounceEntry.template)}</dd>
                    <dt>Sent</dt><dd>{formatDate(selectedBounceEntry.sentAt ?? selectedBounceEntry.createdAt)}</dd>
                    <dt>Delivery state</dt><dd>{deliveryLabel(selectedBounceEntry.deliveryStatus)}</dd>
                  </dl>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBounceLinkNotice(null);
                setBounceLinkSendId("");
              }}
              disabled={bounceLinkMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="button-confirm-link-gmail-notice"
              onClick={() => void linkBounceToSend()}
              disabled={!selectedBounceEntry || bounceLinkMutation.isPending}
              className="bg-[#25324a] text-white hover:bg-[#1d283c]"
            >
              {bounceLinkMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Linking…</> : "Confirm link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={clearFailedOpen} onOpenChange={(open) => !clearFailedBusy && setClearFailedOpen(open)}>
        <DialogContent className="max-w-lg border-slate-200 bg-[#fbfaf8]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-[#25324a]">{cleanupEmailCount > 0 ? "Clear bounced and failed records?" : "Review failed and bounced records"}</DialogTitle>
            <DialogDescription>
              {cleanupEmailCount > 0
                ? `This permanently removes ${bouncedEmailCount} bounced record${bouncedEmailCount === 1 ? "" : "s"} and ${failedEmailCount} confirmed failed attempt${failedEmailCount === 1 ? "" : "s"} with no recorded send time from Venue Admin.`
                : "No confirmed bounced or unsent failed records are currently available to clear from Venue Admin."}
            </DialogDescription>
          </DialogHeader>
          {historyQuery.isError && <p role="alert" className="text-sm text-rose-700">History could not be loaded. Refresh before clearing any records.</p>}
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            <p>{pendingDeliveryCount} sending or uncertain {pendingDeliveryCount === 1 ? "attempt is" : "attempts are"} not included because delivery may have occurred. Successful send history and venue applications are also preserved.</p>
            <p>Used invitation links and email suppressions remain. Unused invitation links referenced only by the removed records may be deleted. Known Gmail bounce IDs are retained so sync does not add those notices back.</p>
          </div>
          <p className="text-sm text-slate-600" data-testid="text-gmail-cleanup-unavailable">This action clears Venue Admin records only. The bounce notices and original sent messages remain in Gmail.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void historyQuery.refetch()} disabled={clearFailedBusy || historyQuery.isFetching}>{historyQuery.isFetching ? "Refreshing…" : "Refresh count"}</Button>
            <Button type="button" variant="outline" data-testid="button-cancel-clear-outreach-records" onClick={() => setClearFailedOpen(false)} disabled={clearFailedBusy}>{cleanupEmailCount > 0 ? "Cancel" : "Close"}</Button>
            {cleanupEmailCount > 0 && <Button type="button" data-testid="button-confirm-clear-outreach-records" onClick={() => void runClearFailed()} disabled={clearFailedBusy || historyQuery.isFetching || historyQuery.isError} className="bg-rose-700 text-white hover:bg-rose-800">
              {clearFailedBusy ? "Clearing…" : `Clear ${cleanupEmailCount} records`}
            </Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={classificationConfirmOpen} onOpenChange={(open) => !classifyRepliesMutation.isPending && setClassificationConfirmOpen(open)}>
        <DialogContent className="max-w-lg border-slate-200 bg-[#fbfaf8]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-[#25324a]">Classify pending replies with AI?</DialogTitle>
            <DialogDescription>
              This reads matched reply text and sends it to the AI classifier. It may use Replit credits. Gmail metadata sync above never reads or sends message text.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClassificationConfirmOpen(false)} disabled={classifyRepliesMutation.isPending}>Cancel</Button>
            <Button
              type="button"
              data-testid="button-confirm-classify-gmail-replies"
              onClick={() => void runClassifyPendingReplies()}
              disabled={classifyRepliesMutation.isPending}
              className="bg-[#25324a] text-white hover:bg-[#1d283c]"
            >
              {classifyRepliesMutation.isPending ? "Classifying…" : "Continue with AI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={bulkConfirmOpen} onOpenChange={(open) => !bulkSending && setBulkConfirmOpen(open)}>
        <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto border-slate-200 bg-[#fbfaf8]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-[#25324a]">Confirm recipients before sending</DialogTitle>
            <DialogDescription>One “{selectedTemplate?.name}” email will be sent to each recipient below. Confirmed pre-send rejections are skipped; the batch stops if delivery is uncertain. Keep this page open until it finishes.</DialogDescription>
          </DialogHeader>
          {filters.status === "bounced" && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
              This retry sends to the current email addresses shown below. Verify the recipients before confirming; a repeat bounce will clear their bounced Venue Admin history on the next Gmail sync.
            </p>
          )}
          {selectedTemplate && <details className="rounded-md border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold">Preview email · {selectedTemplate.subject}</summary>
            <iframe title="Selected email preview" sandbox="" referrerPolicy="no-referrer" srcDoc={templatePreview(selectedTemplate.body, selectedTemplate.format)} className="mt-3 h-72 w-full border-0" />
          </details>}
          {bulkTemplate === "preapproval_video_application" && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              This sends a one-time application link to each selected prospect. It does not approve a venue or grant manager access.
            </p>
          )}
          {["registration", "registration_with_video"].includes(bulkTemplate) && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
              Manual account invitations direct recipients to Venue Manager or venue registration in the Met app. They do not grant access or change approvals. Personal access links remain available from the application's registration-link action.
            </p>
          )}
          {selectedGroups.some((group) => ["sending", "delivery_uncertain"].includes(group.latest.deliveryStatus)) && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Some selected venues have sending or unconfirmed emails. You may still send, but check Gmail Sent first to avoid duplicates.</p>}
          <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold" data-testid="text-bulk-recipient-count">{recipientsForBulk.length} emails · {selectedGroups.length} venues selected{hiddenSelectedCount > 0 ? ` · ${hiddenSelectedCount} hidden by filters` : ""}</p>
          {blockedSelectedCount > 0 && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950" data-testid="text-bulk-blocked-count">{blockedSelectedCount} selected {blockedSelectedCount === 1 ? "venue has" : "venues have"} an email address blocked from future outreach and will be skipped.</p>}
          <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white p-3">
            <ol className="space-y-2 text-sm" data-testid="list-bulk-recipients">
              {recipientsForBulk.map((group, index) => (
                <li key={group.key} className="flex gap-2"><span className="w-5 text-right tabular-nums text-slate-400">{index + 1}.</span><span className="font-medium text-slate-800">{group.latest.businessName}</span><span className="ml-auto text-slate-600">{group.latest.recipientEmail}</span></li>
              ))}
            </ol>
          </div>
          {bulkSending && bulkProgress && (
            <p role="status" data-testid="text-bulk-send-progress" className="text-sm text-slate-600">
              Sending email {bulkProgress.current} of {bulkProgress.total} · {bulkProgress.completed} completed
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" data-testid="button-cancel-bulk-send" onClick={() => setBulkConfirmOpen(false)} disabled={bulkSending}>Cancel</Button>
            <Button type="button" data-testid="button-confirm-bulk-send" onClick={() => void runBulkSend()} disabled={bulkSending || recipientsForBulk.length === 0 || !selectedTemplate} className="bg-[#25324a] text-white hover:bg-[#1d283c]">
              {bulkSending ? "Sending serially…" : `Send to ${recipientsForBulk.length} recipients`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {bulkResult && (
        <div role={bulkResult.detail ? "alert" : "status"} data-testid="status-bulk-send-result" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${bulkResult.detail ? "border-amber-300 bg-amber-50 text-amber-950" : "border-emerald-300 bg-emerald-50 text-emerald-950"}`}>
          <strong>Batch finished: {bulkResult.sent} sent, {bulkResult.rejected} rejected before sending, {bulkResult.uncertain} needing a check, {bulkResult.notAttempted} not attempted.</strong>
          {bulkResult.detail && <span className="ml-2">{bulkResult.detail}</span>}
        </div>
      )}
    </div>
  );
}