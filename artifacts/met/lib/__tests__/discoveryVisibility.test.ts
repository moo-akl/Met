import {
  isExplicitlyVisible,
  visibleDiscoveryPeers,
} from "@/lib/discoveryVisibility";

describe("cached discovery peers", () => {
  it("does not expose cached peers as live radar signals while hidden", () => {
    const peers = [{ id: "past-encounter" }, { id: "connected-friend" }];

    expect(visibleDiscoveryPeers(false, peers)).toEqual([]);
    // Filtering the radar must not mutate the stored encounters/history.
    expect(peers).toHaveLength(2);
  });

  it("keeps live peer signals while visible", () => {
    const peers = [{ id: "nearby-peer" }];

    expect(visibleDiscoveryPeers(true, peers)).toBe(peers);
  });

  it("fails closed for hidden or malformed BLE profile visibility", () => {
    expect(isExplicitlyVisible(true)).toBe(true);
    expect(isExplicitlyVisible(false)).toBe(false);
    expect(isExplicitlyVisible(undefined)).toBe(false);
  });
});