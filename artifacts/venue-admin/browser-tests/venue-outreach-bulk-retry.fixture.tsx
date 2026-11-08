import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import VenueOutreachHistoryPanel from "../src/components/VenueOutreachHistoryPanel";
import { Toaster } from "../src/components/ui/toaster";
import "../src/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

function VenueOutreachBulkRetryFixture() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen bg-white">
        <VenueOutreachHistoryPanel onClose={() => undefined} />
        <Toaster />
      </main>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<VenueOutreachBulkRetryFixture />);
