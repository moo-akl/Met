export type GmailFailureStatus = "failed" | "delivery_uncertain";

/** Only the sender can know whether an error happened before submission. */
export class GmailSendError extends Error {
  constructor(
    message: string,
    public readonly code: "GMAIL_AUTH" | "GMAIL_DELIVERY",
    public readonly deliveryStatus: GmailFailureStatus,
    public readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "GmailSendError";
  }
}

export function gmailFailureStatus(error: unknown): GmailFailureStatus {
  if (error instanceof GmailSendError) return error.deliveryStatus;
  // Retain compatibility with authentication errors from older senders.
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "GMAIL_AUTH" || code === "EAUTH") return "failed";
  // Network errors and lost responses may occur after Gmail accepted a send.
  return "delivery_uncertain";
}
