import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useApp } from "@/contexts/AppContext";
import { api, ApiError } from "@/lib/api/client";
import { suppressFirestorePresence } from "@/lib/firestore/presence";
import { useVisibility } from "@/hooks/useVisibility";

jest.mock("@/contexts/AppContext", () => ({ useApp: jest.fn() }));
jest.mock("@/lib/api/client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;

    constructor(message: string, status: number, body: unknown) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
    }
  },
  api: {
    isConfigured: jest.fn(() => true),
    getMyProfile: jest.fn(),
    upsertMyProfile: jest.fn(),
  },
}));
jest.mock("@/lib/firestore/presence", () => ({
  stopFirestoreProximity: jest.fn(),
  suppressFirestorePresence: jest.fn(),
}));
jest.mock("@/lib/ble", () => ({
  stopBleProximity: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/lib/proximity/presence", () => ({
  stopProximity: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve("1")),
  setItem: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/lib/i18n", () => ({
  t: (key: string) => key,
}));

const mockProfile = {
  id: "firebase-user",
  name: "Local User",
  photoUri: "photo.png",
  bio: "",
  socials: {},
  verified: true,
  isVisible: false,
};

let capturedToggle: (() => Promise<void>) | null = null;
let setProfile: jest.Mock;

function Consumer() {
  const { toggle } = useVisibility();
  capturedToggle = toggle;
  return null;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function renderConsumer() {
  let renderer: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<Consumer />);
  });
  return renderer!;
}

beforeEach(() => {
  jest.clearAllMocks();
  capturedToggle = null;
  setProfile = jest.fn().mockResolvedValue(undefined);
  (useApp as jest.Mock).mockReturnValue({
    profile: mockProfile,
    setProfile,
    authedUid: "firebase-user",
  });
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue("1");
  (api.isConfigured as jest.Mock).mockReturnValue(true);
  (api.getMyProfile as jest.Mock).mockResolvedValue({
    uid: "firebase-user",
    displayName: "Local User",
    photoUrl: "photo.png",
    bio: "",
    socials: {},
    interests: null,
    isVisible: false,
    visibilityVersion: "version-1",
  });
  (api.upsertMyProfile as jest.Mock).mockResolvedValue({ isVisible: true });
  (suppressFirestorePresence as jest.Mock).mockResolvedValue(true);
});

