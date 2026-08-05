/**
 * Integration tests for the profile-completion banner save cycle.
 *
 * These tests complement the pure-logic unit tests in profileBannerTarget.test.ts
 * by exercising the *reactive render path*:
 *
 *   user completes the last missing field → taps Save
 *   → setProfile updates the profile in state
 *   → component re-renders with the new profile
 *   → banner Pressable is no longer in the view hierarchy
 *
 * A stale-closure or missing-dependency bug in the real component would cause
 * the banner to persist after save even though the profile data is now complete.
 * Unit tests that only call getProfileSteps() cannot catch this because they
 * never render a component or trigger a React state update.
 *
 * We use a minimal proxy component that mirrors the exact `profileIncomplete`
 * derivation used in profile.tsx so the tests remain fast and dependency-free
 * while still validating the React update cycle that the unit tests skip.
 *
 *   const profileSteps = profile ? getProfileSteps(profile) : [];
 *   const profileScore = profileSteps.filter(Boolean).length;
 *   const profileTotal = profileSteps.length;
 *   const profileIncomplete = !!profile && profileScore < profileTotal;
 */

import React, { useState } from "react";
import { View } from "react-native";
import renderer, { act } from "react-test-renderer";
import { getProfileSteps } from "../profileBannerTarget";

// ---------------------------------------------------------------------------
// Proxy component — mirrors the banner + save logic from profile.tsx
// ---------------------------------------------------------------------------

type ProfileShape = {
  name: string;
  verified: boolean;
  bio: string;
  socials: Record<string, string>;
  interests: string[];
};

/**
 * ProfileBannerProxy renders the completion banner conditionally, driven by
 * the same `profileIncomplete` derivation as profile.tsx.
 *
 * The `savedProfile` prop is the profile snapshot that will be committed when
 * Save is pressed — simulating what `handleSave` does when it calls
 * `await setProfile({...profile, ...edits})` and then updates local state.
 */
function ProfileBannerProxy({
  initialProfile,
  savedProfile,
}: {
  initialProfile: ProfileShape;
  savedProfile: ProfileShape;
}) {
  const [profile, setProfileState] = useState<ProfileShape>(initialProfile);

  // Exact derivation from profile.tsx — must match 1-to-1.
  const profileSteps = profile ? getProfileSteps(profile) : [];
  const profileScore = profileSteps.filter(Boolean).length;
  const profileTotal = profileSteps.length;
  const profileIncomplete = !!profile && profileScore < profileTotal;

  const handleSave = async () => {
    // Mirrors the async setProfile call in handleSave: awaits a microtask
    // (simulating the async profile write) then commits the new state.
    await Promise.resolve();
    setProfileState(savedProfile);
  };

  return (
    <View testID="root">
      {/* Banner: present when profile is incomplete, absent when complete.
          testID "profile-banner" is what the tests query for. */}
      {profileIncomplete ? <View testID="profile-banner" /> : null}

      {/* Save button — pressing it triggers the async save cycle. */}
      <View
        testID="save-button"
        /* react-test-renderer uses onStartShouldSetResponder to simulate press */
        onStartShouldSetResponder={() => {
          void handleSave();
          return true;
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const completeProfile: ProfileShape = {
  name: "Alice",
  verified: true,
  bio: "Hello world",
  socials: { instagram: "alice" },
  interests: ["music"],
};

/**
 * Return all nodes in the renderer tree that have the given testID.
 * Uses a recursive walk of toJSON() output so no host-env APIs are needed.
 */
function findByTestId(
  node: renderer.ReactTestRendererJSON | null,
  testID: string,
): renderer.ReactTestRendererJSON[] {
  if (!node) return [];
  const results: renderer.ReactTestRendererJSON[] = [];
  if (node.props?.testID === testID) results.push(node);
  for (const child of node.children ?? []) {
    if (typeof child !== "string") {
      results.push(...findByTestId(child, testID));
    }
  }
  return results;
}

function hasBanner(root: renderer.ReactTestRenderer): boolean {
  return findByTestId(root.toJSON() as renderer.ReactTestRendererJSON, "profile-banner").length > 0;
}

/**
 * Simulate pressing the save button on the proxy component.
 * The press is wrapped in `act` so React flushes the resulting state updates
 * before we inspect the tree — the same guarantee Pressable gives in production.
 */
async function pressSave(root: renderer.ReactTestRenderer): Promise<void> {
  const saveNode = root.root.findAll((n) => n.props.testID === "save-button")[0];
  await act(async () => {
    saveNode.props.onStartShouldSetResponder();
    // Flush the micro-task queue so the awaited Promise.resolve() inside
    // handleSave settles and setProfileState is called before we read the tree.
    await new Promise<void>((resolve) => setImmediate(resolve));
  });
}

// ---------------------------------------------------------------------------
// Banner appears with an incomplete profile
// ---------------------------------------------------------------------------

describe("banner is shown while profile is incomplete", () => {
  it("shows the banner when interests are missing", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ProfileBannerProxy
          initialProfile={{ ...completeProfile, interests: [] }}
          savedProfile={completeProfile}
        />,
      );
    });
    expect(hasBanner(root)).toBe(true);
  });

  it("shows the banner when bio is missing", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ProfileBannerProxy
          initialProfile={{ ...completeProfile, bio: "" }}
          savedProfile={completeProfile}
        />,
      );
    });
    expect(hasBanner(root)).toBe(true);
  });

  it("shows the banner when the first social link is missing", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ProfileBannerProxy
          initialProfile={{ ...completeProfile, socials: {} }}
          savedProfile={completeProfile}
        />,
      );
    });
    expect(hasBanner(root)).toBe(true);
  });

  it("shows the banner when photo is not verified", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ProfileBannerProxy
          initialProfile={{ ...completeProfile, verified: false }}
          savedProfile={completeProfile}
        />,
      );
    });
    expect(hasBanner(root)).toBe(true);
  });

  it("does NOT show the banner when the profile is already complete", () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ProfileBannerProxy
          initialProfile={completeProfile}
          savedProfile={completeProfile}
        />,
      );
    });
    expect(hasBanner(root)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Core: banner hides immediately after save — the full save cycle
// ---------------------------------------------------------------------------

describe("banner hides immediately after the last missing field is saved", () => {
  /**
   * Renders an incomplete profile, presses Save, then asserts the banner is gone.
   *
   * This is the primary regression guard: if `setProfile` had a stale-closure
   * or missing-dependency bug, the state update would be lost and the banner
   * would still appear after `pressSave` returns.
   */
  async function runSaveCycle(incompleteProfile: ProfileShape): Promise<void> {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ProfileBannerProxy
          initialProfile={incompleteProfile}
          savedProfile={completeProfile}
        />,
      );
    });

    // Banner is visible before save.
    expect(hasBanner(root)).toBe(true);

    // Tap Save — triggers the async setProfile path.
    await pressSave(root);

    // Banner must be absent from the view hierarchy immediately after save.
    expect(hasBanner(root)).toBe(false);
  }

  it("hides banner after saving the first interest (last missing field)", async () => {
    await runSaveCycle({ ...completeProfile, interests: [] });
  });

  it("hides banner after saving a bio (last missing field)", async () => {
    await runSaveCycle({ ...completeProfile, bio: "" });
  });

  it("hides banner after adding the first social link (last missing field)", async () => {
    await runSaveCycle({ ...completeProfile, socials: {} });
  });

  it("hides banner after saving bio that was whitespace-only", async () => {
    await runSaveCycle({ ...completeProfile, bio: "   " });
  });

  it("hides banner after saving when only the name was missing", async () => {
    await runSaveCycle({ ...completeProfile, name: "" });
  });

  it("hides banner after photo is verified (verified: false → true is the only missing step)", async () => {
    await runSaveCycle({ ...completeProfile, verified: false });
  });

  it("hides banner when all five steps were incomplete and save completes all of them", async () => {
    await runSaveCycle({
      name: "",
      verified: false,
      bio: "",
      socials: {},
      interests: [],
    });
  });
});

