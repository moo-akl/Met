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
  approximateDistanceMeters?: number | null,
): string {
  if (
    (ownerUid && viewerUid && ownerUid === viewerUid) ||
    joinRequestStatus === "accepted"
  ) {
    return `/event-chat/${eventId}`;
  }
  const distanceQuery =
    approximateDistanceMeters != null &&
    Number.isFinite(approximateDistanceMeters) &&
    approximateDistanceMeters >= 0
      ? `?approxDistance=${Math.round(approximateDistanceMeters / 100) * 100}`
      : "";
  return `/event-details/member/${eventId}${distanceQuery}`;
}
