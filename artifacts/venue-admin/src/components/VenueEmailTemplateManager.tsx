import { useState } from "react";
import { createVenueEmailTemplate, updateVenueEmailTemplate, deleteVenueEmailTemplate, type VenueEmailTemplate, type VenueEmailTemplateInput } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import RichEmailBodyEditor, { plainTextEmailToHtml, sanitizeEmailHtml } from "@/components/RichEmailBodyEditor";

const emptyTemplate: VenueEmailTemplateInput = {
  name: "", subject: "", body: "<p>Hello {{businessName}} team,</p><p><br></p><p>Regards,<br>The Met venues team</p>", format: "html",
};
const previewValues: Record<string, string> = {
  businessName: "Example Venue", recipientEmail: "manager@example.com",
  venueManagerUrl: "https://met-app.org/venue-manager",
  applicationUrl: "https://met-app.org/venue-manager/apply#invite=preview-only",
};
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
export function templatePreview(body: string, format: string): string {
  const sample = body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => previewValues[key] ?? `{{${key}}}`);
  const content = format === "html" ? sample : `<div style="font:15px/1.7 Arial,sans-serif;padding:24px;white-space:pre-wrap;">${escapeHtml(sample)}</div>`;
  // Preview cannot run scripts, submit forms, or navigate the admin window.
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">${content}`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: VenueEmailTemplate[];
  onChanged: (templateId?: string) => Promise<unknown>;
};

export default function VenueEmailTemplateManager({ open, onOpenChange, templates, onChanged }: Props) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VenueEmailTemplateInput>({ ...emptyTemplate });
  const [initial, setInitial] = useState(JSON.stringify(emptyTemplate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== initial;
  const load = (template?: VenueEmailTemplate) => {
    if (dirty && !window.confirm("Discard the unsaved changes to this template?")) return;
    const next = template
      ? { name: template.name, subject: template.subject, body: template.body, format: template.format }
      : { ...emptyTemplate };
    setEditingId(template?.id ?? null); setDraft(next); setInitial(JSON.stringify(next)); setError("");
  };
  const save = async () => {
    setBusy(true); setError("");
    try {
      const body = draft.format === "text" ? plainTextEmailToHtml(draft.body) : draft.body;
      const input: VenueEmailTemplateInput = {
        ...draft,
        name: draft.name.trim(),
        subject: draft.subject.trim(),
        body: sanitizeEmailHtml(body),
        format: "html",
      };
      const saved = editingId ? await updateVenueEmailTemplate(editingId, input) : await createVenueEmailTemplate(input);
      setEditingId(saved.id); setDraft(input); setInitial(JSON.stringify(input));
      await onChanged(saved.id);
      toast({ title: "Template saved", description: "It is now available for individual and bulk emails." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The template could not be saved.");
    } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!editingId || !window.confirm(`Remove "${draft.name}" from the email template list? Previous email history will be kept.`)) return;
    setBusy(true); setError("");
    try {
      await deleteVenueEmailTemplate(editingId);
      setEditingId(null); setDraft({ ...emptyTemplate }); setInitial(JSON.stringify(emptyTemplate));
      await onChanged();
      toast({ title: "Template removed", description: "Previous emails remain in the history." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The template could not be removed.");
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (busy) return;
      if (!next && dirty && !window.confirm("Discard the unsaved template changes?")) return;
      if (!next) { setEditingId(null); setDraft({ ...emptyTemplate }); setInitial(JSON.stringify(emptyTemplate)); setError(""); }
      onOpenChange(next);
    }}>
      <DialogContent className="max-h-[94dvh] overflow-y-auto bg-[#fbfaf8] sm:max-w-[1100px]">
        <DialogHeader>
          <DialogTitle>Email templates</DialogTitle>
          <DialogDescription>Create, edit, or remove templates for manual emails. These changes do not alter automated system emails or application approvals.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[230px_minmax(0,1fr)]">
          <aside>
            <Button type="button" variant="outline" onClick={() => load()} disabled={busy} className="mb-3 w-full" data-testid="button-new-email-template">Create template</Button>
            <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 md:max-h-[550px]">
              {templates.map((template) => (
                <button key={template.id} type="button" onClick={() => load(template)} disabled={busy}
                  data-testid={`button-edit-template-${template.id}`} aria-pressed={editingId === template.id}
                  className={`block w-full rounded-md p-2.5 text-left text-sm ${editingId === template.id ? "bg-[#25324a] text-white" : "text-slate-700 hover:bg-slate-100"}`}>
                  {template.name}
                  <span className="mt-1 block text-[10px] opacity-65">{template.builtin ? "Built-in · editable" : "Custom"}</span>
                </button>
              ))}
              {templates.length === 0 && <p className="p-2 text-xs text-slate-500">No templates yet. Create your first template.</p>}
            </div>
          </aside>
          <div className="min-w-0 space-y-3">
            <h3 className="font-semibold text-[#25324a]">{editingId ? "Edit template" : "New template"}</h3>
            <label className="block text-xs font-medium">Template name
              <Input data-testid="input-email-template-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} maxLength={120} disabled={busy} className="mt-1 bg-white" />
            </label>
            <label className="block text-xs font-medium">Subject
              <Input data-testid="input-email-template-subject" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} maxLength={998} disabled={busy} className="mt-1 bg-white" />
            </label>
            <p className="text-xs leading-5 text-slate-500">
              Use the formatting toolbar to style your message. Add personalized fields from the menu; application links are created separately for each recipient. An email does not approve an application or grant account access.
            </p>
            <div className="space-y-4">
              <div className="min-w-0">
                <p className="text-xs font-medium">Email body</p>
                <RichEmailBodyEditor
                  value={draft.format === "text" ? plainTextEmailToHtml(draft.body) : draft.body}
                  onChange={(body) => setDraft({ ...draft, body, format: "html" })}
                  disabled={busy}
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium">Preview · example venue</p>
                <iframe title="Email template preview" sandbox="" referrerPolicy="no-referrer" srcDoc={templatePreview(draft.body, draft.format)}
                  className="mt-1 h-[300px] w-full rounded-md border border-slate-200 bg-white" />
              </div>
            </div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex flex-wrap justify-between gap-2">
              {editingId ? <Button type="button" variant="outline" onClick={() => void remove()} disabled={busy} data-testid="button-remove-email-template" className="text-red-700">Remove template</Button> : <span />}
              <Button type="button" onClick={() => void save()} disabled={busy || !draft.name.trim() || !draft.subject.trim() || !draft.body.trim()} data-testid="button-save-email-template" className="bg-[#25324a] text-white">{busy ? "Saving…" : "Save template"}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
