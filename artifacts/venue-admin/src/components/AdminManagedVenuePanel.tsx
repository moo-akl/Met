import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAdminManagedVenue,
  useUpdateAdminManagedVenue,
  getGetAdminManagedVenueQueryKey,
  getGetVenueApplicationForReviewQueryKey,
  getListVenueApplicationsQueryKey,
  type AdminManagedVenueUpdate,
} from "@workspace/api-client-react";
import { Copy, Loader2, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import AdminManagedContent from "@/components/AdminManagedContent";

const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Hours = Record<string, { open: string; close: string } | null>;

const blankDetails = {
  businessName: "",
  tagline: "",
  description: "",
  phone: "",
  websiteUrl: "",
  publicEmail: "",
  coverPhotoUrl: "",
  logoUrl: "",
};

export default function AdminManagedVenuePanel({ profileId }: { profileId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useGetAdminManagedVenue(profileId);
  const profile = data?.profile;
  const [details, setDetails] = useState(blankDetails);
  const [hours, setHours] = useState<Hours>({});

  // Initialize once for each selected venue. A background refetch should not
  // overwrite the admin's unsaved edits.
  useEffect(() => {
    if (!profile) return;
    setDetails({
      businessName: profile.businessName,
      tagline: profile.tagline ?? "",
      description: profile.description ?? "",
      phone: profile.phone ?? "",
      websiteUrl: profile.websiteUrl ?? "",
      publicEmail: profile.publicEmail ?? "",
      coverPhotoUrl: profile.coverPhotoUrl ?? "",
      logoUrl: profile.logoUrl ?? "",
    });
    setHours(profile.openingHours ?? {});
  }, [profile?.id]);

  const save = useUpdateAdminManagedVenue({
    mutation: {
      onSuccess: async (result) => {
        queryClient.setQueryData(getGetAdminManagedVenueQueryKey(profileId), result);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetVenueApplicationForReviewQueryKey(profileId) }),
          queryClient.invalidateQueries({ queryKey: getListVenueApplicationsQueryKey() }),
        ]);
        toast({ title: "Venue details saved", description: "The public listing has been updated." });
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Could not save venue", description: error.message });
      },
    },
  });

  if (isLoading) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading venue management…</CardContent></Card>;
  if (isError || !profile) {
    return (
      <Card><CardContent className="p-6 space-y-3 text-sm">
        <p>Venue management is unavailable right now.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>Retry</Button>
      </CardContent></Card>
    );
  }

  const setField = (key: keyof typeof blankDetails, value: string) => setDetails((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input: AdminManagedVenueUpdate = {
      businessName: details.businessName.trim(),
      tagline: details.tagline.trim() || null,
      description: details.description.trim() || null,
      phone: details.phone.trim() || null,
      websiteUrl: details.websiteUrl.trim() || null,
      publicEmail: details.publicEmail.trim() || null,
      coverPhotoUrl: details.coverPhotoUrl.trim() || null,
      logoUrl: details.logoUrl.trim() || null,
      openingHours: hours,
    };
    save.mutate({ id: profileId, data: input });
  };

  return (
    <Card className="border-primary/30 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-primary" />Manage this venue</CardTitle>
        <CardDescription>This venue is managed here in Venue Admin. No owner was invited and no Venue Manager account is needed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {profile.qrUrl && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <Label>Venue check-in QR link</Label>
            <p className="text-xs text-muted-foreground">Use this link in the venue's QR code. Guests without Met will go to their app store.</p>
            <div className="flex gap-2">
              <Input readOnly aria-label="Venue check-in link" value={profile.qrUrl} className="text-xs" />
              <Button type="button" size="icon" variant="outline" aria-label="Copy venue check-in link" onClick={() => {
                void navigator.clipboard.writeText(profile.qrUrl!).then(
                  () => toast({ title: "QR link copied" }),
                  () => toast({ variant: "destructive", title: "Could not copy link" }),
                );
              }}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="managed-name">Venue display name</Label>
            <Input id="managed-name" maxLength={255} required value={details.businessName} onChange={(e) => setField("businessName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="managed-tagline">Tagline</Label>
            <Input id="managed-tagline" maxLength={160} value={details.tagline} onChange={(e) => setField("tagline", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="managed-description">Description</Label>
            <Textarea id="managed-description" maxLength={1000} value={details.description} onChange={(e) => setField("description", e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="managed-phone">Public phone</Label><Input id="managed-phone" maxLength={60} value={details.phone} onChange={(e) => setField("phone", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="managed-email">Public email</Label><Input id="managed-email" type="email" maxLength={320} value={details.publicEmail} onChange={(e) => setField("publicEmail", e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="managed-website">Website URL</Label><Input id="managed-website" type="url" placeholder="https://" maxLength={2000} value={details.websiteUrl} onChange={(e) => setField("websiteUrl", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="managed-cover">Cover photo URL</Label><Input id="managed-cover" maxLength={2000} value={details.coverPhotoUrl} onChange={(e) => setField("coverPhotoUrl", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="managed-logo">Logo URL</Label><Input id="managed-logo" maxLength={2000} value={details.logoUrl} onChange={(e) => setField("logoUrl", e.target.value)} /></div>
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Opening hours</legend>
            <p className="text-xs text-muted-foreground">Choose unknown if you do not want to display hours for a day.</p>
            {days.map((day) => {
              const value = hours[day];
              return (
                <div key={day} className="grid grid-cols-[minmax(75px,1fr)_minmax(90px,1fr)] sm:grid-cols-[100px_130px_1fr_1fr] gap-2 items-center">
                  <span className="text-sm capitalize">{day}</span>
                  <select aria-label={`${day} status`} className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={value === undefined ? "unknown" : value === null ? "closed" : "open"} onChange={(e) => {
                    const status = e.target.value;
                    setHours((current) => {
                      const next = { ...current };
                      if (status === "unknown") delete next[day];
                      else next[day] = status === "closed" ? null : { open: "09:00", close: "17:00" };
                      return next;
                    });
                  }}>
                    <option value="unknown">Unknown</option><option value="closed">Closed</option><option value="open">Open</option>
                  </select>
                  {value && (
                    <div className="col-span-2 sm:col-span-2 grid grid-cols-2 gap-2">
                      <Input aria-label={`${day} opens at`} type="time" required value={value.open} onChange={(e) => setHours((current) => ({ ...current, [day]: { ...current[day]!, open: e.target.value } }))} />
                      <Input aria-label={`${day} closes at`} type="time" required value={value.close} onChange={(e) => setHours((current) => ({ ...current, [day]: { ...current[day]!, close: e.target.value } }))} />
                    </div>
                  )}
                </div>
              );
            })}
          </fieldset>
          <Button type="submit" disabled={save.isPending || !details.businessName.trim()}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save venue details
          </Button>
        </form>
        <AdminManagedContent key={profileId} profileId={profileId} />
      </CardContent>
    </Card>
  );
}