describe("useVisibility", () => {
  it("keeps the local user hidden when the remote hide request fails", async () => {
    (api.upsertMyProfile as jest.Mock).mockRejectedValue(
      new Error("network unavailable"),
    );
    (useApp as jest.Mock).mockReturnValue({
      profile: { ...mockProfile, isVisible: true },
      setProfile,
      authedUid: "firebase-user",
    });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const renderer = await renderConsumer();

    await act(async () => {
      await capturedToggle?.();
    });

    expect(setProfile).toHaveBeenCalledTimes(1);
    expect(setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false }),
    );
    expect(suppressFirestorePresence).toHaveBeenCalledWith("firebase-user");
    expect(alertSpy).toHaveBeenCalledWith(
      "You're hidden on this device",
      expect.any(String),
    );
    alertSpy.mockRestore();
    await act(async () => {
      renderer.unmount();
    });
  });

  it("does not become visible when the server rejects the opt-in", async () => {
    (api.upsertMyProfile as jest.Mock)
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValue({ isVisible: false });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const renderer = await renderConsumer();

    await act(async () => {
      await capturedToggle?.();
    });

    expect(api.upsertMyProfile).toHaveBeenCalledWith(
      { uid: "firebase-user" },
      expect.objectContaining({ isVisible: true }),
    );
    expect(setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false }),
    );
    expect(alertSpy).toHaveBeenCalledWith(
      "Couldn't update visibility",
      expect.any(String),
    );
    alertSpy.mockRestore();
    await act(async () => {
      renderer.unmount();
    });
  });

  it("fails closed when the canonical profile has no visibility version", async () => {
    (api.getMyProfile as jest.Mock).mockResolvedValue({
      uid: "firebase-user",
      displayName: "Local User",
      photoUrl: "photo.png",
      bio: "",
      socials: {},
      isVisible: true,
    });
    (api.upsertMyProfile as jest.Mock).mockResolvedValue({ isVisible: false });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const renderer = await renderConsumer();

    await act(async () => {
      await capturedToggle?.();
    });

    expect(api.upsertMyProfile).toHaveBeenCalledWith(
      { uid: "firebase-user" },
      expect.objectContaining({ isVisible: false }),
    );
    expect(api.upsertMyProfile).not.toHaveBeenCalledWith(
      { uid: "firebase-user" },
      expect.objectContaining({ isVisible: true }),
    );
    expect(setProfile).not.toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: true }),
    );
    expect(suppressFirestorePresence).toHaveBeenCalledWith("firebase-user");
    expect(alertSpy).toHaveBeenCalledWith(
      "Couldn't update visibility",
      expect.any(String),
    );
    alertSpy.mockRestore();
    await act(async () => {
      renderer.unmount();
    });
  });

  it("does not compensate over a stale version conflict", async () => {
    (api.upsertMyProfile as jest.Mock).mockRejectedValue(
      new ApiError("Stale visibility version", 409, {}),
    );
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const renderer = await renderConsumer();

    await act(async () => {
      await capturedToggle?.();
    });

    expect(api.upsertMyProfile).toHaveBeenCalledTimes(1);
    expect(api.upsertMyProfile).toHaveBeenCalledWith(
      { uid: "firebase-user" },
      expect.objectContaining({
        isVisible: true,
        expectedVisibilityVersion: "version-1",
      }),
    );
    expect(setProfile).not.toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: true }),
    );
    expect(alertSpy).toHaveBeenCalledWith(
      "Couldn't update visibility",
      expect.any(String),
    );
    alertSpy.mockRestore();
    await act(async () => {
      renderer.unmount();
    });
  });

  it("waits for the version-checked server and mirror acknowledgement", async () => {
    const renderer = await renderConsumer();

    await act(async () => {
      await capturedToggle?.();
    });

    expect(api.upsertMyProfile).toHaveBeenCalledWith(
      { uid: "firebase-user" },
      expect.objectContaining({
        isVisible: true,
        expectedVisibilityVersion: "version-1",
      }),
    );
    expect(setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: true }),
    );
    await act(async () => {
      renderer.unmount();
    });
  });

  it("keeps visibility off locally until the opt-in acknowledgement arrives", async () => {
    const pendingSave = deferred<{ isVisible: boolean }>();
    (api.upsertMyProfile as jest.Mock).mockReturnValue(pendingSave.promise);
    const renderer = await renderConsumer();

    let toggle!: Promise<void>;
    await act(async () => {
      toggle = capturedToggle!();
      for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });

    expect(setProfile).not.toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: true }),
    );

    pendingSave.resolve({ isVisible: true });
    await act(async () => {
      await toggle;
    });

    expect(setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: true }),
    );
    await act(async () => {
      renderer.unmount();
    });
  });

  it("ignores a second toggle while the first visibility write is in flight", async () => {
    const pendingSave = deferred<{ isVisible: boolean }>();
    (api.upsertMyProfile as jest.Mock).mockReturnValue(pendingSave.promise);
    const renderer = await renderConsumer();

    let firstToggle!: Promise<void>;
    await act(async () => {
      firstToggle = capturedToggle!();
      for (let i = 0; i < 4; i += 1) await Promise.resolve();
    });
    await act(async () => {
      await capturedToggle?.();
    });
    expect(api.upsertMyProfile).toHaveBeenCalledTimes(1);

    pendingSave.resolve({ isVisible: true });
    await act(async () => {
      await firstToggle;
    });
    await act(async () => {
      renderer.unmount();
    });
  });

  it("starts account-wide opt-out without waiting for local storage", async () => {
    const pendingLocalSave = deferred<void>();
    setProfile = jest.fn(() => pendingLocalSave.promise);
    (useApp as jest.Mock).mockReturnValue({
      profile: { ...mockProfile, isVisible: true },
      setProfile,
      authedUid: "firebase-user",
    });
    const renderer = await renderConsumer();

    let toggle!: Promise<void>;
    await act(async () => {
      toggle = capturedToggle!();
      for (let i = 0; i < 4; i += 1) await Promise.resolve();
    });

    expect(setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ isVisible: false }),
    );
    expect(api.upsertMyProfile).toHaveBeenCalledWith(
      { uid: "firebase-user" },
      expect.objectContaining({ isVisible: false }),
    );
    expect(suppressFirestorePresence).toHaveBeenCalledWith("firebase-user");

    pendingLocalSave.resolve(undefined);
    await act(async () => {
      await toggle;
    });
    await act(async () => {
      renderer.unmount();
    });
  });

  it("restores hidden local state and opts out if saving visible state fails", async () => {
    setProfile = jest.fn(async (next: { isVisible: boolean }) => {
      if (next.isVisible) throw new Error("storage unavailable");
    });
    (useApp as jest.Mock).mockReturnValue({
      profile: mockProfile,
      setProfile,
      authedUid: "firebase-user",
    });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const renderer = await renderConsumer();

    await act(async () => {
      await capturedToggle?.();
    });

    expect(setProfile.mock.calls.map(([next]) => next.isVisible)).toEqual([
      true,
      false,
    ]);
    expect(api.upsertMyProfile).toHaveBeenNthCalledWith(
      2,
      { uid: "firebase-user" },
      expect.objectContaining({ isVisible: false }),
    );
    expect(alertSpy).toHaveBeenCalledWith(
      "Couldn't update visibility",
      expect.any(String),
    );
    alertSpy.mockRestore();
    await act(async () => {
      renderer.unmount();
    });
  });
});