import { useState } from "react";
import { ShieldCheck, Eye, EyeOff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AgentUnlockProps {
  onAuthenticated: (agent: { id: number; email: string; displayName: string }) => void;
}

export default function AgentUnlock({ onAuthenticated }: AgentUnlockProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/agent/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json() as { agent?: { id: number; email: string; displayName: string }; message?: string };
      if (!res.ok) {
        setError(data.message ?? "Sign-in failed. Check your credentials.");
        return;
      }
      if (data.agent) onAuthenticated(data.agent);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center ring-1 ring-primary/20 mb-4">
            <Users className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Met Sales Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in with your agent credentials</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Agent Sign In</CardTitle>
            <CardDescription className="text-xs">
              Contact your admin if you need access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={isLoading || !email || !password}>
                {isLoading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Secured · Met Sales Portal
        </p>
      </div>
    </div>
  );
}
