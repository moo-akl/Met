import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Route, Switch, Router as WouterRouter, useLocation, useParams } from "wouter";
import {
  createVenueManagerAnnouncement,
  createVenueManagerEvent,
  createVenueManagerInvitation,
  createVenueManagerReward,
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
  type VenueManagerRecentQrVerification,
} from "@workspace/api-client-react";
import QRCode from "react-qr-code";
import { AlertTriangle, BarChart3, Bell, Building2, CalendarDays, ChevronDown, CircleUserRound, Clock, Download, Gift, Globe, LayoutDashboard, LogOut, Mail, MapPin, Phone, Plus, QrCode, RefreshCw, Settings2, ShieldCheck, Trophy, Users, X } from "lucide-react";
import { normalizeVenuePlaceSearchResult, type PlaceResult, type VenuePlaceSearchItem } from "./lib/venuePlaceSearch";
import { applyWebsiteUrlBlur, validateWebsiteUrl } from "./lib/websiteUrl";
import { metAuthError, metChangePassword, metPasswordCreate, metPasswordSignIn, metRefreshVerification, metResetPassword, metSendVerification, metSignOut, metSocialSignIn } from "./lib/firebaseAuth";
import type { User } from "firebase/auth";
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
type Page = "overview" | "venue" | "events" | "rewards" | "announcements" | "analytics" | "team" | "guests";
const VENUE_MANAGER_TERMS_VERSION = "venue-2026-09";
const VENUE_MANAGER_TERMS_URL = "/venue-manager-terms";
const VENUE_MANAGER_PRIVACY_URL = "/venue-manager-privacy";

type VenueGuest = {
  rank: number;
  uid: string;
  displayName: string;
  photoUrl: string | null;
  bio: string | null;
  interests: string[];
  isPioneer: boolean;
  checkinCount: number;
  lastCheckinAt: string;
};
type ApiError = Error & { status?: number };

