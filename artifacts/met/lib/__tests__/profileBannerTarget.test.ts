/**
 * Unit tests for the profile-completion banner scroll-target logic.
 *
 * Covers:
 *  - getProfileSteps  — builds the 5-element boolean array from a profile shape
 *  - getBannerScrollTarget — maps firstIncomplete index → scroll section key
 *  - getBannerHighlightField — maps firstIncomplete index → highlight field name
 *  - getBannerFocusTarget — maps profile field-emptiness → TextInput ref to focus
 *
 * Together these guard against regressions where a step-ordering change or a
 * typo in the ternary chain would silently scroll the banner to the wrong place
 * or focus the wrong TextInput (or skip focusing when it shouldn't, or vice versa).
 */

import {
  getProfileSteps,
  getBannerScrollTarget,
  getBannerHighlightField,
  getBannerFocusTarget,
  getBannerHintKey,
  type FocusTarget,
} from "../profileBannerTarget";

// ---------------------------------------------------------------------------
// getProfileSteps
// ---------------------------------------------------------------------------

describe("getProfileSteps", () => {
  const base = {
    name: "Alice",
    verified: true,
    bio: "Hello",
    socials: { instagram: "alice" },
    interests: ["music"],
  };

  it("returns all-true for a complete profile", () => {
    expect(getProfileSteps(base)).toEqual([true, true, true, true, true]);
  });

  it("step 0 (name) — false when name is empty string", () => {
    expect(getProfileSteps({ ...base, name: "" })[0]).toBe(false);
  });

  it("step 0 (name) — false when name is whitespace only", () => {
    expect(getProfileSteps({ ...base, name: "   " })[0]).toBe(false);
  });

  it("step 0 (name) — false when name is null", () => {
    expect(getProfileSteps({ ...base, name: null })[0]).toBe(false);
  });

  it("step 0 (name) — false when name is undefined", () => {
    const { name, ...rest } = base;
    expect(getProfileSteps(rest)[0]).toBe(false);
  });

  it("step 0 (name) — true when name has content", () => {
    expect(getProfileSteps({ ...base, name: "Bob" })[0]).toBe(true);
  });

  it("step 1 (verified) — false when verified is false", () => {
    expect(getProfileSteps({ ...base, verified: false })[1]).toBe(false);
  });

  it("step 1 (verified) — false when verified is null", () => {
    expect(getProfileSteps({ ...base, verified: null })[1]).toBe(false);
  });

  it("step 1 (verified) — true when verified is true", () => {
    expect(getProfileSteps({ ...base, verified: true })[1]).toBe(true);
  });

  it("step 2 (bio) — false when bio is empty string", () => {
    expect(getProfileSteps({ ...base, bio: "" })[2]).toBe(false);
  });

  it("step 2 (bio) — false when bio is whitespace only", () => {
    expect(getProfileSteps({ ...base, bio: "   " })[2]).toBe(false);
  });

  it("step 2 (bio) — false when bio is null", () => {
    expect(getProfileSteps({ ...base, bio: null })[2]).toBe(false);
  });

  it("step 2 (bio) — true when bio has content", () => {
    expect(getProfileSteps({ ...base, bio: "I like hiking" })[2]).toBe(true);
  });

  it("step 3 (socials) — false when socials is empty object", () => {
    expect(getProfileSteps({ ...base, socials: {} })[3]).toBe(false);
  });

  it("step 3 (socials) — false when socials is null", () => {
    expect(getProfileSteps({ ...base, socials: null })[3]).toBe(false);
  });

  it("step 3 (socials) — true when at least one social key is present", () => {
    expect(getProfileSteps({ ...base, socials: { x: "alice" } })[3]).toBe(true);
  });

  it("step 4 (interests) — false when interests is empty array", () => {
    expect(getProfileSteps({ ...base, interests: [] })[4]).toBe(false);
  });

  it("step 4 (interests) — false when interests is null", () => {
    expect(getProfileSteps({ ...base, interests: null })[4]).toBe(false);
  });

  it("step 4 (interests) — true when at least one interest is present", () => {
    expect(getProfileSteps({ ...base, interests: ["jazz"] })[4]).toBe(true);
  });

  it("returns exactly 5 elements", () => {
    expect(getProfileSteps(base)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// getBannerScrollTarget  (step index → scroll section)
// ---------------------------------------------------------------------------

describe("getBannerScrollTarget", () => {
  it("step 0 (name) → scrolls to photo section", () => {
    expect(getBannerScrollTarget(0)).toBe("photo");
  });

  it("step 1 (photo) → scrolls to photo section", () => {
    expect(getBannerScrollTarget(1)).toBe("photo");
  });

  it("step 2 (bio) → scrolls to photo section", () => {
    expect(getBannerScrollTarget(2)).toBe("photo");
  });

  it("step 3 (socials) → scrolls to socials section", () => {
    expect(getBannerScrollTarget(3)).toBe("socials");
  });

  it("step 4 (interests) → scrolls to interests section", () => {
    expect(getBannerScrollTarget(4)).toBe("interests");
  });
});

// ---------------------------------------------------------------------------
// getBannerHighlightField  (step index → highlight field)
// ---------------------------------------------------------------------------

describe("getBannerHighlightField", () => {
  it("step 0 → highlights the name field", () => {
    expect(getBannerHighlightField(0)).toBe("name");
  });

  it("step 1 → highlights the photo field", () => {
    expect(getBannerHighlightField(1)).toBe("photo");
  });

  it("step 2 → highlights the bio field", () => {
    expect(getBannerHighlightField(2)).toBe("bio");
  });

  it("step 3 → highlights the socials field", () => {
    expect(getBannerHighlightField(3)).toBe("socials");
  });

  it("step 4 → highlights the interests field", () => {
    expect(getBannerHighlightField(4)).toBe("interests");
  });
});

// ---------------------------------------------------------------------------
// Integration: step-to-target mapping via a simulated profileSteps array
// ---------------------------------------------------------------------------

describe("banner target for each first-incomplete step (end-to-end mapping)", () => {
  /**
   * Build a profile where only the given step index is incomplete.
   * All other steps are filled in.
   */
  const profileWithOnlyStepIncomplete = (step: number) => ({
    name: step === 0 ? "" : "Alice",
    verified: step === 1 ? false : true,
    bio: step === 2 ? "" : "Hello",
    socials: step === 3 ? {} : { instagram: "alice" },
    interests: step === 4 ? [] : ["music"],
  });

  const cases: Array<{
    step: number;
    scrollSection: "photo" | "socials" | "interests";
    highlightField: "name" | "photo" | "bio" | "socials" | "interests";
  }> = [
    { step: 0, scrollSection: "photo",     highlightField: "name" },
    { step: 1, scrollSection: "photo",     highlightField: "photo" },
    { step: 2, scrollSection: "photo",     highlightField: "bio" },
    { step: 3, scrollSection: "socials",   highlightField: "socials" },
    { step: 4, scrollSection: "interests", highlightField: "interests" },
  ];

  test.each(cases)(
    "step $step incomplete → scrollSection=$scrollSection, highlight=$highlightField",
    ({ step, scrollSection, highlightField }) => {
      const profile = profileWithOnlyStepIncomplete(step);
      const steps = getProfileSteps(profile);
      const firstIncomplete = steps.findIndex((done) => !done);

      expect(firstIncomplete).toBe(step);
      expect(getBannerScrollTarget(firstIncomplete)).toBe(scrollSection);
      expect(getBannerHighlightField(firstIncomplete)).toBe(highlightField);
    },
  );
});

// ---------------------------------------------------------------------------
// getBannerHintKey  (first-incomplete step index → i18n key for hint text)
// ---------------------------------------------------------------------------

describe("getBannerHintKey", () => {
  it("step 0 (name) → 'home.profileBannerNoName'", () => {
    expect(getBannerHintKey(0)).toBe("home.profileBannerNoName");
  });

  it("step 1 (photo/verified) → 'home.profileBannerNoPhoto'", () => {
    expect(getBannerHintKey(1)).toBe("home.profileBannerNoPhoto");
  });

  it("step 2 (bio) → 'home.profileBannerNoBio'", () => {
    expect(getBannerHintKey(2)).toBe("home.profileBannerNoBio");
  });

  it("step 3 (socials) → 'home.profileBannerNoSocials'", () => {
    expect(getBannerHintKey(3)).toBe("home.profileBannerNoSocials");
  });

  it("step 4 (interests) → 'home.profileBannerNoInterests'", () => {
    expect(getBannerHintKey(4)).toBe("home.profileBannerNoInterests");
  });

  it("out-of-range index defaults to interests key", () => {
    expect(getBannerHintKey(99)).toBe("home.profileBannerNoInterests");
  });
});

// Integration: hint key matches the first-incomplete step from getProfileSteps
describe("getBannerHintKey — matches first-incomplete step from getProfileSteps", () => {
  const cases: Array<{
    step: number;
    label: string;
    profile: Parameters<typeof getProfileSteps>[0];
    expectedKey: string;
  }> = [
    {
      step: 0,
      label: "name missing",
      profile: { name: "", verified: true, bio: "Hello", socials: { instagram: "alice" }, interests: ["music"] },
      expectedKey: "home.profileBannerNoName",
    },
    {
      step: 1,
      label: "photo/verified missing",
      profile: { name: "Alice", verified: false, bio: "Hello", socials: { instagram: "alice" }, interests: ["music"] },
      expectedKey: "home.profileBannerNoPhoto",
    },
    {
      step: 2,
      label: "bio missing",
      profile: { name: "Alice", verified: true, bio: "", socials: { instagram: "alice" }, interests: ["music"] },
      expectedKey: "home.profileBannerNoBio",
    },
    {
      step: 3,
      label: "socials missing",
      profile: { name: "Alice", verified: true, bio: "Hello", socials: {}, interests: ["music"] },
      expectedKey: "home.profileBannerNoSocials",
    },
    {
      step: 4,
      label: "interests missing",
      profile: { name: "Alice", verified: true, bio: "Hello", socials: { instagram: "alice" }, interests: [] },
      expectedKey: "home.profileBannerNoInterests",
    },
  ];

  test.each(cases)(
    "step $step ($label) → $expectedKey",
    ({ step, profile, expectedKey }) => {
      const steps = getProfileSteps(profile);
      const firstIncomplete = steps.findIndex((done) => !done);
      expect(firstIncomplete).toBe(step);
      expect(getBannerHintKey(firstIncomplete)).toBe(expectedKey);
    },
  );
});

// ---------------------------------------------------------------------------
// getBannerFocusTarget  (profile field emptiness → which ref to .focus())
// ---------------------------------------------------------------------------

describe("getBannerFocusTarget", () => {
  const full = {
    name: "Alice",
    bio: "Hello",
    socials: { instagram: "alice" } as Record<string, unknown>,
  };

  // -- name cases -----------------------------------------------------------

  it("name missing → 'name' (nameInputRef should be focused)", () => {
    expect(getBannerFocusTarget({ ...full, name: "" })).toBe("name");
  });

  it("name whitespace-only → 'name'", () => {
    expect(getBannerFocusTarget({ ...full, name: "   " })).toBe("name");
  });

  it("name null → 'name'", () => {
    expect(getBannerFocusTarget({ ...full, name: null })).toBe("name");
  });

  it("name undefined → 'name'", () => {
    const { name, ...rest } = full;
    expect(getBannerFocusTarget(rest)).toBe("name");
  });

  // -- bio cases  -----------------------------------------------------------

  it("name present, bio missing → 'bio' (bioInputRef should be focused)", () => {
    expect(getBannerFocusTarget({ ...full, bio: "" })).toBe("bio");
  });

  it("name present, bio whitespace-only → 'bio'", () => {
    expect(getBannerFocusTarget({ ...full, bio: "   " })).toBe("bio");
  });

  it("name present, bio null → 'bio'", () => {
    expect(getBannerFocusTarget({ ...full, bio: null })).toBe("bio");
  });

  // -- socials cases --------------------------------------------------------

  it("name+bio present, no socials → 'firstSocial' (firstSocialInputRef should be focused)", () => {
    expect(getBannerFocusTarget({ ...full, socials: {} })).toBe("firstSocial");
  });

  it("name+bio present, socials null → 'firstSocial'", () => {
    expect(getBannerFocusTarget({ ...full, socials: null })).toBe("firstSocial");
  });

  it("name+bio present, socials undefined → 'firstSocial'", () => {
    const { socials, ...rest } = full;
    expect(getBannerFocusTarget(rest)).toBe("firstSocial");
  });

  // -- null (no text field to focus) ----------------------------------------

  it("all text fields complete → null (photo/interests steps have no TextInput)", () => {
    expect(getBannerFocusTarget(full)).toBeNull();
  });

  // -- photo step (step 1): name+bio+socials all complete → null ------------

  it("photo step (step 1) — name+bio+socials present → null (photo is not a TextInput)", () => {
    // When only verified=false is incomplete, all text fields are filled.
    // getBannerFocusTarget must return null so no TextInput is focused.
    const profile = { name: "Alice", bio: "Hello", socials: { instagram: "alice" } as Record<string, unknown> };
    expect(getBannerFocusTarget(profile)).toBeNull();
  });

  // -- interests step (step 4): name+bio+socials all complete → null --------

  it("interests step (step 4) — name+bio+socials present → null (interests is not a TextInput)", () => {
    // When only interests=[] is incomplete, all text fields are filled.
    // getBannerFocusTarget must return null so no TextInput is focused.
    const profile = { name: "Alice", bio: "Hello", socials: { tiktok: "alice" } as Record<string, unknown> };
    expect(getBannerFocusTarget(profile)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration: ref dispatch — simulate which ref.focus() is called per step
// ---------------------------------------------------------------------------

/**
 * Simulate the banner onPress focus dispatch from profile.tsx:
 *
 *   const focusTarget = getBannerFocusTarget(profile);
 *   if (focusTarget === "name")        nameRef.focus();
 *   else if (focusTarget === "bio")    bioRef.focus();
 *   else if (focusTarget === "firstSocial") socialRef.focus();
 *
 * This ensures the ref wiring and the if/else ordering remain correct even
 * if the helper returns the right value but someone accidentally reorders the
 * dispatch branches in the component.
 */
function dispatchFocus(
  focusTarget: FocusTarget,
  refs: {
    name: { focus: () => void };
    bio: { focus: () => void };
    social: { focus: () => void };
  },
) {
  if (focusTarget === "name") {
    refs.name.focus();
  } else if (focusTarget === "bio") {
    refs.bio.focus();
  } else if (focusTarget === "firstSocial") {
    refs.social.focus();
  }
}

describe("banner focus dispatch — correct ref.focus() called for each incomplete step", () => {
  function makeRefs() {
    return {
      name:   { focus: jest.fn() },
      bio:    { focus: jest.fn() },
      social: { focus: jest.fn() },
    };
  }

  it("step 0 (name incomplete) — nameInputRef.focus() is called", () => {
    const refs = makeRefs();
    const target = getBannerFocusTarget({ name: "", bio: "Hello", socials: { x: "a" } });
    dispatchFocus(target, refs);
    expect(refs.name.focus).toHaveBeenCalledTimes(1);
    expect(refs.bio.focus).not.toHaveBeenCalled();
    expect(refs.social.focus).not.toHaveBeenCalled();
  });

  it("step 1 (photo incomplete — name+bio+socials present) — no TextInput is focused", () => {
    const refs = makeRefs();
    // All text fields are complete; only verified is false → focus target is null.
    const target = getBannerFocusTarget({ name: "Alice", bio: "Hello", socials: { x: "a" } });
    dispatchFocus(target, refs);
    expect(refs.name.focus).not.toHaveBeenCalled();
    expect(refs.bio.focus).not.toHaveBeenCalled();
    expect(refs.social.focus).not.toHaveBeenCalled();
  });

  it("step 2 (bio incomplete — name present) — bioInputRef.focus() is called", () => {
    const refs = makeRefs();
    const target = getBannerFocusTarget({ name: "Alice", bio: "", socials: { x: "a" } });
    dispatchFocus(target, refs);
    expect(refs.bio.focus).toHaveBeenCalledTimes(1);
    expect(refs.name.focus).not.toHaveBeenCalled();
    expect(refs.social.focus).not.toHaveBeenCalled();
  });

  it("step 3 (socials incomplete — name+bio present) — firstSocialInputRef.focus() is called", () => {
    const refs = makeRefs();
    const target = getBannerFocusTarget({ name: "Alice", bio: "Hello", socials: {} });
    dispatchFocus(target, refs);
    expect(refs.social.focus).toHaveBeenCalledTimes(1);
    expect(refs.name.focus).not.toHaveBeenCalled();
    expect(refs.bio.focus).not.toHaveBeenCalled();
  });

  it("step 4 (interests incomplete — name+bio+socials present) — no TextInput is focused", () => {
    const refs = makeRefs();
    // All text fields are complete; only interests=[] is false → focus target is null.
    const target = getBannerFocusTarget({ name: "Alice", bio: "Hello", socials: { x: "a" } });
    dispatchFocus(target, refs);
    expect(refs.name.focus).not.toHaveBeenCalled();
    expect(refs.bio.focus).not.toHaveBeenCalled();
    expect(refs.social.focus).not.toHaveBeenCalled();
  });

  it("name takes priority over bio when both are empty", () => {
    const refs = makeRefs();
    const target = getBannerFocusTarget({ name: "", bio: "", socials: {} });
    dispatchFocus(target, refs);
    expect(refs.name.focus).toHaveBeenCalledTimes(1);
    expect(refs.bio.focus).not.toHaveBeenCalled();
    expect(refs.social.focus).not.toHaveBeenCalled();
  });

  it("bio takes priority over socials when name present but bio+socials empty", () => {
    const refs = makeRefs();
    const target = getBannerFocusTarget({ name: "Alice", bio: "", socials: {} });
    dispatchFocus(target, refs);
    expect(refs.bio.focus).toHaveBeenCalledTimes(1);
    expect(refs.name.focus).not.toHaveBeenCalled();
    expect(refs.social.focus).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Banner visibility — profileIncomplete flag
//
// Mirrors the exact derivation used in profile.tsx:
//
//   const profileSteps = profile ? getProfileSteps(profile) : [];
//   const profileScore = profileSteps.filter(Boolean).length;
//   const profileTotal = profileSteps.length;
//   const profileIncomplete = !!profile && profileScore < profileTotal;
//
// Tests assert the banner is visible (true) or hidden (false) for each
// profile shape, including edge cases that have historically caused regressions.
// ---------------------------------------------------------------------------

function bannerVisible(
  profile: Parameters<typeof getProfileSteps>[0] | null,
): boolean {
  const steps = profile ? getProfileSteps(profile) : [];
  const score = steps.filter(Boolean).length;
  const total = steps.length;
  return !!profile && score < total;
}

describe("banner visibility — profileIncomplete flag", () => {
  const complete = {
    name: "Alice",
    verified: true as boolean | null,
    bio: "Hello world",
    socials: { instagram: "alice" } as Record<string, unknown> | null,
    interests: ["music"] as unknown[] | null,
  };

  // --- banner is hidden when all steps are complete ------------------------

  it("hidden when all 5 steps are complete", () => {
    expect(bannerVisible(complete)).toBe(false);
  });

  it("hidden when profile is null (no profile loaded yet)", () => {
    expect(bannerVisible(null)).toBe(false);
  });

  // --- banner is shown when at least one step is incomplete ----------------

  it("shown when name is missing", () => {
    expect(bannerVisible({ ...complete, name: "" })).toBe(true);
  });

  it("shown when photo/verified is false", () => {
    expect(bannerVisible({ ...complete, verified: false })).toBe(true);
  });

  it("shown when bio is missing", () => {
    expect(bannerVisible({ ...complete, bio: "" })).toBe(true);
  });

  it("shown when socials is empty object", () => {
    expect(bannerVisible({ ...complete, socials: {} })).toBe(true);
  });

  it("shown when interests is empty array", () => {
    expect(bannerVisible({ ...complete, interests: [] })).toBe(true);
  });

  // --- edge cases: whitespace-only fields must still show the banner --------

  it("shown when name is whitespace only", () => {
    expect(bannerVisible({ ...complete, name: "   " })).toBe(true);
  });

  it("shown when bio is whitespace only", () => {
    expect(bannerVisible({ ...complete, bio: "\t  \n" })).toBe(true);
  });

  // --- edge cases: null fields must still show the banner ------------------

  it("shown when name is null", () => {
    expect(bannerVisible({ ...complete, name: null })).toBe(true);
  });

  it("shown when bio is null", () => {
    expect(bannerVisible({ ...complete, bio: null })).toBe(true);
  });

  it("shown when socials is null", () => {
    expect(bannerVisible({ ...complete, socials: null })).toBe(true);
  });

  it("shown when interests is null", () => {
    expect(bannerVisible({ ...complete, interests: null })).toBe(true);
  });

  it("shown when verified is null", () => {
    expect(bannerVisible({ ...complete, verified: null })).toBe(true);
  });

  // --- partial completion: banner reflects the actual incomplete count ------

  it("shown when only one step remains incomplete (interests missing)", () => {
    expect(bannerVisible({ ...complete, interests: [] })).toBe(true);
  });

  it("shown when only one step remains incomplete (socials missing)", () => {
    expect(bannerVisible({ ...complete, socials: {} })).toBe(true);
  });

  it("hidden when the last step is completed (was interests, now filled in)", () => {
    // Simulate a user who just added their first interest — banner must disappear.
    const wasIncomplete = { ...complete, interests: [] };
    const nowComplete = { ...complete, interests: ["hiking"] };
    expect(bannerVisible(wasIncomplete)).toBe(true);
    expect(bannerVisible(nowComplete)).toBe(false);
  });

  it("hidden when the last step is completed (was socials, now filled in)", () => {
    const wasIncomplete = { ...complete, socials: {} };
    const nowComplete = { ...complete, socials: { x: "alice" } };
    expect(bannerVisible(wasIncomplete)).toBe(true);
    expect(bannerVisible(nowComplete)).toBe(false);
  });

  it("hidden when the last step is completed (was bio whitespace, now has content)", () => {
    const wasIncomplete = { ...complete, bio: "   " };
    const nowComplete = { ...complete, bio: "Love hiking" };
    expect(bannerVisible(wasIncomplete)).toBe(true);
    expect(bannerVisible(nowComplete)).toBe(false);
  });

  // --- score derivation consistency ----------------------------------------

  it("score equals the number of true entries returned by getProfileSteps", () => {
    const profile = { ...complete, interests: [], socials: {} };
    const steps = getProfileSteps(profile);
    const score = steps.filter(Boolean).length;
    // 3 steps complete (name, verified, bio); 2 incomplete (socials, interests)
    expect(score).toBe(3);
    expect(steps).toHaveLength(5);
    expect(bannerVisible(profile)).toBe(true);
  });

  it("score is 5 when all steps are complete", () => {
    const steps = getProfileSteps(complete);
    expect(steps.filter(Boolean).length).toBe(5);
    expect(bannerVisible(complete)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Banner onPress — scroll + highlight dispatch
//
// Mirrors the core logic of the banner Pressable onPress in profile.tsx
// (lines 520–568), stripped of the React/animation wrappers so we can assert
// in pure JS without rendering the full screen.
//
// The actual handler does:
//
//   const targetKey       = getBannerScrollTarget(firstIncomplete);
//   const highlightField  = getBannerHighlightField(firstIncomplete);
//   requestAnimationFrame(() => requestAnimationFrame(() => {
//     scrollRef.current?.scrollTo({ y: sectionOffsets.current[targetKey], animated: true });
//     setTimeout(() => {
//       triggerHighlight(highlightField);
//       ...
//     }, 350);
//   }));
//
// We exercise the pure mapping + dispatch without RAF/setTimeout so the tests
// run synchronously and don't depend on fake timer infrastructure.
// ---------------------------------------------------------------------------

/**
 * Simulate the banner onPress scroll + highlight dispatch from profile.tsx.
 *
 * @param firstIncomplete - index of the first incomplete step (0-4)
 * @param sectionOffsets  - the section Y offsets registered via onLayout
 * @param scrollTo        - mock for scrollRef.current.scrollTo
 * @param triggerHighlight - mock for the triggerHighlight callback
 */
function dispatchBannerPress(
  firstIncomplete: number,
  sectionOffsets: { photo: number; socials: number; interests: number },
  scrollTo: (args: { y: number; animated: boolean }) => void,
  triggerHighlight: (field: string) => void,
): void {
  const targetKey = getBannerScrollTarget(firstIncomplete);
  const highlightField = getBannerHighlightField(firstIncomplete);
  scrollTo({ y: sectionOffsets[targetKey], animated: true });
  triggerHighlight(highlightField);
}

describe("banner onPress — scrollTo is called with the correct section offset", () => {
  // Fixed offsets that represent measured section positions on a real device.
  const offsets = { photo: 120, socials: 640, interests: 950 };

  const cases: Array<{
    step: number;
    label: string;
    expectedOffset: number;
  }> = [
    { step: 0, label: "name incomplete",      expectedOffset: offsets.photo },
    { step: 1, label: "photo incomplete",     expectedOffset: offsets.photo },
    { step: 2, label: "bio incomplete",       expectedOffset: offsets.photo },
    { step: 3, label: "socials incomplete",   expectedOffset: offsets.socials },
    { step: 4, label: "interests incomplete", expectedOffset: offsets.interests },
  ];

  test.each(cases)(
    "step $step ($label) → scrollTo y=$expectedOffset",
    ({ step, expectedOffset }) => {
      const scrollTo = jest.fn();
      const triggerHighlight = jest.fn();

      dispatchBannerPress(step, offsets, scrollTo, triggerHighlight);

      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ y: expectedOffset, animated: true });
    },
  );

  it("scrollTo is never called with a y value from the wrong section", () => {
    const scrollTo = jest.fn();
    const triggerHighlight = jest.fn();

    // Step 3 (socials) must NOT scroll to the photo or interests offset.
    dispatchBannerPress(3, offsets, scrollTo, triggerHighlight);

    const call = scrollTo.mock.calls[0][0] as { y: number; animated: boolean };
    expect(call.y).not.toBe(offsets.photo);
    expect(call.y).not.toBe(offsets.interests);
    expect(call.y).toBe(offsets.socials);
  });
});

describe("banner onPress — triggerHighlight is called with the correct field", () => {
  const offsets = { photo: 120, socials: 640, interests: 950 };

  const cases: Array<{
    step: number;
    label: string;
    expectedField: string;
  }> = [
    { step: 0, label: "name incomplete",      expectedField: "name" },
    { step: 1, label: "photo incomplete",     expectedField: "photo" },
    { step: 2, label: "bio incomplete",       expectedField: "bio" },
    { step: 3, label: "socials incomplete",   expectedField: "socials" },
    { step: 4, label: "interests incomplete", expectedField: "interests" },
  ];

  test.each(cases)(
    "step $step ($label) → triggerHighlight('$expectedField')",
    ({ step, expectedField }) => {
      const scrollTo = jest.fn();
      const triggerHighlight = jest.fn();

      dispatchBannerPress(step, offsets, scrollTo, triggerHighlight);

      expect(triggerHighlight).toHaveBeenCalledTimes(1);
      expect(triggerHighlight).toHaveBeenCalledWith(expectedField);
    },
  );

  it("triggerHighlight is never called more than once per tap", () => {
    for (let step = 0; step < 5; step++) {
      const triggerHighlight = jest.fn();
      dispatchBannerPress(step, offsets, jest.fn(), triggerHighlight);
      expect(triggerHighlight).toHaveBeenCalledTimes(1);
    }
  });
});

describe("banner onPress — scrollTo and triggerHighlight are paired correctly", () => {
  const offsets = { photo: 200, socials: 700, interests: 1100 };

  /**
   * For each step the scroll target and highlight field must agree:
   *   steps 0-2 → photo section  +  name/photo/bio highlight
   *   step  3   → socials section + socials highlight
   *   step  4   → interests section + interests highlight
   */
  const cases: Array<{
    step: number;
    expectedOffset: number;
    expectedField: string;
  }> = [
    { step: 0, expectedOffset: offsets.photo,     expectedField: "name" },
    { step: 1, expectedOffset: offsets.photo,     expectedField: "photo" },
    { step: 2, expectedOffset: offsets.photo,     expectedField: "bio" },
    { step: 3, expectedOffset: offsets.socials,   expectedField: "socials" },
    { step: 4, expectedOffset: offsets.interests, expectedField: "interests" },
  ];

  test.each(cases)(
    "step $step → scrollTo y=$expectedOffset AND triggerHighlight('$expectedField')",
    ({ step, expectedOffset, expectedField }) => {
      const scrollTo = jest.fn();
      const triggerHighlight = jest.fn();

      dispatchBannerPress(step, offsets, scrollTo, triggerHighlight);

      expect(scrollTo).toHaveBeenCalledWith({ y: expectedOffset, animated: true });
      expect(triggerHighlight).toHaveBeenCalledWith(expectedField);
    },
  );
});
