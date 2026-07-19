import { useEffect, useState, useCallback } from "react";
import { api, type BusinessProfile, type LeaderboardEntry } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Download, Loader2, AlertCircle, Medal, ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { format, subMonths, startOfMonth } from "date-fns";

type MyBusinessesResponse = { businesses: BusinessProfile[] };

const MEDAL_COLORS = ["text-yellow-400", "text-slate-400", "text-amber-600"];

function exportCSV(entries: LeaderboardEntry[], businessName: string, label: string) {
  const header = "Rank,Display Name,UID,Check-ins,Trophy\n";
  const rows = entries
    .map((e) => `${e.rank},"${e.displayName}",${e.uid},${e.checkinCount},${e.hasTrophy ? "Yes" : "No"}`)
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${businessName.replace(/\s+/g, "_")}_leaderboard_${label}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function LeaderboardTable({
  entries,
  loading,
}: {
  entries: LeaderboardEntry[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Trophy className="w-7 h-7 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No check-ins for this period</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-border">
      {entries.map((entry, idx) => (
        <div
          key={entry.uid}
          className={`flex items-center gap-3 px-4 py-3 ${idx === 0 ? "bg-primary/5" : ""}`}
        >
          <div className="w-6 text-center flex-shrink-0">
            {idx < 3 ? (
              <Medal className={`w-4 h-4 mx-auto ${MEDAL_COLORS[idx]}`} />
            ) : (
              <span className="text-xs text-muted-foreground font-mono">{entry.rank}</span>
            )}
          </div>
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={entry.photoUrl ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {entry.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{entry.displayName}</span>
            {entry.hasTrophy && <Trophy className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
          </div>
          <div className="text-right flex-shrink-0">
            <span className="text-sm font-bold text-foreground">{entry.checkinCount}</span>
            <span className="text-xs text-muted-foreground ml-1">
              {entry.checkinCount === 1 ? "check-in" : "check-ins"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryAccordion({
  placeId,
  businessName,
}: {
  placeId: string;
  businessName: string;
}) {
  const NUM_MONTHS = 6;
  const months = Array.from({ length: NUM_MONTHS }, (_, i) => {
    const d = subMonths(startOfMonth(new Date()), i + 1);
    return { label: format(d, "MMMM yyyy"), param: format(d, "yyyy-MM") };
  });

  const [open, setOpen] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, LeaderboardEntry[]>>({});
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(
    async (monthParam: string) => {
      if (cache[monthParam]) return;
      setLoadingMonth(monthParam);
      try {
        const data = await api.get<LeaderboardEntry[]>(
          `/api/hubs/${placeId}/leaderboard?month=${monthParam}`
        );
        setCache((prev) => ({ ...prev, [monthParam]: data }));
      } catch {
        setErrors((prev) => ({ ...prev, [monthParam]: "Failed to load" }));
      } finally {
        setLoadingMonth(null);
      }
    },
    [placeId, cache],
  );

  const toggle = (monthParam: string) => {
    if (open === monthParam) {
      setOpen(null);
    } else {
      setOpen(monthParam);
      void load(monthParam);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Past Months</p>
      {months.map(({ label, param }) => {
        const isOpen = open === param;
        const entries = cache[param] ?? [];
        const isLoading = loadingMonth === param;
        return (
          <Card key={param} className="bg-card border-card-border overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
              onClick={() => toggle(param)}
            >
              <div className="flex items-center gap-3">
                <Trophy className="w-4 h-4 text-muted-foreground/60" />
                <span className="text-sm font-medium text-foreground">{label}</span>
                {cache[param] && !isLoading && (
                  <span className="text-xs text-muted-foreground">({entries.length} ranked)</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {cache[param] && entries.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportCSV(entries, businessName, param);
                    }}
                  >
                    <Download className="w-3 h-3" />
                    CSV
                  </Button>
                )}
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border">
                {errors[param] ? (
                  <div className="flex items-center gap-2 text-destructive text-sm px-4 py-3">
                    <AlertCircle className="w-4 h-4" />
                    {errors[param]}
                  </div>
                ) : (
                  <LeaderboardTable entries={entries} loading={isLoading} />
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default function LeaderboardPage({ isAdmin }: { isAdmin?: boolean }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [selected, setSelected] = useState<BusinessProfile | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<"all_time" | "current_month">("current_month");
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
      .get<LeaderboardEntry[]>(`/api/hubs/${selected.placeId}/leaderboard?period=${period}`)
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
              <Link href="/business-register">
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
                  <TabsTrigger value="current_month" className="text-xs h-6 px-3">This Month</TabsTrigger>
                  <TabsTrigger value="all_time" className="text-xs h-6 px-3">All Time</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            {/* Current leaderboard */}
            <Card className="bg-card border-card-border overflow-hidden">
              <CardHeader className="pb-2 border-b border-border">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {selected.name} —{" "}
                  {period === "current_month"
                    ? format(new Date(), "MMMM yyyy")
                    : "All Time"}
                  {!lbLoading && (
                    <span className="ml-2 text-foreground">{entries.length} visitors</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <LeaderboardTable entries={entries} loading={lbLoading} />
              </CardContent>
            </Card>

            {/* History accordion */}
            <HistoryAccordion placeId={selected.placeId} businessName={selected.name} />
          </>
        )}
      </div>
    </Layout>
  );
}
