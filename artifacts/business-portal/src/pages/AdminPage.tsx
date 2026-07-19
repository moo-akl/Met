import { useEffect, useState } from "react";
import { api, type AdminGroup, type AdminBusiness } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Search,
  CheckCircle2,
  XCircle,
  Users,
  Zap,
} from "lucide-react";
import { format } from "date-fns";

type AdminResponse = { grouped: AdminGroup[]; total: number };
type SalesLinkResponse = { url: string; agentId: string };

function SubscriptionCell({ biz }: { biz: AdminBusiness }) {
  if (biz.isActiveSubscription) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-xs whitespace-nowrap">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Active
        </Badge>
        {biz.subscriptionEndDate && (
          <span className="text-xs text-muted-foreground hidden xl:inline">
            until {format(new Date(biz.subscriptionEndDate), "MMM d, yyyy")}
          </span>
        )}
      </div>
    );
  }
  return (
    <Badge variant="outline" className="border-muted text-muted-foreground text-xs whitespace-nowrap">
      <XCircle className="w-3 h-3 mr-1" />
      Free
    </Badge>
  );
}

export default function AdminPage({ isAdmin }: { isAdmin?: boolean }) {
  const { user } = useAuth();
  const [data, setData] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

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
          setError("You don't have admin access.");
        } else {
          setError(err.message ?? "Failed to load admin data");
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const allBusinesses: AdminBusiness[] = (data?.grouped ?? []).flatMap((g) => g.businesses);
  const filtered = agentFilter
    ? allBusinesses.filter(
        (b) =>
          (b.salesAgentId ?? "").toLowerCase().includes(agentFilter.toLowerCase())
      )
    : allBusinesses;

  const groupedFiltered: AdminGroup[] = agentFilter
    ? [{ salesAgentId: agentFilter || null, businesses: filtered }]
    : (data?.grouped ?? []).sort((a, b) => {
        if (!a.salesAgentId) return 1;
        if (!b.salesAgentId) return -1;
        return a.salesAgentId.localeCompare(b.salesAgentId);
      });

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
      <div className="space-y-6 max-w-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            </div>
            <p className="text-muted-foreground text-sm">
              All registered businesses, grouped by sales agent.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => openLinkDialog()}>
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
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Businesses", value: data.total },
                { label: "Active Subscriptions", value: allBusinesses.filter((b) => b.isActiveSubscription).length },
                { label: "Sales Agents", value: data.grouped.filter((g) => g.salesAgentId).length },
                { label: "Unassigned", value: data.grouped.find((g) => !g.salesAgentId)?.businesses.length ?? 0 },
              ].map((s) => (
                <Card key={s.label} className="bg-card border-card-border">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                    <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filter */}
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                placeholder="Filter by agent ID…"
                className="bg-input border-input pl-9"
              />
            </div>

            {/* Table(s) grouped by agent */}
            {groupedFiltered.length === 0 ? (
              <Card className="bg-card border-card-border border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Building2 className="w-8 h-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No businesses match this filter</p>
                </CardContent>
              </Card>
            ) : (
              groupedFiltered.map((group) => {
                const groupBizs = agentFilter
                  ? group.businesses
                  : group.businesses;
                if (groupBizs.length === 0) return null;
                return (
                  <Card key={group.salesAgentId ?? "__none__"} className="bg-card border-card-border overflow-hidden">
                    <CardHeader className="pb-2 border-b border-border">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          <CardTitle className="text-sm font-semibold">
                            Agent:{" "}
                            <span className={group.salesAgentId ? "text-primary font-mono" : "text-muted-foreground italic"}>
                              {group.salesAgentId ?? "(unassigned)"}
                            </span>
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs">{groupBizs.length}</Badge>
                        </div>
                        {group.salesAgentId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-7"
                            onClick={() => openLinkDialog(group.salesAgentId!)}
                          >
                            <Zap className="w-3 h-3" />
                            New Link
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs text-muted-foreground">
                            <th className="text-left px-4 py-2.5 font-medium">Business</th>
                            <th className="text-left px-4 py-2.5 font-medium">Owner</th>
                            <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Hub (Place ID)</th>
                            <th className="text-left px-4 py-2.5 font-medium">Subscription</th>
                            <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">End Date</th>
                            <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Joined</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {groupBizs.map((biz) => (
                            <tr key={biz.businessId} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {biz.logoUrl ? (
                                    <img src={biz.logoUrl} alt={biz.name} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                                  ) : (
                                    <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                                      <Building2 className="w-3.5 h-3.5 text-primary" />
                                    </div>
                                  )}
                                  <span className="font-medium text-foreground truncate max-w-[120px]">{biz.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="min-w-0">
                                  {biz.ownerDisplayName && (
                                    <p className="text-xs font-medium text-foreground truncate max-w-[140px]">{biz.ownerDisplayName}</p>
                                  )}
                                  {biz.ownerEmail && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[140px]">{biz.ownerEmail}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="text-xs font-mono text-muted-foreground/70 truncate max-w-[140px] block">{biz.placeId}</span>
                              </td>
                              <td className="px-4 py-3">
                                <SubscriptionCell biz={biz} />
                              </td>
                              <td className="px-4 py-3 hidden lg:table-cell">
                                <span className="text-xs text-muted-foreground">
                                  {biz.subscriptionEndDate
                                    ? format(new Date(biz.subscriptionEndDate), "MMM d, yyyy")
                                    : "—"}
                                </span>
                              </td>
                              <td className="px-4 py-3 hidden sm:table-cell">
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(biz.createdAt), "MMM d, yyyy")}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                );
              })
            )}
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
                The agent ID is embedded in the registration link as <code className="text-primary">?agent=</code>.
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
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={copyLink}>
                    {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkDialog(false)}>Close</Button>
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
