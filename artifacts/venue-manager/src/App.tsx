import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Route, Switch, Router as WouterRouter, useLocation, useParams } from "wouter";
import {
  acceptVenueManagerInvitation,
  changeVenueManagerPassword,
  createVenueManagerAnnouncement,
  createVenueManagerEvent,
  createVenueManagerInvitation,
  createVenueManagerReward,
  createVenueManagerSession,
  claimVenueManagerAccount,
  deleteVenueManagerAnnouncement,
  deleteVenueManagerEvent,
  deleteVenueManagerSession,
  getGetVenueManagerBusinessQueryOptions,
  getGetVenueManagerDashboardQueryOptions,
  getGetVenueManagerQrCodeQueryOptions,
  getListVenueManagerAnnouncementsQueryOptions,
  getListVenueManagerBusinessesQueryOptions,
  getListVenueManagerEventsQueryOptions,
  getListVenueManagerMembersQueryOptions,
  getListVenueManagerRewardsQueryOptions,
  recoverVenueManagerPassword,
  removeVenueManager,
  requestVenueManagerRemoval,
  updateVenueManagerBusiness,
  updateVenueManagerEvent,
  updateVenueManagerReward,
  updateVenueManagerRole,
  regenerateVenueManagerQrCode,
  type VenueManagerBusiness,
  type VenueManagerDashboard,
  type VenueManagerEvent,
  type VenueManagerEventList,
  type VenueManagerEventInput,
  type VenueManagerEventUpdate,
  type VenueManagerAnnouncementList,
  type VenueManagerAnnouncementInput,
  type VenueManagerMemberList,
  type VenueManagerOpeningHoursDay,
  type VenueManagerReward,
  type VenueManagerRewardList,
  type VenueManagerRewardInput,
  type VenueManagerRewardUpdate,
} from "@workspace/api-client-react";
import QRCode from "react-qr-code";
import { AlertTriangle, BarChart3, Bell, Building2, CalendarDays, ChevronDown, CircleUserRound, Clock, Download, Gift, Globe, LayoutDashboard, LogOut, Mail, MapPin, Phone, Plus, QrCode, RefreshCw, Settings2, ShieldCheck, Users, X } from "lucide-react";
import { applyWebsiteUrlBlur, validateWebsiteUrl } from "./lib/websiteUrl";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 15_000, refetchOnWindowFocus: true } },
});

function invalidateVenueManagerData() {
  void queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0];
      return (typeof key === "string" && key.startsWith("/api/venue-manager/")) || key === "manager-businesses";
    },
  });
}

type Session = { authenticated: true; csrfToken: string; expiresAt: string };
type Role = "owner" | "manager" | "editor";
type Page = "overview" | "venue" | "events" | "rewards" | "announcements" | "analytics" | "team";
type ApiError = Error & { status?: number };

function apiError(error: unknown): string {
  if (error instanceof Error) return error.message.replace(/^Error:\s*/, "") || "Something went wrong.";
  return "Something went wrong.";
}

function csrf(csrfToken: string): RequestInit {
  return { headers: { "x-csrf-token": csrfToken } };
}

function dateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function isoFromInput(value: FormDataEntryValue | null) {
  return value ? new Date(String(value)).toISOString() : undefined;
}
function formText(value: FormDataEntryValue | null) {
  return value === null ? "" : String(value);
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="vm-app">{children}</div>;
}

function Loading({ label = "Loading your workspace…" }: { label?: string }) {
  return <Shell><div className="vm-center"><div className="vm-spinner" /><p>{label}</p></div></Shell>;
}

function SessionBootstrap() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "unauthed" | "expired" | "error">("loading");
  const loadSession = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch("/api/venue-manager/session", { credentials: "include" });
      if (response.ok) {
        setSession((await response.json()) as Session);
        return;
      }
      setSession(null);
      setStatus(response.status === 401 ? "expired" : "error");
    } catch {
      setSession(null);
      setStatus("error");
    }
  }, []);
  useEffect(() => { void loadSession(); }, [loadSession]);
  if (session) {
    return <Portal session={session} onSessionChange={(next) => {
      setSession(next);
      if (!next) setStatus("unauthed");
    }} />;
  }
  if (status === "loading") return <Loading />;
  if (status === "error") {
    return <Shell><div className="vm-center"><p>We couldn’t reach the venue portal. Check your connection and try again.</p><button className="vm-primary" type="button" onClick={() => void loadSession()}>Retry</button></div></Shell>;
  }
  return <LoginPage sessionExpired={status === "expired"} onSignedIn={() => void loadSession()} />;
}

function AuthFrame({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return <Shell>
    <div className="vm-auth">
      <div className="vm-auth-brand"><div className="vm-mark">m</div><span>met <em>business</em></span></div>
      <main className="vm-auth-card"><p className="vm-eyebrow">VENUE MANAGER</p><h1>{title}</h1><p className="vm-subtitle">{subtitle}</p>{children}</main>
      <p className="vm-auth-foot">The operating space for the places people meet.</p>
    </div>
  </Shell>;
}

function LoginPage({ sessionExpired = false, onSignedIn }: { sessionExpired?: boolean; onSignedIn?: () => void }) {
  const [, navigate] = useLocation();
  const [message, setMessage] = useState(sessionExpired ? "Your session ended. Sign in to continue." : "");
  const login = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => createVenueManagerSession({ email, password }),
    onSuccess: () => { queryClient.clear(); navigate("/"); onSignedIn?.(); },
    onError: (error) => setMessage(apiError(error)),
  });
  return <AuthFrame title="Run the room." subtitle="Sign in with your business account to manage your venue on Met.">
    <form className="vm-form" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      login.mutate({ email: String(form.get("email")).trim(), password: String(form.get("password")) });
    }}>
      {message && <div className="vm-notice error">{message}</div>}
      <label>Business email<input required name="email" type="email" autoComplete="email" placeholder="you@yourvenue.com" /></label>
      <label>Password<input required name="password" type="password" autoComplete="current-password" placeholder="Your password" /></label>
      <button className="vm-primary" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</button>
    </form>
    <div className="vm-auth-links"><button type="button" onClick={() => navigate("/recover")}>Use a recovery link</button><button type="button" onClick={() => navigate("/invite")}>Accept an invitation</button><button type="button" onClick={() => navigate("/register")}>Register as venue owner</button><button type="button" onClick={() => navigate("/apply")}>Apply to list your venue</button></div>
  </AuthFrame>;
}

function InvitePage() {
  const [, navigate] = useLocation();
  const [message, setMessage] = useState("");
  const accept = useMutation({
    mutationFn: (data: { token: string; displayName: string; password: string }) => acceptVenueManagerInvitation(data),
    onSuccess: () => { queryClient.clear(); navigate("/"); },
    onError: (error) => setMessage(apiError(error)),
  });
  return <AuthFrame title="Join your venue." subtitle="Create your secure business account from an invitation.">
    <form className="vm-form" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      accept.mutate({ token: String(form.get("token")).trim(), displayName: String(form.get("displayName")).trim(), password: String(form.get("password")) });
    }}>
      {message && <div className="vm-notice error">{message}</div>}
      <label>Invitation code<input required name="token" autoComplete="off" /></label>
      <label>Your name<input required name="displayName" autoComplete="name" /></label>
      <label>New password<input required minLength={12} name="password" type="password" autoComplete="new-password" placeholder="12+ characters, upper/lowercase and number" /></label>
      <button className="vm-primary" disabled={accept.isPending}>{accept.isPending ? "Creating account…" : "Create business account"}</button>
    </form><div className="vm-auth-links"><button type="button" onClick={() => navigate("/")}>Back to sign in</button></div>
  </AuthFrame>;
}

