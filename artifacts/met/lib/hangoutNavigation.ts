export type HangoutJoinRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "withdrawn"
  | null
  | undefined;

export function getHangoutOpenPath(
  eventId: number,
  ownerUid: string | null | undefined,
  viewerUid: string | null | undefined,
  joinRequestStatus: HangoutJoinRequestStatus,
): string {
  if (
    (ownerUid && viewerUid && ownerUid === viewerUid) ||
    joinRequestStatus === "accepted"
  ) {
    return `/event-chat/${eventId}`;
  }
  return `/event-details/member/${eventId}`;
}
