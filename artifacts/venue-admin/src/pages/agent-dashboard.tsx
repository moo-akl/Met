import { useState, useEffect, useCallback } from "react";
import {
  Building2, LogOut, Plus, RefreshCw, Clock, CheckCircle2,
  AlertCircle, FileText, ArrowLeft, Send, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AgentInfo {
  id: number;
  email: string;
  displayName: string;
}

interface Venue {
  id: number;
  businessName: string;
  placeName: string;
  applicationStatus: string;
  contactEmail: string | null;
  contactName: string | null;
  submittedAt: string | null;
  createdAt: string;
}

interface AgentDashboardProps {
  agent: AgentInfo;
  onLogout: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  submitted: { label: "Submitted", color: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="w-3 h-3" /> },
  under_review: { label: "Under Review", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <FileText className="w-3 h-3" /> },
  approved: { label: "Approved", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: "Not Approved", color: "bg-red-100 text-red-800 border-red-200", icon: <X className="w-3 h-3" /> },
  changes_requested: { label: "Changes Needed", color: "bg-purple-100 text-purple-800 border-purple-200", icon: <AlertCircle className="w-3 h-3" /> },
  resubmitted: { label: "Resubmitted", color: "bg-amber-100 text-amber-800 border-amber-200", icon: <Clock className="w-3 h-3" /> },
};

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...opts, credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw Object.assign(new Error(body.message ?? `HTTP ${res.status}`), { status: res.status });
  }
  return res.json() as Promise<T>;
}

const EMPTY_FORM = {
  businessName: "",
  placeName: "",
  contactName: "",
  contactEmail: "",
  phone: "",
  websiteUrl: "",
  description: "",
  registrationNotes: "",
};

export default function AgentDashboard({ agent, onLogout }: AgentDashboardProps) {
  const { toast } = useToast();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "register">("list");
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [lastRegistered, setLastRegistered] = useState<{ businessName: string } | null>(null);

  const loadVenues = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ venues: Venue[] }>("/api/admin/agent/applications");
      setVenues(data.venues);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load your venues." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadVenues(); }, [loadVenues]);

  async function handleLogout() {
    await fetch("/api/admin/agent/session", { method: "DELETE", credentials: "include" }).catch(() => {});
    onLogout();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch("/api/admin/agent/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setLastRegistered({ businessName: form.businessName });
      setForm(EMPTY_FORM);
      setView("list");
      toast({ title: "Venue registered!", description: `${form.businessName} has been submitted for review.` });
      void loadVenues();
    } catch (err) {
      toast({ variant: "destructive", title: "Registration failed", description: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  const setField = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col font-sans">
      {/* Header */}
      <div className="h-14 border-b border-border bg-card px-4 md:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary text-primary-foreground rounded-md flex items-center justify-center text-xs font-bold">
            {agent.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-semibold">{agent.displayName}</span>
            <span className="hidden md:inline text-xs text-muted-foreground ml-2">· Met Sales Portal</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === "list" ? (
            <Button size="sm" className="gap-1.5" onClick={() => setView("register")}>
              <Plus className="w-3.5 h-3.5" />Register Venue
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setView("list")}>
              <ArrowLeft className="w-3.5 h-3.5" />Back
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => void handleLogout()} title="Sign Out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {view === "list" ? (
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 md:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold">My Registered Venues</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{venues.length} venue{venues.length !== 1 ? "s" : ""} total</p>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => void loadVenues()} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {lastRegistered && (
            <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>{lastRegistered.businessName}</strong> registered successfully and is now pending admin review.</span>
              <button onClick={() => setLastRegistered(null)} className="ml-auto text-emerald-700 hover:text-emerald-900"><X className="w-4 h-4" /></button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-border rounded-xl p-4 flex flex-col gap-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : venues.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-14 h-14 rounded-full bg-muted border border-border flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-6 h-6 text-muted-foreground" />
              </div>
              <h2 className="text-base font-semibold mb-2">No venues yet</h2>
              <p className="text-sm text-muted-foreground mb-6">Register your first venue to get started.</p>
              <Button onClick={() => setView("register")} className="gap-2">
                <Plus className="w-4 h-4" />Register a Venue
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {venues.map(venue => {
                const statusConfig = STATUS_CONFIG[venue.applicationStatus] ?? { label: venue.applicationStatus, color: "bg-slate-100 text-slate-700 border-slate-200", icon: null };
                return (
                  <div key={venue.id} className="border border-border rounded-xl p-4 bg-card hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-sm">{venue.businessName}</h3>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 shrink-0 flex items-center gap-1 ${statusConfig.color}`}>
                        {statusConfig.icon}{statusConfig.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{venue.placeName}</p>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      {venue.contactName && <span>Owner: {venue.contactName}</span>}
                      {venue.contactEmail && <span>{venue.contactEmail}</span>}
                      <span className="ml-auto">{format(new Date(venue.submittedAt ?? venue.createdAt), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto w-full px-4 md:px-8 py-8">
            <div className="mb-8">
              <h1 className="text-xl font-bold">Register New Venue</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Fill in the venue details. The owner will receive a claim link to take control of their account.
              </p>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Venue Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name <span className="text-destructive">*</span></Label>
                    <Input id="businessName" placeholder="e.g. The Blue Door Bar" value={form.businessName} onChange={setField("businessName")} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="placeName">Location / Address <span className="text-destructive">*</span></Label>
                    <Input id="placeName" placeholder="e.g. 123 Main St, London" value={form.placeName} onChange={setField("placeName")} required />
                    <p className="text-xs text-muted-foreground">Full address or area name as shown on maps.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" placeholder="Brief description of the venue..." value={form.description} onChange={setField("description")} className="resize-none min-h-[80px]" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Owner Contact Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground -mt-1">The owner will receive an email to claim their venue account.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Owner Name <span className="text-destructive">*</span></Label>
                      <Input id="contactName" placeholder="Full name" value={form.contactName} onChange={setField("contactName")} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Owner Email <span className="text-destructive">*</span></Label>
                      <Input id="contactEmail" type="email" placeholder="owner@venue.com" value={form.contactEmail} onChange={setField("contactEmail")} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" type="tel" placeholder="+44 7700 900000" value={form.phone} onChange={setField("phone")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="websiteUrl">Website</Label>
                      <Input id="websiteUrl" type="url" placeholder="https://..." value={form.websiteUrl} onChange={setField("websiteUrl")} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Registration Notes</CardTitle></CardHeader>
                <CardContent>
                  <Textarea
                    id="registrationNotes"
                    placeholder="Notes for the admin reviewer (e.g. met with manager on site, verified documents in person)..."
                    value={form.registrationNotes}
                    onChange={setField("registrationNotes")}
                    className="resize-none min-h-[80px]"
                  />
                </CardContent>
              </Card>

              <div className="flex gap-3 pb-8">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setView("list")} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 gap-2"
                  disabled={submitting || !form.businessName || !form.placeName || !form.contactName || !form.contactEmail}
                >
                  <Send className="w-4 h-4" />
                  {submitting ? "Submitting…" : "Submit Registration"}
                </Button>
              </div>
            </form>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