async function firebaseManagerRequest(path: string, data: Record<string, string>): Promise<Session> {
  const response = await fetch(`/api/venue-manager/${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { code?: string; message?: string };
    throw Object.assign(new Error(error.message ?? "We couldn't open your venue account."), { status: response.status, code: error.code });
  }
  return response.json() as Promise<Session>;
}

async function managerSession(path: string, user: User, extra: Record<string, string> = {}): Promise<Session> {
  return firebaseManagerRequest(path, { ...extra, idToken: await user.getIdToken() });
}

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
      // A first-time visitor has no session, so 401 is not evidence that a
      // previous session expired. Do not show an alarming error on fresh login.
      setStatus(response.status === 401 ? "unauthed" : "error");
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
  return <LoginPage sessionExpired={status === "expired"} onSignedIn={(next) => { queryClient.clear(); setSession(next); }} />;
}

function AuthFrame({ children, title, subtitle }: { children?: ReactNode; title: string; subtitle: string }) {
  return <Shell>
    <div className="vm-auth">
      <div className="vm-auth-brand"><div className="vm-mark">m</div><span>met <em>business</em></span></div>
      <main className="vm-auth-card"><p className="vm-eyebrow">VENUE MANAGER</p><h1>{title}</h1><p className="vm-subtitle">{subtitle}</p>{children}</main>
      <p className="vm-auth-foot">The operating space for the places people meet.</p>
      <div className="vm-auth-legal" style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 14, fontSize: 12 }}><a data-testid="link-venue-manager-terms" href={VENUE_MANAGER_TERMS_URL} target="_blank" rel="noreferrer" style={{ color: "#16745a" }}>Venue Manager Terms</a><a data-testid="link-venue-manager-privacy" href={VENUE_MANAGER_PRIVACY_URL} target="_blank" rel="noreferrer" style={{ color: "#16745a" }}>Privacy</a></div>
    </div>
  </Shell>;
}

function VerificationActions({ email, pending, onResend, onVerified }: { email: string; pending: boolean; onResend: () => void; onVerified: () => void }) {
  return <div className="vm-verification" role="group" aria-label="Verify your Met email">
    <strong>Check your email</strong>
    <p>Open the verification link sent to <b>{email}</b>. Return here after verifying to continue with the same Met account. Check your spam folder if it has not arrived.</p>
    <button data-testid="button-email-verified" type="button" className="vm-primary" disabled={pending} onClick={onVerified}>{pending ? "Checking…" : "I verified my email"}</button>
    <button data-testid="button-resend-verification" type="button" className="vm-auth-inline" disabled={pending} onClick={onResend}>Resend verification email</button>
  </div>;
}

function LoginPage({ sessionExpired = false, onSignedIn }: { sessionExpired?: boolean; onSignedIn?: (session: Session) => void }) {
  const [, navigate] = useLocation();
  const [message, setMessage] = useState(sessionExpired ? "Your session ended. Sign in to continue." : "");
  const [linkUser, setLinkUser] = useState<User | null>(null);
  const [verificationUser, setVerificationUser] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const beginVerification = async (user: User) => {
    setVerificationUser(user);
    setMessage("Verify your Met email before opening your venue account.");
    try { await metSendVerification(user); } catch (error) { setMessage(`Your email is not verified yet. ${metAuthError(error)} You can resend below.`); }
  };
  const finish = (session: Session) => { queryClient.clear(); onSignedIn?.(session); navigate("/"); };
  const exchange = async (user: User) => {
    try { finish(await managerSession("session/firebase", user)); }
    catch (error) {
      const e = error as ApiError & { code?: string };
      if (e.status === 409 && e.code === "link_required") {
        setLinkUser(user);
        setMessage("Your Met account is verified. Enter your old Venue Manager password once to connect your existing venue access.");
      } else if (e.status === 404) {
        setMessage("This Met account has no venue access yet. Use your registration code or accept an invitation below. We do not link accounts by email alone.");
      } else setMessage(metAuthError(error));
    }
  };
  const run = async (action: () => Promise<User>, newAccount = false) => {
    setPending(true); setMessage(""); setLinkUser(null); setVerificationUser(null);
    try {
      const user = await action();
      if (newAccount || (!user.emailVerified && !(await metRefreshVerification(user)))) await beginVerification(user);
      else await exchange(user);
    } catch (error) { setMessage(metAuthError(error)); }
    finally { setPending(false); }
  };
  return <AuthFrame title="Run the room." subtitle="Use the same Met account you use in the mobile app to manage your venue.">
    {message && <div className={`vm-notice ${linkUser || verificationUser ? "warning" : "error"}`} role="alert" data-testid="status-login">{message}</div>}
    {verificationUser ? <VerificationActions email={verificationUser.email ?? "your Met email"} pending={pending} onResend={() => {
      setPending(true); setMessage("");
      void metSendVerification(verificationUser).then(() => setMessage("A new verification link is on its way.")).catch((error: unknown) => setMessage(metAuthError(error))).finally(() => setPending(false));
    }} onVerified={() => {
      setPending(true); setMessage("");
      void metRefreshVerification(verificationUser).then(async (verified) => {
        if (!verified) { setMessage("Email is not verified yet. Open the link in your inbox, then try again."); return; }
        setVerificationUser(null);
        await exchange(verificationUser);
      }).catch((error: unknown) => setMessage(metAuthError(error))).finally(() => setPending(false));
    }} /> : linkUser ? <form className="vm-form" onSubmit={async (event) => {
      event.preventDefault(); const password = String(new FormData(event.currentTarget).get("legacyPassword") ?? "");
      setPending(true); setMessage("");
      try { finish(await managerSession("link/firebase", linkUser, { legacyPassword: password })); }
      catch (error) { setMessage(metAuthError(error)); }
      finally { setPending(false); }
    }}>
      <label>Old Venue Manager password<input data-testid="input-legacy-password" required name="legacyPassword" type="password" autoComplete="current-password" /></label>
      <button data-testid="button-link-account" className="vm-primary" disabled={pending}>{pending ? "Connecting…" : "Connect venue access"}</button>
      <button data-testid="button-cancel-link" type="button" className="vm-auth-inline" onClick={() => { setLinkUser(null); setMessage(""); void metSignOut().catch(() => {}); }}>Use a different account</button>
    </form> : <>
      {creating && <p className="vm-auth-hint">Already managed a venue here? Create a Met account with that email. Once verified, we’ll ask for your old Venue Manager password once to connect your venue. No invitation code needed.</p>}
      <form className="vm-form" onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        const email = String(form.get("email")).trim(); const password = String(form.get("password"));
        void run(() => creating ? metPasswordCreate(email, password) : metPasswordSignIn(email, password), creating);
      }}>
        <label>Met account email<input data-testid="input-login-email" required name="email" type="email" autoComplete="email" placeholder="you@yourvenue.com" /></label>
        <label>{creating ? "New Met password" : "Met password"}<input data-testid="input-login-password" required minLength={creating ? 6 : undefined} name="password" type="password" autoComplete={creating ? "new-password" : "current-password"} /></label>
        <button data-testid="button-login-email" className="vm-primary" disabled={pending}>{pending ? "Connecting…" : creating ? "Create Met account" : "Sign in with email"}</button>
      </form>
      <button data-testid="button-toggle-create-met" type="button" className="vm-auth-inline" style={{ marginTop: 14 }} disabled={pending} onClick={() => { setCreating(!creating); setMessage(""); }}>{creating ? "I already have a Met account" : "Existing venue owner? Create your Met account"}</button>
      <div className="vm-auth-divider">or continue with</div>
      <div className="vm-social-actions"><button data-testid="button-login-google" type="button" disabled={pending} onClick={() => void run(() => metSocialSignIn("google"))}>Google</button><button data-testid="button-login-apple" type="button" disabled={pending} onClick={() => void run(() => metSocialSignIn("apple"))}>Apple</button></div>
    </>}
    <div className="vm-auth-links"><button type="button" onClick={() => navigate("/recover")}>Use a recovery link</button><button type="button" onClick={() => navigate("/invite")}>Accept an invitation</button><button type="button" onClick={() => navigate("/register")}>Register as venue owner</button><button type="button" onClick={() => navigate("/claim")}>Claim an approved venue</button><button type="button" onClick={() => navigate("/apply")}>Apply to list your venue</button></div>
  </AuthFrame>;
}

function EnrollmentPage({ invitation }: { invitation: boolean }) {
  const [, navigate] = useLocation();
  const tokenFromUrl = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("token") ?? "";
  const [message, setMessage] = useState("");
  const [existing, setExisting] = useState(false);
  const [pending, setPending] = useState(false);
  const [verification, setVerification] = useState<{ user: User; token: string; displayName: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const complete = async (details: { user: User; token: string; displayName: string }) => {
    await managerSession(invitation ? "invitations/accept/firebase" : "register/firebase", details.user, {
      token: details.token, displayName: details.displayName, acceptedTermsVersion: VENUE_MANAGER_TERMS_VERSION,
    });
    queryClient.clear(); navigate("/");
  };
  const checkVerification = async () => {
    if (!verification) return;
    setPending(true); setMessage("");
    try {
      if (!(await metRefreshVerification(verification.user))) {
        setMessage("Email is not verified yet. Open the link in your inbox, then try again.");
        return;
      }
      await complete(verification);
    } catch (error) { setMessage(metAuthError(error)); }
    finally { setPending(false); }
  };
  const enroll = async (method: "password" | "google" | "apple") => {
    const formEl = formRef.current;
    if (!formEl) return;
    const requiredFields = ["token", "email", "displayName", "acceptedTermsVersion", ...(method === "password" ? ["password"] : [])];
    const invalid = requiredFields.map((name) => ({ name, field: formEl.elements.namedItem(name) as HTMLInputElement | null })).find(({ name, field }) => !field || (name === "password" && !field.value) || !field.checkValidity());
    if (invalid) { invalid.field?.reportValidity(); if (invalid.name === "password" && !invalid.field?.value) setMessage("Enter your Met password to continue."); return; }
    const form = new FormData(formEl);
    if (form.get("acceptedTermsVersion") !== VENUE_MANAGER_TERMS_VERSION) { setMessage("Please accept the Venue Manager Terms and Privacy notice to continue."); return; }
    const email = String(form.get("email")).trim();
    const password = String(form.get("password") ?? "");
    setPending(true); setMessage("");
    try {
      const user = method === "password"
        ? existing ? await metPasswordSignIn(email, password) : await metPasswordCreate(email, password)
        : await metSocialSignIn(method);
      if (!user.email || user.email.toLowerCase() !== email.toLowerCase()) {
        setMessage("The Met account email must match the email on this registration or invitation. Choose the matching account and try again.");
        return;
      }
      const details = { user, token: String(form.get("token")).trim(), displayName: String(form.get("displayName")).trim() };
      if ((method === "password" && !existing) || (!user.emailVerified && !(await metRefreshVerification(user)))) {
        setVerification(details);
        const passwordInput = formEl.elements.namedItem("password") as HTMLInputElement | null;
        if (passwordInput) passwordInput.value = "";
        setMessage("Verify your Met email to finish connecting this venue. Your registration details are saved on this page.");
        try { await metSendVerification(user); } catch (error) { setMessage(`Your email is not verified yet. ${metAuthError(error)} Use resend below.`); }
        return;
      }
      await complete(details);
    } catch (error) { setMessage(metAuthError(error)); }
    finally { setPending(false); }
  };
  return <AuthFrame title={invitation ? "Join your venue." : "Set up your venue account."} subtitle="Connect your venue access to the Met account you use in the mobile app.">
    {message && <div className={`vm-notice ${verification ? "warning" : "error"}`} role="alert" data-testid="status-enrollment">{message}</div>}
    {verification && <><VerificationActions email={verification.user.email ?? "your Met email"} pending={pending} onVerified={() => void checkVerification()} onResend={() => {
      setPending(true); setMessage("");
      void metSendVerification(verification.user).then(() => setMessage("A new verification link is on its way.")).catch((error: unknown) => setMessage(metAuthError(error))).finally(() => setPending(false));
    }} /><button data-testid="button-edit-enrollment" type="button" className="vm-auth-inline" onClick={() => { setVerification(null); setExisting(true); setMessage("Sign in to your existing Met account to update the code or details. Your account has already been created."); }}>Edit registration details</button></>}
    <form ref={formRef} className="vm-form" style={verification ? { display: "none" } : undefined} onSubmit={(event) => { event.preventDefault(); void enroll("password"); }}>
      <label>{invitation ? "Invitation code" : "Registration code"}<input data-testid="input-enrollment-token" required name="token" autoComplete="off" defaultValue={tokenFromUrl} /></label>
      <label>Invited email<input data-testid="input-enrollment-email" required name="email" type="email" autoComplete="email" placeholder="you@yourvenue.com" /></label>
      <label>Your name<input data-testid="input-enrollment-name" required name="displayName" autoComplete="name" /></label>
      <label>Met {existing ? "password" : "new password"} <span className="vm-optional">(email sign-in only)</span><input data-testid="input-enrollment-password" minLength={existing ? undefined : 6} name="password" type="password" autoComplete={existing ? "current-password" : "new-password"} /></label>
      <label className="checkbox" style={{ paddingTop: 0, alignItems: "flex-start", lineHeight: 1.5 }}><input data-testid={invitation ? "input-invite-terms-acceptance" : "input-owner-terms-acceptance"} required type="checkbox" name="acceptedTermsVersion" value={VENUE_MANAGER_TERMS_VERSION} style={{ width: 16, marginTop: 3, flexShrink: 0 }} /><span>I agree to the <a href={VENUE_MANAGER_TERMS_URL} target="_blank" rel="noreferrer">Venue Manager Terms</a> and acknowledge the <a href={VENUE_MANAGER_PRIVACY_URL} target="_blank" rel="noreferrer">Privacy notice</a> (version {VENUE_MANAGER_TERMS_VERSION}).</span></label>
      <button data-testid="button-enroll-email" className="vm-primary" disabled={pending}>{pending ? "Connecting…" : existing ? "Continue with Met account" : "Create Met account and continue"}</button>
    </form>
    {!verification && <><button data-testid="button-toggle-existing-met" type="button" className="vm-auth-inline" style={{ marginTop: 15 }} onClick={() => setExisting(!existing)}>{existing ? "Create a new Met account instead" : "I already have a Met account"}</button>
      <div className="vm-auth-divider">or use your Met account</div>
      <div className="vm-social-actions"><button data-testid="button-enroll-google" type="button" disabled={pending} onClick={() => void enroll("google")}>Google</button><button data-testid="button-enroll-apple" type="button" disabled={pending} onClick={() => void enroll("apple")}>Apple</button></div></>}
    <p className="vm-auth-hint">Email verification is required before venue access is granted. You may also need to finish Met mobile onboarding before all features are available.</p>
    <div className="vm-auth-links"><button type="button" onClick={() => navigate("/")}>Back to sign in</button></div>
  </AuthFrame>;
}
function InvitePage() { return <EnrollmentPage invitation />; }

function RecoveryPage() {
  const [, navigate] = useLocation();
  const [message, setMessage] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const recover = useMutation({
    mutationFn: (data: { token: string; newPassword: string }) => recoverVenueManagerPassword(data),
    onSuccess: () => { setSuccess(true); setMessage("Old Venue Manager password updated. Sign in to Met, then connect your venue access."); },
    onError: (error) => setMessage(apiError(error)),
  });
  return <AuthFrame title="Reset your password." subtitle={legacy ? "Use a recovery code for an account that has not been linked to Met yet." : "We'll send a reset link for your Met account password."}>
    {!legacy ? <form className="vm-form" onSubmit={async (event) => {
      event.preventDefault(); setPending(true); setMessage(""); setSuccess(false);
      try { await metResetPassword(String(new FormData(event.currentTarget).get("email")).trim()); setSuccess(true); setMessage("If this email has a Met password account, a reset link is on its way. Check your inbox."); }
      catch (error) { setMessage(metAuthError(error)); }
      finally { setPending(false); }
    }}>
      {message && <div className={`vm-notice ${success ? "success" : "error"}`} role="status">{message}</div>}
      <label>Met account email<input data-testid="input-reset-email" required name="email" type="email" autoComplete="email" /></label>
      <button data-testid="button-reset-met" className="vm-primary" disabled={pending}>{pending ? "Sending…" : "Send reset link"}</button>
    </form> : <form className="vm-form" onSubmit={(event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      recover.mutate({ token: String(form.get("token")).trim(), newPassword: String(form.get("password")) });
    }}>
      {message && <div className={`vm-notice ${success ? "success" : "error"}`}>{message}</div>}
      <label>Recovery code<input required name="token" autoComplete="off" /></label>
      <label>New password<input required minLength={12} name="password" type="password" autoComplete="new-password" /></label>
      <button className="vm-primary" disabled={recover.isPending}>{recover.isPending ? "Updating…" : "Update password"}</button>
    </form>}
    <div className="vm-auth-links"><button type="button" onClick={() => { setLegacy(!legacy); setMessage(""); setSuccess(false); }}>{legacy ? "Reset my Met password" : "I have an old Venue Manager recovery code"}</button><button type="button" onClick={() => navigate("/")}>Back to sign in</button></div>
  </AuthFrame>;
}

function RegisterPage() { return <EnrollmentPage invitation={false} />; }

function ClaimPage() {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [verificationUser, setVerificationUser] = useState<User | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const authenticate = async (action: () => Promise<User>) => {
    setPending(true); setMessage("");
    try {
      const signedIn = await action();
      if (!signedIn.emailVerified && !(await metRefreshVerification(signedIn))) {
        setVerificationUser(signedIn);
        setMessage("Verify your Met email before claiming your venue.");
        try { await metSendVerification(signedIn); } catch (error) { setMessage(`Your email is not verified yet. ${metAuthError(error)} Use resend below.`); }
      } else { setVerificationUser(null); setUser(signedIn); }
    } catch (error) { setMessage(metAuthError(error)); }
    finally { setPending(false); }
  };
  return <AuthFrame title="Claim your venue." subtitle="Approved Met venue owners can connect their business without a separate password.">
    {message && <div data-testid="status-claim" className={`vm-notice ${verificationUser ? "warning" : "error"}`} role="alert">{message}</div>}
    {verificationUser ? <VerificationActions email={verificationUser.email ?? "your Met email"} pending={pending} onResend={() => {
      setPending(true); setMessage("");
      void metSendVerification(verificationUser).then(() => setMessage("A new verification link is on its way.")).catch((error: unknown) => setMessage(metAuthError(error))).finally(() => setPending(false));
    }} onVerified={() => {
      setPending(true); setMessage("");
      void metRefreshVerification(verificationUser).then((verified) => {
        if (!verified) { setMessage("Email is not verified yet. Open the link in your inbox, then try again."); return; }
        setUser(verificationUser); setVerificationUser(null);
      }).catch((error: unknown) => setMessage(metAuthError(error))).finally(() => setPending(false));
    }} /> : !user ? <>
      <p className="vm-auth-hint">Sign in with the verified Met account that owns your approved venue. Claims are checked against your Met owner profile; matching email alone does not grant access.</p>
      <form className="vm-form" onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        void authenticate(() => metPasswordSignIn(String(form.get("email")).trim(), String(form.get("password"))));
      }}>
        <label>Met email<input data-testid="input-claim-login-email" required name="email" type="email" autoComplete="email" /></label>
        <label>Met password<input data-testid="input-claim-login-password" required name="password" type="password" autoComplete="current-password" /></label>
        <button data-testid="button-claim-login" className="vm-primary" disabled={pending}>{pending ? "Signing in…" : "Continue with Met"}</button>
      </form>
      <div className="vm-auth-divider">or continue with</div>
      <div className="vm-social-actions"><button data-testid="button-claim-google" type="button" disabled={pending} onClick={() => void authenticate(() => metSocialSignIn("google"))}>Google</button><button data-testid="button-claim-apple" type="button" disabled={pending} onClick={() => void authenticate(() => metSocialSignIn("apple"))}>Apple</button></div>
    </> : <form className="vm-form" onSubmit={async (event) => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      const email = String(form.get("email")).trim();
      if (!user.email || email.toLowerCase() !== user.email.toLowerCase()) { setMessage("Use the verified email on your signed-in Met account."); return; }
      if (form.get("acceptedTermsVersion") !== VENUE_MANAGER_TERMS_VERSION) { setMessage("Accept the Venue Manager Terms and Privacy notice to continue."); return; }
      setPending(true); setMessage("");
      try {
        const response = await fetch("/api/venue-manager/claim", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken(true)}` },
          body: JSON.stringify({ email, displayName: String(form.get("displayName")).trim(), acceptedTermsVersion: VENUE_MANAGER_TERMS_VERSION }),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({})) as { code?: string; message?: string };
          throw new Error(error.code === "link_required" ? "This email already has a Venue Manager account. Sign in and connect it with your old password instead of claiming by email." : error.message ?? "Unable to claim this venue. Please try again.");
        }
        await response.json() as Session;
        queryClient.clear(); navigate("/");
      } catch (error) { setMessage(metAuthError(error)); }
      finally { setPending(false); }
    }}>
      <p className="vm-auth-hint">Signed in as {user.email}. Only the current approved owner can claim this venue.</p>
      <label>Your name<input data-testid="input-claim-name" required maxLength={120} name="displayName" autoComplete="name" defaultValue={user.displayName ?? ""} /></label>
      <label>Met account email<input data-testid="input-claim-email" required name="email" type="email" autoComplete="email" defaultValue={user.email ?? ""} /></label>
      <label className="checkbox" style={{ paddingTop: 0, alignItems: "flex-start", lineHeight: 1.5 }}><input data-testid="input-claim-terms-acceptance" required type="checkbox" name="acceptedTermsVersion" value={VENUE_MANAGER_TERMS_VERSION} style={{ width: 16, marginTop: 3, flexShrink: 0 }} /><span>I agree to the <a href={VENUE_MANAGER_TERMS_URL} target="_blank" rel="noreferrer">Venue Manager Terms</a> and acknowledge the <a href={VENUE_MANAGER_PRIVACY_URL} target="_blank" rel="noreferrer">Privacy notice</a> (version {VENUE_MANAGER_TERMS_VERSION}).</span></label>
      <button data-testid="button-submit-claim" className="vm-primary" disabled={pending}>{pending ? "Claiming venue…" : "Claim my venue"}</button>
    </form>}
    <div className="vm-auth-links"><button data-testid="button-claim-signin" type="button" onClick={() => navigate("/login")}>Back to sign in</button><button data-testid="button-claim-apply" type="button" onClick={() => navigate("/apply")}>Apply to list a venue</button></div>
  </AuthFrame>;
}

