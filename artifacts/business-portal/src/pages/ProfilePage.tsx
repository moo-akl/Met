import { useEffect, useState } from "react";
import { api, type BusinessProfile } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Loader2, AlertCircle, CheckCircle, Plus, X } from "lucide-react";
import { Link } from "wouter";

type MyBusinessesResponse = { businesses: BusinessProfile[] };

export default function ProfilePage({ isAdmin }: { isAdmin?: boolean }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [selected, setSelected] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    logoUrl: "",
    mediaUrls: [] as string[],
    salesAgentId: "",
  });
  const [newMedia, setNewMedia] = useState("");

  useEffect(() => {
    if (!user) return;
    api
      .get<MyBusinessesResponse>("/api/business/mine")
      .then((res) => {
        const biz = res.businesses ?? [];
        setBusinesses(biz);
        if (biz.length > 0) selectBusiness(biz[0]!);
      })
      .catch(() => setError("Failed to load businesses"))
      .finally(() => setLoading(false));
  }, [user]);

  function selectBusiness(biz: BusinessProfile) {
    setSelected(biz);
    setForm({
      name: biz.name,
      description: biz.description ?? "",
      logoUrl: biz.logoUrl ?? "",
      mediaUrls: biz.mediaUrls ?? [],
      salesAgentId: biz.salesAgentId ?? "",
    });
    setSuccess(false);
    setError("");
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError("");
    setSaving(true);
    try {
      const updated = await api.put<BusinessProfile>(`/api/business/${selected.businessId}`, {
        name: form.name || undefined,
        description: form.description || undefined,
        logoUrl: form.logoUrl || null,
        mediaUrls: form.mediaUrls,
        salesAgentId: form.salesAgentId || null,
      });
      setSelected(updated);
      setBusinesses((prev) =>
        prev.map((b) => (b.businessId === updated.businessId ? { ...updated, events: b.events } : b))
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const addMedia = () => {
    if (!newMedia.trim() || form.mediaUrls.length >= 6) return;
    setForm({ ...form, mediaUrls: [...form.mediaUrls, newMedia.trim()] });
    setNewMedia("");
  };

  const removeMedia = (idx: number) => {
    setForm({ ...form, mediaUrls: form.mediaUrls.filter((_, i) => i !== idx) });
  };

  return (
    <Layout isAdmin={isAdmin}>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Business Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Update how your venue appears to Met users.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && businesses.length === 0 && (
          <Card className="bg-card border-card-border border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <h3 className="font-medium text-foreground mb-1">No businesses registered</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Register your venue to manage its profile
              </p>
              <Link href="/register">
                <Button size="sm">Register Business</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Business selector */}
        {businesses.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {businesses.map((biz) => (
              <button
                key={biz.businessId}
                onClick={() => selectBusiness(biz)}
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

        {selected && (
          <Card className="bg-card border-card-border">
            <CardHeader>
              <CardTitle className="text-base">Edit Profile</CardTitle>
              <CardDescription className="font-mono text-xs">
                Place ID: {selected.placeId}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary rounded-lg px-3 py-2.5">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Changes saved successfully</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="name">Business Name *</Label>
                  <Input
                    id="name"
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
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="bg-input border-input resize-none"
                    rows={3}
                    maxLength={1000}
                    placeholder="Tell Met users about your venue…"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {form.description.length}/1000
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    type="url"
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    className="bg-input border-input"
                    placeholder="https://example.com/logo.png"
                  />
                  {form.logoUrl && (
                    <img
                      src={form.logoUrl}
                      alt="Logo preview"
                      className="w-16 h-16 rounded-lg object-cover mt-2"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Media URLs ({form.mediaUrls.length}/6)</Label>
                  <div className="space-y-2">
                    {form.mediaUrls.map((url, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          value={url}
                          readOnly
                          className="bg-muted border-border text-muted-foreground text-sm flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeMedia(idx)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    {form.mediaUrls.length < 6 && (
                      <div className="flex gap-2">
                        <Input
                          type="url"
                          value={newMedia}
                          onChange={(e) => setNewMedia(e.target.value)}
                          className="bg-input border-input text-sm flex-1"
                          placeholder="https://example.com/photo.jpg"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addMedia();
                            }
                          }}
                        />
                        <Button type="button" variant="outline" size="sm" onClick={addMedia}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="salesAgentId">Sales Agent ID</Label>
                  <Input
                    id="salesAgentId"
                    value={form.salesAgentId}
                    onChange={(e) => setForm({ ...form, salesAgentId: e.target.value })}
                    className="bg-input border-input"
                    placeholder="Optional agent ID"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={saving} className="min-w-24">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
