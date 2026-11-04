export type EventInviteResolveFailure =
  | "unavailable"
  | "wrongPasscode"
  | "loadFailure";

export function classifyEventInviteResolveError(
  error: unknown,
): EventInviteResolveFailure {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (status === 404) return "unavailable";
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("passcode")) return "wrongPasscode";
  return "loadFailure";
}
