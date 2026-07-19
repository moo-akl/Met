import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import ProfilePage from "@/pages/ProfilePage";
import EventsPage from "@/pages/EventsPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import ReviewsPage from "@/pages/ReviewsPage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AppRoutes() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setAdminChecked(true);
      return;
    }
    api
      .get<{ isAdmin: boolean }>("/api/admin/me")
      .then((res) => setIsAdmin(res.isAdmin))
      .catch(() => setIsAdmin(false))
      .finally(() => setAdminChecked(true));
  }, [user]);

  if (loading || !adminChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/business-register" component={RegisterPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={() => <DashboardPage isAdmin={isAdmin} />} />
      <Route path="/profile" component={() => <ProfilePage isAdmin={isAdmin} />} />
      <Route path="/events" component={() => <EventsPage isAdmin={isAdmin} />} />
      <Route path="/leaderboard" component={() => <LeaderboardPage isAdmin={isAdmin} />} />
      <Route path="/reviews" component={() => <ReviewsPage isAdmin={isAdmin} />} />
      {isAdmin && (
        <Route path="/admin" component={() => <AdminPage isAdmin={true} />} />
      )}
      <Route path="/business-register" component={RegisterPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
