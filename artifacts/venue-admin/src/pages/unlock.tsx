import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateVenueAdminSession, getGetVenueAdminSessionQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Unlock() {
  const [secret, setSecret] = useState("");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createSession = useCreateVenueAdminSession({
    mutation: {
      onSuccess: () => {
        toast({ title: "Unlocked", description: "Admin session authenticated." });
        queryClient.invalidateQueries({ queryKey: getGetVenueAdminSessionQueryKey() });
        setLocation("/");
      },
      onError: (error: any) => {
        toast({ 
          variant: "destructive", 
          title: "Access Denied", 
          description: error.message || "Invalid credentials. Please try again." 
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
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="space-y-3 text-center pb-6">
          <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Venue Admin</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Enter your credentials to unlock the operational workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input 
                type="password"
                placeholder="Enter access key" 
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoFocus
                autoComplete="current-password"
                data-testid="input-secret"
                className="text-center font-mono tracking-widest h-12"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-sm font-medium" 
              disabled={createSession.isPending || !secret.trim()}
              data-testid="button-unlock"
            >
              {createSession.isPending ? "Unlocking..." : "Unlock Workspace"}
            </Button>
            
            <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground">
              <ShieldAlert className="w-4 h-4" />
              <span>Authorized personnel only.</span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
