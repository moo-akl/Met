import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useVenueOwner } from "@/hooks/useVenueOwner";
import { api } from "@/lib/api/client";
import { useApp } from "@/contexts/AppContext";

jest.mock("@/contexts/AppContext", () => ({
  useApp: jest.fn(),
}));

jest.mock("@/lib/api/client", () => ({
  api: {
    getMyVenueApplication: jest.fn(),
  },
}));

const mockedUseApp = jest.mocked(useApp);
const mockedGetApplication = jest.mocked(api.getMyVenueApplication);

const application = (businessName: string) =>
  ({
    applicationStatus: "approved",
    isApproved: true,
    businessName,
  }) as never;

describe("useVenueOwner account safety", () => {
  let uid: string | null = "uid-a";

  beforeEach(() => {
    uid = "uid-a";
    mockedUseApp.mockImplementation(() => ({ authedUid: uid }) as never);
    mockedGetApplication.mockReset();
  });

  it("clears the old application and ignores a response from the previous account", async () => {
    let resolveA!: (value: unknown) => void;
    let resolveB!: (value: unknown) => void;
    mockedGetApplication
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveA = resolve; }) as never,
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => { resolveB = resolve; }) as never,
      );

    const { result, rerender } = await renderHook(() => useVenueOwner());
    uid = "uid-b";
    rerender({});

    await waitFor(() => expect(result.current.profile).toBeNull());
    expect(mockedGetApplication).toHaveBeenNthCalledWith(2, { uid: "uid-b" });

    await act(async () => {
      resolveA({ application: application("Account A"), history: [] });
    });
    expect(result.current.profile).toBeNull();

    await act(async () => {
      resolveB({ application: application("Account B"), history: [] });
    });
    await waitFor(() =>
      expect(result.current.profile?.businessName).toBe("Account B"),
    );
  });

  it("surfaces unavailable status data instead of treating it as a new application", async () => {
    mockedGetApplication.mockRejectedValueOnce(new Error("network unavailable"));

    const { result } = await renderHook(() => useVenueOwner());

    await waitFor(() => expect(result.current.error).toBe("Failed to load venue profile"));
    expect(result.current.profile).toBeNull();
    expect(result.current.history).toEqual([]);
  });
});