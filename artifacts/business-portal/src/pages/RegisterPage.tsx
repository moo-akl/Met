import { useState } from "react";
import { useLocation } from "wouter";
import { api, type BusinessProfile } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Building2, Loader2, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const agentFromUrl = params.get("agent") ?? "";

  const [form, setForm] = useState({
    placeId: "",
    name: "",
    description: "",
    logoUrl: "",
    salesAgentId: agentFromUrl,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.placeId.trim()) {
      setError("Google Places ID is required");
      return;
    }
    if (!form.name.trim()) {
      setError("Business name is required");
      return;
    }
    setLoading(true);
    try {
      await api.post<BusinessProfile>("/api/business", {
        placeId: form.placeId.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        logoUrl: form.logoUrl.trim() || undefined,
        salesAgentId: form.salesAgentId.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => navigate("/"), 1500);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Failed to register business");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="bg-card border-card-border max-w-md w-full text-center p-8">
          <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Business Registered!</h2>
          <p className="text-muted-foreground text-sm">Redirecting to your dashboard…</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Register Your Business</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Connect your venue with the Met community
          </p>
        </div>

        <Card className="bg-card border-card-border shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Business Details</CardTitle>
            <CardDescription>
              Your business will appear to Met users who check in at your venue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="placeId">Google Places ID *</Label>
                <Input
                  id="placeId"
                  placeholder="ChIJ... (from Google Maps)"
                  value={form.placeId}
                  onChange={(e) => setForm({ ...form, placeId: e.target.value })}
                  className="bg-input border-input font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Find your Places ID at{" "}
                  <a
                    href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Google's Place ID Finder
                  </a>
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Business Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. The Coffee Corner"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-input border-input"
                  maxLength={120}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Tell Met users about your venue…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-input border-input resize-none"
                  rows={3}
                  maxLength={1000}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={form.logoUrl}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  className="bg-input border-input"
                />
              </div>

              {agentFromUrl && (
                <div className="space-y-1.5">
                  <Label htmlFor="agent">Referred by Agent</Label>
                  <Input
                    id="agent"
                    value={form.salesAgentId}
                    readOnly
                    className="bg-muted border-border text-muted-foreground"
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Register Business
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
