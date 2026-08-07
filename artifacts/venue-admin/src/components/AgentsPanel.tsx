import { useState, useEffect, useCallback } from "react";
import {
  Users, UserPlus, UserCheck, UserX, RefreshCw,
  Mail, Building2, MoreVertical, KeyRound, ShieldOff, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Agent {
  id: number;
  email: string;
  displayName: string;
  isActive: boolean;
  venueCount: number;
  createdAt: string;
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, { ...opts, credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw Object.assign(new Error(body.message ?? `HTTP ${res.status}`), { status: res.status });
  }
  return res.json();
}

export default function AgentsPanel() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTargetId, setResetTargetId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/venue-owner/agents") as { agents: Agent[] };
      setAgents(data.agents);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load agents." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadAgents(); }, [loadAgents]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch("/api/admin/venue-owner/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: createName, email: createEmail, password: createPassword }),
      });
      toast({ title: "Agent created", description: `${createName} can now sign in to the Sales Portal.` });
      setCreateOpen(false);
      setCreateName(""); setCreateEmail(""); setCreatePassword("");
      void loadAgents();
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: (err as Error).message });
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(agent: Agent) {
    try {
      await apiFetch(`/api/admin/venue-owner/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      toast({ title: agent.isActive ? "Agent deactivated" : "Agent reactivated", description: agent.displayName });
      void loadAgents();
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: (err as Error).message });
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTargetId) return;
    setResetting(true);
    try {
      await apiFetch(`/api/admin/venue-owner/agents/${resetTargetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      toast({ title: "Password reset", description: "New password saved. Old sessions signed out." });
      setResetOpen(false);
      setResetPassword("");
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: (err as Error).message });
    } finally {
      setResetting(false);
    }
  }

  const selectedAgent = agents.find(a => a.id === selectedAgentId) ?? null;

  return (
    <div className="flex h-full">
      {/* Agent list sidebar */}
      <div className="w-full md:w-[400px] flex-shrink-0 border-r border-border flex flex-col h-full">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-card/50 shrink-0">
          <span className="text-sm font-semibold text-foreground">Sales Agents ({agents.length})</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void loadAgents()} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreateOpen(true)}>
              <UserPlus className="w-3.5 h-3.5" />
              Add Agent
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 rounded-lg border border-border bg-card flex flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : agents.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-12 h-12 rounded-full bg-muted/50 border border-border flex items-center justify-center mx-auto mb-4">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold">No agents yet</h3>
                <p className="text-xs text-muted-foreground mt-1">Add your first sales agent to let them register venues.</p>
              </div>
            ) : (
              agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id === selectedAgentId ? null : agent.id)}
                  className={`w-full text-left transition-all duration-150 border rounded-lg p-3 group
                    ${selectedAgentId === agent.id
                      ? "bg-primary/[0.03] border-primary/40 ring-1 ring-primary/10"
                      : "bg-card border-border hover:border-primary/30 hover:bg-muted/30"
                    } ${!agent.isActive ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                        ${agent.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {agent.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{agent.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${agent.isActive ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500 bg-slate-50"}`}>
                        {agent.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{agent.venueCount} venue{agent.venueCount !== 1 ? "s" : ""}</span>
                    <span>Joined {format(new Date(agent.createdAt), "MMM d, yyyy")}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Agent detail */}
      <div className="flex-1 flex flex-col h-full bg-card overflow-auto">
        {!selectedAgent ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/10">
            <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6">
              <Users className="w-8 h-8 text-muted-foreground opacity-60" />
            </div>
            <h2 className="text-xl font-bold mb-2">Select an agent</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose a sales agent from the list to manage their account, reset their password, or view their venues.
            </p>
            <Button className="mt-6 gap-2" onClick={() => setCreateOpen(true)}>
              <UserPlus className="w-4 h-4" /> Add First Agent
            </Button>
          </div>
        ) : (
          <div className="p-8 max-w-2xl">
            {/* Agent header */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold
                  ${selectedAgent.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {selectedAgent.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedAgent.displayName}</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5" />{selectedAgent.email}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={`text-xs ${selectedAgent.isActive ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-200 text-slate-500 bg-slate-50"}`}>
                      {selectedAgent.isActive ? <><UserCheck className="w-3 h-3 mr-1" />Active</> : <><UserX className="w-3 h-3 mr-1" />Inactive</>}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Agent ID: {selectedAgent.id}</span>
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setResetTargetId(selectedAgent.id); setResetOpen(true); }}>
                    <KeyRound className="w-4 h-4 mr-2" />Reset Password
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => void toggleActive(selectedAgent)}
                    className={selectedAgent.isActive ? "text-destructive focus:text-destructive" : "text-emerald-700"}
                  >
                    {selectedAgent.isActive
                      ? <><ShieldOff className="w-4 h-4 mr-2" />Deactivate Agent</>
                      : <><ShieldCheck className="w-4 h-4 mr-2" />Reactivate Agent</>}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="border border-border rounded-xl p-4 bg-muted/20">
                <p className="text-2xl font-bold">{selectedAgent.venueCount}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Venues Registered</p>
              </div>
              <div className="border border-border rounded-xl p-4 bg-muted/20">
                <p className="text-sm font-semibold">Joined</p>
                <p className="text-muted-foreground text-sm mt-0.5">{format(new Date(selectedAgent.createdAt), "MMM d, yyyy")}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Actions</h3>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => { setResetTargetId(selectedAgent.id); setResetOpen(true); }}
              >
                <KeyRound className="w-4 h-4" />Reset Password
              </Button>
              <Button
                variant="outline"
                className={`w-full justify-start gap-2 ${selectedAgent.isActive ? "text-destructive border-destructive/30 hover:bg-destructive/5" : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"}`}
                onClick={() => void toggleActive(selectedAgent)}
              >
                {selectedAgent.isActive
                  ? <><ShieldOff className="w-4 h-4" />Deactivate Agent</>
                  : <><ShieldCheck className="w-4 h-4" />Reactivate Agent</>}
              </Button>
            </div>

            {!selectedAgent.isActive && (
              <p className="mt-6 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                ⚠️ This agent is deactivated and cannot sign in to the Sales Portal. Their registered venues remain in the system.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Create Agent Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />Create Sales Agent
            </DialogTitle>
            <DialogDescription>
              The agent will use their email and this password to sign in to the Sales Portal and register venues.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Full Name</Label>
                <Input id="create-name" placeholder="e.g. Sarah Johnson" value={createName} onChange={e => setCreateName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Work Email</Label>
                <Input id="create-email" type="email" placeholder="agent@example.com" value={createEmail} onChange={e => setCreateEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Initial Password</Label>
                <Input id="create-password" type="password" placeholder="Min. 8 characters" value={createPassword} onChange={e => setCreatePassword(e.target.value)} minLength={8} required />
                <p className="text-xs text-muted-foreground">Share this with the agent. They can't change it themselves.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
              <Button type="submit" disabled={creating || !createName || !createEmail || !createPassword}>
                {creating ? "Creating…" : "Create Agent"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4" />Reset Password</DialogTitle>
            <DialogDescription>Set a new password for this agent. Their current session will be signed out.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleResetPassword(e)}>
            <div className="py-4 space-y-2">
              <Label htmlFor="reset-password">New Password</Label>
              <Input id="reset-password" type="password" placeholder="Min. 8 characters" value={resetPassword} onChange={e => setResetPassword(e.target.value)} minLength={8} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>Cancel</Button>
              <Button type="submit" disabled={resetting || resetPassword.length < 8}>
                {resetting ? "Saving…" : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
