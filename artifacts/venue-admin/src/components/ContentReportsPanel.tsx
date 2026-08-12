import { useState, useEffect, useCallback } from "react";
import {
  Flag, RefreshCw, EyeOff, Eye, CheckCircle2, ArrowLeft,
  AlertTriangle, MessageSquare, Building2, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface ContentReport {
  id: number;
  reporterUid: string;
  entityType: "event" | "announcement" | "venue";
  entityId: number;
  placeId: string;
  reason: string;
  status: "open" | "actioned" | "dismissed";
  contentTitle: string | null;
  contentIsHidden: boolean | null;
  createdAt: string;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { ...opts, credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw Object.assign(new Error(body.message ?? `HTTP ${res.status}`), { status: res.status });
  }
  return res.json();
}

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  event: <Calendar className="w-3.5 h-3.5" />,
  announcement: <MessageSquare className="w-3.5 h-3.5" />,
  venue: <Building2 className="w-3.5 h-3.5" />,
};

const REASON_LABELS: Record<string, string> = {
  inappropriate: "Inappropriate",
  offensive_image: "Offensive image",
  spam: "Spam",
  harassment: "Harassment",
  other: "Other",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-50 text-amber-700 border-amber-200",
  actioned: "bg-green-50 text-green-700 border-green-200",
  dismissed: "bg-muted text-muted-foreground border-border",
};

export default function ContentReportsPanel() {
  const { toast } = useToast();
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"open" | "actioned" | "dismissed" | "all">("open");
  const [entityFilter, setEntityFilter] = useState<"all" | "event" | "announcement" | "venue">("all");

  const selectedReport = reports.find((r) => r.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setSelectedId(null);
    try {
      const params = new URLSearchParams({ status: statusFilter, entityType: entityFilter });
      const data = await apiFetch(`/api/admin/venue-owner/content-reports?${params.toString()}`) as {
        reports: ContentReport[];
      };
      setReports(data.reports);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load content reports." });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, entityFilter, toast]);

  useEffect(() => { void load(); }, [load]);

  async function takeAction(reportId: number, action: "hide_content" | "restore_content" | "dismiss") {
    setActioning(reportId);
    try {
      await apiFetch(`/api/admin/venue-owner/content-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const labels: Record<string, string> = {
        hide_content: "Content hidden from guests",
        restore_content: "Content restored",
        dismiss: "Report dismissed",
      };
      toast({ title: "Done", description: labels[action] });
      void load();
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: (err as Error).message });
    } finally {
      setActioning(null);
    }
  }

  return (
    <div className="flex h-full">
      {/* ── Left: report list ───────────────────────────────────────────── */}
      <div className="w-[340px] flex-shrink-0 border-r border-border flex flex-col h-full">
        {/* Filters */}
        <div className="p-3 border-b border-border space-y-2 bg-muted/20">
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="actioned">Actioned</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v as typeof entityFilter)}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="event">Events</SelectItem>
                <SelectItem value="announcement">Announcements</SelectItem>
                <SelectItem value="venue">Venues</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => void load()} title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pl-0.5">
            {loading ? "Loading…" : `${reports.length} report${reports.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-3 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 opacity-30" />
              <p className="text-sm">No reports</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {reports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 border transition-colors ${
                    selectedId === r.id
                      ? "bg-primary/5 border-primary/20"
                      : "bg-card border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded border ${STATUS_COLORS[r.status]}`}>
                      {r.status}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground capitalize">
                      {ENTITY_ICONS[r.entityType]}
                      {r.entityType}
                    </span>
                    {r.contentIsHidden && (
                      <span title="Content is currently hidden">
                        <EyeOff className="w-3 h-3 text-muted-foreground" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-foreground truncate">
                    {r.contentTitle ?? r.placeId}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {REASON_LABELS[r.reason] ?? r.reason} ·{" "}
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right: detail / action pane ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-auto">
        {!selectedReport ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Flag className="w-10 h-10 opacity-20" />
            <p className="text-sm">Select a report to review it</p>
          </div>
        ) : (
          <div className="p-6 max-w-xl space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border ${STATUS_COLORS[selectedReport.status]}`}>
                  {selectedReport.status}
                </span>
                <span className="text-xs text-muted-foreground capitalize inline-flex items-center gap-1">
                  {ENTITY_ICONS[selectedReport.entityType]}
                  {selectedReport.entityType} report
                </span>
              </div>
              <h2 className="text-lg font-bold text-foreground">
                {selectedReport.contentTitle ?? `Venue: ${selectedReport.placeId}`}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Reported{" "}
                {formatDistanceToNow(new Date(selectedReport.createdAt), { addSuffix: true })}
              </p>
            </div>

            {/* Report details */}
            <div className="rounded-lg border border-border bg-muted/20 divide-y divide-border text-sm">
              <Row label="Reason" value={REASON_LABELS[selectedReport.reason] ?? selectedReport.reason} />
              <Row label="Place ID" value={selectedReport.placeId} mono />
              {selectedReport.entityId > 0 && (
                <Row label="Content ID" value={String(selectedReport.entityId)} mono />
              )}
              <Row label="Reporter UID" value={selectedReport.reporterUid.slice(0, 16) + "…"} mono />
              {selectedReport.contentIsHidden !== null && (
                <Row
                  label="Content visible"
                  value={selectedReport.contentIsHidden ? "Hidden from guests" : "Visible to guests"}
                  highlight={!selectedReport.contentIsHidden}
                />
              )}
            </div>

            {/* Apple §5.1.2 notice */}
            {selectedReport.status === "open" && (
              <div className="flex gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>App Store guideline §5.1.2 requires action within 24 hours of a report.</span>
              </div>
            )}

            {/* Action buttons */}
            {selectedReport.status === "open" && (
              <div className="flex flex-col gap-2">
                {selectedReport.entityType !== "venue" && !selectedReport.contentIsHidden && (
                  <Button
                    className="w-full"
                    variant="destructive"
                    disabled={actioning === selectedReport.id}
                    onClick={() => void takeAction(selectedReport.id, "hide_content")}
                  >
                    <EyeOff className="w-4 h-4 mr-2" />
                    {actioning === selectedReport.id ? "Hiding…" : "Hide content from guests"}
                  </Button>
                )}
                {selectedReport.entityType !== "venue" && selectedReport.contentIsHidden && (
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={actioning === selectedReport.id}
                    onClick={() => void takeAction(selectedReport.id, "restore_content")}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {actioning === selectedReport.id ? "Restoring…" : "Restore content (false report)"}
                  </Button>
                )}
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={actioning === selectedReport.id}
                  onClick={() => void takeAction(selectedReport.id, "dismiss")}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {actioning === selectedReport.id ? "Dismissing…" : "Dismiss — no action needed"}
                </Button>
              </div>
            )}

            {selectedReport.status !== "open" && (
              <p className="text-sm text-muted-foreground italic">
                This report has already been {selectedReport.status}. Use the filters to find open reports.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label, value, mono = false, highlight = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-3 py-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-right ${mono ? "font-mono text-xs" : ""} ${highlight ? "text-foreground" : "text-muted-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
