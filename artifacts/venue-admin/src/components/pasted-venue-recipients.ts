import { z } from "zod";

const emailAddress = z.string().email().max(255);

export type PastedVenueRecipient = {
  businessName: string;
  recipientEmail: string;
};

export type PastedRecipientIssue = { line: number; reason: string };

export function keepRetryablePastedRecipients(
  recipients: PastedVenueRecipient[],
  attemptedCount: number,
  continuedRejections: PastedVenueRecipient[],
  stoppedRejectedRecipient: PastedVenueRecipient | null,
): PastedVenueRecipient[] {
  const rejectedEmails = new Set(
    [...continuedRejections, ...(stoppedRejectedRecipient ? [stoppedRejectedRecipient] : [])]
      .map(({ recipientEmail }) => recipientEmail.trim().toLowerCase()),
  );
  return recipients.filter((recipient, index) =>
    index >= attemptedCount || rejectedEmails.has(recipient.recipientEmail.trim().toLowerCase()),
  );
}

/** Accept an address-only list without requiring venue research or names. */
export function parsePastedVenueRecipients(input: string): {
  recipients: PastedVenueRecipient[];
  issues: PastedRecipientIssue[];
  duplicateCount: number;
} {
  const recipients: PastedVenueRecipient[] = [];
  const issues: PastedRecipientIssue[] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;
  for (const [index, raw] of input.split(/\r?\n/).entries()) {
    for (const token of raw.split(/[,;\s]+/).filter(Boolean)) {
      const recipientEmail = token.replace(/^<|>$/g, "").trim().toLowerCase();
      if (!emailAddress.safeParse(recipientEmail).success) {
        issues.push({ line: index + 1, reason: `Invalid email address: ${token}` });
        continue;
      }
      if (seen.has(recipientEmail)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(recipientEmail);
      // Do not infer a business name from an email address.
      recipients.push({ businessName: "your venue", recipientEmail });
    }
  }
  return { recipients, issues, duplicateCount };
}
