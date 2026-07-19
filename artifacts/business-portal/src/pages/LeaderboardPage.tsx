import { useEffect, useState } from "react";
import { api, type BusinessProfile, type LeaderboardEntry } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Download, Loader2, AlertCircle, Medal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";

type MyBusinessesResponse = { businesses: BusinessProfile[] };

const MEDAL_COLORS = ["text-yellow-400", "text-slate-400", "text-amber-600"];

function exportCSV(entries: LeaderboardEntry[], businessName: string, period: string) {
  const header = "Rank,Display Name,UID,Check-ins,Trophy\n";
  const rows = entries
    .map((e) => `${e.rank},"${e.displayName}",${e.uid},${e.checkinCount},${(e as LeaderboardEntry & { hasTrophy?: boolean }).hasTrophy ? "Yes" : "No"}`)
    .join("\n");
  const csv = header + rows;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${businessName.replace(/\s+/g, "_")}_leaderboard_${period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LeaderboardPage({ isAdmin }: { isAdmin?: boolean }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [selected, setSelected] = useState<BusinessProfile | null>(null);
  const [entries, setEntries] = useState<(LeaderboardEntry & { hasTrophy?: boolean })[]>([]);
  const [period, setPeriod] = useState<"all_time" | "current_month">("all_time");
  const [loading, setLoading] = useState(true);
  const [lbLoading, setLbLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api
      .get<MyBusinessesResponse>("/api/business/mine")
      .then((res) => {
        const biz = res.businesses ?? [];
        setBusinesses(biz);
        if (biz.length > 0) setSelected(biz[0]!);
      })
      .catch(() => setError("Failed to load businesses"))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!selected) return;
    setLbLoading(true);
    setError("");
    api
      .get<(LeaderboardEntry & { hasTrophy?: boolean })[]>(
        `/api/hubs/${selected.placeId}/leaderboard?period=${period}`
      )
      .then(setEntries)
      .catch(() => setError("Failed to load leaderboard"))
      .finally(() => setLbLoading(false));
  }, [selected, period]);

  return (
    <Layout isAdmin={isAdmin}>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Top visitors by check-in count at your venue.
            </p>
          </div>
          {entries.length > 0 && selected && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => exportCSV(entries, selected.name, period)}
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && businesses.length === 0 && (
          <Card className="bg-card border-card-border border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Trophy className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <h3 className="font-medium text-foreground mb-1">No businesses registered</h3>
              <Link href="/register">
                <Button size="sm" className="mt-2">Register Business</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {selected && (
          <>
            {/* Selectors */}
            <div className="flex flex-col sm:flex-row gap-3">
              {businesses.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {businesses.map((biz) => (
                    <button
                      key={biz.businessId}
                      onClick={() => setSelected(biz)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        selected?.businessId === biz.businessId
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {biz.name}
                    </button>
                  ))}
                </div>
              )}
              <Tabs
                value={period}
                onValueChange={(v) => setPeriod(v as "all_time" | "current_month")}
                className="sm:ml-auto"
              >
                <TabsList className="bg-muted h-8">
                  <TabsTrigger value="all_time" className="text-xs h-6 px-3">
                    All Time
                  </TabsTrigger>
                  <TabsTrigger value="current_month" className="text-xs h-6 px-3">
                    This Month
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {lbLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <Card className="bg-card border-card-border border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Trophy className="w-8 h-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No check-ins yet for this period</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-card-border overflow-hidden">
                <CardHeader className="pb-2 border-b border-border">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {selected.name} — {period === "all_time" ? "All Time" : "This Month"}
                    <span className="ml-2 text-foreground">{entries.length} visitors</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {entries.map((entry, idx) => {
                      const isMedal = idx < 3;
                      return (
                        <div
                          key={entry.uid}
                          className={`flex items-center gap-3 px-4 py-3 ${idx === 0 ? "bg-primary/5" : ""}`}
                        >
                          {/* Rank */}
                          <div className="w-6 text-center flex-shrink-0">
                            {isMedal ? (
                              <Medal className={`w-4 h-4 mx-auto ${MEDAL_COLORS[idx]}`} />
                            ) : (
                              <span className="text-xs text-muted-foreground font-mono">
                                {entry.rank}
                              </span>
                            )}
                          </div>

                          {/* Avatar */}
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={entry.photoUrl ?? undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {entry.displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>

                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">
                                {entry.displayName}
                              </span>
                              {entry.hasTrophy && (
                                <Trophy className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                              )}
                            </div>
                          </div>

                          {/* Count */}
                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-bold text-foreground">
                              {entry.checkinCount}
                            </span>
                            <span className="text-xs text-muted-foreground ml-1">
                              {entry.checkinCount === 1 ? "check-in" : "check-ins"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
