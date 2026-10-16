import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListVenueEmailTemplates,
  getListVenueEmailTemplatesQueryKey,
  sendManualVenueEmail,
  type VenueEmailTemplate,
  getGetVenueOutreachHistoryQueryKey,
  useGetVenueOutreachHistory,
  useUpdateVenueOutreachPlaceId,
  useUpdateVenueOutreachFollowUp,
  type VenueOutreachHistoryEntry,
  type VenueOutreachPlaceIdInput,
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_WORKLIST_FILTERS, dedupeRecipientEmails, dedupeVenueHistory, filterVenueGroups, isFollowUpDue, lastSuccessfulEmail, sendVenueBatch, sortVenueGroups, venueApplication, type WorklistSort } from "@/components/venue-outreach-worklist";
import VenueOutreachFilters, { emailTemplateLabel } from "@/components/VenueOutreachFilters";
import VenueEmailTemplateManager, { templatePreview } from "@/components/VenueEmailTemplateManager";

type Props = { onClose: () => void; initialSearch?: string };
type TemplateValue = string;
type FollowUpDraft = { note: string; dueDate: string };

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
  }[status];
}

function deliveryClasses(status: VenueOutreachHistoryEntry["deliveryStatus"]): string {
  return {
    sending: "border-sky-200 bg-sky-50 text-sky-700",
    sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
    delivery_uncertain: "border-amber-200 bg-amber-50 text-amber-800",
    failed: "border-rose-200 bg-rose-50 text-rose-700",
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
  const [sort, setSort] = useState<WorklistSort>("recent");
  const [followUpDrafts, setFollowUpDrafts] = useState<Record<string, FollowUpDraft>>({});
  const [savingFollowUpKey, setSavingFollowUpKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkTemplate, setBulkTemplate] = useState<TemplateValue>("contact_request");
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [onePerAddress, setOnePerAddress] = useState(true);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; current: number; total: number } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ sent: number; failed: number; notAttempted: number; detail: string } | null>(null);

  const historyQuery = useGetVenueOutreachHistory({
    query: { queryKey: getGetVenueOutreachHistoryQueryKey() },
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
  const placeIdMutation = useUpdateVenueOutreachPlaceId();
  const entries = historyQuery.data?.emails ?? [];
  const templateLabels = {
    ...Object.fromEntries(entries.filter((entry) => entry.templateName).map((entry) => [entry.template, entry.templateName!])),
    ...Object.fromEntries(emailTemplates.map((template) => [template.id, template.name])),
  };

  const venueGroups = useMemo(() => dedupeVenueHistory(entries), [entries]);
  const filteredGroups = useMemo(
    () => sortVenueGroups(filterVenueGroups(venueGroups, filters), sort),
    [venueGroups, filters, sort],
  );
  const historyTemplates = useMemo(() => Array.from(new Set(entries.map((entry) => entry.template)))
    .sort((a, b) => emailTemplateLabel(a).localeCompare(emailTemplateLabel(b))), [entries]);

  const selectedGroups = venueGroups.filter((group) => selectedKeys.includes(group.key));
  const visibleKeys = new Set(filteredGroups.map((group) => group.key));
  const hiddenSelectedCount = selectedGroups.filter((group) => !visibleKeys.has(group.key)).length;
  const recipientsForBulk = onePerAddress ? dedupeRecipientEmails(selectedGroups) : selectedGroups;
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

  const sendManual = async (entry: VenueOutreachHistoryEntry, recipientEmail: string, templateId: string) => {
    const sent = await sendManualVenueEmail({
      businessName: entry.businessName, recipientEmail, templateId,
      ...(entry.placeId ? { placeId: entry.placeId } : {}),
      ...(entry.venueOwnerProfileId != null ? { venueOwnerProfileId: entry.venueOwnerProfileId } : {}),
    });
    if (!sent.emailSent) throw new Error(`Delivery was not confirmed for ${recipientEmail}.`);
  };

  const runBulkSend = async () => {
    const recipients = recipientsForBulk.map((group) => group.latest);
    setBulkSending(true);
    setBulkProgress({ completed: 0, current: 1, total: recipients.length });
    try {
      const result = await sendVenueBatch(recipients,
        (entry) => sendManual(entry, entry.recipientEmail, bulkTemplate), setBulkProgress);
      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      setBulkConfirmOpen(false);
      setBulkResult({
        sent: result.sentCount,
        failed: result.failedCount,
        notAttempted: result.notAttemptedCount,
        detail: result.error instanceof Error ? result.error.message : result.error ? "The send stopped because delivery was not confirmed." : "",
      });
      setSelectedKeys([]);
    } finally {
      setBulkSending(false);
      setBulkProgress(null);
    }
  };

  const counts = useMemo(() => ({
    total: venueGroups.length,
    followup: venueGroups.filter((group) => isFollowUpDue(group)).length,
    attention: venueGroups.filter((group) =>
      group.latest.deliveryStatus === "delivery_uncertain" || group.latest.deliveryStatus === "failed",
    ).length,
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
              One row per venue, with every prior email kept in its history. Delivery state is shown; opens and reads are not tracked.
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
              <Button type="button" variant="outline" onClick={() => setTemplateManagerOpen(true)} disabled={bulkSending || templatesQuery.isLoading || templatesQuery.isError} data-testid="button-manage-email-templates">Manage templates</Button>
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
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700">{lastSent ? formatDate(lastSent.sentAt ?? lastSent.createdAt) : "No successful email"}</p>
                        <p className="mt-1 text-[11px] text-slate-500" data-testid={`text-outreach-template-${entry.id}`}>{lastSent ? templateLabels[lastSent.template] ?? emailTemplateLabel(lastSent.template) : "—"}</p>
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm ${isFollowUpDue(group) ? "font-semibold text-amber-800" : "text-slate-700"}`}>
                          {entry.nextActionDueDate ?? (entry.nextActionNote?.trim() ? "No date set" : "No plan")}
                        </p>
                        {entry.nextActionNote && <p className="mt-1 truncate text-[11px] text-slate-500" title={entry.nextActionNote}>{entry.nextActionNote}</p>}
                      </div>
                      <div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${deliveryClasses(entry.deliveryStatus)}`} data-testid={`status-outreach-delivery-${entry.id}`}>
                          {entry.deliveryStatus === "sent" ? <CheckCircle2 className="h-3 w-3" /> : entry.deliveryStatus === "delivery_uncertain" ? <Clock3 className="h-3 w-3" /> : null}
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
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`font-semibold ${event.deliveryStatus === "sent" ? "text-emerald-700" : event.deliveryStatus === "delivery_uncertain" ? "text-amber-800" : "text-slate-600"}`}>{deliveryLabel(event.deliveryStatus)}</span>
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
                              <Button type="button" variant="ghost" data-testid={`button-resend-outreach-timeline-${event.id}`} onClick={() => setSelectedEntry(event)} disabled={bulkSending || !!resendingId || templatesQuery.isError || templatesQuery.isLoading} className="h-7 px-2 text-xs">Email</Button>
                            </div>
                          </li>
                        ))}
                      </ol>
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
      <VenueEmailTemplateManager open={templateManagerOpen} onOpenChange={setTemplateManagerOpen} templates={emailTemplates}
        onChanged={async (templateId) => {
          setBulkConfirmOpen(false);
          await queryClient.invalidateQueries({ queryKey: getListVenueEmailTemplatesQueryKey() });
          if (templateId) setBulkTemplate(templateId);
        }} />
      <OutreachPlaceDialog
        entry={placeIdEntry}
        open={Boolean(placeIdEntry)}
        busy={placeIdMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !placeIdMutation.isPending) setPlaceIdEntry(null);
        }}
        onSave={(entry, placeId) => void savePlaceId(entry, placeId)}
      />
      <Dialog open={bulkConfirmOpen} onOpenChange={(open) => !bulkSending && setBulkConfirmOpen(open)}>
        <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto border-slate-200 bg-[#fbfaf8]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-[#25324a]">Confirm recipients before sending</DialogTitle>
            <DialogDescription>One “{selectedTemplate?.name}” email will be sent to each recipient below. Sends run one at a time and stop at the first failure or uncertain delivery. Keep this page open until the batch finishes.</DialogDescription>
          </DialogHeader>
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
          <strong>Batch finished: {bulkResult.sent} sent, {bulkResult.failed} failed or uncertain, {bulkResult.notAttempted} not attempted.</strong>
          {bulkResult.detail && <span className="ml-2">{bulkResult.detail}</span>}
        </div>
      )}
    </div>
  );
}