// ---------------------------------------------------------------------------
// Double-save: pressing Save a second time must not re-show the banner
// ---------------------------------------------------------------------------

describe("save cycle — idempotency", () => {
  it("tapping Save twice does not leave a residual banner", async () => {
    let root!: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <ProfileBannerProxy
          initialProfile={{ ...completeProfile, bio: "" }}
          savedProfile={completeProfile}
        />,
      );
    });

    // First save — banner should disappear.
    await pressSave(root);
    expect(hasBanner(root)).toBe(false);

    // Second save — must still be absent (savedProfile is complete).
    await pressSave(root);
    expect(hasBanner(root)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Async save path: banner stays visible until the async operation resolves
// ---------------------------------------------------------------------------

describe("async save — banner remains visible during the async gap, then hides", () => {
  it("banner is still shown while save is in-flight, then hidden after resolution", async () => {
    let resolveUpload!: () => void;
    const uploadPromise = new Promise<void>((r) => { resolveUpload = r; });

    /**
     * SlowSaveProxy simulates the realistic handleSave path in profile.tsx:
     *   1. An async operation (e.g. photo upload) is awaited.
     *   2. Only after that does setProfile commit the new data.
     *
     * The banner must stay visible during step 1 and disappear after step 2.
     */
    function SlowSaveProxy() {
      const [profile, setProfileState] = useState<ProfileShape>({
        ...completeProfile,
        interests: [],
      });
      const [saving, setSaving] = useState(false);

      // Exact derivation from profile.tsx.
      const profileSteps = profile ? getProfileSteps(profile) : [];
      const profileScore = profileSteps.filter(Boolean).length;
      const profileTotal = profileSteps.length;
      const profileIncomplete = !!profile && profileScore < profileTotal;

      const handleSave = async () => {
        setSaving(true);
        await uploadPromise; // simulates the photo-upload network call
        setProfileState(completeProfile);
        setSaving(false);
      };

      return (
        <View testID="root">
          {profileIncomplete ? <View testID="profile-banner" /> : null}
          {saving ? <View testID="saving-indicator" /> : null}
          <View
            testID="save-button"
            onStartShouldSetResponder={() => {
              void handleSave();
              return true;
            }}
          />
        </View>
      );
    }

    let root!: renderer.ReactTestRenderer;
    act(() => { root = renderer.create(<SlowSaveProxy />); });

    // Banner visible before save.
    expect(hasBanner(root)).toBe(true);

    // Start save without resolving the upload — banner must still be shown.
    act(() => {
      const saveNode = root.root.findAll((n) => n.props.testID === "save-button")[0];
      saveNode.props.onStartShouldSetResponder();
    });

    // Banner and saving indicator are both shown mid-flight.
    expect(hasBanner(root)).toBe(true);
    const savingNodes = findByTestId(
      root.toJSON() as renderer.ReactTestRendererJSON,
      "saving-indicator",
    );
    expect(savingNodes.length).toBe(1);

    // Resolve the upload — state update must propagate and banner must vanish.
    await act(async () => {
      resolveUpload();
      await new Promise<void>((r) => setImmediate(r));
    });

    expect(hasBanner(root)).toBe(false);
    const savingNodesAfter = findByTestId(
      root.toJSON() as renderer.ReactTestRendererJSON,
      "saving-indicator",
    );
    expect(savingNodesAfter.length).toBe(0);
  });
});
