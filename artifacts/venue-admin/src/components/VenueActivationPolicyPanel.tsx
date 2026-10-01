import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Bell, CheckCircle2, Clock3, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Activation = {
  firstInvitationSentAt: string | null;
  registrationDeadline: string | null;
  registeredAt: string | null;
  qrDeadline: string | null;
  qrVerifiedCheckins: number;
  reminder5SentAt: string | null;
  reminder10SentAt: string | null;
  reminder5AttemptedAt: string | null;
  reminder10AttemptedAt: string | null;
  unlistedAt: string | null;
  removalReason: string | null;
  exempt: boolean;
};

function dateTime(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string; message?: string };
    return body.error || body.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export default function VenueActivationPolicyPanel({ profileId }: { profileId: number }) {
  const [activation, setActivation] = useState<Activation | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");
  const [reinstateReason, setReinstateReason] = useState("");

  const loadActivation = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/venue-owner/applications/${profileId}/activation`, {
        credentials: "include",
        signal,
      });
      if (!response.ok) throw new Error(await responseError(response));
      const body = await response.json() as { activation: Activation };
      setActivation(body.activation);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Could not load activation policy.");
      setActivation(null);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    const controller = new AbortController();
    setActivation(null);
    void loadActivation(controller.signal);
    return () => controller.abort();
  }, [loadActivation]);

  const mutate = async (path: string, body?: Record<string, unknown>) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/venue-owner/applications/${profileId}/activation${path}`, {
        method: "POST",
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error(await responseError(response));
      const result = await response.json() as { activation: Activation };
      setActivation(result.activation);
      await loadActivation();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Activation policy update failed.");
      return false;
    } finally {
      setPending(false);
    }
  };

  if (loading && !activation) {
    return <Card><CardContent className="p-5 text-sm text-muted-foreground">Loading activation policy…</CardContent></Card>;
  }
  // Activation controls are intended only for venues with an owner invitation.
  if (!activation?.firstInvitationSentAt && !activation?.registeredAt && !error) return null;

  const status = !activation
    ? "Unavailable"
    : activation.exempt
      ? "Exempt from activation deadlines"
      : activation.unlistedAt
        ? "Unlisted"
        : activation.registeredAt
          ? "Owner registered — QR activation in progress"
          : "Awaiting owner registration";

  return (
    <Card className="shadow-sm border-primary/20">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock3 className="h-4 w-4" /> Owner activation policy
        </CardTitle>
        <CardDescription>Track invitation, registration, and venue check-in activation deadlines.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        {error && (
          <div role="alert" data-testid="status-activation-error" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}
          </div>
        )}
        {activation && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Current state</p>
                <p data-testid="status-activation-state" className="font-medium">{status}</p>
              </div>
              <Button type="button" size="sm" variant="outline" data-testid="button-refresh-activation" disabled={loading || pending} onClick={() => void loadActivation()}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
              </Button>
            </div>
            {activation.unlistedAt && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-medium">Unlisted {dateTime(activation.unlistedAt)}</p>
                {activation.removalReason && <p className="mt-1 text-xs">Reason: {activation.removalReason}</p>}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Invitation sent</p>
                <p data-testid="text-activation-invitation" className="mt-1 text-sm font-medium">{dateTime(activation.firstInvitationSentAt)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Registration progress</p>
                <p data-testid="text-activation-registration" className="mt-1 text-sm font-medium">
                  {activation.registeredAt ? `Registered ${dateTime(activation.registeredAt)}` : `Deadline ${dateTime(activation.registrationDeadline)}`}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">QR activation progress</p>
                <p data-testid="text-activation-checkins" className="mt-1 text-sm font-medium">
                  {activation.qrVerifiedCheckins} verified {activation.qrVerifiedCheckins === 1 ? "check-in" : "check-ins"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Deadline {dateTime(activation.qrDeadline)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Reminder history</p>
                <p data-testid="text-activation-reminders" className="mt-1 text-xs">5-day: {activation.reminder5SentAt ? `Sent ${dateTime(activation.reminder5SentAt)}` : activation.reminder5AttemptedAt ? `Attempted ${dateTime(activation.reminder5AttemptedAt)} — delivery unconfirmed` : "Not attempted"}</p>
                <p className="mt-1 text-xs">10-day: {activation.reminder10SentAt ? `Sent ${dateTime(activation.reminder10SentAt)}` : activation.reminder10AttemptedAt ? `Attempted ${dateTime(activation.reminder10AttemptedAt)} — delivery unconfirmed` : "Not attempted"}</p>
              </div>
            </div>
            <section className="space-y-2 rounded-md border p-3" aria-labelledby="activation-reminder-heading">
              <h3 id="activation-reminder-heading" className="flex items-center gap-2 text-sm font-medium"><Bell className="h-4 w-4" />Manual reminder</h3>
              <p className="text-xs text-muted-foreground">Preview: “Your venue is ready to activate. Complete account registration and encourage guests to check in using your venue QR code before the deadlines shown above.”</p>
              <Button type="button" size="sm" variant="outline" data-testid="button-send-activation-reminder" disabled={pending || Boolean(activation.unlistedAt) || Boolean(activation.registeredAt) || !activation.registrationDeadline || new Date(activation.registrationDeadline).getTime() <= Date.now()} onClick={() => void mutate("/reminder")}>
                <Bell className="mr-1.5 h-3.5 w-3.5" />{pending ? "Sending…" : "Send reminder now"}
              </Button>
            </section>
            <section className="space-y-3 rounded-md border p-3" aria-labelledby="activation-exception-heading">
              <h3 id="activation-exception-heading" className="flex items-center gap-2 text-sm font-medium"><ShieldAlert className="h-4 w-4" />Deadline exception</h3>
              <div className="flex items-center gap-2">
                <input
                  id={`activation-exempt-${profileId}`}
                  data-testid="input-activation-exempt"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={activation.exempt}
                  disabled={pending}
                  onChange={(event) => {
                    const exempt = event.target.checked;
                    if (!exceptionReason.trim()) {
                      setError("Enter a reason before changing the deadline exception.");
                      return;
                    }
                    void mutate("/exception", { exempt, reason: exceptionReason.trim() });
                  }}
                />
                <Label htmlFor={`activation-exempt-${profileId}`}>Exempt this venue from activation deadlines</Label>
              </div>
              <Textarea data-testid="input-activation-exception-reason" aria-label="Deadline exception reason" placeholder="Reason for this exception" value={exceptionReason} onChange={(event) => setExceptionReason(event.target.value)} disabled={pending} />
            </section>
            {activation.unlistedAt && (
              <section className="space-y-2 rounded-md border border-amber-300 p-3 dark:border-amber-800" aria-labelledby="activation-reinstate-heading">
                <h3 id="activation-reinstate-heading" className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4" />Reinstate listing</h3>
                <Label htmlFor={`activation-reinstate-${profileId}`} className="text-xs text-muted-foreground">Reason for reinstatement</Label>
                <Input id={`activation-reinstate-${profileId}`} data-testid="input-activation-reinstate-reason" value={reinstateReason} onChange={(event) => setReinstateReason(event.target.value)} placeholder="Enter a reason" disabled={pending} />
                <Button type="button" size="sm" disabled={pending || !reinstateReason.trim()} onClick={async () => {
                  if (await mutate("/reinstate", { reason: reinstateReason.trim() })) setReinstateReason("");
                }} data-testid="button-reinstate-venue">{pending ? "Reinstating…" : "Reinstate venue"}</Button>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}