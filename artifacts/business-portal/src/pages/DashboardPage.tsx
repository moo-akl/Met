import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api, type BusinessProfile } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  CalendarDays,
  Star,
  Trophy,
  Plus,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

type MyBusinessesResponse = {
  businesses: BusinessProfile[];
};

export default function DashboardPage({ isAdmin }: { isAdmin?: boolean }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api
      .get<MyBusinessesResponse>("/api/business/mine")
      .then((res) => {
        setBusinesses(res.businesses ?? []);
      })
      .catch(() => {
        setError("Failed to load your businesses");
      })
      .finally(() => setLoading(false));
  }, [user]);

  const totalEvents = businesses.reduce((acc, b) => acc + (b.events?.length ?? 0), 0);

  return (
    <Layout isAdmin={isAdmin}>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here's what's happening with your venues on Met.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Businesses", value: businesses.length, icon: Building2, color: "text-primary" },
            { label: "Events", value: totalEvents, icon: CalendarDays, color: "text-chart-2" },
            { label: "Reviews", value: "—", icon: Star, color: "text-chart-4" },
            { label: "Check-ins", value: "—", icon: Trophy, color: "text-chart-3" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="bg-card border-card-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">{stat.label}</span>
                    <Icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Businesses */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Your Businesses</h2>
            <Link href="/register">
              <Button size="sm" className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add Business
              </Button>
            </Link>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {!loading && !error && businesses.length === 0 && (
            <Card className="bg-card border-card-border border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <h3 className="font-medium text-foreground mb-1">No businesses yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Register your venue to start connecting with Met users
                </p>
                <Link href="/register">
                  <Button size="sm" className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Register Business
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {businesses.map((biz) => (
              <Card key={biz.businessId} className="bg-card border-card-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  {biz.logoUrl ? (
                    <img
                      src={biz.logoUrl}
                      alt={biz.name}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-foreground text-sm truncate">{biz.name}</h3>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {biz.events?.length ?? 0} events
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {biz.description ?? "No description"}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono truncate">
                      {biz.placeId}
                    </p>
                  </div>
                  <Link href="/profile">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick links */}
        {businesses.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { href: "/events", icon: CalendarDays, label: "Manage Events", desc: "Add or remove upcoming events" },
                { href: "/leaderboard", icon: Trophy, label: "View Leaderboard", desc: "See top visitors at your venue" },
                { href: "/reviews", icon: Star, label: "Customer Reviews", desc: "Read feedback from Met users" },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.href} href={action.href}>
                    <Card className="bg-card border-card-border hover:border-primary/30 transition-colors cursor-pointer h-full">
                      <CardContent className="p-4 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{action.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
