/**
 * Tests for EncounterRow — subscriber ring colour
 *
 * Covers:
 *  1. pro  tier  → gold ring  (#FFD700) on the Avatar
 *  2. plus tier  → blue ring  (#3B82F6) on the Avatar
 *  3. free tier  → no subscriber ring (ring prop driven only by request_received)
 *  4. absent tier → no subscriber ring
 */

import React from "react";
import { render } from "@testing-library/react-native";
import type { Encounter } from "@/lib/types";

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/components/ActionSheet", () => ({
  ActionSheet: () => null,
}));

jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return { Feather: View };
});

jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({
    removeEncounter: jest.fn(),
    setBlocked: jest.fn(),
    profile: { interests: [] },
    authedUid: "current-user",
  }),
}));

jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    foreground: "#000",
    mutedForeground: "#666",
    primary: "#333",
    secondary: "#eee",
    muted: "#ccc",
    border: "#ddd",
  }),
}));

jest.mock("@/lib/i18n", () => ({
  useT: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.when) return `met ${String(opts.when)}`;
      if (opts?.count) return `${String(opts.count)}x`;
      if (opts?.interest) return String(opts.interest);
      return key;
    },
  }),
}));

jest.mock("@/lib/api/client", () => ({
  api: { getCommunityStanding: jest.fn().mockResolvedValue(null) },
}));

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined }),
}));

// Avatar mock — stores the last set of props passed on each render so tests
// can assert on ring / ringColor without touching the Avatar implementation.
// Using a plain object (not a `let` binding) to avoid any TDZ concerns with
// jest.mock hoisting.
const avatarCalls: Array<Record<string, unknown>> = [];

jest.mock("@/components/Avatar", () => ({
  Avatar: (props: Record<string, unknown>) => {
    avatarCalls.push({ ...props });
    return null;
  },
}));

// ── Subject ───────────────────────────────────────────────────────────────────

import { EncounterRow } from "../EncounterRow";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEncounter(overrides: Partial<Encounter> = {}): Encounter {
  return {
    id: "peer-uid",
    realName: "Test Person",
    photoUri: "https://example.com/photo.jpg",
    bio: "",
    socials: {},
    encounterCount: 1,
    firstSeenAt: Date.now() - 60_000,
    lastSeenAt: Date.now() - 60_000,
    lastDistanceM: 10,
    lastLocation: "here",
    status: "encounter",
    ...overrides,
  };
}

/** Returns the props passed to Avatar during the most recent render. */
function lastAvatarProps(): Record<string, unknown> {
  return avatarCalls[avatarCalls.length - 1] ?? {};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  avatarCalls.length = 0;
});

describe("EncounterRow — subscriber ring", () => {
  it("renders a gold ring for a pro-tier peer", async () => {
    await render(<EncounterRow encounter={makeEncounter({ tier: "pro" })} />);

    const props = lastAvatarProps();
    expect(props.ring).toBe(true);
    expect(props.ringColor).toBe("#FFD700");
  });

  it("renders a blue ring for a plus-tier peer", async () => {
    await render(<EncounterRow encounter={makeEncounter({ tier: "plus" })} />);

    const props = lastAvatarProps();
    expect(props.ring).toBe(true);
    expect(props.ringColor).toBe("#3B82F6");
  });

  it("does not render a subscriber ring for a free-tier peer with no pending request", async () => {
    await render(
      <EncounterRow
        encounter={makeEncounter({ tier: "free", status: "encounter" })}
      />,
    );

    const props = lastAvatarProps();
    // ring should be false — no request_received status, no paid tier.
    expect(props.ring).toBe(false);
    expect(props.ringColor).toBeUndefined();
  });

  it("does not render a subscriber ring when tier is absent", async () => {
    await render(
      <EncounterRow encounter={makeEncounter({ status: "encounter" })} />,
    );

    const props = lastAvatarProps();
    expect(props.ring).toBe(false);
    expect(props.ringColor).toBeUndefined();
  });
});
