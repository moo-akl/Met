/**
 * Module-level pub/sub for venue QR verification state.
 *
 * When a user scans a venue's QR code (either in-app via qr-scan.tsx or via
 * deep link), this module records the verified placeId in memory and notifies
 * all subscribers (e.g. useHubCheckin) so the badge and venue page update
 * without needing a page reload.
 *
 * State is intentionally in-memory only — it mirrors the server-side
 * venue_qr_verifications table which is the source of truth. On app restart the
 * checkin API response re-hydrates isQrVerified from the DB.
 */

type Listener = (placeId: string, streak?: number) => void;

const _listeners = new Set<Listener>();
const _verified = new Set<string>(); // placeIds verified this session

/** True when the user has QR-verified the given placeId this session. */
export function getQrVerified(placeId: string): boolean {
  return _verified.has(placeId);
}

/**
 * Record that the user successfully scanned the QR code at placeId.
 * Optionally carries the streak awarded by the server so that subscribers
 * can update the badge without waiting for the next GPS poll.
 * Notifies all subscribers immediately.
 */
export function markQrVerified(placeId: string, streak?: number): void {
  _verified.add(placeId);
  _listeners.forEach((fn) => fn(placeId, streak));
}

/**
 * Subscribe to QR verification events.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function subscribeQrVerification(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
