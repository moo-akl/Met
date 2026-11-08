import { useMemo, useState } from "react";
import {
  getListAdminOpenStreetMapAttractionsQueryOptions,
  useListAdminOpenStreetMapAttractions,
  useImportApprovedTouristAttractions,
  useImportWorldTouristAttractions,
  useImportAdditionalWorldTouristAttractions,
  useQuickAddAdminVenue,
  type AdminOpenStreetMapAttraction,
  type ListAdminOpenStreetMapAttractionsCountry,
} from "@workspace/api-client-react";
import { ExternalLink, Loader2, MapPin, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const COUNTRIES: Array<{ code: ListAdminOpenStreetMapAttractionsCountry; name: string }> = [
  { code: "VN", name: "Vietnam" },
  { code: "MY", name: "Malaysia" },
  { code: "LA", name: "Laos" },
  { code: "KH", name: "Cambodia" },
];

const MAX_SELECTED_ATTRACTIONS = 25;

function venueTypeForAttraction(category: string): "culture" | "outdoors" | "other" {
  if (/national park|nature reserve|viewpoint|waterfall/i.test(category)) return "outdoors";
  if (/historic|museum|temple|palace|monument|ruins|archaeological/i.test(category)) return "culture";
  return "other";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The attraction could not be added.";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
};

export function OpenStreetMapAttractionImportDialog({ open, onOpenChange, onImported }: Props) {
  const { toast } = useToast();
  const [country, setCountry] = useState<ListAdminOpenStreetMapAttractionsCountry>("VN");
  const [searchRequested, setSearchRequested] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const queryOptions = getListAdminOpenStreetMapAttractionsQueryOptions({ country });
  const attractionQuery = useListAdminOpenStreetMapAttractions(
    { country },
    {
      query: {
        ...queryOptions,
        enabled: open && searchRequested,
        staleTime: 60_000,
        retry: false,
      },
    },
  );
  const importApprovedTouristAttractions = useImportApprovedTouristAttractions();
  const importWorldTouristAttractions = useImportWorldTouristAttractions();
  const importAdditionalWorldTouristAttractions = useImportAdditionalWorldTouristAttractions();
  const addVenue = useQuickAddAdminVenue();
  const attractions = attractionQuery.data?.attractions ?? [];
  const selectedAttractions = useMemo(
    () => attractions.filter((attraction) => selectedIds.has(attraction.placeId) && !attraction.alreadyAdded),
    [attractions, selectedIds],
  );

  const reset = () => {
    setSearchRequested(false);
    setSelectedIds(new Set());
    setReviewing(false);
    setResultMessage("");
  };

  const changeCountry = (value: string) => {
    setCountry(value as ListAdminOpenStreetMapAttractionsCountry);
    setSearchRequested(false);
    setSelectedIds(new Set());
    setReviewing(false);
    setResultMessage("");
  };

  const toggleSelection = (attraction: AdminOpenStreetMapAttraction, checked: boolean | "indeterminate") => {
    if (attraction.alreadyAdded) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        if (!next.has(attraction.placeId) && next.size >= MAX_SELECTED_ATTRACTIONS) {
          toast({
            title: "Batch limit reached",
            description: `Add up to ${MAX_SELECTED_ATTRACTIONS} attractions at a time.`,
            variant: "destructive",
          });
          return current;
        }
        next.add(attraction.placeId);
      } else {
        next.delete(attraction.placeId);
      }
      return next;
    });
  };

  const importSelected = async () => {
    if (importing || selectedAttractions.length === 0) return;
    setImporting(true);
    setResultMessage("");
    let addedCount = 0;
    const failures: string[] = [];

    for (const attraction of selectedAttractions) {
      try {
        await addVenue.mutateAsync({
          data: {
            placeId: attraction.placeId,
            placeName: attraction.placeName,
            businessName: attraction.placeName,
            lat: attraction.lat,
            lng: attraction.lng,
            managementMode: "admin",
            venueType: venueTypeForAttraction(attraction.category),
          },
        });
        addedCount += 1;
      } catch {
        failures.push(attraction.placeName);
      }
    }

    setImporting(false);
    if (addedCount > 0) {
      onImported();
      await attractionQuery.refetch();
    }

    const summary = failures.length
      ? `${addedCount} added; ${failures.length} could not be added.`
      : `${addedCount} Met-managed ${addedCount === 1 ? "listing" : "listings"} added.`;
    setResultMessage(summary);
    setSelectedIds(new Set());
    setReviewing(false);
    toast({
      title: failures.length ? "Import finished with skipped items" : "Attractions added",
      description: failures.length
        ? `${summary} ${failures.slice(0, 2).join(", ")}${failures.length > 2 ? " and more" : ""}.`
        : "The listings are now visible on Met’s map.",
      variant: failures.length && addedCount === 0 ? "destructive" : "default",
    });
  };

  const importApprovedShortlist = async () => {
    if (importing) return;
    setImporting(true);
    setResultMessage("");
    try {
      const result = await importApprovedTouristAttractions.mutateAsync();
      onImported();
      if (searchRequested) await attractionQuery.refetch();
      const summary =
        `${result.added} added, ${result.updated} updated, ` +
        `${result.photosUploaded} photos uploaded.`;
      setResultMessage(summary);
      setSelectedIds(new Set());
      setReviewing(false);
      toast({
        title: "Tourist attractions imported",
        description: summary,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      toast({
        title: "Attraction import failed",
        description: message,
        variant: "destructive",
      });
      setResultMessage(message);
    } finally {
      setImporting(false);
    }
  };

  const importWorldAttractions = async () => {
    if (importing) return;
    setImporting(true);
    setResultMessage("");
    try {
      const result = await importWorldTouristAttractions.mutateAsync();
      onImported();
      if (searchRequested) await attractionQuery.refetch();
      const summary =
        `${result.added} added, ${result.updated} updated, ` +
        `${result.photosUploaded} photos uploaded.`;
      setResultMessage(summary);
      setSelectedIds(new Set());
      setReviewing(false);
      toast({
        title: "World attractions imported",
        description: summary,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      toast({
        title: "World attraction import failed",
        description: message,
        variant: "destructive",
      });
      setResultMessage(message);
    } finally {
      setImporting(false);
    }
  };

  const importAdditionalWorldAttractions = async () => {
    if (importing) return;
    setImporting(true);
    setResultMessage("");
    try {
      const result = await importAdditionalWorldTouristAttractions.mutateAsync();
      onImported();
      if (searchRequested) await attractionQuery.refetch();
      const summary =
        `${result.added} added, ${result.updated} updated, ` +
        `${result.photosUploaded} photos uploaded.`;
      setResultMessage(summary);
      setSelectedIds(new Set());
      setReviewing(false);
      toast({
        title: "Additional world attractions imported",
        description: summary,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      toast({
        title: "Additional world attraction import failed",
        description: message,
        variant: "destructive",
      });
      setResultMessage(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (importing) return;
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90dvh] sm:max-w-[680px]" data-testid="dialog-osm-attraction-import">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Import tourist attractions
          </DialogTitle>
          <DialogDescription>
            Find notable OpenStreetMap places and add selected locations as Met-managed listings.
          </DialogDescription>
        </DialogHeader>

        {!reviewing ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-sm font-medium">Import the approved 20-place shortlist</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Adds missing places, fills in descriptions and categories, and uploads a reuse-licensed photo for each
                listing that does not already have one. Source and photo attribution are included.
              </p>
              <Button
                className="mt-3"
                onClick={importApprovedShortlist}
                disabled={importing}
                data-testid="button-import-approved-tourist-shortlist"
              >
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                Import all 20 and upload photos
              </Button>
            </div>

            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-sm font-medium">Add 40 more attractions from around the world</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Adds guest-ready descriptions, verified official links where available, and reuse-licensed photos.
                Photo credits and licenses stay in admin history and storage metadata.
              </p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={importWorldAttractions}
                disabled={importing}
                data-testid="button-import-world-tourist-attractions"
              >
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                Import 40 world attractions
              </Button>
            </div>

            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-sm font-medium">Add a separate second set of 40 attractions</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Adds 40 new places without replacing the first 40. Official links are included only where verified;
                photo credits and licenses stay in admin history and storage metadata.
              </p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={importAdditionalWorldAttractions}
                disabled={importing}
                data-testid="button-import-additional-world-tourist-attractions"
              >
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
                Import the second set of 40
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Select value={country} onValueChange={changeCountry} disabled={importing}>
                <SelectTrigger aria-label="Country" data-testid="select-osm-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  setSearchRequested(true);
                  setResultMessage("");
                }}
                disabled={attractionQuery.isFetching || importing}
                data-testid="button-search-osm-attractions"
              >
                {attractionQuery.isFetching
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Search className="mr-2 h-4 w-4" />}
                Find attractions
              </Button>
            </div>

            <p className="text-xs text-muted-foreground" data-testid="text-osm-attribution">
              Results prioritize notable places tagged with Wikipedia, Wikidata, or heritage references.
              Data © OpenStreetMap contributors under the ODbL.{" "}
              <a
                href={attractionQuery.data?.attributionUrl ?? "https://www.openstreetmap.org/copyright"}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Attribution details
              </a>
            </p>

            {attractionQuery.data?.source === "curated_fallback" && (
              <p
                className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm"
                role="status"
                data-testid="status-osm-curated-fallback"
              >
                OpenStreetMap’s live search is temporarily unavailable. Showing a curated shortlist instead; review each source link before adding.
              </p>
            )}

            {attractionQuery.isError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert" data-testid="status-osm-search-error">
                {getErrorMessage(attractionQuery.error)}
              </p>
            )}
            {resultMessage && (
              <p className="rounded-md border bg-muted/30 p-3 text-sm" role="status" data-testid="status-osm-import-result">
                {resultMessage}
              </p>
            )}

            <ScrollArea className="h-[min(48vh,420px)] rounded-md border">
              <div className="space-y-2 p-3">
                {attractions.map((attraction) => {
                  const checked = selectedIds.has(attraction.placeId);
                  return (
                    <div
                      key={attraction.placeId}
                      className={`flex gap-3 rounded-lg border p-3 ${
                        attraction.alreadyAdded ? "bg-muted/30 opacity-70" : "hover:bg-muted/30"
                      }`}
                      data-testid={`row-osm-attraction-${attraction.placeId}`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleSelection(attraction, value)}
                        disabled={attraction.alreadyAdded || importing}
                        aria-label={`Select ${attraction.placeName}`}
                        data-testid={`checkbox-osm-attraction-${attraction.placeId}`}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{attraction.placeName}</p>
                          {attraction.alreadyAdded && <Badge variant="secondary">Already added</Badge>}
                        </div>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">{attraction.category}</p>
                        <a
                          href={attraction.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                          data-testid={`link-osm-source-${attraction.placeId}`}
                        >
                          OpenStreetMap source <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
                {attractionQuery.isLoading && (
                  <p className="py-8 text-center text-sm text-muted-foreground">Searching OpenStreetMap…</p>
                )}
                {searchRequested && !attractionQuery.isLoading && !attractionQuery.isError && attractions.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No notable attractions were found for this country. Try again later.
                  </p>
                )}
                {!searchRequested && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Choose a country, then search for notable attractions.
                  </p>
                )}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
                Close
              </Button>
              <Button
                onClick={() => setReviewing(true)}
                disabled={selectedAttractions.length === 0 || importing}
                data-testid="button-review-osm-selection"
              >
                Review {selectedAttractions.length} selected
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="font-medium">
                Add {selectedAttractions.length} Met-managed {selectedAttractions.length === 1 ? "listing" : "listings"}?
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                These listings become visible on Met’s map and receive QR check-in links. They are not official profiles
                from the attraction operators. Only display QR codes at locations where you have permission.
              </p>
            </div>
            <ScrollArea className="max-h-[38vh] rounded-md border">
              <ul className="space-y-2 p-3">
                {selectedAttractions.map((attraction) => (
                  <li key={attraction.placeId} className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{attraction.placeName}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewing(false)} disabled={importing}>
                Back to selection
              </Button>
              <Button
                onClick={() => void importSelected()}
                disabled={importing || selectedAttractions.length === 0}
                data-testid="button-confirm-osm-import"
              >
                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {importing ? "Adding listings…" : "Add selected"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