function RecoveryPage() {
  const [, navigate] = useLocation();
  const [message, setMessage] = useState("");
  const recover = useMutation({
    mutationFn: (data: { token: string; newPassword: string }) => recoverVenueManagerPassword(data),
    onSuccess: () => { setMessage("Password updated. You can sign in now."); },
    onError: (error) => setMessage(apiError(error)),
  });
  return <AuthFrame title="Reset your password." subtitle="Use the recovery code shared by your venue owner.">
    <form className="vm-form" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      recover.mutate({ token: String(form.get("token")).trim(), newPassword: String(form.get("password")) });
    }}>
      {message && <div className={`vm-notice ${recover.isSuccess ? "success" : "error"}`}>{message}</div>}
      <label>Recovery code<input required name="token" autoComplete="off" /></label>
      <label>New password<input required minLength={12} name="password" type="password" autoComplete="new-password" /></label>
      <button className="vm-primary" disabled={recover.isPending}>{recover.isPending ? "Updating…" : "Update password"}</button>
    </form><div className="vm-auth-links"><button type="button" onClick={() => navigate("/")}>Back to sign in</button></div>
  </AuthFrame>;
}

function RegisterPage() {
  const [, navigate] = useLocation();
  const tokenFromUrl = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  ).get("token") ?? "";
  const [message, setMessage] = useState("");
  const register = useMutation({
    mutationFn: async (data: { token: string; email: string; displayName: string; password: string }) => {
      const res = await fetch("/api/venue-manager/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        throw Object.assign(new Error(err.message ?? "Registration failed"), { status: res.status });
      }
    },
    onSuccess: () => { queryClient.clear(); navigate("/"); },
    onError: (error) => setMessage(apiError(error)),
  });
  return (
    <AuthFrame
      title="Set up your venue account."
      subtitle="Create your owner account to manage your approved venue on Met."
    >
      <form
        className="vm-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          register.mutate({
            token: String(form.get("token")).trim(),
            email: String(form.get("email")).trim(),
            displayName: String(form.get("displayName")).trim(),
            password: String(form.get("password")),
          });
        }}
      >
        {message && <div className="vm-notice error">{message}</div>}
        <label>
          Registration code
          <input required name="token" autoComplete="off" defaultValue={tokenFromUrl} />
        </label>
        <label>
          Business email
          <input required name="email" type="email" autoComplete="email" placeholder="you@yourvenue.com" />
        </label>
        <label>
          Your name
          <input required name="displayName" autoComplete="name" placeholder="How you'll appear to your team" />
        </label>
        <label>
          Password
          <input
            required
            minLength={12}
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="12+ characters, upper/lowercase and number"
          />
        </label>
        <button className="vm-primary" disabled={register.isPending}>
          {register.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>
      <div className="vm-auth-links">
        <button type="button" onClick={() => navigate("/")}>Back to sign in</button>
      </div>
    </AuthFrame>
  );
}

function Tip({ children }: { children: string }) {
  return (
    <span className="vm-tip" role="tooltip" aria-label={children}>
      ?<span className="vm-tip-bubble">{children}</span>
    </span>
  );
}

type PlaceResult = { placeId: string; name: string; address: string; lat: number; lng: number };
type ApplyFormData = {
  contactEmail: string; contactName: string; place: PlaceResult | null;
  tagline: string; description: string; verificationDocUrl: string; registrationNotes: string;
};

function ApplyPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ApplyFormData>({ contactEmail: "", contactName: "", place: null, tagline: "", description: "", verificationDocUrl: "", registrationNotes: "" });
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/venue-owner/places-public/search?query=${encodeURIComponent(search)}`);
        if (res.ok) { const json = await res.json() as { places: PlaceResult[] }; setResults(json.places); }
      } catch { /* ignore */ } finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/venue-owner/apply", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ contactEmail: form.contactEmail, contactName: form.contactName, placeId: form.place!.placeId, placeName: form.place!.name, businessName: form.place!.name, lat: form.place!.lat, lng: form.place!.lng, tagline: form.tagline || null, description: form.description || null, verificationDocUrl: form.verificationDocUrl, registrationNotes: form.registrationNotes || null }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { message?: string }; throw Object.assign(new Error(e.message ?? "Submission failed"), { status: res.status }); }
    },
    onSuccess: () => setSubmitted(true),
    onError: (e) => setError(apiError(e)),
  });

  if (submitted) return (
    <AuthFrame title="Application received." subtitle="We review every application carefully — usually within a few business days.">
      <div className="vm-notice success">Your application for <strong>{form.place?.name}</strong> has been submitted. When approved you'll receive your registration link at <strong>{form.contactEmail}</strong>.</div>
      <div className="vm-auth-links"><button type="button" onClick={() => navigate("/")}>Back to sign in</button></div>
    </AuthFrame>
  );

  const stepLabels = ["Your contact details", "Find your venue", "About your venue", "Proof of ownership", "Review & submit"];
  return (
    <AuthFrame title="List your venue on Met." subtitle={`Step ${step} of 5 — ${stepLabels[step - 1]}`}>
      {error && <div className="vm-notice error">{error}</div>}

      {step === 1 && (
        <form className="vm-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setForm(d => ({ ...d, contactEmail: String(f.get("email")).trim(), contactName: String(f.get("name")).trim() })); setError(""); setStep(2); }}>
          <label><span className="vm-label-row">Your name<Tip>Type your first and last name — e.g. "Sarah Johnson".</Tip></span><input required name="name" autoComplete="name" defaultValue={form.contactName} placeholder="Your full name" /></label>
          <label><span className="vm-label-row">Your email<Tip>Type the email address you check regularly. Your registration link will arrive here once we approve your application.</Tip></span><input required name="email" type="email" autoComplete="email" defaultValue={form.contactEmail} placeholder="you@yourvenue.com" /></label>
          <button className="vm-primary">Next →</button>
        </form>
      )}

      {step === 2 && (
        <div className="vm-form">
          <label><span className="vm-label-row">Search for your venue<Tip>Type your venue's name or street address, then tap the correct result in the list below.</Tip></span>
            <input value={search} onChange={(e) => { setSearch(e.target.value); if (form.place) setForm(d => ({ ...d, place: null })); }} placeholder="Type your venue name or address" autoFocus />
          </label>
          {searching && <p className="vm-subtitle" style={{ margin: 0 }}>Searching…</p>}
          {results.length > 0 && !form.place && (
            <div className="vm-place-results">
              {results.map((p) => (
                <button key={p.placeId} type="button" className="vm-place-result" onClick={() => { setForm(d => ({ ...d, place: p })); setSearch(p.name); setResults([]); }}>
                  <strong>{p.name}</strong><span>{p.address}</span>
                </button>
              ))}
            </div>
          )}
          {form.place && <div className="vm-notice success">✓ <strong>{form.place.name}</strong><br /><small style={{ opacity: 0.75 }}>{form.place.address}</small></div>}
          <div className="vm-apply-actions">
            <button className="vm-secondary" type="button" onClick={() => setStep(1)}>← Back</button>
            <button className="vm-primary" type="button" disabled={!form.place} onClick={() => setStep(3)}>Next →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form className="vm-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setForm(d => ({ ...d, tagline: String(f.get("tagline") ?? "").trim(), description: String(f.get("description") ?? "").trim() })); setStep(4); }}>
          <label><span className="vm-label-row">Tagline <span className="vm-optional">optional</span><Tip>One punchy sentence, max 160 characters — e.g. "The rooftop bar where the city meets the sky."</Tip></span><input name="tagline" maxLength={160} defaultValue={form.tagline} placeholder="What makes your venue special — in one line" /></label>
          <label><span className="vm-label-row">Description <span className="vm-optional">optional</span><Tip>Write 2–4 sentences about the vibe, what's on offer, and any dress code — enough for a guest to picture the experience before they arrive.</Tip></span><textarea name="description" rows={4} maxLength={1000} defaultValue={form.description} placeholder="Tell potential guests about the vibe, what you offer, what to expect" /></label>
          <div className="vm-apply-actions">
            <button className="vm-secondary" type="button" onClick={() => setStep(2)}>← Back</button>
            <button className="vm-primary">Next →</button>
          </div>
        </form>
      )}

      {step === 4 && (
        <form className="vm-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setForm(d => ({ ...d, verificationDocUrl: String(f.get("docUrl")).trim(), registrationNotes: String(f.get("notes") ?? "").trim() })); setError(""); setStep(5); }}>
          <p className="vm-subtitle" style={{ margin: "0 0 4px" }}>Upload your proof of ownership to Google Drive, Dropbox, or similar and paste the link below. Accepted: business licence, lease agreement, utility bill addressed to the venue.</p>
          <label><span className="vm-label-row">Document link<Tip>Paste a shareable link (Google Drive, Dropbox, OneDrive) to a business licence, lease, or utility bill showing the venue address. The link must be viewable without signing in.</Tip></span><input required name="docUrl" type="url" defaultValue={form.verificationDocUrl} placeholder="https://drive.google.com/…" /></label>
          <label><span className="vm-label-row">Additional notes <span className="vm-optional">optional</span><Tip>Type anything that could help — e.g. "I'm the ops manager, not the legal owner" or "the lease is in my company name".</Tip></span><textarea name="notes" rows={3} maxLength={500} defaultValue={form.registrationNotes} placeholder="Anything else you'd like us to know" /></label>
          <div className="vm-apply-actions">
            <button className="vm-secondary" type="button" onClick={() => setStep(3)}>← Back</button>
            <button className="vm-primary">Review →</button>
          </div>
        </form>
      )}

      {step === 5 && (
        <div className="vm-form">
          <div className="vm-review">
            <div className="vm-review-row"><span>Name</span><strong>{form.contactName}</strong></div>
            <div className="vm-review-row"><span>Email</span><strong>{form.contactEmail}</strong></div>
            <div className="vm-review-row"><span>Venue</span><strong>{form.place?.name}</strong></div>
            {form.tagline && <div className="vm-review-row"><span>Tagline</span><strong>{form.tagline}</strong></div>}
            <div className="vm-review-row"><span>Doc</span><a href={form.verificationDocUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#16745a", wordBreak: "break-all" }}>View document</a></div>
          </div>
          <div className="vm-apply-actions" style={{ marginTop: "12px" }}>
            <button className="vm-secondary" type="button" onClick={() => setStep(4)}>← Back</button>
            <button className="vm-primary" disabled={submit.isPending} onClick={() => { setError(""); submit.mutate(); }}>{submit.isPending ? "Submitting…" : "Submit application"}</button>
          </div>
        </div>
      )}

      <div className="vm-auth-links"><button type="button" onClick={() => navigate("/")}>Already have an account? Sign in</button></div>
    </AuthFrame>
  );
}

function Portal({ session, onSessionChange }: { session: Session; onSessionChange: (session: Session | null) => void }) {
  const [, navigate] = useLocation();
  const businesses = useQuery(getListVenueManagerBusinessesQueryOptions({
    request: { credentials: "include" },
    query: { queryKey: ["manager-businesses"] },
  } as never));
  const unauthorized = businesses.isError && (businesses.error as ApiError)?.status === 401;
  useEffect(() => {
    if (unauthorized) { queryClient.clear(); onSessionChange(null); navigate("/"); }
  }, [unauthorized, onSessionChange, navigate]);
  if (businesses.isLoading || unauthorized) return <Loading />;
  if (businesses.isError) return <AuthFrame title="Unable to open your workspace." subtitle="Please sign in again or try refreshing."><div className="vm-notice error">{apiError(businesses.error)}</div><button className="vm-primary" type="button" onClick={() => businesses.refetch()}>Try again</button></AuthFrame>;
  const list = businesses.data?.businesses ?? [];
  if (!list.length) return <EmptyWorkspace session={session} onSessionChange={onSessionChange} />;
  return <Switch>
    <Route path="/invite" component={InvitePage} /><Route path="/recover" component={RecoveryPage} />
    <Route path="/:businessId/:page?" component={() => <Workspace businesses={list} session={session} onSessionChange={onSessionChange} />} />
    <Route path="/" component={() => { navigate(`/${list[0].businessId}/overview`); return <Loading label="Opening your venue…" />; }} />
  </Switch>;
}

function EmptyWorkspace({ session, onSessionChange }: { session: Session; onSessionChange: (session: Session | null) => void }) {
  return <AuthFrame title="No active venues yet." subtitle="Your account is secure, but it is not currently assigned to an active venue.">
    <p className="vm-subtitle">Ask your venue owner to check your invitation or membership. If you were an existing Met venue owner, start the migration from the mobile app.</p>
    <LogoutButton session={session} onDone={() => onSessionChange(null)} />
  </AuthFrame>;
}

function Workspace({ businesses, session, onSessionChange }: { businesses: VenueManagerBusiness[]; session: Session; onSessionChange: (session: Session | null) => void }) {
  const params = useParams<{ businessId: string; page?: Page }>();
  const [, navigate] = useLocation();
  const businessId = Number(params.businessId);
  const business = businesses.find((item) => item.businessId === businessId) ?? businesses[0];
  const page = (params.page ?? "overview") as Page;
  useEffect(() => { if (!businesses.some((item) => item.businessId === businessId)) navigate(`/${business.businessId}/overview`, { replace: true }); }, [businessId, business, businesses, navigate]);
  const allowed: Page[] = business.role === "editor" ? ["overview", "events", "announcements", "analytics"] : business.role === "manager" ? ["overview", "venue", "events", "rewards", "announcements", "analytics"] : ["overview", "venue", "events", "rewards", "announcements", "analytics", "team"];
  const activePage = allowed.includes(page) ? page : "overview";
  return <Shell>
    <div className="vm-workspace">
      <aside className="vm-sidebar"><div className="vm-logo"><div className="vm-mark">m</div><span>met <em>business</em></span></div>
        <VenueChooser businesses={businesses} active={business} onChange={(id) => navigate(`/${id}/overview`)} />
        <nav>{allowed.map((item) => <NavItem key={item} page={item} active={activePage === item} onClick={() => navigate(`/${business.businessId}/${item}`)} />)}</nav>
        <div className="vm-sidebar-bottom"><div className="vm-role"><ShieldCheck size={16} /><span>{business.role} access</span></div><LogoutButton session={session} onDone={() => { queryClient.clear(); onSessionChange(null); navigate("/"); }} /></div>
      </aside>
      <main className="vm-main"><header className="vm-mobile-head"><div className="vm-logo"><div className="vm-mark">m</div><span>met <em>business</em></span></div><span className="vm-mobile-role">{business.role}</span></header>
        <PageContent page={activePage} business={business} csrfToken={session.csrfToken} onSession={onSessionChange} />
      </main>
    </div>
  </Shell>;
}

function NavItem({ page, active, onClick }: { page: Page; active: boolean; onClick: () => void }) {
  const icons: Record<Page, ReactNode> = { overview: <LayoutDashboard />, venue: <Building2 />, events: <CalendarDays />, rewards: <Gift />, announcements: <Bell />, analytics: <BarChart3 />, team: <Users /> };
  const labels: Record<Page, string> = { overview: "Overview", venue: "Venue profile", events: "Events", rewards: "Rewards", announcements: "Announcements", analytics: "Analytics", team: "Team" };
  return <button className={`vm-nav ${active ? "active" : ""}`} onClick={onClick}>{icons[page]}<span>{labels[page]}</span></button>;
}

function VenueChooser({ businesses, active, onChange }: { businesses: VenueManagerBusiness[]; active: VenueManagerBusiness; onChange: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="vm-venue-picker"><button onClick={() => setOpen(!open)}><span className="vm-venue-avatar">{active.businessName.slice(0, 1)}</span><span><strong>{active.businessName}</strong><small>{active.placeName}</small></span><ChevronDown size={16} /></button>
    {open && <div className="vm-venue-menu">{businesses.map((business) => <button key={business.businessId} onClick={() => { onChange(business.businessId); setOpen(false); }}><strong>{business.businessName}</strong><small>{business.placeName} · {business.role}</small></button>)}</div>}
  </div>;
}

function LogoutButton({ session, onDone }: { session: Session; onDone: () => void }) {
  const logout = useMutation({ mutationFn: () => deleteVenueManagerSession(csrf(session.csrfToken)), onSettled: onDone });
  return <button className="vm-logout" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={16} />{logout.isPending ? "Signing out…" : "Sign out"}</button>;
}

function PageContent({ page, business, csrfToken, onSession }: { page: Page; business: VenueManagerBusiness; csrfToken: string; onSession: (session: Session) => void }) {
  const labels: Record<Page, [string, string]> = {
    overview: ["Good to see you.", "The pulse of your place, right now."], venue: ["Your venue, your voice.", "Keep the public face of your place current."],
    events: ["Make a reason to gather.", "Create moments your community can RSVP to."], rewards: ["Reward the regulars.", "Set a little anticipation in motion."],
    announcements: ["Say what’s happening.", "Share updates with people who know your place."], analytics: ["Read the room.", "Signals from your venue community."], team: ["Your people.", "Give the right access to the right hands."],
  };
  return <div className="vm-page"><div className="vm-page-intro"><div><p className="vm-eyebrow">{business.placeName.toUpperCase()}</p><h1>{labels[page][0]}</h1><p>{labels[page][1]}</p></div><div className="vm-location"><MapPin size={16} />{business.placeName}</div></div>
    {page === "overview" && <Overview business={business} />}
    {page === "venue" && <VenueProfile business={business} csrfToken={csrfToken} />}
    {page === "events" && <Events business={business} csrfToken={csrfToken} />}
    {page === "rewards" && <Rewards business={business} csrfToken={csrfToken} />}
    {page === "announcements" && <Announcements business={business} csrfToken={csrfToken} />}
    {page === "analytics" && <Analytics business={business} />}
    {page === "team" && <Team business={business} csrfToken={csrfToken} onSession={onSession} />}
  </div>;
}

function useBusinessQuery<T>(factory: (id: number, options?: unknown) => unknown, businessId: number) {
  return useQuery<T>(factory(businessId, { request: { credentials: "include" } }) as never);
}

function Overview({ business }: { business: VenueManagerBusiness }) {
  const dashboard = useBusinessQuery<VenueManagerDashboard>(getGetVenueManagerDashboardQueryOptions, business.businessId);
  const events = useBusinessQuery<VenueManagerEventList>(getListVenueManagerEventsQueryOptions, business.businessId);
  if (dashboard.isLoading || events.isLoading) return <SectionLoading />;
  const trend = dashboard.data?.checkInTrend ?? [];
  const total = trend.reduce((sum, item) => sum + item.count, 0);
  const qrToday = dashboard.data?.qrVerificationsToday ?? 0;
  const qrTrend = dashboard.data?.qrVerificationsTrend ?? [];
  const qrMax = Math.max(1, ...qrTrend.map((b) => b.count));
  return <div className="vm-grid overview-grid"><section className="vm-panel vm-hero-panel"><span className="vm-hero-orb" /><p>COMMUNITY THIS MONTH</p><h2>{total}<small>check-ins</small></h2><div className="vm-spark">{trend.slice(-12).map((item) => <i key={item.day} style={{ height: `${Math.max(8, Math.min(100, item.count * 13))}%` }} />)}</div></section>
    <section className="vm-panel vm-qr-panel"><div className="vm-panel-title"><h2>QR Verifications</h2><QrCode size={18} /></div><p className="vm-stat-label">Today</p><p className="vm-stat-value">{qrToday}<small>verified guests</small></p><div className="vm-spark vm-spark-qr">{qrTrend.length ? qrTrend.map((b) => <i key={b.day} title={`${b.day}: ${b.count}`} style={{ height: `${Math.max(8, Math.round((b.count / qrMax) * 100))}%` }} />) : Array.from({ length: 7 }).map((_, i) => <i key={i} style={{ height: "8%" }} />)}</div><p className="vm-spark-label">7-day trend</p></section>
    <section className="vm-panel"><div className="vm-panel-title"><h2>Coming up</h2><CalendarDays /></div>{(events.data?.events ?? []).slice(0, 3).map((event) => <div className="vm-list-row" key={event.id}><span className="vm-date">{new Date(event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><div><strong>{event.title}</strong><small>{event.rsvpCount ?? 0} RSVPs</small></div></div>)}{!(events.data?.events ?? []).length && <Empty text="No events yet. Start the next good night." />}</section>
    <section className="vm-panel"><div className="vm-panel-title"><h2>Regulars</h2><CircleUserRound /></div>{(dashboard.data?.topVisitors ?? []).map((visitor) => <div className="vm-list-row" key={visitor.userUid}><span className="vm-person">{visitor.displayName.slice(0, 1)}</span><div><strong>{visitor.displayName}</strong><small>{visitor.checkinCount} visits this month</small></div></div>)}{!(dashboard.data?.topVisitors ?? []).length && <Empty text="Visitor insights will appear after check-ins." />}</section>
    <section className="vm-panel vm-reward-callout"><Gift size={23} /><div><strong>{dashboard.data?.activeReward ? "A reward is live" : "Keep regulars close"}</strong><p>{dashboard.data?.activeReward ? "Your current campaign is bringing people back." : "Create a reward for the people who make your place feel alive."}</p></div></section>
  </div>;
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Day = typeof DAYS[number];
type HoursState = Record<Day, { open: string; close: string; closed: boolean }>;

function defaultHoursState(existing?: VenueManagerBusiness["openingHours"]): HoursState {
  const defaults: HoursState = {
    monday: { open: "09:00", close: "22:00", closed: false },
    tuesday: { open: "09:00", close: "22:00", closed: false },
    wednesday: { open: "09:00", close: "22:00", closed: false },
    thursday: { open: "09:00", close: "22:00", closed: false },
    friday: { open: "09:00", close: "23:00", closed: false },
    saturday: { open: "10:00", close: "23:00", closed: false },
    sunday: { open: "10:00", close: "21:00", closed: false },
  };
  if (!existing) return defaults;
  for (const day of DAYS) {
    const v = existing[day];
    if (v === undefined) continue;
    if (v === null) { defaults[day] = { ...defaults[day], closed: true }; }
    else { defaults[day] = { open: v.open, close: v.close, closed: false }; }
  }
  return defaults;
}

function OpeningHoursEditor({ hours, onChange }: { hours: HoursState; onChange: (h: HoursState) => void }) {
  const DAY_LABELS: Record<Day, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };
  return (
    <div className="vm-hours-editor">
      {DAYS.map((day) => {
        const h = hours[day];
        return (
          <div key={day} className="vm-hours-row">
            <span className="vm-hours-day">{DAY_LABELS[day]}</span>
            <label className="vm-hours-closed">
              <input type="checkbox" checked={h.closed} onChange={(e) => onChange({ ...hours, [day]: { ...h, closed: e.target.checked } })} />
              <span>Closed</span>
            </label>
            {!h.closed && (
              <>
                <input className="vm-hours-time" type="time" value={h.open} onChange={(e) => onChange({ ...hours, [day]: { ...h, open: e.target.value } })} />
                <span className="vm-hours-sep">–</span>
                <input className="vm-hours-time" type="time" value={h.close} onChange={(e) => onChange({ ...hours, [day]: { ...h, close: e.target.value } })} />
              </>
            )}
            {h.closed && <span className="vm-hours-closed-label">Closed all day</span>}
          </div>
        );
      })}
    </div>
  );
}

async function uploadVenueImage(
  businessId: number,
  csrfToken: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  const contentType = file.type || "image/jpeg";
  onProgress(10);
  // Step 1: request a presigned PUT URL (content type is bound into the URL so GCS enforces it).
  const res = await fetch(`/api/venue-manager/businesses/${businessId}/images/upload`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify({ contentType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Failed to prepare upload.");
  }
  const { uploadURL, objectPath } = await res.json() as { uploadURL: string; objectPath: string };
  onProgress(30);
  // Step 2: PUT the file directly to GCS via the presigned URL.
  const put = await fetch(uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!put.ok) throw new Error("Failed to upload image. Please try again.");
  onProgress(70);
  // Step 3: confirm the upload — server reads the first bytes and validates image magic.
  const confirm = await fetch(`/api/venue-manager/businesses/${businessId}/images/confirm`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify({ objectPath }),
  });
  if (!confirm.ok) {
    const err = await confirm.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Image validation failed. Please try a different file.");
  }
  const { url } = await confirm.json() as { url: string };
  onProgress(100);
  return url;
}

type ImageUploadFieldProps = {
  label: string;
  value: string;
  onChange: (url: string) => void;
  businessId: number;
  csrfToken: string;
};

function ImageUploadField({ label, value, onChange, businessId, csrfToken }: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError("");
    setProgress(0);
    try {
      const url = await uploadVenueImage(businessId, csrfToken, file, setProgress);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="vm-image-upload-field">
      <span className="vm-image-upload-label">{label}</span>
      {value && (
        <div className="vm-image-preview">
          <img src={value} alt={label} />
          <button type="button" className="vm-image-remove" aria-label="Remove image" onClick={() => { onChange(""); setError(""); }}>
            <X size={14} />
          </button>
        </div>
      )}
      {!value && (
        <button
          type="button"
          className="vm-image-pick-btn"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? `Uploading… ${progress < 100 ? `${progress}%` : ""}` : "Choose image"}
        </button>
      )}
      {value && !uploading && (
        <button
          type="button"
          className="vm-image-pick-btn replace"
          onClick={() => inputRef.current?.click()}
        >
          Replace image
        </button>
      )}
      {uploading && (
        <div className="vm-image-progress">
          <div className="vm-image-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <span className="vm-image-error">{error}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}


function VenueQrCodePanel({ business, csrfToken }: { business: VenueManagerBusiness; csrfToken: string }) {
  const client = useQueryClient();
  const qr = useQuery({
    ...getGetVenueManagerQrCodeQueryOptions(business.businessId, { request: { credentials: "include" } }),
  });
  const [regenerating, setRegenerating] = useState(false);
  const [qrMsg, setQrMsg] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const data = qr.data;

  function downloadQr() {
    if (!data) return;
    const svg = document.getElementById("vm-qr-svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const canvas = document.createElement("canvas");
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const link = document.createElement("a");
      link.download = `${business.placeName.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
  }

  async function doRegenerate() {
    setRegenerating(true);
    setQrMsg("");
    try {
      await regenerateVenueManagerQrCode(business.businessId, { credentials: "include", headers: { "x-csrf-token": csrfToken } });
      await client.invalidateQueries({ queryKey: getGetVenueManagerQrCodeQueryOptions(business.businessId).queryKey });
      setQrMsg("QR code regenerated. The old code is now invalid.");
    } catch {
      setQrMsg("Failed to regenerate. Try again.");
    } finally {
      setRegenerating(false);
      setShowConfirm(false);
    }
  }

  return (
    <section className="vm-panel">
      <div className="vm-section-head-row">
        <QrCode size={18} />
        <div>
          <h3 style={{ margin: 0 }}>Check-in QR code</h3>
          <p style={{ margin: "2px 0 0", fontSize: "0.85em", opacity: 0.7 }}>Print and display this at your venue so guests can check in.</p>
        </div>
      </div>
      {qr.isLoading && <SectionLoading />}
      {qr.isError && <div className="vm-notice error">Unable to load QR code. Refresh to try again.</div>}
      {data && (
        <div className="vm-qr-body">
          <div className="vm-qr-code">
            <QRCode id="vm-qr-svg" value={data.qrUrl} size={200} bgColor="#ffffff" fgColor="#111111" />
          </div>
          <div className="vm-qr-meta">
            <p className="vm-qr-url">{data.qrUrl}</p>
            <div className="vm-qr-actions">
              <button type="button" className="vm-secondary" onClick={downloadQr}><Download size={14} />Download PNG</button>
              {business.role === "owner" && (
                <button type="button" className="vm-secondary danger-text" onClick={() => { setQrMsg(""); setShowConfirm(true); }}><RefreshCw size={14} />Regenerate code</button>
              )}
            </div>
            {qrMsg && <div className={`vm-notice ${qrMsg.startsWith("Failed") ? "error" : "success"}`}>{qrMsg}</div>}
          </div>
        </div>
      )}
      {showConfirm && (
        <Modal title="Regenerate QR code?" onClose={() => setShowConfirm(false)}>
          <div className="vm-form">
            <p className="vm-subtitle" style={{ margin: "0 0 12px" }}>This will invalidate the current code immediately. Anyone who already scanned the old URL will be able to check in until the link expires, but new scans of the old code will not work.</p>
            <div className="vm-form-actions">
              <button type="button" className="vm-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button type="button" className="vm-danger-btn" disabled={regenerating} onClick={() => void doRegenerate()}>{regenerating ? "Regenerating…" : "Yes, regenerate"}</button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function VenueProfile({ business, csrfToken }: { business: VenueManagerBusiness; csrfToken: string }) {
  const detail = useBusinessQuery<VenueManagerBusiness>(getGetVenueManagerBusinessQueryOptions, business.businessId);
  const [message, setMessage] = useState("");
  const [websiteUrlError, setWebsiteUrlError] = useState("");
  const [showRemoval, setShowRemoval] = useState(false);
  const venue = detail.data ?? business;
  const [hours, setHours] = useState<HoursState>(() => defaultHoursState(venue.openingHours ?? undefined));
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(venue.coverPhotoUrl ?? "");
  const [logoUrl, setLogoUrl] = useState(venue.logoUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(venue.websiteUrl ?? "");
  // Re-sync state when fresh data arrives from the server
  const venueRef = detail.data;
  useEffect(() => {
    if (venueRef) {
      setHours(defaultHoursState(venueRef.openingHours ?? undefined));
      setCoverPhotoUrl(venueRef.coverPhotoUrl ?? "");
      setLogoUrl(venueRef.logoUrl ?? "");
      setWebsiteUrl(venueRef.websiteUrl ?? "");
    }
  }, [venueRef]);

  function handleWebsiteUrlBlur() {
    const { value, error } = applyWebsiteUrlBlur(websiteUrl);
    setWebsiteUrl(value);
    setWebsiteUrlError(error);
  }

  const update = useMutation({
    mutationFn: (data: object) => updateVenueManagerBusiness(business.businessId, data, csrf(csrfToken)),
    onSuccess: () => { invalidateVenueManagerData(); setMessage("Venue profile saved."); },
    onError: (error) => setMessage(apiError(error)),
  });

  const removal = useMutation({
    mutationFn: (data: { reason: string }) => requestVenueManagerRemoval(business.businessId, data, csrf(csrfToken)),
    onSuccess: () => { setShowRemoval(false); setMessage("Your removal request has been received. Our team will follow up within 2–3 business days."); },
    onError: (error) => setMessage(apiError(error)),
  });

  if (detail.isLoading) return <SectionLoading />;

  function buildOpeningHours(): Record<string, VenueManagerOpeningHoursDay | null> {
    const result: Record<string, VenueManagerOpeningHoursDay | null> = {};
    for (const day of DAYS) {
      const h = hours[day];
      result[day] = h.closed ? null : { open: h.open, close: h.close };
    }
    return result;
  }

  return (
    <div className="vm-venue-profile">
      <section className="vm-panel vm-form-panel">
        <form className="vm-form two-col" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const websiteUrlValue = websiteUrl.trim();
          const urlErr = validateWebsiteUrl(websiteUrlValue);
          if (urlErr) { setWebsiteUrlError(urlErr); return; }
          setWebsiteUrlError("");
          update.mutate({
            businessName: form.get("businessName"),
            tagline: form.get("tagline") || null,
            description: form.get("description") || null,
            coverPhotoUrl: coverPhotoUrl || null,
            logoUrl: logoUrl || null,
            phone: form.get("phone") || null,
            websiteUrl: websiteUrlValue || null,
            publicEmail: form.get("publicEmail") || null,
            openingHours: buildOpeningHours(),
          });
        }}>
          {message && <div className={`vm-notice ${update.isSuccess || removal.isSuccess ? "success" : "error"} full`}>{message}</div>}

          <label>Public business name<input name="businessName" required defaultValue={venue.businessName} /></label>
          <label>Short tagline<input name="tagline" defaultValue={venue.tagline ?? ""} placeholder="The neighborhood's favorite…" /></label>
          <label className="full">About your venue<textarea name="description" defaultValue={venue.description ?? ""} rows={5} /></label>

          <div className="full vm-section-head"><h3><Building2 size={16} /> Media</h3></div>
          <ImageUploadField label="Logo" value={logoUrl} onChange={setLogoUrl} businessId={business.businessId} csrfToken={csrfToken} />
          <ImageUploadField label="Cover photo" value={coverPhotoUrl} onChange={setCoverPhotoUrl} businessId={business.businessId} csrfToken={csrfToken} />

          <div className="full vm-section-head"><h3><Phone size={16} /> Contact details</h3></div>
          <label><span className="vm-label-row"><Phone size={13} />Phone<span className="vm-optional">optional</span></span><input name="phone" type="tel" defaultValue={venue.phone ?? ""} placeholder="+1 555 000 0000" /></label>
          <label>
            <span className="vm-label-row"><Globe size={13} />Website<span className="vm-optional">optional</span></span>
            <input
              name="websiteUrl"
              type="text"
              value={websiteUrl}
              placeholder="https://yourvenue.com"
              onChange={(e) => { setWebsiteUrl(e.target.value); if (websiteUrlError) setWebsiteUrlError(""); }}
              onBlur={handleWebsiteUrlBlur}
            />
            {websiteUrlError && <span className="vm-image-error">{websiteUrlError}</span>}
          </label>
          <label className="full"><span className="vm-label-row"><Mail size={13} />Booking / contact email<span className="vm-optional">optional</span></span><input name="publicEmail" type="email" defaultValue={venue.publicEmail ?? ""} placeholder="bookings@yourvenue.com" /></label>

          <div className="full vm-section-head"><h3><Clock size={16} /> Opening hours</h3></div>
          <div className="full">
            <OpeningHoursEditor hours={hours} onChange={setHours} />
          </div>

          <div className="full vm-form-actions">
            <button className="vm-primary" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save venue profile"}</button>
          </div>
        </form>
      </section>

      <VenueQrCodePanel business={business} csrfToken={csrfToken} />

      {business.role === "owner" && (
        <section className="vm-panel vm-danger-zone">
          <div className="vm-danger-head"><AlertTriangle size={18} /><div><h3>Request listing removal</h3><p>Ask our team to remove this venue from the Met app. Your data and team accounts will remain until the request is processed.</p></div></div>
          <button className="vm-danger-btn" type="button" onClick={() => { setMessage(""); setShowRemoval(true); }}>Request removal</button>
        </section>
      )}

      {showRemoval && (
        <Modal title="Request venue removal" onClose={() => setShowRemoval(false)}>
          <form className="vm-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); removal.mutate({ reason: String(f.get("reason") ?? "").trim() }); }}>
            <p className="vm-subtitle" style={{ margin: "0 0 8px" }}>We'll review your request and reach out within 2–3 business days. Your listing stays live until removal is confirmed.</p>
            <label>Reason <span className="vm-optional">optional</span><textarea name="reason" rows={4} placeholder="e.g. venue permanently closed, sold the business…" /></label>
            <div className="vm-form-actions">
              <button type="button" className="vm-secondary" onClick={() => setShowRemoval(false)}>Cancel</button>
              <button className="vm-danger-btn" disabled={removal.isPending}>{removal.isPending ? "Submitting…" : "Submit removal request"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Events({ business, csrfToken }: { business: VenueManagerBusiness; csrfToken: string }) {
  const client = useQueryClient(); const events = useBusinessQuery<VenueManagerEventList>(getListVenueManagerEventsQueryOptions, business.businessId); const [editing, setEditing] = useState<VenueManagerEvent | "new" | null>(null); const [message, setMessage] = useState("");
  const save = useMutation({ mutationFn: ({ id, data }: { id?: number; data: VenueManagerEventInput | VenueManagerEventUpdate }) => id ? updateVenueManagerEvent(business.businessId, id, data as VenueManagerEventUpdate, csrf(csrfToken)) : createVenueManagerEvent(business.businessId, data as VenueManagerEventInput, csrf(csrfToken)), onSuccess: () => { invalidateVenueManagerData(); setEditing(null); }, onError: (error) => setMessage(apiError(error)) });
  const remove = useMutation({ mutationFn: (id: number) => deleteVenueManagerEvent(business.businessId, id, csrf(csrfToken)), onSuccess: () => invalidateVenueManagerData() });
  return <><div className="vm-toolbar"><span>{events.data?.events.length ?? 0} events</span><button className="vm-primary compact" onClick={() => { setMessage(""); setEditing("new"); }}><Plus size={16} />New event</button></div>{events.isLoading ? <SectionLoading /> : <div className="vm-stack">{(events.data?.events ?? []).map((event) => <article className="vm-item-card" key={event.id}><div className="vm-item-date">{new Date(event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div><div><span className={`vm-status ${event.isPublished ? "live" : ""}`}>{event.isPublished ? "Published" : "Draft"}</span><h2>{event.title}</h2><p>{event.description || "No description yet."}</p><small>{new Date(event.startsAt).toLocaleString()} · {event.rsvpCount ?? 0} RSVPs</small></div><div className="vm-item-actions"><button onClick={() => { setMessage(""); setEditing(event); }}>Edit</button><button className="danger-text" onClick={() => { if (confirm("Delete this event?")) remove.mutate(event.id); }}>Delete</button></div></article>)}{!(events.data?.events ?? []).length && <Empty text="There are no events yet. Make the first one." />}</div>}{editing && <EventModal event={editing === "new" ? undefined : editing} message={message} pending={save.isPending} onClose={() => setEditing(null)} onSubmit={(data) => save.mutate({ id: editing === "new" ? undefined : editing.id, data })} businessId={business.businessId} csrfToken={csrfToken} />}</>;
}

function EventModal({ event, message, pending, onClose, onSubmit, businessId, csrfToken }: { event?: VenueManagerEvent; message: string; pending: boolean; onClose: () => void; onSubmit: (data: VenueManagerEventInput | VenueManagerEventUpdate) => void; businessId: number; csrfToken: string }) {
  const [imageUrl, setImageUrl] = useState(event?.imageUrl ?? "");
  return (
    <Modal title={event ? "Edit event" : "New event"} onClose={onClose}>
      <form className="vm-form two-col" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        onSubmit({
          title: formText(f.get("title")),
          description: formText(f.get("description")) || null,
          startsAt: isoFromInput(f.get("startsAt")),
          endsAt: isoFromInput(f.get("endsAt")) || null,
          capacityLimit: f.get("capacityLimit") ? Number(f.get("capacityLimit")) : null,
          isPublished: f.get("isPublished") === "on",
          imageUrl: imageUrl || null,
        });
      }}>
        {message && <div className="vm-notice error full">{message}</div>}
        <label className="full">Name<input name="title" required defaultValue={event?.title} /></label>
        <label>Starts<input name="startsAt" type="datetime-local" required defaultValue={dateTimeInput(event?.startsAt)} /></label>
        <label>Ends<input name="endsAt" type="datetime-local" defaultValue={dateTimeInput(event?.endsAt)} /></label>
        <label>Capacity<input name="capacityLimit" type="number" min="1" defaultValue={event?.capacityLimit ?? ""} /></label>
        <label className="checkbox"><input name="isPublished" type="checkbox" defaultChecked={event?.isPublished ?? true} /> Publish this event</label>
        <label className="full">Description<textarea name="description" rows={4} defaultValue={event?.description ?? ""} /></label>
        <div className="full">
          <ImageUploadField label="Event image" value={imageUrl} onChange={setImageUrl} businessId={businessId} csrfToken={csrfToken} />
        </div>
        <div className="vm-form-actions full">
          <button type="button" className="vm-secondary" onClick={onClose}>Cancel</button>
          <button className="vm-primary" disabled={pending}>{pending ? "Saving…" : "Save event"}</button>
        </div>
      </form>
    </Modal>
  );
}

function Rewards({ business, csrfToken }: { business: VenueManagerBusiness; csrfToken: string }) {
  const client = useQueryClient(); const rewards = useBusinessQuery<VenueManagerRewardList>(getListVenueManagerRewardsQueryOptions, business.businessId); const [editing, setEditing] = useState<VenueManagerReward | "new" | null>(null); const [message, setMessage] = useState("");
  const save = useMutation({ mutationFn: ({ id, data }: { id?: number; data: VenueManagerRewardInput | VenueManagerRewardUpdate }) => id ? updateVenueManagerReward(business.businessId, id, data as VenueManagerRewardUpdate, csrf(csrfToken)) : createVenueManagerReward(business.businessId, data as VenueManagerRewardInput, csrf(csrfToken)), onSuccess: () => { invalidateVenueManagerData(); setEditing(null); }, onError: (e) => setMessage(apiError(e)) });
  return <><div className="vm-toolbar"><span>{rewards.data?.rewards.length ?? 0} campaigns</span><button className="vm-primary compact" onClick={() => { setMessage(""); setEditing("new"); }}><Plus size={16} />New reward</button></div>{rewards.isLoading ? <SectionLoading /> : <div className="vm-stack">{(rewards.data?.rewards ?? []).map((reward) => <article className="vm-item-card" key={reward.id}><div className="vm-item-icon"><Gift /></div><div><span className={`vm-status ${reward.status === "active" ? "live" : ""}`}>{reward.status}</span><h2>{reward.title}</h2><p>{reward.prizeDescription}</p><small>{new Date(reward.startDate).toLocaleDateString()} — {new Date(reward.endDate).toLocaleDateString()}</small></div><div className="vm-item-actions"><button onClick={() => { setMessage(""); setEditing(reward); }}>Edit</button></div></article>)}{!(rewards.data?.rewards ?? []).length && <Empty text="No campaigns yet. Make your regulars feel seen." />}</div>}{editing && <RewardModal reward={editing === "new" ? undefined : editing} message={message} pending={save.isPending} onClose={() => setEditing(null)} onSubmit={(data) => save.mutate({ id: editing === "new" ? undefined : editing.id, data })} />}</>;
}

function RewardModal({ reward, message, pending, onClose, onSubmit }: { reward?: VenueManagerReward; message: string; pending: boolean; onClose: () => void; onSubmit: (data: VenueManagerRewardInput | VenueManagerRewardUpdate) => void }) {
  return <Modal title={reward ? "Edit reward" : "New reward"} onClose={onClose}><form className="vm-form two-col" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSubmit({ title: formText(f.get("title")), prizeDescription: formText(f.get("prizeDescription")), description: formText(f.get("description")) || null, rewardType: formText(f.get("rewardType")) as VenueManagerRewardInput["rewardType"], status: formText(f.get("status")) as VenueManagerRewardInput["status"], startDate: isoFromInput(f.get("startDate"))!, endDate: isoFromInput(f.get("endDate"))!, venueTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone }); }}>{message && <div className="vm-notice error full">{message}</div>}<label className="full">Campaign name<input name="title" required defaultValue={reward?.title} /></label><label>Reward<input name="prizeDescription" required defaultValue={reward?.prizeDescription} placeholder="Free cocktail for a regular" /></label><label>Type<select name="rewardType" defaultValue={reward?.rewardType ?? "custom"}><option value="custom">Custom</option><option value="free_drink">Free drink</option><option value="discount">Discount</option><option value="experience">Experience</option></select></label><label>Starts<input name="startDate" type="datetime-local" required defaultValue={dateTimeInput(reward?.startDate)} /></label><label>Ends<input name="endDate" type="datetime-local" required defaultValue={dateTimeInput(reward?.endDate)} /></label><label>Status<select name="status" defaultValue={reward?.status === "cancelled" ? "cancelled" : reward?.status ?? "draft"}><option value="draft">Draft</option><option value="active">Active</option><option value="cancelled">Cancelled</option></select></label><label className="full">Details<textarea name="description" rows={3} defaultValue={reward?.description ?? ""} /></label><div className="vm-form-actions full"><button type="button" className="vm-secondary" onClick={onClose}>Cancel</button><button className="vm-primary" disabled={pending}>{pending ? "Saving…" : "Save reward"}</button></div></form></Modal>;
}

function Announcements({ business, csrfToken }: { business: VenueManagerBusiness; csrfToken: string }) {
  const client = useQueryClient(); const announcements = useBusinessQuery<VenueManagerAnnouncementList>(getListVenueManagerAnnouncementsQueryOptions, business.businessId); const [compose, setCompose] = useState(false); const [message, setMessage] = useState("");
  const create = useMutation({ mutationFn: (data: VenueManagerAnnouncementInput) => createVenueManagerAnnouncement(business.businessId, data, csrf(csrfToken)), onSuccess: () => { invalidateVenueManagerData(); setCompose(false); }, onError: (e) => setMessage(apiError(e)) });
  const remove = useMutation({ mutationFn: (id: number) => deleteVenueManagerAnnouncement(business.businessId, id, csrf(csrfToken)), onSuccess: () => invalidateVenueManagerData() });
  return <><div className="vm-toolbar"><span>Keep your community in the loop</span><button className="vm-primary compact" onClick={() => { setMessage(""); setCompose(true); }}><Plus size={16} />Post update</button></div>{announcements.isLoading ? <SectionLoading /> : <div className="vm-stack">{(announcements.data?.announcements ?? []).map((item) => <article className="vm-announcement" key={item.id}><div><span className={`vm-status ${item.isPinned ? "live" : ""}`}>{item.isPinned ? "Pinned" : new Date(item.createdAt).toLocaleDateString()}</span><h2>{item.title}</h2><p>{item.body}</p></div><button className="icon-button" aria-label="Delete announcement" onClick={() => { if (confirm("Delete this announcement?")) remove.mutate(item.id); }}><X size={17} /></button></article>)}{!(announcements.data?.announcements ?? []).length && <Empty text="Nothing announced yet. Your community is listening." />}</div>}{compose && <Modal title="Post an update" onClose={() => setCompose(false)}><form className="vm-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); create.mutate({ title: formText(f.get("title")), body: formText(f.get("body")), isPinned: f.get("isPinned") === "on" }); }}>{message && <div className="vm-notice error">{message}</div>}<label>Headline<input name="title" required /></label><label>What’s happening?<textarea name="body" rows={5} required /></label><label className="checkbox"><input type="checkbox" name="isPinned" /> Pin this update</label><div className="vm-form-actions"><button type="button" className="vm-secondary" onClick={() => setCompose(false)}>Cancel</button><button className="vm-primary" disabled={create.isPending}>{create.isPending ? "Posting…" : "Post update"}</button></div></form></Modal>}</>;
}

function Analytics({ business }: { business: VenueManagerBusiness }) {
  const dashboard = useBusinessQuery<VenueManagerDashboard>(getGetVenueManagerDashboardQueryOptions, business.businessId); if (dashboard.isLoading) return <SectionLoading />;
  const data = dashboard.data; const max = Math.max(1, ...(data?.checkInTrend ?? []).map((item) => item.count));
  return <div className="vm-grid analytics-grid"><section className="vm-panel wide"><div className="vm-panel-title"><div><h2>Check-in rhythm</h2><p>Last 30 days</p></div><strong>{(data?.checkInTrend ?? []).reduce((s, v) => s + v.count, 0)} total</strong></div><div className="vm-chart">{(data?.checkInTrend ?? []).map((item) => <div key={item.day} title={`${item.day}: ${item.count}`}><i style={{ height: `${Math.max(4, item.count / max * 100)}%` }} /><small>{new Date(item.day).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}</small></div>)}</div></section><section className="vm-panel"><div className="vm-panel-title"><h2>Event interest</h2><CalendarDays /></div>{(data?.eventRsvpCounts ?? []).map((item) => <div className="vm-list-row" key={item.eventId}><span className="vm-person">E</span><div><strong>{item.title}</strong><small>{item.going} going · {item.maybe} maybe</small></div></div>)}{!(data?.eventRsvpCounts ?? []).length && <Empty text="Published events will show RSVP interest here." />}</section></div>;
}

function Team({ business, csrfToken, onSession }: { business: VenueManagerBusiness; csrfToken: string; onSession: (session: Session) => void }) {
  const client = useQueryClient(); const members = useBusinessQuery<VenueManagerMemberList>(getListVenueManagerMembersQueryOptions, business.businessId); const [invite, setInvite] = useState(false); const [message, setMessage] = useState("");
  const add = useMutation({ mutationFn: (data: { email: string; role: "manager" | "editor" }) => createVenueManagerInvitation(business.businessId, data, csrf(csrfToken)), onSuccess: (result) => { setMessage(`Invitation code created: ${result.invitationToken}. Share it securely; it expires ${new Date(result.expiresAt).toLocaleString()}.`); invalidateVenueManagerData(); }, onError: (e) => setMessage(apiError(e)) });
  const role = useMutation({ mutationFn: ({ managerId, value }: { managerId: number; value: "manager" | "editor" }) => updateVenueManagerRole(business.businessId, managerId, { role: value }, csrf(csrfToken)), onSuccess: () => invalidateVenueManagerData() });
  const remove = useMutation({ mutationFn: (managerId: number) => removeVenueManager(business.businessId, managerId, csrf(csrfToken)), onSuccess: () => invalidateVenueManagerData() });
  const password = useMutation({ mutationFn: (data: { currentPassword: string; newPassword: string }) => changeVenueManagerPassword(data, csrf(csrfToken)), onSuccess: (next) => onSession(next as Session), onError: (e) => setMessage(apiError(e)) });
  return <div className="vm-team"><section><div className="vm-toolbar"><span>{members.data?.members.length ?? 0} active people</span><button className="vm-primary compact" onClick={() => { setMessage(""); setInvite(true); }}><Plus size={16} />Invite team member</button></div><div className="vm-stack">{(members.data?.members ?? []).map((member) => <article className="vm-member" key={member.managerId}><span className="vm-person">{member.displayName.slice(0, 1)}</span><div><strong>{member.displayName}</strong><small>{member.email}</small></div>{member.role === "owner" ? <span className="vm-status live">Owner</span> : <select value={member.role} onChange={(e) => role.mutate({ managerId: member.managerId, value: e.target.value as "manager" | "editor" })}><option value="manager">Manager</option><option value="editor">Editor</option></select>} {member.role !== "owner" && <button className="danger-text" onClick={() => { if (confirm(`Remove ${member.displayName}?`)) remove.mutate(member.managerId); }}>Remove</button>}</article>)}</div></section><section className="vm-panel vm-password"><Settings2 /><h2>Account security</h2><p>Change your business password. You’ll stay signed in here and other sessions will end.</p><form className="vm-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); password.mutate({ currentPassword: String(f.get("currentPassword")), newPassword: String(f.get("newPassword")) }); }}><label>Current password<input name="currentPassword" type="password" required /></label><label>New password<input name="newPassword" type="password" minLength={12} required /></label><button className="vm-secondary" disabled={password.isPending}>{password.isPending ? "Updating…" : "Change password"}</button></form></section>{invite && <Modal title="Invite a teammate" onClose={() => setInvite(false)}><form className="vm-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); add.mutate({ email: String(f.get("email")), role: f.get("role") as "manager" | "editor" }); }}><label>Email<input name="email" type="email" required /></label><label>Access level<select name="role"><option value="manager">Manager — profile, content, rewards, analytics</option><option value="editor">Editor — events and announcements</option></select></label>{message && <div className={`vm-notice ${add.isSuccess ? "success" : "error"}`}>{message}</div>}<div className="vm-form-actions"><button type="button" className="vm-secondary" onClick={() => setInvite(false)}>Close</button><button className="vm-primary" disabled={add.isPending}>{add.isPending ? "Creating…" : "Create invitation"}</button></div></form></Modal>}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="vm-modal-backdrop" role="presentation"><section className="vm-modal" role="dialog" aria-modal="true"><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></header>{children}</section></div>; }
function Empty({ text }: { text: string }) { return <div className="vm-empty">{text}</div>; }
function SectionLoading() { return <div className="vm-section-loading"><div className="vm-spinner" /></div>; }

function Routes() { return <Switch><Route path="/invite" component={InvitePage} /><Route path="/recover" component={RecoveryPage} /><Route path="/register" component={RegisterPage} /><Route path="/apply" component={ApplyPage} /><Route component={SessionBootstrap} /></Switch>; }
export default function App() { return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Routes /></WouterRouter></QueryClientProvider>; }