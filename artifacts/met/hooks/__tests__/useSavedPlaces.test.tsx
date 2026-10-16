import React from "react";
import { Alert } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSavedPlaces } from "../useSavedPlaces";
import type { SavedPlace } from "@workspace/api-client-react";

let mockUid: string | null = "account-a";
let mockFail = false;
const mockStore = new Map<string, SavedPlace[]>();
const mockRead = jest.fn();
const mockWrite = jest.fn();
const clients: QueryClient[] = [];
jest.mock("@/contexts/AppContext", () => ({
  useApp: () => ({ authedUid: mockUid }),
}));
jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void) => {
    const React = require("react");
    React.useEffect(effect, [effect]);
  },
}));
// Keep actual React Query behavior while replacing only generated transport.
// The server store outlives hook unmounts and QueryClients, unlike local saves.
jest.mock("@workspace/api-client-react", () => {
  const { useQuery, useMutation } = require("@tanstack/react-query");
  return {
    useListSavedPlaces: (options: any) => useQuery({
      ...options.query,
      queryFn: async () => {
        const uid = options.request.headers["X-Met-Uid"];
        mockRead(uid);
        if (mockFail) throw new Error("Offline");
        return [...(mockStore.get(uid) ?? [])];
      },
    }),
    useSavePlace: (options: any) => useMutation({
      ...options.mutation,
      mutationFn: async ({ placeId }: { placeId: string }) => {
        const uid = options.request.headers["X-Met-Uid"];
        mockWrite(uid, "save", placeId);
        if (mockFail) throw new Error("Offline");
        const entry = { placeId, placeName: "Real Café", savedAt: "2026-10-16T00:00:00.000Z", available: true };
        mockStore.set(uid, [entry, ...(mockStore.get(uid) ?? []).filter((p) => p.placeId !== placeId)]);
        return entry;
      },
    }),
    useUnsavePlace: (options: any) => useMutation({
      ...options.mutation,
      mutationFn: async ({ placeId }: { placeId: string }) => {
        const uid = options.request.headers["X-Met-Uid"];
        mockWrite(uid, "unsave", placeId);
        if (mockFail) throw new Error("Offline");
        mockStore.set(uid, (mockStore.get(uid) ?? []).filter((p) => p.placeId !== placeId));
      },
    }),
  };
});

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}
beforeEach(() => {
  mockUid = "account-a";
  mockFail = false;
  mockStore.clear();
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

it("shares save/unsave state across screens and reloads it from the server after remount", async () => {
  const first = setup();
  const hooks = await renderHook(() => [useSavedPlaces(), useSavedPlaces()] as const, { wrapper: first.wrapper });
  await waitFor(() => expect(hooks.result.current[0].data).toEqual([]));
  await act(() => hooks.result.current[0].toggle("real-venue"));
  await waitFor(() => expect(hooks.result.current[1].data?.[0]?.placeId).toBe("real-venue"));
  await hooks.unmount();
  first.client.clear();
  const reload = setup();
  const reloaded = await renderHook(() => useSavedPlaces(), { wrapper: reload.wrapper });
  await waitFor(() => expect(reloaded.result.current.data?.[0]?.placeId).toBe("real-venue"));
  await act(() => reloaded.result.current.toggle("real-venue"));
  await waitFor(() => expect(reloaded.result.current.data).toEqual([]));
  expect(mockStore.get("account-a")).toEqual([]);
});

it("does not expose another account's bookmarks after a switch or sign-out", async () => {
  const { wrapper } = setup();
  mockStore.set("account-a", [{ placeId: "real-venue", placeName: "Real Café", savedAt: "2026-10-16T00:00:00Z", available: true }]);
  const hook = await renderHook(() => useSavedPlaces(), { wrapper });
  await waitFor(() => expect(hook.result.current.data).toHaveLength(1));
  mockUid = "account-b";
  await hook.rerender({});
  expect(hook.result.current.data?.length ?? 0).toBe(0);
  await waitFor(() => expect(hook.result.current.data).toEqual([]));
  mockUid = null;
  await hook.rerender({});
  expect(hook.result.current.signedIn).toBe(false);
  expect(hook.result.current.data).toBeUndefined();
  expect(mockStore.get("account-a")).toHaveLength(1);
});

it("never simulates a successful save when the request fails", async () => {
  const { wrapper } = setup();
  const hook = await renderHook(() => useSavedPlaces(), { wrapper });
  await waitFor(() => expect(hook.result.current.data).toEqual([]));
  mockFail = true;
  await act(() => hook.result.current.toggle("real-venue"));
  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  expect(hook.result.current.data).toEqual([]);
  expect(mockStore.get("account-a")).toBeUndefined();
});

it("does not fetch or save in the read-only screenshot demo", async () => {
  const { wrapper } = setup();
  const hook = await renderHook(() => useSavedPlaces(false), { wrapper });
  await act(() => hook.result.current.toggle("demo-place"));
  expect(mockRead).not.toHaveBeenCalled();
  expect(mockWrite).not.toHaveBeenCalled();
});
