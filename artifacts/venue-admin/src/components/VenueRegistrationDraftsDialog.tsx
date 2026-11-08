import { useMemo, useState } from "react";
import {
  useGetVenueRegistrationDraftTargets,
  type VenueRegistrationDraftResult,
} from "@workspace/api-client-react";
import { AlertCircle, CheckCircle2, FileUp, Loader2, Mail, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const MAX_PDF_BYTES = 3 * 1024 * 1024;
const OPERATION_STORAGE_PREFIX = "met-venue-registration-draft-op-v1";

type DraftRowState = Pick<
  VenueRegistrationDraftResult,
  "status" | "message" | "expiresAt"
>;

function operationStorageKey(profileId: number) {
  return `${OPERATION_STORAGE_PREFIX}:${profileId}`;
}

function getOperationId(profileId: number): string {
  const key = operationStorageKey(profileId);
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const operationId = crypto.randomUUID();
  window.sessionStorage.setItem(key, operationId);
  return operationId;
}

function replaceOperationId(profileId: number): string {
  const key = operationStorageKey(profileId);
  const operationId = crypto.randomUUID();
  window.sessionStorage.setItem(key, operationId);
  return operationId;
}

function friendlyStatus(status: DraftRowState["status"]): string {
  switch (status) {
    case "created":
      return "Draft created";
    case "already_created":
      return "Draft already exists";
    case "uncertain":
      return "Check Gmail Drafts";
    case "failed":
      return "Could not create";
  }
}

export default function VenueRegistrationDraftsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useGetVenueRegistrationDraftTargets({
      query: { enabled: open, refetchOnWindowFocus: false },
    });
  const targets = data?.targets ?? [];
  const [filesByName, setFilesByName] = useState<Record<string, File>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Record<number, DraftRowState>>({});

  const eligibleTargets = useMemo(
    () => targets.filter((target) => target.eligible && target.profileId !== null),
    [targets],
  );
  const allFilesReady =
    targets.length === 12 &&
    Object.keys(filesByName).length === 12 &&
    targets.every(
      (target) =>
        target.eligible &&
        target.profileId !== null &&
        filesByName[target.pdfFilename] !== undefined,
    );
  const completedCount = eligibleTargets.filter((target) => {
    const result = target.profileId === null ? undefined : results[target.profileId];
    return result?.status === "created" || result?.status === "already_created";
  }).length;

  const selectFiles = (selected: FileList | null) => {
    const next: Record<string, File> = {};
    const invalid: string[] = [];
    const expectedFilenames = new Set(targets.map((target) => target.pdfFilename));
    for (const file of Array.from(selected ?? [])) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        invalid.push(`${file.name}: not a PDF`);
      } else if (file.size > MAX_PDF_BYTES) {
        invalid.push(`${file.name}: over 3 MB`);
      } else if (expectedFilenames.size > 0 && !expectedFilenames.has(file.name)) {
        invalid.push(`${file.name}: not one of the 12 expected PDFs`);
      } else if (next[file.name]) {
        invalid.push(`${file.name}: selected more than once`);
      } else {
        next[file.name] = file;
      }
    }
    setFilesByName(next);
    setConfirmed(false);
    setFileError(invalid.length > 0 ? invalid.join("; ") : null);
  };

  const createDrafts = async () => {
    if (!allFilesReady || !confirmed || creating) return;
    setCreating(true);
    setProgress(0);
    let finished = 0;

    for (const target of eligibleTargets) {
      const profileId = target.profileId;
      const file = filesByName[target.pdfFilename];
      if (profileId === null || !file) continue;
      const prior = results[profileId];
      if (prior?.status === "created" || prior?.status === "already_created") {
        finished += 1;
        setProgress(finished);
        continue;
      }

      try {
        const operationId = prior?.status === "failed"
          ? replaceOperationId(profileId)
          : getOperationId(profileId);
        const response = await fetch(
          `/api/admin/venue-owner/applications/${profileId}/registration-draft`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/pdf",
              "X-Venue-Draft-Operation": operationId,
            },
            body: file,
          },
        );
        const payload = await response.json().catch(() => null) as
          | VenueRegistrationDraftResult
          | { message?: string }
          | null;
        if (
          payload &&
          "status" in payload &&
          ["created", "already_created", "uncertain", "failed"].includes(payload.status)
        ) {
          setResults((current) => ({
            ...current,
            [profileId]: {
              status: payload.status as DraftRowState["status"],
              message: payload.message,
              expiresAt: payload.expiresAt,
            },
          }));
        } else {
          const message = payload && "message" in payload
            ? payload.message
            : `Request failed (${response.status}).`;
          setResults((current) => ({
            ...current,
            [profileId]: {
              status: response.status >= 500 ? "uncertain" : "failed",
              message: response.status >= 500
                ? "The result could not be confirmed. Check Gmail Drafts before retrying."
                : message ?? "The draft could not be created.",
              expiresAt: null,
            },
          }));
        }
      } catch {
        setResults((current) => ({
          ...current,
          [profileId]: {
            status: "uncertain",
            message: "The result could not be confirmed. Check Gmail Drafts before retrying.",
            expiresAt: null,
          },
        }));
      }

      finished += 1;
      setProgress(finished);
    }

    setCreating(false);
    void refetch();
  };

  const allComplete =
    eligibleTargets.length === 12 &&
    eligibleTargets.every((target) => {
      const result = target.profileId === null ? undefined : results[target.profileId];
      return result?.status === "created" || result?.status === "already_created";
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!creating) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Prepare venue registration drafts</DialogTitle>
          <DialogDescription>
            Review the 12 recipients and matching PDFs. This creates unsent Gmail drafts only; it never sends email.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Each draft gets a fresh, email-bound registration link and its matching PDF. Existing links stay valid. Uploaded files are processed in memory and are not saved by this workflow.
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">1. Verify recipients and PDF filenames</p>
                <p className="text-sm text-muted-foreground">
                  The optimized PDFs must each be smaller than 3 MB.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Refresh
              </Button>
            </div>

            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading the approved venue list…</p>
            ) : isError ? (
              <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
                {error instanceof Error ? error.message : "Could not load the venue list."}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Venue</th>
                      <th className="px-3 py-2 font-medium">Recipient</th>
                      <th className="px-3 py-2 font-medium">PDF</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {targets.map((target) => {
                      const result = target.profileId === null
                        ? undefined
                        : results[target.profileId];
                      const selectedFile = filesByName[target.pdfFilename];
                      return (
                        <tr key={target.pdfFilename} className="border-t align-top">
                          <td className="px-3 py-2 font-medium">{target.businessName}</td>
                          <td className="px-3 py-2">{target.contactEmail ?? "No recipient email"}</td>
                          <td className="px-3 py-2">
                            <span className="block max-w-[250px] break-all text-xs">{target.pdfFilename}</span>
                            {selectedFile ? (
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB selected
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            {result ? (
                              <span className={`inline-flex items-center gap-1 ${result.status === "failed" || result.status === "uncertain" ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                                {result.status === "created" || result.status === "already_created"
                                  ? <CheckCircle2 className="h-4 w-4" />
                                  : <AlertCircle className="h-4 w-4" />}
                                {friendlyStatus(result.status)}
                              </span>
                            ) : target.eligible ? (
                              selectedFile ? "Ready" : "Awaiting PDF"
                            ) : (
                              <span className="text-destructive">{target.ineligibilityReason}</span>
                            )}
                            {result?.message ? (
                              <span className="mt-1 block max-w-[220px] text-xs text-muted-foreground">
                                {result.message}
                              </span>
                            ) : null}
                            {result?.expiresAt && (result.status === "created" || result.status === "already_created") ? (
                              <span className="mt-1 block text-xs text-muted-foreground">
                                Link expires {new Date(result.expiresAt).toLocaleDateString()}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {targets.some((target) => !target.eligible) ? (
              <p className="text-sm text-destructive">
                Draft creation is blocked until every target is eligible.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <p className="font-medium">2. Upload the 12 optimized PDFs</p>
            <Input
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(event) => selectFiles(event.currentTarget.files)}
              disabled={targets.length === 0 || isLoading || isError || creating}
              aria-label="Select the 12 optimized venue introduction PDFs"
            />
            <p className="text-sm text-muted-foreground">
              Select the extracted files with the exact filenames shown above. Original 52 MB PDFs are too large.
            </p>
            {fileError ? (
              <p className="text-sm text-destructive">{fileError}</p>
            ) : null}
            {Object.keys(filesByName).length > 0 ? (
              <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Paperclip className="h-4 w-4" />
                {Object.keys(filesByName).length} PDF file(s) selected
              </p>
            ) : null}
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <p className="font-medium">3. Confirm before creating drafts</p>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.currentTarget.checked)}
                disabled={!allFilesReady || creating}
              />
              <span>
                I verified all 12 recipient addresses and PDF matches, and I want to create unsent Gmail drafts.
              </span>
            </label>
          </div>

          {allComplete ? (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
              All 12 drafts are in Gmail Drafts. None have been sent.
            </div>
          ) : null}
          {creating ? (
            <p className="text-sm text-muted-foreground">
              Creating draft {Math.min(progress + 1, eligibleTargets.length)} of {eligibleTargets.length}…
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => void createDrafts()}
            disabled={!allFilesReady || !confirmed || creating || allComplete}
          >
            {creating
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Mail className="mr-2 h-4 w-4" />}
            {creating ? "Creating drafts…" : `Create unsent drafts (${12 - completedCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
