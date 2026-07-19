import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { api, type BusinessProfile, type PlaceSuggestion } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Building2, Loader2, CheckCircle, MapPin, X } from "lucide-react";

type PlacesResponse = { places: PlaceSuggestion[] };

function PlacesAutocomplete({
  value,
  onChange,
}: {
  value: PlaceSuggestion | null;
  onChange: (p: PlaceSuggestion | null) => void;
}) {
  const [query, setQuery] = useState(value ? `${value.name} — ${value.address}` : "");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<PlacesResponse>(
          `/api/business/places-search?q=${encodeURIComponent(q)}`
        );
        setSuggestions(res.places ?? []);
        setOpen((res.places ?? []).length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const select = (p: PlaceSuggestion) => {
    onChange(p);
    setQuery(`${p.name} — ${p.address}`);
    setOpen(false);
    setSuggestions([]);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(null);
            search(e.target.value);
          }}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          placeholder="Search for your venue by name…"
          className="bg-input border-input pl-9 pr-9"
        />
        {(value || searching) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : value ? (
              <button type="button" onClick={clear}>
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            ) : null}
          </div>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-card-border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((p) => (
            <button
              key={p.placeId}
              type="button"
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/60 text-left transition-colors"
              onMouseDown={(e) => { e.preventDefault(); select(p); }}
            >
              <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                <p className="text-xs text-muted-foreground/40 font-mono truncate">{p.placeId}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {value && (
        <p className="text-xs text-muted-foreground/60 font-mono mt-1 truncate">
          Place ID: {value.placeId}
        </p>
      )}
      {!value && (
        <p className="text-xs text-muted-foreground mt-1">
          Type your venue name or address to search. Can't find it?{" "}
          <a
            href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Look up Place ID manually
          </a>
        </p>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  const params = new URLSearchParams(search);
  const agentFromUrl = params.get("agent") ?? "";

  const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [form, setForm] = useState({
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
    if (!selectedPlace) {
      setError("Please select a venue from the search results");
      return;
    }
    if (!form.name.trim()) {
      setError("Business display name is required");
      return;
    }
    setLoading(true);
    try {
      await api.post<BusinessProfile>("/api/business", {
        placeId: selectedPlace.placeId,
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
                <Label>Venue Location *</Label>
                <PlacesAutocomplete value={selectedPlace} onChange={setSelectedPlace} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Business Display Name *</Label>
                <Input
                  id="name"
                  placeholder={selectedPlace ? selectedPlace.name : "e.g. The Coffee Corner"}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-input border-input"
                  maxLength={120}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Name shown to Met users (defaults to venue name if left blank after selection).
                </p>
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
                  <Label htmlFor="agent">Referred by Sales Agent</Label>
                  <Input
                    id="agent"
                    value={form.salesAgentId}
                    readOnly
                    className="bg-muted border-border text-muted-foreground"
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || !selectedPlace}>
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
