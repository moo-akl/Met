/**
 * Cached encounter rows are history, not live radar signals. Never feed
 * them back into a live discovery visualization while the user is hidden.
 */
export function visibleDiscoveryPeers<T>(
  isVisible: boolean,
  peers: T[],
): T[] {
  return isVisible ? peers : [];
}

/** Missing/malformed visibility must never be treated as an opt-in. */
export function isExplicitlyVisible(value: unknown): value is true {
  return value === true;
}