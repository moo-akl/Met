import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import { Download, ExternalLink, Presentation, Monitor, Layers } from 'lucide-react';

const queryClient = new QueryClient();

function Home() {
  const pdfUrl = import.meta.env.BASE_URL + "My_Home_Cambridge_Starters_High_Resolution.pdf";
  const coverUrl = import.meta.env.BASE_URL + "cover.jpg";

  return (
    <div className="min-h-[100dvh] w-full relative flex items-center justify-center overflow-hidden bg-background font-sans p-4 sm:p-6 lg:p-12">
      {/* Playful Background Elements */}
      <div className="absolute inset-0 z-0 opacity-[0.6] bg-[radial-gradient(hsl(var(--muted-foreground)/0.2)_1px,transparent_1px)] [background-size:24px_24px]" />
      
      <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-secondary/50 blur-[100px] mix-blend-multiply opacity-70 animate-blob-spin pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] rounded-full bg-primary/20 blur-[100px] mix-blend-multiply opacity-70 animate-blob-spin pointer-events-none" style={{ animationDelay: '-10s' }} />

      {/* Main Container */}
      <main className="relative z-10 max-w-5xl w-full bg-card rounded-[2.5rem] shadow-xl border border-border/60 overflow-hidden flex flex-col lg:flex-row my-8">
        
        {/* Left Side: Cover Image Showcase */}
        <div className="lg:w-[45%] bg-muted/30 p-8 lg:p-12 flex items-center justify-center relative overflow-hidden border-b lg:border-b-0 lg:border-r border-border/60">
           {/* Decorative elements behind the cover */}
           <div className="absolute top-10 right-10 w-32 h-32 bg-accent/80 rounded-full blur-2xl opacity-60" />
           <div className="absolute bottom-10 left-10 w-40 h-40 bg-secondary/80 rounded-full blur-3xl opacity-60" />
           
           <div className="relative w-full max-w-sm aspect-[16/9] lg:aspect-[4/3] rounded-2xl shadow-2xl overflow-hidden border-[6px] border-white transform transition-transform duration-700 hover:scale-[1.02] hover:shadow-primary/20 animate-float-gentle group">
             <img 
               src={coverUrl} 
               alt="My Home - Cambridge YLE Starters Cover" 
               className="w-full h-full object-cover bg-white"
               onError={(e) => {
                 // Fallback if image isn't ready
                 e.currentTarget.src = "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?q=80&w=2000&auto=format&fit=crop";
               }}
             />
             <div className="absolute inset-0 shadow-inner rounded-xl pointer-events-none" />
             <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
           </div>
        </div>

        {/* Right Side: Content & Actions */}
        <div className="lg:w-[55%] p-8 sm:p-10 lg:p-14 flex flex-col justify-center">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-secondary/80 text-secondary-foreground text-sm font-bold tracking-wide w-fit mb-6">
            <Presentation className="w-4 h-4" />
            <span>Classroom Deck</span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight font-display mb-4 leading-[1.1]">
            My Home <br/>
            <span className="text-primary font-bold text-2xl lg:text-3xl block mt-2 opacity-90">Cambridge YLE Starters</span>
          </h1>
          
          <p className="text-muted-foreground text-lg mb-8 leading-relaxed font-medium">
            A complete, ready-to-teach presentation designed specifically for young learners. Vibrant illustrations, clear layouts, and engaging visuals to support the Cambridge Starters curriculum.
          </p>

          {/* Meta Specifications */}
          <div className="flex flex-wrap gap-3 mb-10">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground bg-muted/60 border border-border/50 px-4 py-2.5 rounded-xl">
              <Layers className="w-4 h-4 text-primary" />
              24 Slides
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground bg-muted/60 border border-border/50 px-4 py-2.5 rounded-xl">
              <Monitor className="w-4 h-4 text-primary" />
              16:9 Aspect Ratio
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground bg-muted/60 border border-border/50 px-4 py-2.5 rounded-xl">
              <span className="font-extrabold text-primary mr-0.5 tracking-tighter">HD</span>
              1920×1080
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-auto">
            <a 
              href={pdfUrl} 
              download 
              className="group relative inline-flex items-center justify-center gap-3 bg-primary text-primary-foreground px-8 py-4.5 rounded-2xl font-bold text-lg shadow-[0_8px_20px_-6px_rgba(0,0,0,0.2)] shadow-primary/30 hover:shadow-primary/40 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.3)] hover:-translate-y-1 transition-all duration-300 overflow-hidden active:scale-95 active:translate-y-0"
              data-testid="link-download-pdf"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-[120%] group-hover:translate-y-0 transition-transform duration-400 ease-out rounded-2xl pointer-events-none" />
              <Download className="w-6 h-6 relative z-10 group-hover:animate-bounce" />
              <span className="relative z-10">Download PDF</span>
            </a>
            
            <a 
              href={pdfUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="group inline-flex items-center justify-center gap-3 bg-transparent text-foreground border-[2.5px] border-border/80 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-muted hover:border-muted-foreground/30 transition-all duration-300 active:scale-95"
              data-testid="link-open-new-tab"
            >
              <ExternalLink className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span>Open in Browser</span>
            </a>
          </div>

        </div>
      </main>
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;