function Tip({ children }: { children: string }) {
  return (
    <span className="vm-tip" role="tooltip" aria-label={children}>
      ?<span className="vm-tip-bubble">{children}</span>
    </span>
  );
}

type ApplyFormData = {
  contactEmail: string; contactName: string; place: PlaceResult | null;
  tagline: string; description: string; verificationDocUrl: string; registrationNotes: string;
};

function ApplyPage() {
  const [, navigate] = useLocation();
  const [applicationInviteToken] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.hash.slice(1)).get("invite") ?? "",
  );
  const isBranchApplication = typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("branch") === "1" &&
    !applicationInviteToken;
  const [branchAccountStatus, setBranchAccountStatus] = useState<"idle" | "loading" | "ready" | "unauthenticated" | "unlinked" | "error">(
    isBranchApplication ? "loading" : "idle",
  );
  const [branchAccountError, setBranchAccountError] = useState("");
  const [branchAccountRetry, setBranchAccountRetry] = useState(0);
  const [inviteStatus, setInviteStatus] = useState<"none" | "loading" | "valid" | "invalid">(
    applicationInviteToken ? "loading" : "none",
  );
  const [inviteDetails, setInviteDetails] = useState<{
    invitedEmail: string;
    businessName: string;
    expiresAt: string;
  } | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<ApplyFormData>({ contactEmail: "", contactName: "", place: null, tagline: "", description: "", verificationDocUrl: "", registrationNotes: "" });
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isBranchApplication) return;
    let cancelled = false;
    setBranchAccountStatus("loading");
    setBranchAccountError("");
    void fetch("/api/venue-manager/me/met-profile", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { message?: string };
          throw Object.assign(new Error(body.message ?? "Unable to verify your venue manager account."), {
            status: response.status,
          });
        }
        return response.json() as Promise<{
          email: string;
          firebaseAccountLinked?: boolean;
        }>;
      })
      .then((account) => {
        if (cancelled) return;
        if (account.firebaseAccountLinked !== true || !account.email) {
          setBranchAccountStatus("unlinked");
          setBranchAccountError(
            "Link this venue manager login to your verified Met account before submitting another venue.",
          );
          return;
        }
        setForm((current) => ({ ...current, contactEmail: account.email }));
        setBranchAccountStatus("ready");
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        const status = (requestError as { status?: number })?.status;
        setBranchAccountStatus(status === 401 ? "unauthenticated" : "error");
        setBranchAccountError(
          status === 401
            ? "Sign in to your Venue Manager account before registering another venue."
            : apiError(requestError),
        );
      });
    return () => { cancelled = true; };
  }, [isBranchApplication, branchAccountRetry]);

  useEffect(() => {
    if (!applicationInviteToken) return;
    let cancelled = false;
    setInviteStatus("loading");
    void fetch("/api/venue-owner/application-invites/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token: applicationInviteToken }),
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? "This invitation link is invalid, expired, or already used.");
      }
      return response.json() as Promise<{ invitedEmail: string; businessName: string; expiresAt: string }>;
    }).then((details) => {
      if (cancelled) return;
      setInviteDetails(details);
      setForm((current) => ({ ...current, contactEmail: details.invitedEmail }));
      setInviteStatus("valid");
    }).catch((error: unknown) => {
      if (cancelled) return;
      setError(error instanceof Error ? error.message : "Unable to verify this application invitation.");
      setInviteStatus("invalid");
    });
    return () => { cancelled = true; };
  }, [applicationInviteToken]);

  useEffect(() => {
    if (typeof search !== "string" || search.length < 2) { setResults([]); return; }
    const query = search;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/venue-owner/places-public/search?query=${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = await res.json() as { places: VenuePlaceSearchItem[] };
          setResults(json.places.map(normalizeVenuePlaceSearchResult));
        }
      } catch { /* ignore */ } finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const submit = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/venue-owner/apply", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ contactEmail: form.contactEmail, contactName: form.contactName, placeId: form.place!.placeId, placeName: form.place!.name, businessName: form.place!.name, lat: form.place!.lat, lng: form.place!.lng, tagline: form.tagline || null, description: form.description || null, verificationDocUrl: form.verificationDocUrl, registrationNotes: form.registrationNotes || null, ...(applicationInviteToken ? { applicationInviteToken } : {}) }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})) as { message?: string }; throw Object.assign(new Error(e.message ?? "Submission failed"), { status: res.status }); }
    },
    onSuccess: () => setSubmitted(true),
    onError: (e) => setError(apiError(e)),
  });

  if (inviteStatus === "loading") {
    return <AuthFrame title="Checking your invitation." subtitle="Please wait while we verify the application link." />;
  }
  if (isBranchApplication && branchAccountStatus === "loading") {
    return <AuthFrame title="Checking your Venue Manager account." subtitle="We’ll use its verified Met email for this separate venue application." />;
  }
  if (isBranchApplication && branchAccountStatus !== "ready") {
    return <AuthFrame
      title={branchAccountStatus === "unauthenticated" ? "Sign in to register another venue." : "Your account needs verification."}
      subtitle="A new venue is reviewed separately. Account access is only granted after approval and registration."
    >
      <div className="vm-notice error" role="alert">{branchAccountError}</div>
      <div className="vm-auth-links">
        <button type="button" onClick={() => navigate("/")}>Back to sign in</button>
        {branchAccountStatus === "error" && (
          <button type="button" onClick={() => setBranchAccountRetry((attempt) => attempt + 1)}>Try again</button>
        )}
      </div>
    </AuthFrame>;
  }
  if (inviteStatus === "invalid") {
    return <AuthFrame title="This invitation link can’t be used." subtitle="It may have expired or already been used. Ask the Met venues team for a new link.">
      <div className="vm-notice error" role="alert">{error}</div>
      <div className="vm-auth-links"><button type="button" onClick={() => navigate("/")}>Back to sign in</button></div>
    </AuthFrame>;
  }

  if (submitted) return (
    <AuthFrame title="Application received." subtitle="We review every application carefully — usually within a few business days.">
      <div className="vm-notice success">
        Your application for <strong>{form.place?.name}</strong> has been submitted. When approved, a registration link will be sent to <strong>{form.contactEmail}</strong>.
        {isBranchApplication && " This listing has its own review and venue data. Accept its registration link with the same verified Met account to add it to your venue switcher."}
      </div>
      <div className="vm-auth-links"><button type="button" onClick={() => navigate("/")}>{isBranchApplication ? "Return to your venues" : "Back to sign in"}</button></div>
    </AuthFrame>
  );

  const stepLabels = ["Your contact details", "Find your venue", "About your venue", "Proof of ownership", "Review & submit"];
  return (
    <AuthFrame title="List your venue on Met." subtitle={`Step ${step} of 5 — ${stepLabels[step - 1]}`}>
      {error && <div className="vm-notice error">{error}</div>}
      {isBranchApplication && <div className="vm-notice success">This will be a separate venue listing with its own approval. The registration link will be sent to your verified account email: <strong>{form.contactEmail}</strong>.</div>}
      {inviteDetails && <div className="vm-notice success">You’re invited to apply for <strong>{inviteDetails.businessName}</strong>. Select your venue below and submit it for Met’s review. This invitation does not approve the venue or grant account access.</div>}

      {step === 1 && (
        <form className="vm-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setForm(d => ({ ...d, contactEmail: String(f.get("email")).trim(), contactName: String(f.get("name")).trim() })); setError(""); setStep(2); }}>
          <label><span className="vm-label-row">Your name<Tip>Type your first and last name — e.g. "Sarah Johnson".</Tip></span><input required name="name" autoComplete="name" defaultValue={form.contactName} placeholder="Your full name" /></label>
          <label><span className="vm-label-row">Your email<Tip>Type the email address you check regularly. Your registration link will arrive here once we approve your application.</Tip></span><input required name="email" type="email" autoComplete="email" value={form.contactEmail} readOnly={Boolean(applicationInviteToken || isBranchApplication)} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} placeholder="you@yourvenue.com" /></label>
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
  const allowed: Page[] = business.role === "editor" ? ["overview", "events", "announcements", "analytics", "guests"] : business.role === "manager" ? ["overview", "venue", "events", "rewards", "announcements", "analytics", "guests"] : ["overview", "venue", "events", "rewards", "announcements", "analytics", "team", "guests"];
  const activePage = allowed.includes(page) ? page : "overview";
  return <Shell>
    <div className="vm-workspace">
      <aside className="vm-sidebar"><div className="vm-logo"><div className="vm-mark">m</div><span>met <em>business</em></span></div>
        <VenueChooser businesses={businesses} active={business} onChange={(id) => navigate(`/${id}/overview`)} />
        <button className="vm-add-venue" type="button" onClick={() => navigate("/apply?branch=1")}>Register another venue</button>
        <nav>{allowed.map((item) => <NavItem key={item} page={item} active={activePage === item} onClick={() => navigate(`/${business.businessId}/${item}`)} />)}</nav>
        <div className="vm-sidebar-bottom"><div className="vm-role"><ShieldCheck size={16} /><span>{business.role} access</span></div><LogoutButton session={session} onDone={() => { queryClient.clear(); onSessionChange(null); navigate("/"); }} /></div>
      </aside>
      <main className="vm-main"><header className="vm-mobile-head">
        <div className="vm-mobile-top">
          <div className="vm-logo"><div className="vm-mark">m</div><span>met <em>business</em></span></div>
          <span className="vm-mobile-role">{business.role} access</span>
        </div>
        <div className="vm-mobile-controls">
          {businesses.length > 1 && (
            <select
              aria-label="Switch venue"
              value={business.businessId}
              onChange={(event) => navigate(`/${Number(event.target.value)}/overview`)}
            >
              {businesses.map((item) => (
                <option key={item.businessId} value={item.businessId}>
                  {item.businessName} — {item.placeName} · {item.role}
                </option>
              ))}
            </select>
          )}
          <button className="vm-add-venue" type="button" onClick={() => navigate("/apply?branch=1")}>Register another venue</button>
        </div>
      </header>
        <PageContent page={activePage} business={business} csrfToken={session.csrfToken} />
      </main>
    </div>
  </Shell>;
}

function NavItem({ page, active, onClick }: { page: Page; active: boolean; onClick: () => void }) {
  const icons: Record<Page, ReactNode> = { overview: <LayoutDashboard />, venue: <Building2 />, events: <CalendarDays />, rewards: <Gift />, announcements: <Bell />, analytics: <BarChart3 />, team: <Users />, guests: <Trophy /> };
  const labels: Record<Page, string> = { overview: "Overview", venue: "Venue profile", events: "Events", rewards: "Rewards", announcements: "Announcements", analytics: "Analytics", team: "Team", guests: "Guests" };
  return <button className={`vm-nav ${active ? "active" : ""}`} onClick={onClick}>{icons[page]}<span>{labels[page]}</span></button>;
}

function VenueChooser({ businesses, active, onChange }: { businesses: VenueManagerBusiness[]; active: VenueManagerBusiness; onChange: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="vm-venue-picker">
    <button
      type="button"
      aria-label={`Switch venue. Current venue: ${active.businessName}`}
      aria-haspopup="true"
      aria-expanded={open}
      aria-controls="vm-venue-menu"
      onClick={() => setOpen(!open)}
    ><span className="vm-venue-avatar">{active.businessName.slice(0, 1)}</span><span><strong>{active.businessName}</strong><small>{active.placeName}</small></span><ChevronDown size={16} /></button>
    {open && <div className="vm-venue-menu" id="vm-venue-menu" aria-label="Choose a venue">{businesses.map((business) => <button type="button" key={business.businessId} aria-current={business.businessId === active.businessId ? "true" : undefined} onClick={() => { onChange(business.businessId); setOpen(false); }}><strong>{business.businessName}</strong><small>{business.placeName} · {business.role}</small></button>)}</div>}
  </div>;
}

function LogoutButton({ session, onDone }: { session: Session; onDone: () => void }) {
  const logout = useMutation({
    mutationFn: async () => {
      await deleteVenueManagerSession(csrf(session.csrfToken));
      await metSignOut().catch(() => {});
    },
    onSuccess: () => { queryClient.clear(); onDone(); },
  });
  return <><button data-testid="button-logout" className="vm-logout" onClick={() => logout.mutate()} disabled={logout.isPending}><LogOut size={16} />{logout.isPending ? "Signing out…" : "Sign out"}</button>{logout.isError && <small role="alert" style={{ color: "#f0c8bd", padding: 8 }}>Could not end this session. Please try again.</small>}</>;
}

function PageContent({ page, business, csrfToken }: { page: Page; business: VenueManagerBusiness; csrfToken: string }) {
  const labels: Record<Page, [string, string]> = {
    overview: ["Good to see you.", "The pulse of your place, right now."], venue: ["Your venue, your voice.", "Keep the public face of your place current."],
    events: ["Make a reason to gather.", "Create moments your community can RSVP to."], rewards: ["Reward the regulars.", "Set a little anticipation in motion."],
    announcements: ["Say what's happening.", "Share updates with people who know your place."], analytics: ["Read the room.", "Signals from your venue community."], team: ["Your people.", "Give the right access to the right hands."],
    guests: ["Your regulars.", "People who keep coming back. Reach out personally."],
  };
  return <div className="vm-page"><div className="vm-page-intro"><div><p className="vm-eyebrow">{business.placeName.toUpperCase()}</p><h1>{labels[page][0]}</h1><p>{labels[page][1]}</p></div><div className="vm-location"><MapPin size={16} />{business.placeName}</div></div>
    {page === "overview" && <Overview business={business} />}
    {page === "venue" && <VenueProfile business={business} csrfToken={csrfToken} />}
    {page === "events" && <Events business={business} csrfToken={csrfToken} />}
    {page === "rewards" && <Rewards business={business} csrfToken={csrfToken} />}
    {page === "announcements" && <Announcements business={business} csrfToken={csrfToken} />}
    {page === "analytics" && <Analytics business={business} />}
    {page === "team" && <Team business={business} csrfToken={csrfToken} />}
    {page === "guests" && <Guests business={business} csrfToken={csrfToken} />}
  </div>;
}

function useBusinessQuery<T>(factory: (id: number, options?: unknown) => unknown, businessId: number) {
  return useQuery<T>(factory(businessId, { request: { credentials: "include" } }) as never);
}

function formatVerifiedAt(iso: string): string {
  const now = Date.now();
  const ms = now - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function RecentQrVerificationsList({ items }: { items: VenueManagerRecentQrVerification[] }) {
  if (!items.length) return <Empty text="No QR scans yet today." />;
  return <>
    {items.map((item, i) => (
      <div className="vm-list-row" key={`${item.verifiedAt}-${i}`}>
        {item.photoUrl
          ? <span className="vm-person" style={{ backgroundImage: `url(${item.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          : <span className="vm-person">{item.displayName.slice(0, 1)}</span>}
        <div>
          <strong>{item.displayName}</strong>
          <small>{formatVerifiedAt(item.verifiedAt)}</small>
        </div>
      </div>
    ))}
  </>;
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
  const recentQr = dashboard.data?.recentQrVerifications ?? [];
  return <div className="vm-grid overview-grid"><section className="vm-panel vm-hero-panel"><span className="vm-hero-orb" /><p>COMMUNITY THIS MONTH</p><h2>{total}<small>check-ins</small></h2><div className="vm-spark">{trend.slice(-12).map((item) => <i key={item.day} style={{ height: `${Math.max(8, Math.min(100, item.count * 13))}%` }} />)}</div></section>
    <section className="vm-panel vm-qr-panel"><div className="vm-panel-title"><h2>QR Verifications</h2><QrCode size={18} /></div><p className="vm-stat-label">Today</p><p className="vm-stat-value">{qrToday}<small>verified guests</small></p><div className="vm-spark vm-spark-qr">{qrTrend.length ? qrTrend.map((b) => <i key={b.day} title={`${b.day}: ${b.count}`} style={{ height: `${Math.max(8, Math.round((b.count / qrMax) * 100))}%` }} />) : Array.from({ length: 7 }).map((_, i) => <i key={i} style={{ height: "8%" }} />)}</div><p className="vm-spark-label">7-day trend</p></section>
    <section className="vm-panel"><div className="vm-panel-title"><h2>Scanned Today</h2><ShieldCheck size={18} /></div><RecentQrVerificationsList items={recentQr} /></section>
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

function Team({ business, csrfToken }: { business: VenueManagerBusiness; csrfToken: string }) {
  const client = useQueryClient(); const members = useBusinessQuery<VenueManagerMemberList>(getListVenueManagerMembersQueryOptions, business.businessId); const [invite, setInvite] = useState(false); const [message, setMessage] = useState("");
  const add = useMutation({ mutationFn: (data: { email: string; role: "manager" | "editor" }) => createVenueManagerInvitation(business.businessId, data, csrf(csrfToken)), onSuccess: (result) => { setMessage(`Invitation code created: ${result.invitationToken}. Share it securely; it expires ${new Date(result.expiresAt).toLocaleString()}.`); invalidateVenueManagerData(); }, onError: (e) => setMessage(apiError(e)) });
  const role = useMutation({ mutationFn: ({ managerId, value }: { managerId: number; value: "manager" | "editor" }) => updateVenueManagerRole(business.businessId, managerId, { role: value }, csrf(csrfToken)), onSuccess: () => invalidateVenueManagerData() });
  const remove = useMutation({ mutationFn: (managerId: number) => removeVenueManager(business.businessId, managerId, csrf(csrfToken)), onSuccess: () => invalidateVenueManagerData() });
  const password = useMutation({ mutationFn: (data: { currentPassword: string; newPassword: string }) => metChangePassword(data.currentPassword, data.newPassword), onSuccess: () => setMessage("Met password updated."), onError: (e) => setMessage(metAuthError(e)) });
  return <div className="vm-team"><section><div className="vm-toolbar"><span>{members.data?.members.length ?? 0} active people</span><button className="vm-primary compact" onClick={() => { setMessage(""); setInvite(true); }}><Plus size={16} />Invite team member</button></div><div className="vm-stack">{(members.data?.members ?? []).map((member) => <article className="vm-member" key={member.managerId}><span className="vm-person">{member.displayName.slice(0, 1)}</span><div><strong>{member.displayName}</strong><small>{member.email}</small></div>{member.role === "owner" ? <span className="vm-status live">Owner</span> : <select value={member.role} onChange={(e) => role.mutate({ managerId: member.managerId, value: e.target.value as "manager" | "editor" })}><option value="manager">Manager</option><option value="editor">Editor</option></select>} {member.role !== "owner" && <button className="danger-text" onClick={() => { if (confirm(`Remove ${member.displayName}?`)) remove.mutate(member.managerId); }}>Remove</button>}</article>)}</div></section><section className="vm-panel vm-password"><Settings2 /><h2>Account security</h2><p>Your password belongs to your Met account. Sign in with email and password to change it here; social sign-in accounts manage passwords with their provider.</p>{message && !invite && <div className={`vm-notice ${password.isSuccess ? "success" : "error"}`} role="status">{message}</div>}<form className="vm-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); password.mutate({ currentPassword: String(f.get("currentPassword")), newPassword: String(f.get("newPassword")) }); }}><label>Current Met password<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>New Met password<input name="newPassword" type="password" autoComplete="new-password" minLength={6} required /></label><button className="vm-secondary" disabled={password.isPending}>{password.isPending ? "Updating…" : "Change Met password"}</button></form></section>{invite && <Modal title="Invite a teammate" onClose={() => setInvite(false)}><form className="vm-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); add.mutate({ email: String(f.get("email")), role: f.get("role") as "manager" | "editor" }); }}><label>Email<input name="email" type="email" required /></label><label>Access level<select name="role"><option value="manager">Manager — profile, content, rewards, analytics</option><option value="editor">Editor — events and announcements</option></select></label>{message && <div className={`vm-notice ${add.isSuccess ? "success" : "error"}`}>{message}</div>}<div className="vm-form-actions"><button type="button" className="vm-secondary" onClick={() => setInvite(false)}>Close</button><button className="vm-primary" disabled={add.isPending}>{add.isPending ? "Creating…" : "Create invitation"}</button></div></form></Modal>}</div>;
}

type GuestPeriod = "all" | "month" | "week";

function Guests({ business, csrfToken }: { business: VenueManagerBusiness; csrfToken: string }) {
  const [guests, setGuests] = useState<VenueGuest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [selected, setSelected] = useState<VenueGuest | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealMsg, setRevealMsg] = useState("");
  const [revealStatus, setRevealStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [revealErr, setRevealErr] = useState("");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);
  // Epoch increments every time the filter (business/period/search) changes.
  // loadMore captures the epoch at call-time and discards the response if it
  // no longer matches — preventing stale pages from appending to a new filter.
  const queryEpochRef = useRef(0);
  const loadMoreAbortRef = useRef<AbortController | null>(null);

  // Fetch the manager's existing outbound reveals on mount so the "Reveal sent"
  // and "Previously declined" badges survive navigation — the local state
  // resets on unmount, but the server knows which requests are already
  // pending, accepted, or declined.
  const sentQuery = useQuery<{ sentUids: string[]; declinedUids: string[] }>({
    queryKey: ["/api/venue-manager/businesses", business.businessId, "guests/reveals"],
    queryFn: async () => {
      const r = await fetch(`/api/venue-manager/businesses/${business.businessId}/guests/reveals`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load sent reveals.");
      return r.json() as Promise<{ sentUids: string[]; declinedUids: string[] }>;
    },
    staleTime: 30_000,
    retry: 1,
  });

  // Merge server-known UIDs into the local sets once the query resolves.
  // Uses a functional update so any UIDs added during this session are preserved.
  useEffect(() => {
    if (sentQuery.isSuccess) {
      if (sentQuery.data.sentUids.length > 0) {
        setSent((prev) => {
          const next = new Set(prev);
          for (const uid of sentQuery.data.sentUids) next.add(uid);
          return next;
        });
      }
      if ((sentQuery.data.declinedUids ?? []).length > 0) {
        setDeclined((prev) => {
          const next = new Set(prev);
          for (const uid of sentQuery.data.declinedUids) next.add(uid);
          return next;
        });
      }
    }
  }, [sentQuery.isSuccess, sentQuery.data]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [period, setPeriod] = useState<GuestPeriod>("all");

  // Check whether the current manager's email is linked to a Met account.
  // This is needed before they can send reveals — a 422 is the current failure
  // mode but we want to surface it prominently rather than waiting for a tap.
  const metProfile = useQuery<{ linked: boolean; email: string }>({
    queryKey: ["/api/venue-manager/me/met-profile"],
    queryFn: async () => {
      const r = await fetch("/api/venue-manager/me/met-profile", { credentials: "include" });
      // 503 = Firebase/transient error — throw so the query enters error state,
      // which the UI treats as "can't confirm" rather than "not linked".
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? "Unable to check Met account.");
      return r.json() as Promise<{ linked: boolean; email: string }>;
    },
    staleTime: 60_000,
    retry: 1,
  });

  // Three-valued link status:
  //  "loading"  — query in flight; block reveals until confirmed
  //  "unlinked" — Firebase confirmed user not found; show banner + disable
  //  "linked"   — Firebase confirmed user exists; full feature available
  //  "error"    — transient Firebase failure; allow reveals (server still enforces)
  const metLinkStatus: "loading" | "linked" | "unlinked" | "error" =
    metProfile.isPending
      ? "loading"
      : metProfile.isError
      ? "error"
      : metProfile.data.linked
      ? "linked"
      : "unlinked";

  const canSendReveal = metLinkStatus === "linked" || metLinkStatus === "error";
  const managerEmail = metProfile.data?.email ?? "";

  // If the reveal composer is already open and the linkage check comes back
  // unlinked, close it so the disabled state can't be bypassed by racing the load.
  useEffect(() => {
    if (metLinkStatus === "unlinked" && (revealOpen || selected !== null)) {
      setRevealOpen(false);
      setRevealMsg("");
      setRevealStatus("idle");
      setRevealErr("");
    }
  }, [metLinkStatus, revealOpen, selected]);

  // Debounce the search term so we don't fire a request on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    // Abort any in-flight loadMore from the previous filter so it can't
    // append stale results after this new page-1 response lands.
    loadMoreAbortRef.current?.abort();
    loadMoreAbortRef.current = null;
    setLoadingMore(false);
    // Increment the epoch so any concurrent loadMore that hasn't returned
    // yet knows its response is no longer valid.
    queryEpochRef.current += 1;

    setLoading(true); setLoadErr("");
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "100" });
    if (period !== "all") params.set("period", period);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    fetch(`/api/venue-manager/businesses/${business.businessId}/guests?${params.toString()}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? "Failed to load guests.");
        return r.json();
      })
      .then((data) => { setGuests(data.guests ?? []); setTotal(data.total ?? 0); })
      .catch((e: unknown) => { if ((e as { name?: string }).name !== "AbortError") setLoadErr((e as Error).message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [business.businessId, period, debouncedSearch]);

  async function loadMore() {
    if (loadingMore) return;
    // Snapshot the epoch and offset at call-time. If the filter changes while
    // the request is in flight, epoch will have been incremented and we discard.
    const epoch = queryEpochRef.current;
    const nextOffset = guests.length;
    const controller = new AbortController();
    loadMoreAbortRef.current = controller;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: "100", offset: String(nextOffset) });
      if (period !== "all") params.set("period", period);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const r = await fetch(
        `/api/venue-manager/businesses/${business.businessId}/guests?${params.toString()}`,
        { credentials: "include", signal: controller.signal },
      );
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { message?: string }).message ?? "Failed to load guests.");
      const data = (await r.json()) as { guests?: VenueGuest[]; total?: number };
      // Discard if the filter changed while this request was in flight.
      if (queryEpochRef.current !== epoch) return;
      setGuests((prev) => [...prev, ...(data.guests ?? [])]);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== "AbortError") setLoadErr((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }

  function openReveal(guest: VenueGuest) {
    setSelected(guest); setRevealOpen(true);
    setRevealMsg(""); setRevealStatus("idle"); setRevealErr("");
  }

  function closeDrawer() { setSelected(null); setRevealOpen(false); }

  async function sendReveal() {
    if (!selected) return;
    setRevealStatus("sending"); setRevealErr("");
    try {
      const r = await fetch(`/api/venue-manager/businesses/${business.businessId}/guests/${selected.uid}/reveal`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ message: revealMsg.trim() || null }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? "Failed to send reveal.");
      setRevealStatus("sent");
      setSent((prev) => new Set(prev).add(selected.uid));
      // Remove from declined if they were in that state — the new reveal is now pending.
      setDeclined((prev) => { const next = new Set(prev); next.delete(selected.uid); return next; });
    } catch (e) {
      setRevealStatus("error");
      setRevealErr((e as Error).message);
    }
  }

  function formatLast(iso: string) {
    const ms = Date.now() - new Date(iso).getTime();
    const d = Math.floor(ms / 86_400_000);
    if (d === 0) return "Today";
    if (d === 1) return "Yesterday";
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }

  if (loading) return <SectionLoading />;
  if (loadErr) return <div className="vm-notice error">{loadErr}</div>;

  return <>
    {metLinkStatus === "unlinked" && (
      <div className="vm-notice warning vm-met-link-banner">
        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
        <span>
          To send reveal requests, create a Met account using the same email
          (<strong>{managerEmail}</strong>). Once your Met account is active,
          reveal requests will be available automatically.
        </span>
      </div>
    )}
    <div className="vm-guests-controls">
      <input
        className="vm-guests-search"
        type="search"
        placeholder="Search by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search guests by name"
      />
      <div className="vm-guests-period">
        {(["all", "month", "week"] as GuestPeriod[]).map((p) => (
          <button
            key={p}
            type="button"
            className={`vm-period-btn${period === p ? " active" : ""}`}
            onClick={() => setPeriod(p)}
          >
            {p === "all" ? "All time" : p === "month" ? "This month" : "This week"}
          </button>
        ))}
      </div>
    </div>
    <div className="vm-guests-header">
      <span className="vm-guests-total">{total} {total === 1 ? "guest" : "guests"} checked in</span>
      <p className="vm-guests-hint">Tap a guest to view their profile and connect personally.</p>
    </div>
    {!guests.length && <Empty text={debouncedSearch.trim() ? "No guests match your search." : "No check-ins recorded yet at this venue."} />}
    <div className="vm-guests-list">
      {guests.map((g) => (
        <button key={g.uid} className="vm-guest-row" onClick={() => setSelected(g)}>
          <span className="vm-guest-rank">#{g.rank}</span>
          {g.photoUrl
            ? <span className="vm-guest-avatar" style={{ backgroundImage: `url(${g.photoUrl})` }} />
            : <span className="vm-guest-avatar initials">{g.displayName.slice(0, 1).toUpperCase()}</span>}
          <div className="vm-guest-info">
            <strong>{g.displayName}{g.isPioneer ? " ★" : ""}</strong>
            <small>Last seen {formatLast(g.lastCheckinAt)}</small>
          </div>
          <span className="vm-guest-badge">{g.checkinCount}×</span>
        </button>
      ))}
    </div>

    {guests.length > 0 && guests.length < total && (
      <div className="vm-load-more">
        <button className="vm-secondary" type="button" onClick={() => void loadMore()} disabled={loadingMore}>
          {loadingMore ? "Loading…" : `Load more · ${total - guests.length} remaining`}
        </button>
      </div>
    )}

    {selected && (
      <div className="vm-drawer-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeDrawer(); }}>
        <aside className="vm-drawer">
          <header className="vm-drawer-head">
            <button className="icon-button" onClick={closeDrawer} aria-label="Close"><X /></button>
          </header>
          <div className="vm-drawer-profile">
            {selected.photoUrl
              ? <div className="vm-drawer-avatar" style={{ backgroundImage: `url(${selected.photoUrl})` }} />
              : <div className="vm-drawer-avatar initials">{selected.displayName.slice(0, 1).toUpperCase()}</div>}
            <div>
              <h2>{selected.displayName}{selected.isPioneer ? <span className="vm-pioneer-badge"> ★ Pioneer</span> : null}</h2>
              <p className="vm-drawer-meta">{selected.checkinCount} check-in{selected.checkinCount !== 1 ? "s" : ""} · Last {formatLast(selected.lastCheckinAt)}</p>
            </div>
          </div>
          {selected.bio && <p className="vm-drawer-bio">{selected.bio}</p>}
          {selected.interests.length > 0 && (
            <div className="vm-drawer-tags">
              {selected.interests.map((tag) => <span key={tag} className="vm-tag">{tag}</span>)}
            </div>
          )}
          <div className="vm-drawer-actions">
            {sent.has(selected.uid)
              ? <div className="vm-notice success" style={{ margin: 0 }}>Reveal sent — they'll see it in their Met app.</div>
              : revealOpen
                ? <div className="vm-reveal-compose">
                    {declined.has(selected.uid) && (
                      <div className="vm-notice warning vm-reveal-retry-note" style={{ marginBottom: 8 }}>
                        This guest previously declined a reveal. Your new request will be sent if the cool-down period has passed.
                      </div>
                    )}
                    <label className="vm-reveal-label">Opening note <small>(optional · 240 chars max)</small></label>
                    <textarea
                      className="vm-reveal-textarea"
                      rows={3}
                      maxLength={240}
                      placeholder="Hey! I'm the manager here, always good to see you…"
                      value={revealMsg}
                      onChange={(e) => setRevealMsg(e.target.value)}
                    />
                    {revealStatus === "error" && <div className="vm-notice error" style={{ marginTop: 8 }}>{revealErr}</div>}
                    <div className="vm-reveal-actions">
                      <button className="vm-secondary" onClick={() => setRevealOpen(false)}>Cancel</button>
                      <button className="vm-primary" disabled={revealStatus === "sending"} onClick={sendReveal}>
                        {revealStatus === "sending" ? "Sending…" : "Send reveal"}
                      </button>
                    </div>
                  </div>
                : declined.has(selected.uid)
                  ? <div className="vm-reveal-declined-wrap">
                      <div className="vm-notice vm-notice-declined" style={{ margin: 0 }}>
                        Previously declined — this guest declined a past reveal request.
                      </div>
                      {canSendReveal && (
                        <button className="vm-secondary" style={{ marginTop: 8 }} onClick={() => openReveal(selected)}>
                          <CircleUserRound size={16} /> Send again
                        </button>
                      )}
                    </div>
                  : canSendReveal
                  ? <button className="vm-primary" onClick={() => openReveal(selected)}>
                      <CircleUserRound size={16} /> Send reveal request
                    </button>
                  : metLinkStatus === "loading"
                  ? <button className="vm-primary" disabled>
                      <CircleUserRound size={16} /> Send reveal request
                    </button>
                  : <span className="vm-reveal-disabled-wrap">
                      <button className="vm-primary" disabled>
                        <CircleUserRound size={16} /> Send reveal request
                      </button>
                      <small className="vm-reveal-disabled-hint">
                        Create a Met account with {managerEmail} to unlock this feature.
                      </small>
                    </span>}
          </div>
        </aside>
      </div>
    )}
  </>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="vm-modal-backdrop" role="presentation"><section className="vm-modal" role="dialog" aria-modal="true"><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></header>{children}</section></div>; }
function Empty({ text }: { text: string }) { return <div className="vm-empty">{text}</div>; }
function SectionLoading() { return <div className="vm-section-loading"><div className="vm-spinner" /></div>; }

function Routes() { return <Switch><Route path="/invite" component={InvitePage} /><Route path="/recover" component={RecoveryPage} /><Route path="/register" component={RegisterPage} /><Route path="/claim" component={ClaimPage} /><Route path="/apply" component={ApplyPage} /><Route component={SessionBootstrap} /></Switch>; }
export default function App() { return <QueryClientProvider client={queryClient}><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}><Routes /></WouterRouter></QueryClientProvider>; }