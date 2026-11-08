import { useMemo, useState } from "react";
import { sendManualVenueEmail, type VenueEmailTemplate } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { templatePreview } from "./VenueEmailTemplateManager";
import { keepRetryablePastedRecipients, parsePastedVenueRecipients } from "./pasted-venue-recipients";
import {
  getVenueSendErrorMessage,
  isConfirmedVenueSendFailure,
  sendVenueBatch,
  shouldContinueVenueBatchAfterFailure,
} from "./venue-outreach-worklist";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: VenueEmailTemplate[];
  onSent: () => Promise<unknown>;
};

export default function PastedVenueEmailDialog({ open, onOpenChange, templates, onSent }: Props) {
  const [input, setInput] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [review, setReview] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ sent: number; rejected: number; uncertain: number; remaining: number; detail: string } | null>(null);
  const parsed = useMemo(() => parsePastedVenueRecipients(input), [input]);
  const template = templates.find((item) => item.id === templateId);
  const ready = parsed.recipients.length > 0 && parsed.issues.length === 0 && !!template && !result;

  const send = async () => {
    if (!ready || sending) return;
    setSending(true);
    let currentEmail = "";
    try {
      const outcome = await sendVenueBatch(parsed.recipients, async (recipient) => {
        currentEmail = recipient.recipientEmail;
        const response = await sendManualVenueEmail({ ...recipient, templateId, bulkInvitation: true });
        if (!response.emailSent) throw new Error("Delivery was not confirmed.");
      }, ({ current, total }) => setProgress(`Sending ${current} of ${total}`), Infinity, shouldContinueVenueBatchAfterFailure);
      const terminalIsConfirmedNotSent = Boolean(outcome.error && isConfirmedVenueSendFailure(outcome.error));
      const rejectedCount = outcome.continuedFailures.length + (terminalIsConfirmedNotSent ? 1 : 0);
      const uncertainCount = outcome.error && !terminalIsConfirmedNotSent ? 1 : 0;
      const rejectedDetails = outcome.continuedFailures.map(({ recipient, error }) =>
        `Rejected before sending to ${recipient.recipientEmail}: ${getVenueSendErrorMessage(error)}. The batch continued.`,
      );
      const stoppedDetail = outcome.error
        ? terminalIsConfirmedNotSent
          ? `The request for ${currentEmail} was rejected before sending: ${getVenueSendErrorMessage(outcome.error)}. Later recipients were not attempted.`
          : `Delivery to ${currentEmail} was not confirmed. Check Gmail Sent before retrying this address. Later recipients were not attempted.`
        : "";
      const stoppedRejectedRecipient = terminalIsConfirmedNotSent
        ? parsed.recipients.find((recipient) => recipient.recipientEmail === currentEmail) ?? null
        : null;
      const retryableRecipients = keepRetryablePastedRecipients(
        parsed.recipients,
        outcome.sentCount + outcome.failedCount,
        outcome.continuedFailures.map(({ recipient }) => recipient),
        stoppedRejectedRecipient,
      );
      setResult({
        sent: outcome.sentCount,
        rejected: rejectedCount,
        uncertain: uncertainCount,
        remaining: outcome.notAttemptedCount,
        detail: [...rejectedDetails, stoppedDetail].filter(Boolean).join(" "),
      });
      // Keep only confirmed rejections and recipients that were not attempted.
      setInput(retryableRecipients.map((recipient) => recipient.recipientEmail).join("\n"));
      await onSent();
    } finally {
      setSending(false);
      setProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!sending) { onOpenChange(next); if (!next) setReview(false); } }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-slate-200 bg-[#fbfaf8] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{review ? "Review bulk email" : "Send to a pasted list"}</DialogTitle>
          <DialogDescription>
            {review
              ? "Each recipient receives a separate email. Confirmed rejections are skipped; the batch stops if delivery cannot be confirmed."
              : "Paste emails separated by commas, semicolons, spaces, or new lines. No venue names needed."}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div role="status" data-testid="status-pasted-send-result" className="space-y-3 rounded-md border border-slate-300 bg-white p-4 text-sm">
            <p className="font-semibold">{result.sent} sent · {result.rejected} rejected before sending · {result.uncertain} need checking · {result.remaining} not attempted</p>
            {result.detail && <p className="text-amber-900">{result.detail}</p>}
            <p>The draft keeps confirmed rejected and not-attempted addresses. Sent and uncertain addresses are removed to reduce accidental duplicate sends.</p>
          </div>
        ) : review ? (
          <>
            <p className="font-semibold" data-testid="text-pasted-recipient-count">{parsed.recipients.length} individual emails · {template?.name}</p>
            {template && <details className="rounded-md border bg-white p-3">
              <summary className="cursor-pointer text-sm font-semibold">Preview email · {template.subject}</summary>
              <iframe title="Pasted list email preview" sandbox="" referrerPolicy="no-referrer" srcDoc={templatePreview(template.body, template.format, { businessName: "your venue", recipientEmail: parsed.recipients[0]?.recipientEmail ?? "" }, true)} className="mt-3 h-64 w-full border-0" />
            </details>}
            {template && /\{\{\s*applicationUrl\s*\}\}/.test(`${template.subject} ${template.body}`) && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">A unique application invitation is created for each recipient. This does not approve venues or grant manager access.</p>}
            <ol className="max-h-52 space-y-2 overflow-y-auto rounded-md border bg-white p-3 text-sm">
              {parsed.recipients.map((recipient) => <li key={recipient.recipientEmail} className="break-all text-slate-700">{recipient.recipientEmail}</li>)}
            </ol>
          </>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pasted-venue-recipients">Email addresses</Label>
              <textarea id="pasted-venue-recipients" data-testid="input-pasted-recipients" value={input} onChange={(event) => setInput(event.target.value)} placeholder={"owner@example.com, manager@example.com\nhello@example.com"} className="min-h-44 w-full rounded-md border border-slate-300 bg-white p-3 text-sm" />
              <p className="text-xs text-slate-600">Duplicates are skipped. These emails open with “We’d love to invite you and your venue to use Met.” No venue names are needed.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pasted-email-template">Email template</Label>
              <select id="pasted-email-template" data-testid="select-pasted-template" value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Choose a template</option>
                {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <p className="text-sm" data-testid="text-pasted-validation">{parsed.recipients.length} ready · {parsed.duplicateCount} duplicates skipped · {parsed.issues.length} invalid entries</p>
            {parsed.issues.length > 0 && <ul role="alert" className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">{parsed.issues.map((issue, index) => <li key={index}>Line {issue.line}: {issue.reason}</li>)}</ul>}
          </div>
        )}
        {sending && <p role="status" className="text-sm">{progress}</p>}
        <DialogFooter>
          {result ? <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button type="button" onClick={() => { setResult(null); setReview(false); }}> {result.remaining || result.rejected ? "Review remaining recipients" : "Prepare another batch"}</Button>
          </> : <>
            <Button type="button" variant="outline" disabled={sending} onClick={() => review ? setReview(false) : onOpenChange(false)}>{review ? "Edit list" : "Cancel"}</Button>
            <Button type="button" data-testid={review ? "button-send-pasted-list" : "button-review-pasted-list"} disabled={!ready || sending} onClick={() => review ? void send() : setReview(true)} className="bg-[#25324a] text-white">
              {sending ? "Sending…" : review ? `Send to all ${parsed.recipients.length}` : `Review ${parsed.recipients.length} recipients`}
            </Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
