/**
 * Module-level pub/sub for the "discovery hints" — the pulsing tab ring and
 * "Tap to compete!" tooltip shown to new users for their first 3 sessions.
 *
 * Centralised here so tapping either target permanently dismisses both
 * immediately, without needing a shared React context.
 */
import { loadHubTooltipDismissed, saveHubTooltipDismissed } from "./storage";

type Listener = () => void;
const _listeners = new Set<Listener>();
let _dismissed = false;

/** Read dismissal state synchronously (valid after initDiscoveryState resolves). */
export function isDiscoveryDismissedSync(): boolean {
  return _dismissed;
}

/**
 * Hydrate the in-memory flag from AsyncStorage on app boot.
 * Safe to call from multiple components — idempotent once dismissed.
 */
export async function initDiscoveryState(): Promise<void> {
  if (_dismissed) return;
  const stored = await loadHubTooltipDismissed().catch(() => false);
  if (stored) _dismissed = true;
}

/**
 * Subscribe to instant dismissal events.
 * Returns an unsubscribe function; call it in useEffect cleanup.
 */
export function subscribeDiscovery(fn: Listener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/**
 * Permanently dismiss both the tab ring and the tooltip.
 * Persists to AsyncStorage and notifies all subscribers immediately.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function dismissDiscoveryHints(): void {
  if (_dismissed) return;
  _dismissed = true;
  saveHubTooltipDismissed().catch(() => {});
  _listeners.forEach((fn) => fn());
}
