import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import {
  getGetVenueAdminSessionQueryKey,
  useGetVenueAdminSession,
} from '@workspace/api-client-react';

import Unlock from './pages/unlock';
import Dashboard from './pages/dashboard';
import { Skeleton } from './components/ui/skeleton';
import { ShieldCheck } from 'lucide-react';

const queryClient = new QueryClient();

function AuthGuard() {
  const { data: session, isLoading, isError, isFetching } = useGetVenueAdminSession({
    query: {
      queryKey: getGetVenueAdminSessionQueryKey(),
      retry: false,
      staleTime: 0,
    },
  });

  if (isLoading || (isFetching && !isError && !session)) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center ring-1 ring-primary/20 animate-pulse">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-2 flex flex-col items-center">
            <Skeleton className="w-48 h-4 rounded-full" />
            <Skeleton className="w-32 h-3 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // If there's an error fetching the session, or the session is explicitly not authenticated, show Unlock
  if (isError || !session?.authenticated) {
    return (
      <Switch>
        <Route path="/" component={Unlock} />
        <Route component={Unlock} /> {/* Redirect all to unlock if not authed */}
      </Switch>
    );
  }

  // Authenticated
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthGuard />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
