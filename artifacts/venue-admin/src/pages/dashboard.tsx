import { useState, useMemo, useEffect } from "react";
import { 
  useGetVenueAdminSession,
  getGetVenueAdminSessionQueryKey,
  useDeleteVenueAdminSession,
  useChangeVenueAdminPassword,
  useListVenueApplications,
  getListVenueApplicationsQueryKey,
  useGetVenueApplicationForReview,
  getGetVenueApplicationForReviewQueryKey,
  useStartVenueApplicationReview,
  useApproveVenueApplication,
  useRejectVenueApplication,
  useRequestVenueApplicationChanges,
  useWithdrawVenueApplicationAsAdmin,
  useAddVenueApplicationNote,
  VenueApplication,
  VenueApplicationQueueCounts,
  VenueApplicationReviewHistoryEntry
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { 
  Check, 
  X, 
  LogOut, 
  MapPin, 
  FileText, 
  Building2, 
  AlertCircle, 
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  Search,
  MessageSquare,
  Shield,
  History,
  Info,
  Edit3,
  CornerDownLeft,
  XCircle,
  RefreshCw,
  KeyRound,
  Mail,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

function isApiError(error: unknown): error is Error & { status: number, data: unknown } {
  return error instanceof Error && 'status' in error;
}

type ListStatus = "queue" | "all" | "draft" | "submitted" | "under_review" | "changes_requested" | "rejected" | "resubmitted" | "approved" | "withdrawn" | "expired";

function StatusBadge({ status, label }: { status: string, label: string }) {
  const statusConfig: Record<string, { bg: string, text: string, border: string }> = {
    submitted: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
    resubmitted: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
    under_review: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
    changes_requested: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
    approved: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
    rejected: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
    withdrawn: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", border: "border-slate-200 dark:border-slate-700" },
    expired: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", border: "border-slate-200 dark:border-slate-700" },
    draft: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", border: "border-slate-200 dark:border-slate-700" },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <Badge variant="outline" className={`${config.bg} ${config.text} ${config.border} shrink-0 text-[10px] uppercase tracking-wider font-semibold py-0.5 px-2`}>
      {label}
    </Badge>
  );
}

function getGoogleMapsUrl(application: VenueApplication): string {
  const hasCoordinates = application.lat != null && application.lng != null;
  const hasPlaceId = application.placeId.trim().length > 0;
  const query = hasPlaceId
    ? application.placeName || application.businessName
    : hasCoordinates
      ? `${application.lat},${application.lng}`
      : application.placeName || application.businessName;
  const params = new URLSearchParams({
    api: "1",
    query,
  });

  if (hasPlaceId) {
    params.set("query_place_id", application.placeId);
  }

  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<ListStatus>("queue");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  
  // Dialog states
  const [decisionDialog, setDecisionDialog] = useState<"approve" | "reject" | "changes" | "withdraw" | "note" | null>(null);
  const [applicantMessage, setApplicantMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [regLinkResult, setRegLinkResult] = useState<{ token: string; expiresAt: string; appId: number } | null>(null);
  const [regLinkLoading, setRegLinkLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleApiError = (error: unknown, fallbackMessage: string) => {
    if (isApiError(error)) {
      if (error.status === 401) {
        queryClient.setQueryData(getGetVenueAdminSessionQueryKey(), { authenticated: false, expiresAt: "" });
        queryClient.invalidateQueries({ queryKey: getGetVenueAdminSessionQueryKey() });
        toast({ variant: "destructive", title: "Session Expired", description: "Your session has expired. Please log in again." });
        setLocation("/");
        return;
      }
      if (error.status === 409) {
        const body = error.data as { message: string, currentStatus?: string } | null;
        toast({ 
          variant: "destructive", 
          title: "Conflict", 
          description: body?.message || "The application status has changed."
        });
        queryClient.invalidateQueries({ queryKey: getListVenueApplicationsQueryKey(listParams) });
        if (selectedAppId) {
          queryClient.invalidateQueries({ queryKey: getGetVenueApplicationForReviewQueryKey(selectedAppId) });
        }
        setDecisionDialog(null);
        return;
      }
      toast({ variant: "destructive", title: "Error", description: error.message || fallbackMessage });
    } else {
      toast({ variant: "destructive", title: "Error", description: fallbackMessage });
    }
  };

  // Queries
  const listParams = useMemo(() => {
    const params: { status?: string; from?: string; to?: string; search?: string } = { status: filterStatus };
    if (fromDate) params.from = new Date(`${fromDate}T00:00:00`).toISOString();
    if (toDate) {
      const end = new Date(`${toDate}T00:00:00`);
      end.setDate(end.getDate() + 1);
      params.to = end.toISOString();
    }
    if (search.trim()) params.search = search.trim();
    return params;
  }, [filterStatus, fromDate, toDate, search]);
  
  const { data: listData, isLoading: isLoadingApps, isError: isAppsError, error: appsError, refetch: refetchApplications, isFetching: isFetchingApps } = useListVenueApplications(
    listParams,
    {
      query: {
        queryKey: getListVenueApplicationsQueryKey(listParams),
        refetchInterval: 20_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      }
    }
  );

  const applications = listData?.applications ?? [];
  const counts = listData?.counts ?? {};
  const hasActiveFilters = filterStatus !== "queue" || Boolean(fromDate || toDate || search.trim());
  const resetFilters = () => {
    setFilterStatus("queue");
    setFromDate("");
    setToDate("");
    setSearch("");
    setSelectedAppId(null);
  };

  const { data: detailData, isLoading: isLoadingDetail } = useGetVenueApplicationForReview(
    selectedAppId as number,
    {
      query: {
        enabled: !!selectedAppId,
        queryKey: getGetVenueApplicationForReviewQueryKey(selectedAppId as number)
      }
    }
  );

  const selectedApp = detailData?.application;
  const history = detailData?.history ?? [];

  const isActionable = selectedApp?.applicationStatus === "submitted" || 
                       selectedApp?.applicationStatus === "under_review" || 
                       selectedApp?.applicationStatus === "resubmitted" ||
                       selectedApp?.applicationStatus === "changes_requested";
  // Statuses from which the API permits an administrative withdrawal.
  const canWithdraw = isActionable;

  // Mutations
  const logout = useDeleteVenueAdminSession({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetVenueAdminSessionQueryKey(), { authenticated: false, expiresAt: "" });
        queryClient.invalidateQueries({ queryKey: getGetVenueAdminSessionQueryKey() });
        setLocation("/");
      }
    }
  });
  const changePassword = useChangeVenueAdminPassword({
    mutation: {
      onSuccess: () => {
        setCurrentPassword("");
        setNewPassword("");
        setPasswordDialogOpen(false);
        queryClient.invalidateQueries({ queryKey: getGetVenueAdminSessionQueryKey() });
        toast({ title: "Password changed", description: "Other active sessions have been signed out." });
      },
      onError: (error) => handleApiError(error, "Unable to change password."),
    },
  });

  const invalidateAndClose = () => {
    queryClient.invalidateQueries({ queryKey: getListVenueApplicationsQueryKey(listParams) });
    if (selectedAppId) {
      queryClient.invalidateQueries({ queryKey: getGetVenueApplicationForReviewQueryKey(selectedAppId) });
    }
    setDecisionDialog(null);
    setApplicantMessage("");
    setInternalNote("");
  };

  const startReview = useStartVenueApplicationReview({
    mutation: {
      onSuccess: () => invalidateAndClose(),
      onError: (e) => handleApiError(e, "Failed to start review.")
    }
  });

  const approveApp = useApproveVenueApplication({
    mutation: {
      onSuccess: () => {
        toast({ title: "Approved", description: "Venue application approved successfully." });
        invalidateAndClose();
      },
      onError: (e) => handleApiError(e, "Failed to approve application.")
    }
  });

  const rejectApp = useRejectVenueApplication({
    mutation: {
      onSuccess: () => {
        toast({ title: "Rejected", description: "Venue application rejected." });
        invalidateAndClose();
      },
      onError: (e) => handleApiError(e, "Failed to reject application.")
    }
  });

  const requestChanges = useRequestVenueApplicationChanges({
    mutation: {
      onSuccess: () => {
        toast({ title: "Changes Requested", description: "Applicant notified to make changes." });
        invalidateAndClose();
      },
      onError: (e) => handleApiError(e, "Failed to request changes.")
    }
  });

  const withdrawApp = useWithdrawVenueApplicationAsAdmin({
    mutation: {
      onSuccess: () => {
        toast({ title: "Withdrawn", description: "Application administratively withdrawn." });
        invalidateAndClose();
      },
      onError: (e) => handleApiError(e, "Failed to withdraw application.")
    }
  });

  const addNote = useAddVenueApplicationNote({
    mutation: {
      onSuccess: () => {
        toast({ title: "Note Added", description: "Internal note saved." });
        invalidateAndClose();
      },
      onError: (e) => handleApiError(e, "Failed to add note.")
    }
  });

  const handleLogout = () => logout.mutate();

  const handleStartReview = () => {
    if (!selectedApp) return;
    startReview.mutate({ id: selectedApp.id, data: {} });
  };

  const submitDecision = () => {
    if (!selectedApp) return;

    const payloadBase = {
      internalNote: internalNote.trim() || undefined,
      expectedStatus: selectedApp.applicationStatus
    };

    switch (decisionDialog) {
      case "approve":
        approveApp.mutate({ id: selectedApp.id, data: payloadBase });
        break;
      case "reject":
        rejectApp.mutate({ 
          id: selectedApp.id, 
          data: { ...payloadBase, reason: applicantMessage.trim() } 
        });
        break;
      case "changes":
        requestChanges.mutate({ 
          id: selectedApp.id, 
          data: { ...payloadBase, message: applicantMessage.trim() } 
        });
        break;
      case "withdraw":
        withdrawApp.mutate({ 
          id: selectedApp.id, 
          data: { ...payloadBase, reason: applicantMessage.trim() } 
        });
        break;
      case "note":
        addNote.mutate({ 
          id: selectedApp.id, 
          data: { internalNote: internalNote.trim() } 
        });
        break;
    }
  };

  const openDecision = (type: "approve" | "reject" | "changes" | "withdraw" | "note") => {
    setDecisionDialog(type);
    setApplicantMessage("");
    setInternalNote("");
  };

  async function deleteVenue(appId: number, businessName: string) {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/venue-owner/venues/${appId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast({ title: "Error", description: err.message ?? "Failed to delete venue.", variant: "destructive" });
        return;
      }
      toast({ title: "Venue deleted", description: `${businessName} has been permanently deleted.` });
      setDeleteDialogOpen(false);
      setDeleteConfirmName("");
      setSelectedAppId(null);
      queryClient.invalidateQueries({ queryKey: getListVenueApplicationsQueryKey(listParams) });
    } catch {
      toast({ title: "Error", description: "Failed to delete venue.", variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  async function generateRegistrationLink(appId: number) {
    setRegLinkLoading(true);
    try {
      const res = await fetch(`/api/admin/venue-owner/applications/${appId}/registration-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        toast({ title: "Error", description: err.message ?? "Failed to generate link.", variant: "destructive" });
        return;
      }
      const data = await res.json() as { token: string; expiresAt: string };
      setRegLinkResult({ ...data, appId });
    } catch {
      toast({ title: "Error", description: "Failed to generate registration link.", variant: "destructive" });
    } finally {
      setRegLinkLoading(false);
    }
  }

  const isMessageRequired = decisionDialog === "reject" || decisionDialog === "changes" || decisionDialog === "withdraw";
  const isInternalNoteRequired = decisionDialog === "note";
  
  const canSubmitDecision = () => {
    if (isMessageRequired && applicantMessage.trim().length < 3) return false;
    if (isInternalNoteRequired && internalNote.trim().length < 1) return false;
    return true;
  };

  const isPending = approveApp.isPending || rejectApp.isPending || requestChanges.isPending || withdrawApp.isPending || addNote.isPending || startReview.isPending;

  if (isAppsError) {
    // Handle global 401 specifically from the list query just in case AuthGuard missed it
    if (isApiError(appsError) && appsError.status === 401) {
      queryClient.setQueryData(getGetVenueAdminSessionQueryKey(), { authenticated: false, expiresAt: "" });
      queryClient.invalidateQueries({ queryKey: getGetVenueAdminSessionQueryKey() });
      setLocation("/");
      return null;
    }
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center bg-background min-h-[100dvh]">
        <div className="max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-foreground">Workspace Error</h2>
          <p className="text-muted-foreground mb-6">{(isApiError(appsError) ? appsError.message : "") || "Failed to load applications."}</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: getListVenueApplicationsQueryKey(listParams) })}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden font-sans">
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>
              Use at least 12 characters with upper-case, lower-case, and a number. Changing it signs out other active sessions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={changePassword.isPending || !currentPassword || !newPassword}
              onClick={() => changePassword.mutate({ data: { currentPassword, newPassword } })}
            >
              {changePassword.isPending ? "Saving…" : "Change password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Sidebar List */}
      <div className="w-full md:w-[400px] flex-shrink-0 border-r border-border bg-muted/20 flex flex-col h-full z-10 relative">
        <div className="h-16 px-4 flex items-center justify-between border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-2 font-bold tracking-tight text-lg">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            Venue T&S
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => setPasswordDialogOpen(true)} title="Change password">
              <KeyRound className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={handleLogout} title="Sign Out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-3 border-b border-border bg-card/50 space-y-3 shrink-0">
          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={(val: ListStatus) => { setFilterStatus(val); setSelectedAppId(null); }}>
              <SelectTrigger className="w-full bg-background font-medium h-9">
                <SelectValue placeholder="Filter Queue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="queue">Actionable Queue ({(counts.submitted ?? 0) + (counts.under_review ?? 0) + (counts.resubmitted ?? 0)})</SelectItem>
                <SelectItem value="all">All Applications ({Object.values(counts).reduce((a,b)=>a+b, 0)})</SelectItem>
                <SelectItem value="submitted">Submitted ({counts.submitted || 0})</SelectItem>
                <SelectItem value="under_review">Under Review ({counts.under_review || 0})</SelectItem>
                <SelectItem value="resubmitted">Resubmitted ({counts.resubmitted || 0})</SelectItem>
                <SelectItem value="changes_requested">Changes Requested ({counts.changes_requested || 0})</SelectItem>
                <SelectItem value="approved">Approved ({counts.approved || 0})</SelectItem>
                <SelectItem value="rejected">Rejected ({counts.rejected || 0})</SelectItem>
                <SelectItem value="withdrawn">Withdrawn ({counts.withdrawn || 0})</SelectItem>
                <SelectItem value="expired">Expired ({counts.expired || 0})</SelectItem>
                <SelectItem value="draft">Draft ({counts.draft || 0})</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => void refetchApplications()}
              disabled={isFetchingApps}
              title="Refresh applications"
            >
              <RefreshCw className={`w-4 h-4 ${isFetchingApps ? "animate-spin" : ""}`} />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className={`h-9 w-9 shrink-0 ${fromDate || toDate ? "border-primary text-primary bg-primary/5" : ""}`}>
                  <Filter className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Filter by Date Range</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">From</Label>
                      <Input 
                        type="date" 
                        value={fromDate} 
                        onChange={(e) => setFromDate(e.target.value)} 
                        className="text-sm h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">To</Label>
                      <Input 
                        type="date" 
                        value={toDate} 
                        onChange={(e) => setToDate(e.target.value)} 
                        className="text-sm h-9"
                      />
                    </div>
                  </div>
                  {(fromDate || toDate) && (
                    <Button 
                      variant="ghost" 
                      className="w-full h-8 text-xs text-muted-foreground" 
                      onClick={() => { setFromDate(""); setToDate(""); }}
                    >
                      Clear Dates
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setSelectedAppId(null); }}
              placeholder="Search venue, place ID, owner, or application ID"
              className="h-9 pl-8 text-sm"
              aria-label="Search applications"
            />
          </div>
          {hasActiveFilters && (
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Showing filtered results.</span>
              <Button variant="link" className="h-auto p-0 text-xs" onClick={resetFilters}>
                Show full review queue
              </Button>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {isLoadingApps ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 rounded-lg border border-border bg-card flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3 mt-2" />
                </div>
              ))
            ) : applications.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-12 h-12 rounded-full bg-muted/50 border border-border flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                  <Check className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold">{hasActiveFilters ? "No matching applications" : "Review queue is clear"}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasActiveFilters
                    ? "Try removing filters or search terms to view the full queue."
                    : "New and resubmitted applications appear here automatically."}
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  {hasActiveFilters && (
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      Show full review queue
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => void refetchApplications()} disabled={isFetchingApps}>
                    <RefreshCw className={`mr-1.5 w-3.5 h-3.5 ${isFetchingApps ? "animate-spin" : ""}`} /> Refresh
                  </Button>
                </div>
              </div>
            ) : (
              applications.map(app => (
                <button
                  key={app.id}
                  onClick={() => setSelectedAppId(app.id)}
                  className={`w-full text-left transition-all duration-200 border rounded-lg p-3 group
                    ${selectedAppId === app.id 
                      ? "bg-primary/[0.03] border-primary/40 shadow-sm ring-1 ring-primary/10" 
                      : "bg-card border-border hover:border-primary/30 hover:bg-muted/30"
                    }`}
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <h4 className={`font-semibold text-sm truncate flex-1 ${selectedAppId === app.id ? "text-primary" : "text-foreground"}`}>
                      {app.businessName}
                    </h4>
                    <StatusBadge status={app.applicationStatus} label={app.statusLabel || app.applicationStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground truncate mb-2">{app.placeName}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center text-[10px] text-muted-foreground gap-1.5 font-medium">
                      <Clock className="w-3 h-3" />
                      {format(new Date(app.submittedAt ?? app.createdAt), "MMM d, h:mm a")}
                    </div>
                    {app.applicationStatus === "under_review" && (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold tracking-wider uppercase">In Progress</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Workspace Detail */}
      <div className="flex-1 flex flex-col h-full bg-card overflow-hidden">
        {!selectedAppId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/10">
            <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 shadow-sm">
              <Building2 className="w-8 h-8 text-muted-foreground opacity-60" />
            </div>
            <h2 className="text-xl font-bold mb-2">Select an application</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose a venue application from the queue to review documents and make a decision.
            </p>
          </div>
        ) : isLoadingDetail ? (
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-5 w-1/4" />
            </div>
            <div className="grid grid-cols-2 gap-8">
              <Skeleton className="h-64 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          </div>
        ) : selectedApp ? (
          <>
            <div className="h-16 px-6 md:px-10 flex items-center justify-between border-b border-border bg-card shrink-0">
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedApp.applicationStatus} label={selectedApp.statusLabel || selectedApp.applicationStatus} />
                <span className="text-sm text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">ID: {selectedApp.id}</span>
              </div>
              
              {isActionable && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openDecision("note")}>
                    <Edit3 className="w-4 h-4 mr-2" /> Note
                  </Button>
                  
                  {canWithdraw && (
                    <Button variant="outline" size="sm" className="text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => openDecision("withdraw")}>
                      <XCircle className="w-4 h-4 mr-2" /> Withdraw
                    </Button>
                  )}
                  {(selectedApp.applicationStatus === "submitted" || selectedApp.applicationStatus === "resubmitted") && (
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleStartReview} disabled={isPending}>
                      <History className="w-4 h-4 mr-2" /> Start Review
                    </Button>
                  )}
                  {selectedApp.applicationStatus === "under_review" && (
                    <>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openDecision("reject")}>
                        <X className="w-4 h-4 mr-2" /> Reject
                      </Button>
                      <Button variant="outline" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30" onClick={() => openDecision("changes")}>
                        <CornerDownLeft className="w-4 h-4 mr-2" /> Request Changes
                      </Button>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => openDecision("approve")}>
                        <Check className="w-4 h-4 mr-2" /> Approve
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <ScrollArea className="flex-1 bg-muted/10">
              <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-8">
                {/* Header */}
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3 text-foreground">{selectedApp.businessName}</h1>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-medium">
                      <MapPin className="w-4 h-4" />
                      {selectedApp.placeName}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono bg-muted/50 px-2 py-1 rounded">
                      PID: {selectedApp.placeId}
                    </div>
                     <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
                       <a
                         href={getGoogleMapsUrl(selectedApp)}
                         target="_blank"
                         rel="noopener noreferrer"
                         aria-label={`Check ${selectedApp.placeName} on Google Maps`}
                       >
                         <MapPin className="w-3.5 h-3.5" />
                         Check on Google Maps
                         <ExternalLink className="w-3.5 h-3.5" />
                       </a>
                     </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Details */}
                  <div className="lg:col-span-2 space-y-6">
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3 border-b border-border/50">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <Info className="w-4 h-4" />
                          Business Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <dl className="divide-y divide-border/50 text-sm">
                          <div className="grid grid-cols-3 gap-4 p-5 hover:bg-muted/20 transition-colors">
                            <dt className="font-medium text-muted-foreground">Tagline</dt>
                            <dd className="col-span-2 font-medium">{selectedApp.tagline || "—"}</dd>
                          </div>
                          <div className="grid grid-cols-3 gap-4 p-5 hover:bg-muted/20 transition-colors">
                            <dt className="font-medium text-muted-foreground">Description</dt>
                            <dd className="col-span-2 whitespace-pre-wrap leading-relaxed">{selectedApp.description || "—"}</dd>
                          </div>
                          <div className="grid grid-cols-3 gap-4 p-5 hover:bg-muted/20 transition-colors">
                            <dt className="font-medium text-muted-foreground">Coordinates</dt>
                            <dd className="col-span-2 font-mono text-xs">
                              {selectedApp.lat}, {selectedApp.lng}
                            </dd>
                          </div>
                          <div className="grid grid-cols-3 gap-4 p-5 hover:bg-muted/20 transition-colors">
                            <dt className="font-medium text-muted-foreground">Registration Notes</dt>
                            <dd className="col-span-2 whitespace-pre-wrap p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-md text-amber-900 dark:text-amber-200">
                              {selectedApp.registrationNotes || "No additional notes provided."}
                            </dd>
                          </div>
                        </dl>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm border-primary/20">
                      <CardHeader className="pb-3 border-b border-border/50 bg-primary/[0.02]">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Proof of Ownership
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5">
                        {selectedApp.verificationDocUrl ? (
                          <a 
                            href={selectedApp.verificationDocUrl}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-sm transition-all group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground group-hover:text-primary transition-colors">Verification Document</p>
                                <p className="text-xs text-muted-foreground">Opens in a new tab</p>
                              </div>
                            </div>
                            <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </a>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 rounded-lg border-dashed border-destructive/20 bg-destructive/5">
                            <AlertCircle className="w-8 h-8 text-destructive mb-3 opacity-80" />
                            <p className="text-sm font-semibold text-destructive">Missing Documentation</p>
                            <p className="text-xs text-destructive/80 mt-1 max-w-[250px]">
                              Applicant did not provide a verification document. You may need to request changes or reject.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column: Audit & Meta */}
                  <div className="space-y-6">
                    <Card className="shadow-sm">
                      <CardHeader className="pb-3 border-b border-border/50">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                          Applicant
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 text-sm space-y-4">
                        {(selectedApp as Record<string, unknown>).applicationSource === "web" && (
                          <div>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
                              Web application
                            </Badge>
                          </div>
                        )}
                        {(selectedApp as Record<string, unknown>).contactName && (
                          <div>
                            <span className="block text-xs font-medium text-muted-foreground mb-1">Contact Name</span>
                            <span className="font-medium">{String((selectedApp as Record<string, unknown>).contactName)}</span>
                          </div>
                        )}
                        {(selectedApp as Record<string, unknown>).contactEmail && (
                          <div>
                            <span className="block text-xs font-medium text-muted-foreground mb-1">Contact Email</span>
                            <a
                              href={`mailto:${String((selectedApp as Record<string, unknown>).contactEmail)}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {String((selectedApp as Record<string, unknown>).contactEmail)}
                            </a>
                          </div>
                        )}
                        <div>
                          <span className="block text-xs font-medium text-muted-foreground mb-1">Owner UID</span>
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded break-all select-all">
                            {selectedApp.ownerUid}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-medium text-muted-foreground mb-1">Submitted At</span>
                          <span className="font-medium">
                             {format(new Date(selectedApp.submittedAt ?? selectedApp.createdAt), "MMM d, yyyy, h:mm a")}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    {selectedApp.applicationStatus === "approved" && (
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3 border-b border-border/50">
                          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <KeyRound className="w-4 h-4" />
                            Portal Access
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 text-sm space-y-3">
                          <p className="text-muted-foreground text-xs leading-relaxed">
                            Generate a one-time registration link. The venue owner uses it to create their
                            Venue Manager account. Each link expires after 7 days.
                          </p>
                          {regLinkResult?.appId === selectedApp.id ? (
                            <div className="space-y-2">
                              <div className="font-mono text-[11px] break-all bg-muted p-2 rounded select-all leading-relaxed">
                                {`${window.location.origin}/venue-manager/register?token=${regLinkResult.token}`}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Expires {format(new Date(regLinkResult.expiresAt), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                  void navigator.clipboard.writeText(
                                    `${window.location.origin}/venue-manager/register?token=${regLinkResult.token}`,
                                  );
                                  toast({ title: "Copied", description: "Registration link copied to clipboard." });
                                }}
                              >
                                Copy link
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full text-muted-foreground"
                                disabled={regLinkLoading}
                                onClick={() => void generateRegistrationLink(selectedApp.id)}
                              >
                                {regLinkLoading ? "Generating…" : "Generate a new link"}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              disabled={regLinkLoading}
                              onClick={() => void generateRegistrationLink(selectedApp.id)}
                            >
                              {regLinkLoading ? "Generating…" : "Generate registration link"}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    <Card className="shadow-sm border-destructive/30">
                      <CardHeader className="pb-3 border-b border-destructive/20">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-destructive/70 flex items-center gap-2">
                          <Trash2 className="w-4 h-4" />
                          Danger Zone
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 text-sm space-y-3">
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          Permanently delete this venue and all associated data — events, rewards,
                          announcements, manager accounts, and the full application history.
                          This cannot be undone.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => { setDeleteDialogOpen(true); setDeleteConfirmName(""); }}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          Delete Venue
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm flex-1">
                      <CardHeader className="pb-3 border-b border-border/50">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          <History className="w-4 h-4" />
                          Audit Trail
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="max-h-[400px] overflow-y-auto p-5">
                          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                            {history.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center italic relative z-10">No history available.</p>
                            ) : (
                              history.map((entry: VenueApplicationReviewHistoryEntry) => (
                                <div key={entry.id} className="relative z-10 flex items-start gap-4">
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 border-background shadow-sm
                                    ${entry.eventType === "email_sent" ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400" :
                                      entry.actorRole === "applicant" ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" :
                                      entry.actorRole === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                    {entry.eventType === "email_sent" ? <Mail className="w-4 h-4" /> :
                                     entry.actorRole === "applicant" ? <Building2 className="w-4 h-4" /> :
                                     entry.actorRole === "admin" ? <Shield className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                                  </div>
                                  <div className="flex-1 bg-card border border-border/50 rounded-lg p-3 shadow-sm space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                      <div>
                                        <p className="text-xs font-semibold capitalize text-muted-foreground">
                                          {entry.eventType === "email_sent" ? "system" : entry.actorRole}
                                        </p>
                                        <p className="text-sm font-medium mt-0.5">
                                          {entry.eventType === "email_sent" ? (
                                            <>Email sent to <span className="font-bold text-foreground">{String(entry.metadata?.to ?? "applicant")}</span></>
                                          ) : entry.toStatus ? (
                                            <>Changed status to <span className="font-bold text-foreground">{entry.toStatus}</span></>
                                          ) : (
                                            "Added note"
                                          )}
                                        </p>
                                      </div>
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {format(new Date(entry.createdAt), "MMM d, h:mm a")}
                                      </span>
                                    </div>

                                    {entry.eventType === "email_sent" && entry.metadata?.subject != null && (
                                      <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 rounded p-2 text-sm text-indigo-900 dark:text-indigo-200">
                                        <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 opacity-70">Subject</span>
                                        {String(entry.metadata.subject)}
                                      </div>
                                    )}
                                    
                                    {entry.applicantMessage && (
                                      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded p-2 text-sm text-blue-900 dark:text-blue-200">
                                        <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 opacity-70">Message to Applicant</span>
                                        {entry.applicantMessage}
                                      </div>
                                    )}
                                    
                                    {entry.internalNote && (
                                      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded p-2 text-sm text-amber-900 dark:text-amber-200 flex gap-2 items-start">
                                        <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-60" />
                                        <div>
                                          <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5 opacity-70">Internal Note (Hidden)</span>
                                          {entry.internalNote}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </div>

      {/* Delete Venue Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open && !deleteLoading) { setDeleteDialogOpen(false); setDeleteConfirmName(""); } }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> Delete Venue
            </DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{selectedApp?.businessName}</strong> and all
              associated data — events, rewards, announcements, manager accounts, and the full
              application history. <strong>This cannot be undone.</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Label htmlFor="delete-confirm" className="text-xs font-bold uppercase tracking-wider">
              Type the venue name to confirm
            </Label>
            <Input
              id="delete-confirm"
              placeholder={selectedApp?.businessName ?? ""}
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmName(""); }} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteLoading || deleteConfirmName.trim() !== (selectedApp?.businessName ?? "").trim()}
              onClick={() => selectedApp && void deleteVenue(selectedApp.id, selectedApp.businessName)}
            >
              {deleteLoading ? "Deleting…" : "Delete Venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unified Decision Dialog */}
      <Dialog open={!!decisionDialog} onOpenChange={(open) => !open && setDecisionDialog(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {decisionDialog === "approve" && <><Check className="w-5 h-5 text-emerald-600" /> Approve Application</>}
              {decisionDialog === "reject" && <><X className="w-5 h-5 text-red-600" /> Reject Application</>}
              {decisionDialog === "changes" && <><CornerDownLeft className="w-5 h-5 text-amber-600" /> Request Changes</>}
              {decisionDialog === "withdraw" && <><XCircle className="w-5 h-5 text-slate-600" /> Admin Withdraw</>}
              {decisionDialog === "note" && <><Edit3 className="w-5 h-5 text-blue-600" /> Add Internal Note</>}
            </DialogTitle>
            <DialogDescription>
              {decisionDialog === "approve" && `You are approving ${selectedApp?.businessName}. This grants venue ownership.`}
              {decisionDialog === "reject" && `You are rejecting ${selectedApp?.businessName}. They can resubmit later.`}
              {decisionDialog === "changes" && `Ask ${selectedApp?.businessName} to fix issues and resubmit.`}
              {decisionDialog === "withdraw" && `Administratively withdraw this application. It will not be actionable anymore.`}
              {decisionDialog === "note" && `Record a note on the audit trail for other reviewers.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isMessageRequired && (
              <div className="space-y-2">
                <Label htmlFor="applicant-message" className="text-xs font-bold uppercase tracking-wider flex justify-between">
                  <span>Message to Applicant <span className="text-destructive">*</span></span>
                  <span className="text-muted-foreground normal-case font-normal text-[10px]">They will see this</span>
                </Label>
                <Textarea 
                  id="applicant-message"
                  placeholder="Explain exactly what the applicant needs to know..."
                  value={applicantMessage}
                  onChange={(e) => setApplicantMessage(e.target.value)}
                  className="min-h-[100px] resize-none border-blue-200 focus-visible:ring-blue-500"
                  autoFocus
                />
                {applicantMessage.length > 0 && applicantMessage.length < 3 && (
                  <p className="text-xs text-destructive">Must be at least 3 characters.</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="internal-note" className="text-xs font-bold uppercase tracking-wider flex justify-between text-amber-700 dark:text-amber-500">
                <span>Internal Note {isInternalNoteRequired && <span className="text-destructive">*</span>}</span>
                <span className="opacity-80 normal-case font-normal text-[10px]">Reviewers only</span>
              </Label>
              <Textarea 
                id="internal-note"
                placeholder={isInternalNoteRequired ? "Record your note here..." : "Optional internal context..."}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                className="min-h-[80px] resize-none bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 focus-visible:ring-amber-500"
                autoFocus={decisionDialog === "note"}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecisionDialog(null)} disabled={isPending}>Cancel</Button>
            <Button 
              onClick={submitDecision} 
              disabled={isPending || !canSubmitDecision()}
              className={
                decisionDialog === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
                decisionDialog === "reject" ? "bg-red-600 hover:bg-red-700 text-white" :
                decisionDialog === "changes" ? "bg-amber-600 hover:bg-amber-700 text-white" :
                ""
              }
            >
              {isPending ? "Submitting..." : 
               decisionDialog === "approve" ? "Confirm Approval" :
               decisionDialog === "reject" ? "Confirm Rejection" :
               decisionDialog === "changes" ? "Send Request" :
               decisionDialog === "withdraw" ? "Withdraw Application" :
               "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
