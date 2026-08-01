import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 shadow-sm border-border">
        <CardContent className="pt-8 pb-8 text-center flex flex-col items-center">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-2">
            Page Not Found
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            The page you are looking for doesn't exist or has been moved.
          </p>
          <Link href="/" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
            Return to Dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
