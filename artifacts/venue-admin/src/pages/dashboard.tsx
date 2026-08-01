import { useEffect, useState } from "react";
import { 
  useGetVenueAdminSession,
  getGetVenueAdminSessionQueryKey,
  useDeleteVenueAdminSession,
  useListPendingVenueApplications,
  getListPendingVenueApplicationsQueryKey,
  useApproveVenueApplication,
  useRejectVenueApplication,
  VenueApplication
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
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  // Queries
  const { data: appsData, isLoading: isLoadingApps, isError: isAppsError, error: appsError } = useListPendingVenueApplications({
    query: {
      queryKey: getListPendingVenueApplicationsQueryKey()
    }
  });

  const applications = appsData?.pending ?? [];
  const selectedApp = applications.find(app => app.id === selectedAppId);

  // Auto-select first application if none selected and data loads
  useEffect(() => {
    if (applications.length > 0 && !selectedAppId) {
      setSelectedAppId(applications[0].id);
    }
  }, [applications, selectedAppId]);

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

  const approveApp = useApproveVenueApplication({
    mutation: {
      onSuccess: () => {
        toast({ title: "Application Approved", description: "The venue has been approved." });
        queryClient.invalidateQueries({ queryKey: getListPendingVenueApplicationsQueryKey() });
        setApproveDialogOpen(false);
        if (selectedAppId === selectedApp?.id) setSelectedAppId(null);
      },
      onError: (error: any) => {
        toast({ variant: "destructive", title: "Error", description: error.message || "Failed to approve application." });
      }
    }
  });

  const rejectApp = useRejectVenueApplication({
    mutation: {
      onSuccess: () => {
        toast({ title: "Application Rejected", description: "The venue application was rejected." });
        queryClient.invalidateQueries({ queryKey: getListPendingVenueApplicationsQueryKey() });
        setRejectDialogOpen(false);
        setRejectionReason("");
        if (selectedAppId === selectedApp?.id) setSelectedAppId(null);
      },
      onError: (error: any) => {
        toast({ variant: "destructive", title: "Error", description: error.message || "Failed to reject application." });
      }
    }
  });

  const handleLogout = () => {
    logout.mutate();
  };

  const handleApprove = () => {
    if (!selectedApp) return;
    approveApp.mutate({ id: selectedApp.id });
  };

  const handleReject = () => {
    if (!selectedApp) return;
    if (!rejectionReason.trim() || rejectionReason.length < 3) {
      toast({ variant: "destructive", title: "Invalid Reason", description: "Please provide a valid reason (min 3 characters)." });
      return;
    }
    rejectApp.mutate({ id: selectedApp.id, data: { reason: rejectionReason } });
  };

  const openRejectDialog = () => {
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  if (isAppsError) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center bg-background min-h-[100dvh]">
        <div className="max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 text-foreground">Failed to load applications</h2>
          <p className="text-muted-foreground mb-6">{appsError?.message || "An unexpected error occurred."}</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: getListPendingVenueApplicationsQueryKey() })}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-muted/30 overflow-hidden">
      {/* Sidebar / List View */}
      <div className="w-full md:w-96 flex-shrink-0 border-r border-border bg-background flex flex-col h-full z-10 shadow-sm relative">
        <div className="h-16 px-6 flex items-center justify-between border-b border-border bg-sidebar shrink-0">
          <div className="flex items-center gap-2 text-sidebar-foreground font-semibold tracking-tight">
            <Building2 className="w-5 h-5 text-sidebar-primary" />
            <span>Venue Admin</span>
          </div>
          <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout} title="Sign Out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoadingApps ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4 flex flex-col gap-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3 mt-2" />
              </Card>
            ))
          ) : applications.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground">All caught up</h3>
              <p className="text-xs text-muted-foreground mt-1">No pending applications to review.</p>
            </div>
          ) : (
            applications.map(app => (
              <button
                key={app.id}
                onClick={() => setSelectedAppId(app.id)}
                className={`w-full text-left transition-all duration-200 border rounded-lg p-4 group
                  ${selectedAppId === app.id 
                    ? "bg-primary/[0.04] border-primary/30 shadow-sm ring-1 ring-primary/20" 
                    : "bg-card border-border hover:border-primary/30 hover:bg-accent/50"
                  }`}
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                  <h4 className="font-semibold text-sm truncate text-foreground flex-1">
                    {app.businessName}
                  </h4>
                  <Badge variant="outline" className="shrink-0 bg-background text-[10px] uppercase tracking-wider font-semibold py-0">Pending</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mb-3">{app.placeName}</p>
                <div className="flex items-center text-[11px] text-muted-foreground gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  {format(new Date(app.createdAt), "MMM d, h:mm a")}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail View */}
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
        {selectedApp ? (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-8 border-b border-border">
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">{selectedApp.businessName}</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm">{selectedApp.placeName}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <Button variant="outline" className="h-10 px-5 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" onClick={openRejectDialog}>
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button className="h-10 px-5 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setApproveDialogOpen(true)}>
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-8">
                    <section>
                      <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">About the Venue</h3>
                      <Card className="border-border shadow-sm">
                        <CardContent className="p-5 space-y-5 text-sm">
                          <div>
                            <span className="block text-xs font-medium text-muted-foreground mb-1">Tagline</span>
                            <p className="text-foreground font-medium">{selectedApp.tagline || "—"}</p>
                          </div>
                          <div>
                            <span className="block text-xs font-medium text-muted-foreground mb-1">Description</span>
                            <p className="text-foreground leading-relaxed text-sm whitespace-pre-wrap">{selectedApp.description || "—"}</p>
                          </div>
                          <div>
                            <span className="block text-xs font-medium text-muted-foreground mb-1">Coordinates</span>
                            <p className="font-mono text-xs text-foreground bg-muted inline-flex px-2 py-1 rounded">
                              {selectedApp.lat || "—"}, {selectedApp.lng || "—"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </section>

                    <section>
                      <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">Applicant Info</h3>
                      <Card className="border-border shadow-sm">
                        <CardContent className="p-5 space-y-5 text-sm">
                          <div>
                            <span className="block text-xs font-medium text-muted-foreground mb-1">Owner UID</span>
                            <p className="font-mono text-xs text-foreground bg-muted inline-flex px-2 py-1 rounded break-all">{selectedApp.ownerUid}</p>
                          </div>
                          <div>
                            <span className="block text-xs font-medium text-muted-foreground mb-1">Registration Notes</span>
                            <p className="text-foreground text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md border border-border/50">{selectedApp.registrationNotes || "No notes provided."}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </section>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-8">
                    <section>
                      <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">Verification</h3>
                      <Card className="border-border shadow-sm">
                        <CardContent className="p-5 text-sm">
                          {selectedApp.verificationDocUrl ? (
                            <a 
                              href={selectedApp.verificationDocUrl}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-4 rounded-md border border-border bg-muted/30 hover:bg-muted transition-colors group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-foreground">Verification Document</p>
                                  <p className="text-xs text-muted-foreground">Click to view in new tab</p>
                                </div>
                              </div>
                              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                            </a>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 px-4 text-center border rounded-md border-dashed border-border bg-muted/20">
                              <AlertCircle className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                              <p className="text-sm font-medium text-muted-foreground">No verification document</p>
                              <p className="text-xs text-muted-foreground mt-1">Applicant did not provide supporting files.</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </section>

                    <section>
                      <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">System Metadata</h3>
                      <Card className="border-border shadow-sm">
                        <CardContent className="p-5 space-y-4 text-sm">
                           <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                            <span className="text-muted-foreground">Application ID</span>
                            <span className="font-mono text-xs">{selectedApp.id}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                            <span className="text-muted-foreground">Place ID</span>
                            <span className="font-mono text-xs">{selectedApp.placeId}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                            <span className="text-muted-foreground">Submitted</span>
                            <span className="font-medium">{format(new Date(selectedApp.createdAt), "MMM d, yyyy, h:mm a")}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : applications.length > 0 ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
            Select an application from the sidebar to review details.
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <Check className="w-10 h-10 text-muted-foreground opacity-50" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Inbox Zero</h2>
            <p className="text-muted-foreground max-w-sm">There are no pending venue applications. Check back later.</p>
          </div>
        )}
      </div>

      {/* Approve Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Approve Venue</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve <strong>{selectedApp?.businessName}</strong>? This action will grant them venue owner access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approveApp.isPending}>
              {approveApp.isPending ? "Approving..." : "Confirm Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reject Venue Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting <strong>{selectedApp?.businessName}</strong>. This may be shared with the applicant.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder="e.g. Verification document is illegible. Please re-submit."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px] resize-none"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectApp.isPending || rejectionReason.length < 3}>
              {rejectApp.isPending ? "Rejecting..." : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
