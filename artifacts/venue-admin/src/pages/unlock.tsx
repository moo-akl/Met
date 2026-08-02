import { useState } from "react";
import { useLocation } from "wouter";
import {
  getGetVenueAdminSessionQueryKey,
  getGetVenueAdminSetupStateQueryKey,
  useCreateVenueAdminSession,
  useGetVenueAdminSetupState,
  useRecoverVenueAdminPassword,
  useSetupVenueAdminPassword,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ArrowRight, LockKeyhole, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function isApiError(error: unknown): error is Error & { status: number } {
  return error instanceof Error && 'status' in error;
}

export default function Unlock() {
  const [password, setPassword] = useState("");
  const [bootstrapCode, setBootstrapCode] = useState("");
  const [mode, setMode] = useState<"sign-in" | "setup" | "recover">("sign-in");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: setupState, isLoading: isLoadingSetup, isError: setupStateError } = useGetVenueAdminSetupState({
    query: { queryKey: getGetVenueAdminSetupStateQueryKey(), retry: false },
  });

  const createSession = useCreateVenueAdminSession({
    mutation: {
      onSuccess: () => {
        toast({ title: "Authenticated", description: "Admin session established." });
        queryClient.invalidateQueries({ queryKey: getGetVenueAdminSessionQueryKey() });
        setLocation("/");
      },
      onError: (error: unknown) => {
        const message = isApiError(error) ? error.message : "Unable to sign in.";
        if (isApiError(error) && error.status === 428) setMode("setup");
        toast({ 
          variant: "destructive", 
          title: "Sign-in failed", 
          description: message 
        });
      }
    }
  });

  const setupPassword = useSetupVenueAdminPassword({
    mutation: {
      onSuccess: () => {
        toast({ title: "Password set", description: "Venue Admin is ready to use." });
        queryClient.invalidateQueries({ queryKey: getGetVenueAdminSessionQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetVenueAdminSetupStateQueryKey() });
        setLocation("/");
      },
      onError: (error: unknown) => toast({
        variant: "destructive",
        title: "Setup failed",
        description: isApiError(error) ? error.message : "Unable to set the password.",
      }),
    },
  });

  const recoverPassword = useRecoverVenueAdminPassword({
    mutation: {
      onSuccess: () => {
        setPassword("");
        setBootstrapCode("");
        setMode("sign-in");
        toast({ title: "Password reset", description: "Sign in with your new password." });
      },
      onError: (error: unknown) => toast({
        variant: "destructive",
        title: "Recovery failed",
        description: isApiError(error) ? error.message : "Unable to reset the password.",
      }),
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    if (mode === "setup") {
      setupPassword.mutate({ data: { bootstrapCode, password } });
    } else if (mode === "recover") {
      recoverPassword.mutate({ data: { bootstrapCode, newPassword: password } });
    } else {
      createSession.mutate({ data: { password } });
    }
  };
  const isPending = createSession.isPending || setupPassword.isPending || recoverPassword.isPending;
  const requiresBootstrap = mode !== "sign-in";
  const title = mode === "setup" ? "Set up Venue Admin" : mode === "recover" ? "Recover your password" : "Venue Trust & Safety";
  const subtitle = mode === "setup"
    ? "Create the private password. You need the deployment bootstrap code once."
    : mode === "recover"
      ? "Use the deployment recovery code to replace the password and sign out existing sessions."
      : "Sign in with the password managed by your administrator.";

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4 font-sans">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6 ring-1 ring-primary/20 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {subtitle}
          </p>
        </div>

        {isLoadingSetup ? (
          <p className="text-center text-sm text-muted-foreground">Checking secure access…</p>
        ) : setupStateError || !setupState?.serverConfigured ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Venue Admin is not configured on the server. Add the required server session and bootstrap secrets, then reload this page.
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {setupState.setupRequired && mode === "sign-in" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-foreground">
              First-time setup is required. <button type="button" onClick={() => setMode("setup")} className="font-semibold underline">Set the password</button>
            </div>
          )}
          {requiresBootstrap && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
                <KeyRound className="w-4 h-4" />
              </div>
              <Input
                type="password"
                placeholder={mode === "setup" ? "Deployment bootstrap code" : "Deployment recovery code"}
                value={bootstrapCode}
                onChange={(e) => setBootstrapCode(e.target.value)}
                autoComplete="off"
                className="pl-10 h-12 text-sm bg-card border-border/60"
              />
            </div>
          )}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
              <LockKeyhole className="w-4 h-4" />
            </div>
            <Input 
              type="password"
              placeholder={mode === "sign-in" ? "Admin password" : "New password (12+ characters)"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              data-testid="input-password"
              className="pl-10 h-12 text-sm bg-card border-border/60 focus:border-primary transition-colors shadow-sm"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-12 text-sm font-semibold shadow-sm" 
            disabled={isPending || !password.trim() || (requiresBootstrap && !bootstrapCode.trim())}
            data-testid="button-unlock"
          >
            {isPending ? "Verifying..." : mode === "setup" ? "Set Password" : mode === "recover" ? "Reset Password" : "Enter Workspace"}
            {!isPending && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </form>
        )}

        <div className="text-center">
          {!setupState?.setupRequired && mode === "sign-in" && (
            <button type="button" onClick={() => setMode("recover")} className="mb-4 text-xs font-medium text-primary underline">
              Forgot your password?
            </button>
          )}
          {mode !== "sign-in" && (
            <button type="button" onClick={() => setMode("sign-in")} className="mb-4 text-xs font-medium text-primary underline">
              Back to sign in
            </button>
          )}
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-mono">
            Passwords are never stored in this browser
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            This workspace is available at the published Venue Admin link. Keep the deployment bootstrap code in server secrets only.
          </p>
        </div>
      </div>
    </div>
  );
}
