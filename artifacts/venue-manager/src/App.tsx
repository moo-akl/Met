import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
  getListVenueManagerAnnouncementsQueryOptions,
  getListVenueManagerBusinessesQueryOptions,
  getListVenueManagerEventsQueryOptions,
  getListVenueManagerMembersQueryOptions,
  getListVenueManagerRewardsQueryOptions,
  recoverVenueManagerPassword,
  removeVenueManager,
  updateVenueManagerBusiness,
  updateVenueManagerEvent,
  updateVenueManagerReward,
  updateVenueManagerRole,
  type VenueManagerBusiness,
  type VenueManagerDashboard,
  type VenueManagerEvent,
  type VenueManagerEventList,
  type VenueManagerEventInput,
  type VenueManagerEventUpdate,
  type VenueManagerAnnouncementList,
  type VenueManagerAnnouncementInput,
  type VenueManagerMemberList,
  type VenueManagerReward,
  type VenueManagerRewardList,
  type VenueManagerRewardInput,
  type VenueManagerRewardUpdate,
} from "@workspace/api-client-react";
import { BarChart3, Bell, Building2, CalendarDays, ChevronDown, CircleUserRound, Gift, LayoutDashboard, LogOut, MapPin, Plus, Settings2, ShieldCheck, Users, X } from "lucide-react";
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
    <div className="vm-auth-links"><button type="button" onClick={() => navigate("/recover")}>Use a recovery link</button><button type="button" onClick={() => navigate("/invite")}>Accept an invitation</button></div>
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
  return <div className="vm-grid overview-grid"><section className="vm-panel vm-hero-panel"><span className="vm-hero-orb" /><p>COMMUNITY THIS MONTH</p><h2>{total}<small>check-ins</small></h2><div className="vm-spark">{trend.slice(-12).map((item) => <i key={item.day} style={{ height: `${Math.max(8, Math.min(100, item.count * 13))}%` }} />)}</div></section>
    <section className="vm-panel"><div className="vm-panel-title"><h2>Coming up</h2><CalendarDays /></div>{(events.data?.events ?? []).slice(0, 3).map((event) => <div className="vm-list-row" key={event.id}><span className="vm-date">{new Date(event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><div><strong>{event.title}</strong><small>{event.rsvpCount ?? 0} RSVPs</small></div></div>)}{!(events.data?.events ?? []).length && <Empty text="No events yet. Start the next good night." />}</section>
    <section className="vm-panel"><div className="vm-panel-title"><h2>Regulars</h2><CircleUserRound /></div>{(dashboard.data?.topVisitors ?? []).map((visitor) => <div className="vm-list-row" key={visitor.userUid}><span className="vm-person">{visitor.displayName.slice(0, 1)}</span><div><strong>{visitor.displayName}</strong><small>{visitor.checkinCount} visits this month</small></div></div>)}{!(dashboard.data?.topVisitors ?? []).length && <Empty text="Visitor insights will appear after check-ins." />}</section>
    <section className="vm-panel vm-reward-callout"><Gift size={23} /><div><strong>{dashboard.data?.activeReward ? "A reward is live" : "Keep regulars close"}</strong><p>{dashboard.data?.activeReward ? "Your current campaign is bringing people back." : "Create a reward for the people who make your place feel alive."}</p></div></section>
  </div>;
}

function VenueProfile({ business, csrfToken }: { business: VenueManagerBusiness; csrfToken: string }) {
  const client = useQueryClient(); const detail = useBusinessQuery<VenueManagerBusiness>(getGetVenueManagerBusinessQueryOptions, business.businessId); const [message, setMessage] = useState("");
  const update = useMutation({ mutationFn: (data: object) => updateVenueManagerBusiness(business.businessId, data, csrf(csrfToken)), onSuccess: () => { invalidateVenueManagerData(); setMessage("Venue profile saved."); }, onError: (error) => setMessage(apiError(error)) });
  if (detail.isLoading) return <SectionLoading />;
  const venue = detail.data ?? business;
  return <section className="vm-panel vm-form-panel"><form className="vm-form two-col" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); update.mutate({ businessName: form.get("businessName"), tagline: form.get("tagline") || null, description: form.get("description") || null, coverPhotoUrl: form.get("coverPhotoUrl") || null, logoUrl: form.get("logoUrl") || null }); }}>
    {message && <div className={`vm-notice ${update.isSuccess ? "success" : "error"} full`}>{message}</div>}<label>Public business name<input name="businessName" required defaultValue={venue.businessName} /></label><label>Short promise<input name="tagline" defaultValue={venue.tagline ?? ""} placeholder="The neighborhood's favorite…" /></label><label className="full">About your venue<textarea name="description" defaultValue={venue.description ?? ""} rows={5} /></label><label>Logo URL<input name="logoUrl" type="url" defaultValue={venue.logoUrl ?? ""} /></label><label>Cover image URL<input name="coverPhotoUrl" type="url" defaultValue={venue.coverPhotoUrl ?? ""} /></label><div className="full vm-form-actions"><button className="vm-primary" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save venue profile"}</button></div>
  </form></section>;
}

