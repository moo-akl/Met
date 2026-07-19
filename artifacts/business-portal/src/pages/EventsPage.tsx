import { useEffect, useRef, useState } from "react";
import { api, type BusinessProfile, type BusinessEvent } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarDays, Plus, Trash2, Loader2, AlertCircle, Clock, Pencil, Upload, X, ImageIcon } from "lucide-react";
import { format, isPast } from "date-fns";
import { Link } from "wouter";
import { auth } from "@/lib/firebase";

type MyBusinessesResponse = { businesses: BusinessProfile[] };

type EventForm = { title: string; description: string; imageUrl: string; startTime: string; endTime: string };

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventsPage({ isAdmin }: { isAdmin?: boolean }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [selected, setSelected] = useState<BusinessProfile | null>(null);
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BusinessEvent | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<EventForm>({ title: "", description: "", imageUrl: "", startTime: "", endTime: "" });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setIsUploading(true);
    setUploadError(null);
    try {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const metaRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
      });
      if (!metaRes.ok) {
        const body = await metaRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Failed to get upload URL (${metaRes.status})`);
      }
      const { uploadURL, objectPath } = (await metaRes.json()) as { uploadURL: string; objectPath: string };
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Upload to storage failed");
      const servingUrl = `${window.location.origin}/api/storage${objectPath}`;
      setForm((prev) => ({ ...prev, imageUrl: servingUrl }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
      setError(`Image upload failed: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    api
      .get<MyBusinessesResponse>("/api/business/mine")
      .then((res) => {
        const biz = res.businesses ?? [];
        setBusinesses(biz);
        if (biz.length > 0) {
          setSelected(biz[0]!);
          setEvents(biz[0]!.events ?? []);
        }
      })
      .catch(() => setError("Failed to load businesses"))
      .finally(() => setLoading(false));
  }, [user]);

  function selectBusiness(biz: BusinessProfile) {
    setSelected(biz);
    setEvents(biz.events ?? []);
    setError("");
  }

  function openCreateDialog() {
    setEditingEvent(null);
    setForm({ title: "", description: "", imageUrl: "", startTime: "", endTime: "" });
    setError("");
    setDialogOpen(true);
  }

  function openEditDialog(event: BusinessEvent) {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description ?? "",
      imageUrl: event.imageUrl ?? "",
      startTime: toLocalDatetimeValue(event.startTime),
      endTime: toLocalDatetimeValue(event.endTime),
    });
    setError("");
    setDialogOpen(true);
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploadError(null);

    if (!file.type.startsWith("image/") || !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      const msg = "Only image files are allowed (JPG, PNG, WebP, GIF, AVIF, HEIC).";
      setUploadError(msg);
      setError(`Image upload failed: ${msg}`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      const msg = "Image must be 5 MB or smaller.";
      setUploadError(msg);
      setError(`Image upload failed: ${msg}`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function clearImage() {
    setForm((prev) => ({ ...prev, imageUrl: "" }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (isUploading) {
      setError("Image is still uploading. Please wait.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      if (editingEvent) {
        const updated = await api.put<BusinessEvent>(
          `/api/business/${selected.businessId}/events/${editingEvent.eventId}`,
          {
            title: form.title,
            description: form.description || undefined,
            imageUrl: form.imageUrl.trim() ? form.imageUrl.trim() : null,
            startTime: new Date(form.startTime).toISOString(),
            endTime: new Date(form.endTime).toISOString(),
          }
        );
        setEvents((prev) => prev.map((ev) => (ev.eventId === updated.eventId ? updated : ev)));
      } else {
        const event = await api.post<BusinessEvent>(
          `/api/business/${selected.businessId}/events`,
          {
            title: form.title,
            description: form.description || undefined,
            imageUrl: form.imageUrl.trim() || undefined,
            startTime: new Date(form.startTime).toISOString(),
            endTime: new Date(form.endTime).toISOString(),
          }
        );
        setEvents((prev) => [event, ...prev]);
      }
      setDialogOpen(false);
      setForm({ title: "", description: "", imageUrl: "", startTime: "", endTime: "" });
      setEditingEvent(null);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Failed to save event");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected || deleteId === null) return;
    setDeleting(true);
    try {
      await api.delete(`/api/business/${selected.businessId}/events/${deleteId}`);
      setEvents((prev) => prev.filter((ev) => ev.eventId !== deleteId));
      setDeleteId(null);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? "Failed to delete event");
    } finally {
      setDeleting(false);
    }
  };

  const minStart = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <Layout isAdmin={isAdmin}>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Events</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage events at your venue.</p>
          </div>
          {selected && (
            <Button
              onClick={openCreateDialog}
              size="sm"
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Event
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
              <CalendarDays className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <h3 className="font-medium text-foreground mb-1">No businesses registered</h3>
              <Link href="/register">
                <Button size="sm" className="mt-2">Register Business</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {error && !dialogOpen && (
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2.5">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
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
          <div className="space-y-3">
            {events.length === 0 ? (
              <Card className="bg-card border-card-border border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <CalendarDays className="w-8 h-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No events yet</p>
                  <Button
                    size="sm"
                    className="mt-3 gap-1.5"
                    onClick={openCreateDialog}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create First Event
                  </Button>
                </CardContent>
              </Card>
            ) : (
              events.map((event) => {
                const past = isPast(new Date(event.endTime));
                return (
                  <Card
                    key={event.eventId}
                    className={`bg-card border-card-border ${past ? "opacity-60" : ""}`}
                  >
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {event.imageUrl ? (
                          <img
                            src={event.imageUrl}
                            alt={event.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = "none";
                              const parent = target.parentElement;
                              if (parent) {
                                const icon = document.createElement("span");
                                icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3M3 11h18M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`;
                                parent.appendChild(icon);
                              }
                            }}
                          />
                        ) : (
                          <CalendarDays className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-semibold text-sm text-foreground truncate">
                            {event.title}
                          </h3>
                          <Badge
                            variant={past ? "secondary" : "default"}
                            className="text-xs shrink-0"
                          >
                            {past ? "Past" : "Upcoming"}
                          </Badge>
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mb-1">{event.description}</p>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>
                            {format(new Date(event.startTime), "MMM d, yyyy h:mm a")} —{" "}
                            {format(new Date(event.endTime), "h:mm a")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid="edit-event-btn"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(event)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteId(event.eventId)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingEvent(null); }}>
        <DialogContent className="bg-card border-card-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit Event" : "Create Event"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {error && dialogOpen && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Event Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Happy Hour, Live Music"
                className="bg-input border-input"
                maxLength={120}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional details…"
                className="bg-input border-input resize-none"
                rows={2}
                maxLength={1000}
              />
            </div>

            {/* Cover Image Upload */}
            <div className="space-y-1.5">
              <Label>Cover Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {!form.imageUrl && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full h-24 rounded-lg border-2 border-dashed border-border bg-input hover:bg-muted/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-xs">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span className="text-xs font-medium">Click to upload a photo</span>
                      <span className="text-xs opacity-70">JPG, PNG, WebP, GIF</span>
                    </>
                  )}
                </button>
              )}
              {form.imageUrl && (
                <div className="relative rounded-lg overflow-hidden border border-border h-32 group">
                  <img
                    src={form.imageUrl}
                    alt="Event cover preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white/90 text-xs font-medium text-foreground hover:bg-white transition-colors"
                    >
                      {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={clearImage}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white/90 text-xs font-medium text-foreground hover:bg-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              )}
              {uploadError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {uploadError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time *</Label>
                <Input
                  type="datetime-local"
                  value={form.startTime}
                  min={editingEvent ? undefined : minStart}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="bg-input border-input text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time *</Label>
                <Input
                  type="datetime-local"
                  value={form.endTime}
                  min={form.startTime || (editingEvent ? undefined : minStart)}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="bg-input border-input text-sm"
                  required
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || isUploading}>
                {(saving || isUploading) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingEvent ? "Save Changes" : "Create Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-card border-card-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
