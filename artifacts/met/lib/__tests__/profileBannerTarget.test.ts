/**
 * Unit tests for the profile-completion banner scroll-target logic.
 *
 * Covers:
 *  - getProfileSteps  — builds the 5-element boolean array from a profile shape
 *  - getBannerScrollTarget — maps firstIncomplete index → scroll section key
 *  - getBannerHighlightField — maps firstIncomplete index → highlight field name
 *
 * Together these guard against regressions where a step-ordering change or a
 * typo in the ternary chain would silently scroll the banner to the wrong place.
 */

import {
  getProfileSteps,
  getBannerScrollTarget,
  getBannerHighlightField,
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
