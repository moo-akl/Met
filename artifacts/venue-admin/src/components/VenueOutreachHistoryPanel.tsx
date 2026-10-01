import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createVenueRegistrationLink,
  getGetVenueOutreachHistoryQueryKey,
  sendNewVenueOutreach,
  sendVenueContactRequest,
  useGetVenueOutreachHistory,
  type VenueOutreachHistoryEntry,
  type VenueOutreachInputTemplate,
  type VenueRegistrationLinkInputTemplate,
} from "@workspace/api-client-react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Mail,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Props = { onClose: () => void; initialSearch?: string };
type StatusFilter = "all" | VenueOutreachHistoryEntry["deliveryStatus"];
type KindFilter = "all" | VenueOutreachHistoryEntry["kind"];
type TemplateValue = VenueOutreachInputTemplate | VenueRegistrationLinkInputTemplate;

const outreachTemplates: Array<{ value: VenueOutreachInputTemplate; label: string }> = [
  { value: "contact_request", label: "Contact request" },
  { value: "met_launch_with_links", label: "Met launch with links" },
  { value: "met_launch_without_links", label: "Met launch without links" },
  { value: "preapproval_video_application", label: "Pre-approval video application" },
  { value: "introduction", label: "Introduction" },
  { value: "benefits", label: "Benefits" },
  { value: "events", label: "Events" },
  { value: "rewards", label: "Rewards" },
  { value: "follow_up", label: "Follow-up" },
];

const registrationTemplates: Array<{ value: VenueRegistrationLinkInputTemplate; label: string }> = [
  { value: "registration", label: "Registration link" },
  { value: "registration_with_video", label: "Registration link with video" },
];

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

function isRegistrationTemplate(value: string): value is VenueRegistrationLinkInputTemplate {
  return value === "registration" || value === "registration_with_video";
}

function getTemplateOptions(kind: VenueOutreachHistoryEntry["kind"]) {
  return kind === "registration_invite" ? registrationTemplates : outreachTemplates;
}

