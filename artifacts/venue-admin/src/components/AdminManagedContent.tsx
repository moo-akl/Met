import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListAdminManagedEventsQueryKey, getListAdminManagedRewardsQueryKey, getListAdminManagedAnnouncementsQueryKey,
  useListAdminManagedEvents, useListAdminManagedRewards, useListAdminManagedAnnouncements,
  useCreateAdminManagedEvent, useUpdateAdminManagedEvent, useDeleteAdminManagedEvent,
  useCreateAdminManagedReward, useUpdateAdminManagedReward, useDeleteAdminManagedReward,
  useCreateAdminManagedAnnouncement, useUpdateAdminManagedAnnouncement, useDeleteAdminManagedAnnouncement,
  type VenueManagerEvent, type VenueManagerEventInput, type VenueManagerReward, type VenueManagerRewardInput,
  type VenueManagerAnnouncement, type AdminManagedAnnouncementInput,
  prepareAdminManagedImage, confirmAdminManagedImage,
} from "@workspace/api-client-react";
import { CalendarDays, Gift, Megaphone, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const localDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const isoDate = (value: string) => new Date(value).toISOString();
const displayDate = (value?: string | null) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
const optional = (value: string) => value.trim() || null;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Please try again.";

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function CollectionState({ loading, error, retry, empty, children }: { loading: boolean; error: boolean; retry: () => void; empty: boolean; children: ReactNode }) {
  if (loading) return <div className="space-y-3 py-4" aria-label="Loading content"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  if (error) return <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>Could not load this content.</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={retry}>Retry</Button></div>;
  if (empty) return <div className="rounded-lg border border-dashed bg-muted/20 px-5 py-8 text-center text-sm text-muted-foreground">Nothing here yet. Add the first item for this venue.</div>;
  return <div className="space-y-2">{children}</div>;
}

function ConfirmRemove({ open, title, description, pending, onCancel, onConfirm }: { open: boolean; title: string; description: string; pending: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <AlertDialog open={open} onOpenChange={(next) => { if (!next && !pending) onCancel(); }}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Keep item</AlertDialogCancel>
        <AlertDialogAction disabled={pending} onClick={(event) => { event.preventDefault(); onConfirm(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{pending ? "Working…" : "Confirm"}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

function ImageField({ id, value, profileId, onChange, onUploadingChange }: {
  id: string; value: string; profileId: number; onChange: (url: string) => void; onUploadingChange: (uploading: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = async (file: File) => {
    setError("");
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setError("Choose a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    setUploading(true);
    onUploadingChange(true);
    try {
      const { uploadURL, objectPath, confirmationToken } = await prepareAdminManagedImage(profileId, { contentType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif" });
      const put = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error("Could not upload the image. Please try again.");
      const result = await confirmAdminManagedImage(profileId, { objectPath, confirmationToken });
      onChange(result.url);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  };
  return <div className="space-y-2">
    <Field id={id} label="Image URL (optional)"><Input id={id} type="text" placeholder="https:// or upload below" value={value} disabled={uploading} onChange={(event) => onChange(event.target.value)} /></Field>
    <div className="flex items-center gap-2">
      <Input aria-label="Choose image to upload" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} className="max-w-xs cursor-pointer" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void upload(file);
        event.target.value = "";
      }} />
      {uploading && <span role="status" className="text-sm text-muted-foreground">Uploading image…</span>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {value && <div className="flex items-start gap-3"><img src={value} alt="Selected image preview" className="h-24 w-32 rounded-md border object-cover" /><Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => onChange("")}>Remove image</Button></div>}
  </div>;
}

type EventDraft = { title: string; description: string; imageUrl: string; startsAt: string; endsAt: string; capacityLimit: string; isPublished: boolean };
const emptyEvent: EventDraft = { title: "", description: "", imageUrl: "", startsAt: "", endsAt: "", capacityLimit: "", isPublished: false };
const eventDraft = (item: VenueManagerEvent): EventDraft => ({ title: item.title, description: item.description ?? "", imageUrl: item.imageUrl ?? "", startsAt: localDate(item.startsAt), endsAt: localDate(item.endsAt), capacityLimit: item.capacityLimit?.toString() ?? "", isPublished: item.isPublished });

function Events({ profileId }: { profileId: number }) {
  const { toast } = useToast();
  const client = useQueryClient();
  const query = useListAdminManagedEvents(profileId);
  const refresh = () => client.invalidateQueries({ queryKey: getListAdminManagedEventsQueryKey(profileId) });
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [removing, setRemoving] = useState<VenueManagerEvent | null>(null);
  const [draft, setDraft] = useState<EventDraft>(emptyEvent);
  const [uploading, setUploading] = useState(false);
  const create = useCreateAdminManagedEvent();
  const update = useUpdateAdminManagedEvent();
  const remove = useDeleteAdminManagedEvent();
  const pending = create.isPending || update.isPending || uploading;
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (uploading) return;
    if (draft.endsAt && new Date(draft.endsAt) <= new Date(draft.startsAt)) { toast({ variant: "destructive", title: "End must be after start" }); return; }
    const data: VenueManagerEventInput = { title: draft.title.trim(), description: optional(draft.description), imageUrl: optional(draft.imageUrl), startsAt: isoDate(draft.startsAt), endsAt: draft.endsAt ? isoDate(draft.endsAt) : null, capacityLimit: draft.capacityLimit ? Number(draft.capacityLimit) : null, isPublished: draft.isPublished };
    try {
      if (editing === "new") await create.mutateAsync({ id: profileId, data });
      else if (typeof editing === "number") await update.mutateAsync({ id: profileId, eventId: editing, data });
      await refresh(); setEditing(null); toast({ title: "Event saved" });
    } catch (error) { toast({ variant: "destructive", title: "Could not save event", description: errorMessage(error) }); }
  };
  const changeVisibility = async (item: VenueManagerEvent) => {
    try { await update.mutateAsync({ id: profileId, eventId: item.id, data: { isPublished: !item.isPublished } }); await refresh(); toast({ title: item.isPublished ? "Event moved to draft" : "Event published" }); }
    catch (error) { toast({ variant: "destructive", title: "Could not update event", description: errorMessage(error) }); }
  };
  const confirmRemove = async () => {
    if (!removing) return;
    try { await remove.mutateAsync({ id: profileId, eventId: removing.id }); await refresh(); setRemoving(null); toast({ title: "Event removed" }); }
    catch (error) { toast({ variant: "destructive", title: "Could not remove event", description: errorMessage(error) }); }
  };
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Schedule and publish events for this listing.</p><Button size="sm" onClick={() => { setDraft(emptyEvent); setEditing("new"); }}><Plus className="mr-1 h-4 w-4" /> Add event</Button></div>
    <CollectionState loading={query.isLoading} error={query.isError} retry={() => void query.refetch()} empty={!query.data?.events.length}>
      {query.data?.events.map((item) => <div key={item.id} className="rounded-lg border bg-card px-4 py-3" data-testid={`event-${item.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{item.title}</strong><Badge variant={item.isPublished ? "default" : "secondary"}>{item.isPublished ? "Published" : "Draft"}</Badge></div><p className="text-xs text-muted-foreground">{displayDate(item.startsAt)}{item.endsAt ? ` – ${displayDate(item.endsAt)}` : ""}{item.capacityLimit ? ` · ${item.rsvpCount ?? 0}/${item.capacityLimit} RSVPs` : ""}</p>{item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}</div>
          <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={update.isPending} onClick={() => void changeVisibility(item)}>{item.isPublished ? "Move to draft" : "Publish"}</Button><Button size="icon" variant="ghost" aria-label={`Edit ${item.title}`} onClick={() => { setDraft(eventDraft(item)); setEditing(item.id); }}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" aria-label={`Remove ${item.title}`} onClick={() => setRemoving(item)}><Trash2 className="h-4 w-4" /></Button></div></div>
      </div>)}
    </CollectionState>
    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !pending) setEditing(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editing === "new" ? "Add event" : "Edit event"}</DialogTitle><DialogDescription>Set the schedule and choose whether guests can see it.</DialogDescription></DialogHeader>
      <form onSubmit={(event) => void save(event)} className="space-y-4">
        <Field id="event-title" label="Title"><Input id="event-title" required maxLength={120} value={draft.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field id="event-description" label="Description"><Textarea id="event-description" maxLength={2000} value={draft.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <ImageField id="event-image" profileId={profileId} value={draft.imageUrl} onChange={(value) => set("imageUrl", value)} onUploadingChange={setUploading} />
        <div className="grid gap-4 sm:grid-cols-2"><Field id="event-start" label="Starts at"><Input id="event-start" type="datetime-local" required value={draft.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field><Field id="event-end" label="Ends at (optional)"><Input id="event-end" type="datetime-local" value={draft.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></Field></div>
        <Field id="event-capacity" label="Capacity limit (optional)"><Input id="event-capacity" type="number" min={1} step={1} value={draft.capacityLimit} onChange={(e) => set("capacityLimit", e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isPublished} onChange={(e) => set("isPublished", e.target.checked)} /> Publish this event</label>
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save event"}</Button></DialogFooter>
      </form></DialogContent></Dialog>
    <ConfirmRemove open={!!removing} title={`Remove ${removing?.title ?? "event"}?`} description="This permanently removes the event and cannot be undone." pending={remove.isPending} onCancel={() => setRemoving(null)} onConfirm={() => void confirmRemove()} />
  </div>;
}

type RewardDraft = { title: string; description: string; prizeDescription: string; rewardType: "free_drink" | "discount" | "experience" | "custom"; status: "draft" | "active" | "cancelled" | "completed"; startDate: string; endDate: string; venueTimezone: string };
const emptyReward: RewardDraft = { title: "", description: "", prizeDescription: "", rewardType: "custom", status: "draft", startDate: "", endDate: "", venueTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" };
const rewardDraft = (item: VenueManagerReward): RewardDraft => ({ title: item.title, description: item.description ?? "", prizeDescription: item.prizeDescription, rewardType: item.rewardType, status: item.status, startDate: localDate(item.startDate), endDate: localDate(item.endDate), venueTimezone: item.venueTimezone });

function Rewards({ profileId }: { profileId: number }) {
  const { toast } = useToast(); const client = useQueryClient();
  const query = useListAdminManagedRewards(profileId);
  const refresh = () => client.invalidateQueries({ queryKey: getListAdminManagedRewardsQueryKey(profileId) });
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [removing, setRemoving] = useState<VenueManagerReward | null>(null);
  const [draft, setDraft] = useState<RewardDraft>(emptyReward);
  const create = useCreateAdminManagedReward(); const update = useUpdateAdminManagedReward(); const remove = useDeleteAdminManagedReward();
  const pending = create.isPending || update.isPending;
  const set = <K extends keyof RewardDraft>(key: K, value: RewardDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (new Date(draft.endDate) <= new Date(draft.startDate)) { toast({ variant: "destructive", title: "End must be after start" }); return; }
    try { new Intl.DateTimeFormat("en", { timeZone: draft.venueTimezone }); }
    catch { toast({ variant: "destructive", title: "Enter a valid IANA timezone", description: "For example, America/New_York." }); return; }
    const data: VenueManagerRewardInput = { title: draft.title.trim(), description: optional(draft.description), prizeDescription: draft.prizeDescription.trim(), rewardType: draft.rewardType, status: draft.status === "active" ? "active" : "draft", startDate: isoDate(draft.startDate), endDate: isoDate(draft.endDate), venueTimezone: draft.venueTimezone.trim() };
    try {
      if (editing === "new") await create.mutateAsync({ id: profileId, data });
      else if (typeof editing === "number") await update.mutateAsync({ id: profileId, rewardId: editing, data: { ...data, status: draft.status === "completed" ? undefined : draft.status } });
      await refresh(); setEditing(null); toast({ title: "Reward saved" });
    } catch (error) { toast({ variant: "destructive", title: "Could not save reward", description: errorMessage(error) }); }
  };
  const changeStatus = async (item: VenueManagerReward, status: "draft" | "active" | "cancelled") => {
    try { await update.mutateAsync({ id: profileId, rewardId: item.id, data: { status } }); await refresh(); toast({ title: `Reward ${status}` }); }
    catch (error) { toast({ variant: "destructive", title: "Could not update reward", description: errorMessage(error) }); }
  };
  const confirmRemove = async () => {
    if (!removing) return;
    try { await remove.mutateAsync({ id: profileId, rewardId: removing.id }); await refresh(); setRemoving(null); toast({ title: "Reward cancelled" }); }
    catch (error) { toast({ variant: "destructive", title: "Could not cancel reward", description: errorMessage(error) }); }
  };
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Create and control venue rewards.</p><Button size="sm" onClick={() => { setDraft(emptyReward); setEditing("new"); }}><Plus className="mr-1 h-4 w-4" /> Add reward</Button></div>
    <CollectionState loading={query.isLoading} error={query.isError} retry={() => void query.refetch()} empty={!query.data?.rewards.length}>
      {query.data?.rewards.map((item) => <div key={item.id} className="rounded-lg border bg-card px-4 py-3" data-testid={`reward-${item.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{item.title}</strong><Badge variant={item.status === "active" ? "default" : "secondary"} className="capitalize">{item.status}</Badge></div><p className="text-xs text-muted-foreground">{item.prizeDescription} · {displayDate(item.startDate)} – {displayDate(item.endDate)}</p>{item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}</div>
          <div className="flex flex-wrap gap-1">{item.status !== "completed" && item.status !== "cancelled" && <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => void changeStatus(item, item.status === "active" ? "draft" : "active")}>{item.status === "active" ? "Move to draft" : "Activate"}</Button>}{item.status !== "completed" && <Button size="icon" variant="ghost" aria-label={`Edit ${item.title}`} onClick={() => { setDraft(rewardDraft(item)); setEditing(item.id); }}><Pencil className="h-4 w-4" /></Button>}{item.status !== "cancelled" && item.status !== "completed" && <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Cancel ${item.title}`} onClick={() => setRemoving(item)}><Trash2 className="h-4 w-4" /></Button>}</div></div>
      </div>)}
    </CollectionState>
    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !pending) setEditing(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editing === "new" ? "Add reward" : "Edit reward"}</DialogTitle><DialogDescription>Dates are entered in your local time. The venue timezone is recorded with the reward.</DialogDescription></DialogHeader>
      <form onSubmit={(event) => void save(event)} className="space-y-4">
        <Field id="reward-title" label="Title"><Input id="reward-title" required maxLength={120} value={draft.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field id="reward-description" label="Description"><Textarea id="reward-description" maxLength={2000} value={draft.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field id="reward-prize" label="Prize description"><Input id="reward-prize" required maxLength={200} value={draft.prizeDescription} onChange={(e) => set("prizeDescription", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field id="reward-type" label="Reward type"><select id="reward-type" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.rewardType} onChange={(e) => set("rewardType", e.target.value as RewardDraft["rewardType"])}><option value="custom">Custom</option><option value="free_drink">Free drink</option><option value="discount">Discount</option><option value="experience">Experience</option></select></Field><Field id="reward-status" label="Status"><select id="reward-status" className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.status} disabled={draft.status === "cancelled" || draft.status === "completed"} onChange={(e) => set("status", e.target.value as RewardDraft["status"])}><option value="draft">Draft</option><option value="active">Active</option>{draft.status === "cancelled" && <option value="cancelled">Cancelled</option>}{draft.status === "completed" && <option value="completed">Completed</option>}</select></Field></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field id="reward-start" label="Starts at"><Input id="reward-start" type="datetime-local" required value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field><Field id="reward-end" label="Ends at"><Input id="reward-end" type="datetime-local" required value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field></div>
        <Field id="reward-timezone" label="Venue timezone (IANA)"><Input id="reward-timezone" required placeholder="America/New_York" value={draft.venueTimezone} onChange={(e) => set("venueTimezone", e.target.value)} /></Field>
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save reward"}</Button></DialogFooter>
      </form></DialogContent></Dialog>
    <ConfirmRemove open={!!removing} title={`Cancel ${removing?.title ?? "reward"}?`} description="Removing a reward cancels it. This will not permanently delete its record." pending={remove.isPending} onCancel={() => setRemoving(null)} onConfirm={() => void confirmRemove()} />
  </div>;
}

type AdminAnnouncement = VenueManagerAnnouncement & { isHidden?: boolean };
type AnnouncementDraft = { title: string; body: string; imageUrl: string; isPinned: boolean; isHidden: boolean };
const emptyAnnouncement: AnnouncementDraft = { title: "", body: "", imageUrl: "", isPinned: false, isHidden: false };
const announcementDraft = (item: AdminAnnouncement): AnnouncementDraft => ({ title: item.title, body: item.body, imageUrl: item.imageUrl ?? "", isPinned: item.isPinned, isHidden: item.isHidden ?? false });

function Announcements({ profileId }: { profileId: number }) {
  const { toast } = useToast(); const client = useQueryClient();
  const query = useListAdminManagedAnnouncements(profileId);
  const refresh = () => client.invalidateQueries({ queryKey: getListAdminManagedAnnouncementsQueryKey(profileId) });
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [removing, setRemoving] = useState<AdminAnnouncement | null>(null);
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyAnnouncement);
  const [uploading, setUploading] = useState(false);
  const create = useCreateAdminManagedAnnouncement(); const update = useUpdateAdminManagedAnnouncement(); const remove = useDeleteAdminManagedAnnouncement();
  const pending = create.isPending || update.isPending || uploading;
  const set = <K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (uploading) return;
    const data: AdminManagedAnnouncementInput = { title: draft.title.trim(), body: draft.body.trim(), imageUrl: optional(draft.imageUrl), isPinned: draft.isPinned, isHidden: draft.isHidden };
    if (!data.title || !data.body) { toast({ variant: "destructive", title: "Title and body are required" }); return; }
    try {
      if (editing === "new") await create.mutateAsync({ id: profileId, data });
      else if (typeof editing === "number") await update.mutateAsync({ id: profileId, announcementId: editing, data });
      await refresh(); setEditing(null); toast({ title: "Announcement saved" });
    } catch (error) { toast({ variant: "destructive", title: "Could not save announcement", description: errorMessage(error) }); }
  };
  const changeVisibility = async (item: AdminAnnouncement) => {
    try { await update.mutateAsync({ id: profileId, announcementId: item.id, data: { isHidden: !item.isHidden } }); await refresh(); toast({ title: item.isHidden ? "Announcement published" : "Announcement hidden" }); }
    catch (error) { toast({ variant: "destructive", title: "Could not update announcement", description: errorMessage(error) }); }
  };
  const confirmRemove = async () => {
    if (!removing) return;
    try { await remove.mutateAsync({ id: profileId, announcementId: removing.id }); await refresh(); setRemoving(null); toast({ title: "Announcement removed" }); }
    catch (error) { toast({ variant: "destructive", title: "Could not remove announcement", description: errorMessage(error) }); }
  };
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Post updates to guests or keep them hidden as drafts.</p><Button size="sm" onClick={() => { setDraft(emptyAnnouncement); setEditing("new"); }}><Plus className="mr-1 h-4 w-4" /> Add announcement</Button></div>
    <CollectionState loading={query.isLoading} error={query.isError} retry={() => void query.refetch()} empty={!query.data?.announcements.length}>
      {query.data?.announcements.map((raw) => { const item = raw as AdminAnnouncement; return <div key={item.id} className="rounded-lg border bg-card px-4 py-3" data-testid={`announcement-${item.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{item.title}</strong><Badge variant={item.isHidden ? "secondary" : "default"}>{item.isHidden ? "Hidden" : "Published"}</Badge>{item.isPinned && <Badge variant="outline">Pinned</Badge>}</div><p className="text-sm text-muted-foreground line-clamp-2">{item.body}</p></div>
          <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={update.isPending} onClick={() => void changeVisibility(item)}>{item.isHidden ? "Publish" : "Hide"}</Button><Button size="icon" variant="ghost" aria-label={`Edit ${item.title}`} onClick={() => { setDraft(announcementDraft(item)); setEditing(item.id); }}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" aria-label={`Remove ${item.title}`} onClick={() => setRemoving(item)}><Trash2 className="h-4 w-4" /></Button></div></div>
      </div>; })}
    </CollectionState>
    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !pending) setEditing(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editing === "new" ? "Add announcement" : "Edit announcement"}</DialogTitle><DialogDescription>Hidden announcements are not visible to guests.</DialogDescription></DialogHeader>
      <form onSubmit={(event) => void save(event)} className="space-y-4">
        <Field id="announcement-title" label="Title"><Input id="announcement-title" required maxLength={120} value={draft.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field id="announcement-body" label="Message"><Textarea id="announcement-body" required maxLength={2000} rows={5} value={draft.body} onChange={(e) => set("body", e.target.value)} /></Field>
        <ImageField id="announcement-image" profileId={profileId} value={draft.imageUrl} onChange={(value) => set("imageUrl", value)} onUploadingChange={setUploading} />
        <div className="flex flex-wrap gap-6"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isPinned} onChange={(e) => set("isPinned", e.target.checked)} /> Pin announcement</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isHidden} onChange={(e) => set("isHidden", e.target.checked)} /> Keep hidden</label></div>
        <DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save announcement"}</Button></DialogFooter>
      </form></DialogContent></Dialog>
    <ConfirmRemove open={!!removing} title={`Remove ${removing?.title ?? "announcement"}?`} description="This permanently removes the announcement and cannot be undone." pending={remove.isPending} onCancel={() => setRemoving(null)} onConfirm={() => void confirmRemove()} />
  </div>;
}

export default function AdminManagedContent({ profileId }: { profileId: number }) {
  return <section className="space-y-4 border-t pt-6" aria-label="Venue content management">
    <div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-semibold">Venue content</h3><p className="mt-1 text-sm text-muted-foreground">Manage what guests see at this venue, directly from Admin.</p></div><RefreshCw className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></div>
    <Tabs defaultValue="events" className="w-full">
      <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="events" className="gap-1.5"><CalendarDays className="h-4 w-4" />Events</TabsTrigger><TabsTrigger value="rewards" className="gap-1.5"><Gift className="h-4 w-4" />Rewards</TabsTrigger><TabsTrigger value="announcements" className="gap-1.5"><Megaphone className="h-4 w-4" /><span className="hidden sm:inline">Announcements</span><span className="sm:hidden">Updates</span></TabsTrigger></TabsList>
      <TabsContent value="events" className="pt-3"><Events profileId={profileId} /></TabsContent>
      <TabsContent value="rewards" className="pt-3"><Rewards profileId={profileId} /></TabsContent>
      <TabsContent value="announcements" className="pt-3"><Announcements profileId={profileId} /></TabsContent>
    </Tabs>
  </section>;
}