function Events({ business, csrfToken }: { business: VenueManagerBusiness; csrfToken: string }) {
  const client = useQueryClient(); const events = useBusinessQuery<VenueManagerEventList>(getListVenueManagerEventsQueryOptions, business.businessId); const [editing, setEditing] = useState<VenueManagerEvent | "new" | null>(null); const [message, setMessage] = useState("");
  const save = useMutation({ mutationFn: ({ id, data }: { id?: number; data: VenueManagerEventInput | VenueManagerEventUpdate }) => id ? updateVenueManagerEvent(business.businessId, id, data as VenueManagerEventUpdate, csrf(csrfToken)) : createVenueManagerEvent(business.businessId, data as VenueManagerEventInput, csrf(csrfToken)), onSuccess: () => { invalidateVenueManagerData(); setEditing(null); }, onError: (error) => setMessage(apiError(error)) });
  const remove = useMutation({ mutationFn: (id: number) => deleteVenueManagerEvent(business.businessId, id, csrf(csrfToken)), onSuccess: () => invalidateVenueManagerData() });
  return <><div className="vm-toolbar"><span>{events.data?.events.length ?? 0} events</span><button className="vm-primary compact" onClick={() => { setMessage(""); setEditing("new"); }}><Plus size={16} />New event</button></div>{events.isLoading ? <SectionLoading /> : <div className="vm-stack">{(events.data?.events ?? []).map((event) => <article className="vm-item-card" key={event.id}><div className="vm-item-date">{new Date(event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div><div><span className={`vm-status ${event.isPublished ? "live" : ""}`}>{event.isPublished ? "Published" : "Draft"}</span><h2>{event.title}</h2><p>{event.description || "No description yet."}</p><small>{new Date(event.startsAt).toLocaleString()} · {event.rsvpCount ?? 0} RSVPs</small></div><div className="vm-item-actions"><button onClick={() => { setMessage(""); setEditing(event); }}>Edit</button><button className="danger-text" onClick={() => { if (confirm("Delete this event?")) remove.mutate(event.id); }}>Delete</button></div></article>)}{!(events.data?.events ?? []).length && <Empty text="There are no events yet. Make the first one." />}</div>}{editing && <EventModal event={editing === "new" ? undefined : editing} message={message} pending={save.isPending} onClose={() => setEditing(null)} onSubmit={(data) => save.mutate({ id: editing === "new" ? undefined : editing.id, data })} />}</>;
}

function EventModal({ event, message, pending, onClose, onSubmit }: { event?: VenueManagerEvent; message: string; pending: boolean; onClose: () => void; onSubmit: (data: VenueManagerEventInput | VenueManagerEventUpdate) => void }) {
  return <Modal title={event ? "Edit event" : "New event"} onClose={onClose}><form className="vm-form two-col" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSubmit({ title: formText(f.get("title")), description: formText(f.get("description")) || null, startsAt: isoFromInput(f.get("startsAt")), endsAt: isoFromInput(f.get("endsAt")) || null, capacityLimit: f.get("capacityLimit") ? Number(f.get("capacityLimit")) : null, isPublished: f.get("isPublished") === "on" }); }}>{message && <div className="vm-notice error full">{message}</div>}<label className="full">Name<input name="title" required defaultValue={event?.title} /></label><label>Starts<input name="startsAt" type="datetime-local" required defaultValue={dateTimeInput(event?.startsAt)} /></label><label>Ends<input name="endsAt" type="datetime-local" defaultValue={dateTimeInput(event?.endsAt)} /></label><label>Capacity<input name="capacityLimit" type="number" min="1" defaultValue={event?.capacityLimit ?? ""} /></label><label className="checkbox"><input name="isPublished" type="checkbox" defaultChecked={event?.isPublished ?? true} /> Publish this event</label><label className="full">Description<textarea name="description" rows={4} defaultValue={event?.description ?? ""} /></label><div className="vm-form-actions full"><button type="button" className="vm-secondary" onClick={onClose}>Cancel</button><button className="vm-primary" disabled={pending}>{pending ? "Saving…" : "Save event"}</button></div></form></Modal>;
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

function Routes() { return <Switch><Route path="/invite" component={InvitePage} /><Route path="/recover" component={RecoveryPage} /><Route component={SessionBootstrap} /></Switch>; }
export default function App() { return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Routes /></WouterRouter></QueryClientProvider>; }