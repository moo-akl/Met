import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateVenueAdminSession, getGetVenueAdminSessionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, ArrowRight, LockKeyhole } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function isApiError(error: unknown): error is Error & { status: number } {
  return error instanceof Error && 'status' in error;
}

export default function Unlock() {
  const [secret, setSecret] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createSession = useCreateVenueAdminSession({
    mutation: {
      onSuccess: () => {
        toast({ title: "Authenticated", description: "Admin session established." });
        queryClient.invalidateQueries({ queryKey: getGetVenueAdminSessionQueryKey() });
        setLocation("/");
      },
      onError: (error: unknown) => {
        const message = isApiError(error) ? error.message : "Invalid access key.";
        toast({ 
          variant: "destructive", 
          title: "Access Denied", 
          description: message 
        });
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) return;
    createSession.mutate({ data: { secret } });
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4 font-sans">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-6 ring-1 ring-primary/20 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Venue Trust & Safety</h1>
          <p className="text-sm text-muted-foreground">
            Provide your access key to enter the review workspace.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground">
              <LockKeyhole className="w-4 h-4" />
            </div>
            <Input 
              type="password"
              placeholder="Admin Access Key" 
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoFocus
              autoComplete="current-password"
              data-testid="input-secret"
              className="pl-10 h-12 text-sm bg-card border-border/60 focus:border-primary transition-colors shadow-sm"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-12 text-sm font-semibold shadow-sm" 
            disabled={createSession.isPending || !secret.trim()}
            data-testid="button-unlock"
          >
            {createSession.isPending ? "Verifying..." : "Enter Workspace"}
            {!createSession.isPending && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-mono">
            Every action is permanently audited
          </p>
        </div>
      </div>
    </div>
  );
}
