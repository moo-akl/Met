import { useEffect, useState, type FormEvent } from "react";
import type {
  VenueIntroProfile,
  VenueIntroProfileInput,
} from "@workspace/api-client-react";
import { Plus, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

type ProfileField = keyof VenueIntroProfileInput;

const fields: Array<{
  key: ProfileField;
  label: string;
  maxLength: number;
  multiline: boolean;
}> = [
  { key: "coverCopy", label: "Cover slide copy", maxLength: 240, multiline: true },
  { key: "slide2Heading", label: "Slide 2 heading", maxLength: 100, multiline: false },
  { key: "slide2Copy", label: "Slide 2 copy", maxLength: 300, multiline: true },
  { key: "slide3Heading", label: "Slide 3 heading", maxLength: 100, multiline: false },
  { key: "slide3Copy", label: "Slide 3 copy", maxLength: 300, multiline: true },
];

const emptyInput: VenueIntroProfileInput = {
  venueName: "",
  coverCopy: "",
  slide2Heading: "",
  slide2Copy: "",
  slide3Heading: "",
  slide3Copy: "",
};

type ProfileDraft = VenueIntroProfileInput & { key?: string };

async function readError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({})) as { message?: string };
  return payload.message ?? `Request failed (HTTP ${response.status}).`;
}

export default function VenueIntroProfilesPanel() {
  const [profiles, setProfiles] = useState<VenueIntroProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch("/api/venue-intro-profiles", {
          credentials: "include",
        });
        if (!response.ok) throw new Error(await readError(response));
        const payload = await response.json() as VenueIntroProfile[];
        if (!Array.isArray(payload) || payload.some((profile) =>
          !profile.key || !profile.venueName || !profile.coverCopy ||
          !profile.slide2Heading || !profile.slide2Copy ||
          !profile.slide3Heading || !profile.slide3Copy
        )) {
          throw new Error("The venue profile list is incomplete.");
        }
        if (!cancelled) setProfiles(payload);
      } catch (cause) {
        if (!cancelled) {
          setLoadError(
            cause instanceof Error ? cause.message : "Could not load venue profiles.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function startNewProfile() {
    setDraft({ ...emptyInput });
    setSaveError("");
    setNotice("");
  }

  function selectProfile(profile: VenueIntroProfile) {
    const { key, ...input } = profile;
    setDraft({ key, ...input });
    setSaveError("");
    setNotice("");
  }

  function updateField<K extends keyof VenueIntroProfileInput>(
    key: K,
    value: string,
  ) {
    setDraft((current) => current ? { ...current, [key]: value } : current);
    setNotice("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;

    setSaving(true);
    setSaveError("");
    setNotice("");
    try {
      const { key, ...input } = draft;
      const response = await fetch(
        key
          ? `/api/admin/venue-intro-profiles/${encodeURIComponent(key)}`
          : "/api/admin/venue-intro-profiles",
        {
          method: key ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!response.ok) throw new Error(await readError(response));
      const saved = await response.json() as VenueIntroProfile;
      setDraft(saved);
      setNotice(`${saved.venueName} profile saved.`);
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "Could not save the venue profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  const draftFields: Array<{ value: string; maxLength: number }> = draft
    ? [
        { value: draft.venueName, maxLength: 100 },
        { value: draft.coverCopy, maxLength: 240 },
        { value: draft.slide2Heading, maxLength: 100 },
        { value: draft.slide2Copy, maxLength: 300 },
        { value: draft.slide3Heading, maxLength: 100 },
        { value: draft.slide3Copy, maxLength: 300 },
      ]
    : [];
  const hasValidDraft =
    draftFields.length === 6 &&
    draftFields.every(
      ({ value, maxLength }) =>
        value.trim().length >= 2 && value.length <= maxLength,
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border bg-card px-6 py-5">
        <h1 className="text-lg font-bold tracking-tight">Venue introduction profiles</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Add or edit the venue copy used on slides 1–3. Shared product slides are not changed.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Profiles</h2>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading…" : `${profiles.length} available`}
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Reload profiles"
                onClick={() => setReloadKey((value) => value + 1)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button type="button" size="sm" onClick={startNewProfile}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {loading ? (
            <p className="p-4 text-sm text-muted-foreground" role="status">
              Loading venue profiles…
            </p>
          ) : loadError ? (
            <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              <p>{loadError}</p>
              <button
                type="button"
                className="mt-2 font-semibold underline"
                onClick={() => setReloadKey((value) => value + 1)}
              >
                Retry
              </button>
            </div>
          ) : (
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-3">
                {profiles.map((profile) => (
                  <button
                    type="button"
                    key={profile.key}
                    onClick={() => selectProfile(profile)}
                    aria-current={draft?.key === profile.key ? "true" : undefined}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      draft?.key === profile.key
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-card hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{profile.venueName}</span>
                    <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                      {profile.coverCopy}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </section>

        <section className="min-h-0 overflow-y-auto p-4 sm:p-6">
          {!draft ? (
            <div className="flex h-full min-h-48 items-center justify-center text-center">
              <div className="max-w-sm">
                <h2 className="font-semibold">Choose a profile to edit</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Or add a new venue profile. All six copy fields are checked before saving.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={saveProfile} className="mx-auto max-w-2xl space-y-5">
              <div>
                <h2 className="text-base font-semibold">
                  {draft.key ? "Edit venue profile" : "Add venue profile"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter a venue name and all five copy fields. Every field needs at least two non-space characters and must stay within its limit.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="intro-venue-name">Venue name</Label>
                <Input
                  id="intro-venue-name"
                  value={draft.venueName}
                  onChange={(event) => updateField("venueName", event.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="organization"
                />
                <p className="text-xs text-muted-foreground">
                  Used in the cover and in the generated PDF filename.
                </p>
              </div>

              {fields.map((field) => {
                const value = draft[field.key];
                const controlId = `intro-${field.key}`;
                return (
                  <div className="space-y-2" key={field.key}>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor={controlId}>{field.label}</Label>
                      <span className="text-xs text-muted-foreground">
                        {value.length}/{field.maxLength}
                      </span>
                    </div>
                    {field.multiline ? (
                      <Textarea
                        id={controlId}
                        value={value}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        required
                        minLength={2}
                        maxLength={field.maxLength}
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={controlId}
                        value={value}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        required
                        minLength={2}
                        maxLength={field.maxLength}
                      />
                    )}
                  </div>
                );
              })}

              {saveError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
                  {saveError}
                </p>
              )}
              {notice && (
                <p className="rounded-lg border border-emerald-600/20 bg-emerald-600/5 p-3 text-sm text-emerald-800" role="status">
                  {notice}
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button type="submit" disabled={saving || !hasValidDraft}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving…" : "Save profile"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setDraft(null);
                    setSaveError("");
                    setNotice("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
