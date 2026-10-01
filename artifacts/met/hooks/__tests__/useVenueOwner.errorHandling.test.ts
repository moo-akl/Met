import { renderHook, waitFor } from "@testing-library/react-native";

import { useVenueOwner } from "@/hooks/useVenueOwner";
import {
  api,
  setActiveVenueBusinessId,
  type VenueOwnerProfile,
} from "@/lib/api/client";
import { useApp } from "@/contexts/AppContext";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/contexts/AppContext", () => ({
  useApp: jest.fn(),
}));

jest.mock("@/lib/api/client", () => ({
  api: {
    getMyVenueApplication: jest.fn(),
    getMyVenueBranches: jest.fn(),
  },
  getActiveVenueBusinessId: jest.fn(() => null),
  setActiveVenueBusinessId: jest.fn(),
}));

const mockedUseApp = jest.mocked(useApp);
const mockedGetApplication = jest.mocked(api.getMyVenueApplication);
const mockedGetBranches = jest.mocked(api.getMyVenueBranches);

const approvedProfile = (businessName: string) =>
  ({
    applicationStatus: "approved",
    isApproved: true,
    businessName,
  }) as VenueOwnerProfile;

const apiError = (status: number) =>
  Object.assign(new Error(`request failed: ${status}`), { status });

describe("useVenueOwner application and branch errors", () => {
  beforeEach(() => {
    mockedUseApp.mockReturnValue({ authedUid: "uid-a" } as never);
    mockedGetApplication.mockReset();
    mockedGetBranches.mockReset();
    jest.mocked(setActiveVenueBusinessId).mockClear();
  });

  it.each([
    ["404", apiError(404), null],
    ["500", apiError(500), "Failed to load venue profile"],
    ["network", new Error("network unavailable"), "Failed to load venue profile"],
  ])(
    "handles an application %s with successful branch loading",
    async (_label, applicationError, expectedError) => {
      mockedGetApplication.mockRejectedValueOnce(applicationError);
      mockedGetBranches.mockResolvedValueOnce({
        branches: [],
        applications: [],
      });

      const { result } = await renderHook(() => useVenueOwner());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe(expectedError);
      expect(result.current.branchError).toBeNull();
      expect(result.current.profile).toBeNull();
    },
  );

  it.each([
    ["404", apiError(404), null],
    ["500", apiError(500), "Failed to load venue profile"],
    ["network", new Error("network unavailable"), "Failed to load venue profile"],
  ])(
    "preserves the application %s outcome when branch loading fails",
    async (_label, applicationError, expectedError) => {
      mockedGetApplication.mockRejectedValueOnce(applicationError);
      mockedGetBranches.mockRejectedValueOnce(new Error("branches unavailable"));

      const { result } = await renderHook(() => useVenueOwner());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe(expectedError);
      expect(result.current.branchError).toBe("Failed to load venue branches");
      expect(result.current.profile).toBeNull();
    },
  );

  it("uses an approved branch profile when the application endpoint returns 404", async () => {
    const branchProfile = approvedProfile("Approved branch");
    mockedGetApplication.mockRejectedValueOnce(apiError(404));
    mockedGetBranches.mockResolvedValueOnce({
      branches: [
        {
          businessId: 42,
          role: "owner",
          profile: branchProfile,
        },
      ],
      applications: [],
    });

    const { result } = await renderHook(() => useVenueOwner());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.profile).toBe(branchProfile);
    expect(result.current.isApproved).toBe(true);
    expect(result.current.activeBusinessId).toBe(42);
    expect(result.current.error).toBeNull();
    expect(result.current.branchError).toBeNull();
  });
});