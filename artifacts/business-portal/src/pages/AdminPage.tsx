import { useEffect, useState } from "react";
import { api, type AdminGroup } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  Building2,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import { format } from "date-fns";

type AdminResponse = { grouped: AdminGroup[]; total: number };
type SalesLinkResponse = { url: string; agentId: string };

function GroupCard({
  group,
  onGenerateLink,
}: {
  group: AdminGroup;
  onGenerateLink: (agentId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const agentId = group.salesAgentId ?? "(unassigned)";

  return (
    <Card className="bg-card border-card-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Agent:{" "}
              <span className={group.salesAgentId ? "text-primary" : "text-muted-foreground italic"}>
                {agentId}
              </span>
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {group.businesses.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {group.salesAgentId && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => onGenerateLink(group.salesAgentId!)}
              >
                <LinkIcon className="w-3 h-3" />
                Generate Link
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-2">
          {group.businesses.map((biz) => (
            <div
              key={biz.businessId}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border/50"
            >
              {biz.logoUrl ? (
                <img
                  src={biz.logoUrl}
                  alt={biz.name}
                  className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{biz.name}</span>
                  {biz.ownerDisplayName && (
                    <span className="text-xs text-muted-foreground">
                      by {biz.ownerDisplayName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground/60 font-mono truncate mt-0.5">
                  {biz.placeId}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Joined {format(new Date(biz.createdAt), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export default function AdminPage({ isAdmin }: { isAdmin?: boolean }) {
  const { user } = useAuth();
  const [data, setData] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [linkDialog, setLinkDialog] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .get<AdminResponse>("/api/admin/businesses")
      .then(setData)
      .catch((err: Error) => {
        if (err.message.includes("403") || err.message.includes("Forbidden")) {
          setError("You don't have admin access. Contact the team to be added to the admin list.");
        } else {
          setError(err.message ?? "Failed to load admin data");
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const openLinkDialog = (prefilledAgent = "") => {
    setAgentId(prefilledAgent);
    setGeneratedLink("");
    setLinkError("");
    setLinkDialog(true);
  };

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId.trim()) return;
    setLinkError("");
    setGenerating(true);
    try {
      const res = await api.post<SalesLinkResponse>("/api/admin/generate-sales-link", {
        agentId: agentId.trim(),
      });
      setGeneratedLink(res.url);
    } catch (err: unknown) {
      setLinkError((err as Error)?.message ?? "Failed to generate link");
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Layout isAdmin={isAdmin}>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Overview of all registered businesses grouped by sales agent.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => openLinkDialog()}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Generate Sales Link
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card className="bg-card border-card-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Businesses</p>
                  <p className="text-2xl font-bold text-foreground">{data.total}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-card-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Sales Agents</p>
                  <p className="text-2xl font-bold text-foreground">
                    {data.grouped.filter((g) => g.salesAgentId).length}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card border-card-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Unassigned</p>
                  <p className="text-2xl font-bold text-foreground">
                    {data.grouped.find((g) => !g.salesAgentId)?.businesses.length ?? 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Groups */}
            <div className="space-y-4">
              {data.grouped
                .sort((a, b) => {
                  if (!a.salesAgentId) return 1;
                  if (!b.salesAgentId) return -1;
                  return a.salesAgentId.localeCompare(b.salesAgentId);
                })
                .map((group) => (
                  <GroupCard
                    key={group.salesAgentId ?? "__unassigned__"}
                    group={group}
                    onGenerateLink={(id) => openLinkDialog(id)}
                  />
                ))}

              {data.grouped.length === 0 && (
                <Card className="bg-card border-card-border border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <Building2 className="w-8 h-8 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No businesses registered yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>

      {/* Generate Sales Link Dialog */}
      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent className="bg-card border-card-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Sales Link</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGenerateLink} className="space-y-4 py-2">
            {linkError && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4" />
                {linkError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="agentId">Agent ID *</Label>
              <Input
                id="agentId"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="e.g. agent_alice"
                className="bg-input border-input"
                maxLength={64}
                required
              />
              <p className="text-xs text-muted-foreground">
                This ID will be embedded in the registration link.
              </p>
            </div>

            {generatedLink && (
              <div className="space-y-1.5">
                <Label>Generated Link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={generatedLink}
                    readOnly
                    className="bg-muted border-border text-xs font-mono text-muted-foreground flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={copyLink}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkDialog(false)}>
                Close
              </Button>
              <Button type="submit" disabled={generating || !agentId.trim()}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Generate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