function getDefaultTemplate(entry: VenueOutreachHistoryEntry): TemplateValue {
  const templates = getTemplateOptions(entry.kind);
  return templates.some((option) => option.value === entry.template)
    ? (entry.template as TemplateValue)
    : templates[0].value;
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
}: {
  entry: VenueOutreachHistoryEntry | null;
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onResend: (entry: VenueOutreachHistoryEntry, recipientEmail: string, template: TemplateValue, checkedSent: boolean) => void;
}) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [template, setTemplate] = useState<TemplateValue>("contact_request");
  const [checkedSent, setCheckedSent] = useState(false);

  const entryKey = entry?.id ?? "";
  const needsSentCheck = entry?.deliveryStatus === "delivery_uncertain";
  const options = entry ? getTemplateOptions(entry.kind) : [];

  useEffect(() => {
    if (entry) {
      setRecipientEmail(entry.recipientEmail);
      setTemplate(getDefaultTemplate(entry));
      setCheckedSent(false);
    }
  }, [entryKey]); // Deliberately reset only when a different row is opened.

  if (!entry) return null;

  const trimmedEmail = recipientEmail.trim();
  const canSubmit =
    trimmedEmail.length > 3 &&
    trimmedEmail.includes("@") &&
    Boolean(template) &&
    (!needsSentCheck || checkedSent) &&
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
              <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-amber-950">
                <input
                  type="checkbox"
                  data-testid="checkbox-gmail-sent-confirmation"
                  checked={checkedSent}
                  onChange={(event) => setCheckedSent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-amber-700"
                />
                <span>I checked Gmail Sent and understand a duplicate may occur.</span>
              </label>
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
            onClick={() => onResend(entry, trimmedEmail, template, checkedSent)}
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

export default function VenueOutreachHistoryPanel({ onClose, initialSearch = "" }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [selectedEntry, setSelectedEntry] = useState<VenueOutreachHistoryEntry | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const historyQuery = useGetVenueOutreachHistory({
    query: { queryKey: getGetVenueOutreachHistoryQueryKey() },
  });
  const entries = historyQuery.data?.emails ?? [];

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...entries]
      .filter((entry) => statusFilter === "all" || entry.deliveryStatus === statusFilter)
      .filter((entry) => kindFilter === "all" || entry.kind === kindFilter)
      .filter((entry) => {
        if (!query) return true;
        return [entry.businessName, entry.recipientEmail, entry.template, entry.applicationStatus ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [entries, kindFilter, search, statusFilter]);

  const counts = useMemo(() => ({
    total: entries.length,
    sent: entries.filter((entry) => entry.deliveryStatus === "sent").length,
    attention: entries.filter((entry) => entry.deliveryStatus === "delivery_uncertain" || entry.deliveryStatus === "failed").length,
  }), [entries]);

  const handleResend = async (
    entry: VenueOutreachHistoryEntry,
    recipientEmail: string,
    template: TemplateValue,
    checkedSent: boolean,
  ) => {
    if (entry.deliveryStatus === "delivery_uncertain" && !checkedSent) return;
    if (entry.kind !== "new_venue_outreach" && entry.venueOwnerProfileId == null) {
      toast({
        variant: "destructive",
        title: "Cannot resend this record",
        description: "This history entry does not include the venue owner profile needed to send it again.",
      });
      return;
    }
    if (
      entry.linkStatus === "used" &&
      (entry.kind === "new_venue_outreach" || entry.kind === "registration_invite")
    ) {
      toast({
        variant: "destructive",
        title: "Link already used",
        description: "This invitation link has already been used and cannot be sent again.",
      });
      return;
    }

    setResendingId(entry.id);
    try {
      if (entry.kind === "new_venue_outreach") {
        const result = await sendNewVenueOutreach({
          businessName: entry.businessName,
          recipientEmail,
          template: template as VenueOutreachInputTemplate,
        });
        if (!result.emailSent) throw new Error("The email service did not confirm delivery.");
      } else if (entry.kind === "contact_request") {
        const result = await sendVenueContactRequest(entry.venueOwnerProfileId as number, { recipientEmail });
        if (!result.emailSent) throw new Error("The email service did not confirm delivery.");
      } else {
        const result = await createVenueRegistrationLink(entry.venueOwnerProfileId as number, {
          sendEmail: true,
          recipientEmail,
          template: isRegistrationTemplate(template) ? template : "registration",
        });
        if (!result.emailSent) throw new Error("The registration email could not be confirmed. Check Gmail Sent before trying again.");
      }

      await queryClient.invalidateQueries({ queryKey: getGetVenueOutreachHistoryQueryKey() });
      setSelectedEntry(null);
      toast({
        title: "Email sent",
        description: `A new ${prettify(template)} email was sent to ${recipientEmail}.`,
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

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setKindFilter("all");
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
            <h2 className="font-serif text-3xl tracking-[-0.04em] text-[#1f2938] sm:text-[38px]">Every invitation, accounted for.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review owner outreach, check delivery signals, and resend carefully when a venue needs another touch.
            </p>
          </div>
          <div className="flex gap-2 self-start lg:self-end">
            <div className="rounded-md border border-slate-300 bg-[#f7f5f1] px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">All sends</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#25324a]" data-testid="text-total-outreach-count">{counts.total}</p>
            </div>
            <div className="rounded-md border border-slate-300 bg-[#f7f5f1] px-4 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Need attention</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-[#9b6b37]" data-testid="text-attention-outreach-count">{counts.attention}</p>
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-slate-300 bg-[#f7f5f1] shadow-[0_12px_35px_rgba(37,50,74,0.07)]" data-testid="section-outreach-history">
          <div className="flex flex-col gap-4 border-b border-slate-300/80 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1 lg:max-w-[460px]">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                data-testid="input-search-outreach-history"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search venue, recipient, or template"
                className="h-10 border-slate-300 bg-white pl-10 text-sm"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <select
                  data-testid="select-outreach-kind-filter"
                  value={kindFilter}
                  onChange={(event) => setKindFilter(event.target.value as KindFilter)}
                  className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 pr-9 text-sm text-slate-700 outline-none focus:border-slate-600 sm:w-[190px]"
                  aria-label="Filter by send type"
                >
                  <option value="all">All send types</option>
                  <option value="new_venue_outreach">New venue outreach</option>
                  <option value="contact_request">Contact requests</option>
                  <option value="registration_invite">Registration invites</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-500" />
              </div>
              <div className="relative">
                <select
                  data-testid="select-outreach-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 pr-9 text-sm text-slate-700 outline-none focus:border-slate-600 sm:w-[160px]"
                  aria-label="Filter by delivery status"
                >
                  <option value="all">All delivery states</option>
                  <option value="sent">Sent</option>
                  <option value="sending">Sending</option>
                  <option value="delivery_uncertain">Check Sent</option>
                  <option value="failed">Failed</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-500" />
              </div>
              {(search || statusFilter !== "all" || kindFilter !== "all") && (
                <Button type="button" variant="ghost" data-testid="button-clear-outreach-filters" onClick={clearFilters} className="h-10 text-slate-600">
                  Clear
                </Button>
              )}
            </div>
          </div>

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
          ) : filteredEntries.length === 0 ? (
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
                <div className="grid grid-cols-[1.25fr_1.45fr_1.2fr_1fr_1fr_106px] gap-4 border-b border-slate-200 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <span>Venue</span>
                  <span>Recipient</span>
                  <span>Template / type</span>
                  <span>Delivery</span>
                  <span>Application</span>
                  <span className="text-right">Action</span>
                </div>
                {filteredEntries.map((entry) => {
                  const cannotResend =
                    entry.linkStatus === "used" &&
                    (entry.kind === "new_venue_outreach" || entry.kind === "registration_invite");
                  const profileMissing = entry.kind !== "new_venue_outreach" && entry.venueOwnerProfileId == null;
                  return (
                    <div
                      key={entry.id}
                      data-testid={`row-outreach-${entry.id}`}
                      className="grid grid-cols-[1.25fr_1.45fr_1.2fr_1fr_1fr_106px] gap-4 border-b border-slate-200/80 px-5 py-4 last:border-b-0 hover:bg-white/45"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900" data-testid={`text-outreach-business-${entry.id}`}>{entry.businessName}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{prettify(entry.kind)} · {formatDate(entry.createdAt)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-700" data-testid={`text-outreach-recipient-${entry.id}`}>{entry.recipientEmail}</p>
                        <p className="mt-1 truncate text-[11px] text-slate-500">
                          {entry.sentAt ? `Sent ${formatDate(entry.sentAt)}` : "Send time not confirmed"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-700" data-testid={`text-outreach-template-${entry.id}`}>{prettify(entry.template)}</p>
                        {entry.linkStatus !== "none" && (
                          <p className={`mt-1 text-[11px] font-medium ${linkClasses(entry.linkStatus)}`} data-testid={`status-outreach-link-${entry.id}`}>
                            {linkLabel(entry.linkStatus)}{entry.expiresAt ? ` · expires ${formatDate(entry.expiresAt)}` : ""}
                          </p>
                        )}
                      </div>
                      <div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${deliveryClasses(entry.deliveryStatus)}`} data-testid={`status-outreach-delivery-${entry.id}`}>
                          {entry.deliveryStatus === "sent" ? <CheckCircle2 className="h-3 w-3" /> : entry.deliveryStatus === "delivery_uncertain" ? <Clock3 className="h-3 w-3" /> : null}
                          {deliveryLabel(entry.deliveryStatus)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        {entry.applicationStatus ? (
                          <p className="truncate text-sm text-slate-700" data-testid={`status-outreach-application-${entry.id}`}>{prettify(entry.applicationStatus)}</p>
                        ) : (
                          <p className="text-sm text-slate-400" data-testid={`status-outreach-application-${entry.id}`}>Not linked</p>
                        )}
                        {entry.applicationId != null && <p className="mt-1 text-[11px] text-slate-500">Application #{entry.applicationId}</p>}
                      </div>
                      <div className="flex justify-end">
                        {cannotResend ? (
                          <span className="pt-2 text-right text-[11px] leading-4 text-slate-500" data-testid={`text-outreach-used-${entry.id}`}>Already used</span>
                        ) : profileMissing ? (
                          <span className="pt-2 text-right text-[11px] leading-4 text-slate-500" data-testid={`text-outreach-unavailable-${entry.id}`}>Unavailable</span>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            data-testid={`button-resend-outreach-${entry.id}`}
                            onClick={() => setSelectedEntry(entry)}
                            disabled={entry.deliveryStatus === "sending" || resendingId === entry.id}
                            className="h-9 gap-1.5 border-slate-300 bg-[#fbfaf8] px-3 text-xs text-[#25324a] hover:bg-white"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Resend
                          </Button>
                        )}
                      </div>
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
        entry={selectedEntry}
        open={Boolean(selectedEntry)}
        busy={Boolean(selectedEntry && resendingId === selectedEntry.id)}
        onOpenChange={(open) => {
          if (!open && !resendingId) setSelectedEntry(null);
        }}
        onResend={handleResend}
      />
    </div>
  );
}