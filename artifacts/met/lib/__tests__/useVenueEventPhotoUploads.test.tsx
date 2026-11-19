import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Pressable, Text, View } from "react-native";
import { useVenueEventPhotoUploads } from "../useVenueEventPhotoUploads";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPrepareVenueEventImage = jest.fn();
const mockStartVenueEventImageUpload = jest.fn();

jest.mock("@/lib/venueEventImage", () => ({
  prepareVenueEventImage: (...args: unknown[]) =>
    mockPrepareVenueEventImage(...args),
}));

jest.mock("@/lib/api/client", () => ({
  startVenueEventImageUpload: (...args: unknown[]) =>
    mockStartVenueEventImageUpload(...args),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function UploadQueueHarness() {
  const queue = useVenueEventPhotoUploads("test-user", []);
  return (
    <View>
      <Pressable
        testID="add-photos"
        onPress={() =>
          queue.addPhotos(
            [1, 2, 3, 4].map((index) => ({
              uri: `file:///photo-${index}.jpg`,
              width: 1200,
            })),
          )
        }
      >
        <Text>Add</Text>
      </Pressable>
      <Pressable
        testID="add-one-photo"
        onPress={() =>
          queue.addPhotos([{ uri: "file:///single-photo.jpg", width: 1200 }])
        }
      >
        <Text>Add one</Text>
      </Pressable>
      <Text testID="photo-statuses">
        {queue.photos.map((photo) => photo.status).join(",")}
      </Text>
      <Pressable
        testID="retry-first"
        onPress={() => {
          const first = queue.photos[0];
          if (first) queue.retryPhoto(first.id);
        }}
      >
        <Text>Retry</Text>
      </Pressable>
      <Pressable
        testID="remove-first"
        onPress={() => {
          const first = queue.photos[0];
          if (first) queue.removePhoto(first.id);
        }}
      >
        <Text>Remove</Text>
      </Pressable>
    </View>
  );
}

describe("useVenueEventPhotoUploads", () => {
  beforeEach(() => {
    mockPrepareVenueEventImage.mockReset();
    mockStartVenueEventImageUpload.mockReset();
    mockPrepareVenueEventImage.mockImplementation(async (uri: string) => ({
      uri: uri.replace("photo-", "prepared-"),
      size: 1000,
      contentType: "image/jpeg",
    }));
  });

  it("starts no more than two photo uploads at once", async () => {
    const pending: Array<{
      uploadId: string;
      resolve: (value: { url: string }) => void;
    }> = [];
    mockStartVenueEventImageUpload.mockImplementation(
      (_opts: unknown, input: { uploadId: string }) => {
        const upload = deferred<{ url: string }>();
        pending.push({ uploadId: input.uploadId, resolve: upload.resolve });
        return { promise: upload.promise, cancel: jest.fn() };
      },
    );

    const screen = await render(<UploadQueueHarness />);
    fireEvent.press(screen.getByTestId("add-photos"));

    await waitFor(() =>
      expect(mockStartVenueEventImageUpload).toHaveBeenCalledTimes(2),
    );
    expect(mockPrepareVenueEventImage).toHaveBeenCalledTimes(2);

    await act(async () => pending[0]?.resolve({ url: "https://cdn.test/1.jpg" }));
    await waitFor(() =>
      expect(mockStartVenueEventImageUpload).toHaveBeenCalledTimes(3),
    );
    await act(async () => pending[1]?.resolve({ url: "https://cdn.test/2.jpg" }));
    await waitFor(() =>
      expect(mockStartVenueEventImageUpload).toHaveBeenCalledTimes(4),
    );
    await act(async () => {
      pending[2]?.resolve({ url: "https://cdn.test/3.jpg" });
      pending[3]?.resolve({ url: "https://cdn.test/4.jpg" });
    });
    await waitFor(() =>
      expect(screen.getByTestId("photo-statuses").props.children).toBe(
        "uploaded,uploaded,uploaded,uploaded",
      ),
    );
  });

  it("retries a failed upload with the same upload ID", async () => {
    const retry = deferred<{ url: string }>();
    mockStartVenueEventImageUpload
      .mockImplementationOnce(() => ({
        promise: Promise.reject(new Error("network down")),
        cancel: jest.fn(),
      }))
      .mockImplementationOnce(() => ({
        promise: retry.promise,
        cancel: jest.fn(),
      }));

    const screen = await render(<UploadQueueHarness />);
    fireEvent.press(screen.getByTestId("add-one-photo"));
    await waitFor(() =>
      expect(screen.getByTestId("photo-statuses").props.children).toContain("failed"),
    );

    const firstUploadId =
      mockStartVenueEventImageUpload.mock.calls[0]?.[1].uploadId;
    fireEvent.press(screen.getByTestId("retry-first"));
    await waitFor(() =>
      expect(mockStartVenueEventImageUpload).toHaveBeenCalledTimes(2),
    );
    expect(mockStartVenueEventImageUpload.mock.calls[1]?.[1].uploadId).toBe(
      firstUploadId,
    );

    await act(async () => retry.resolve({ url: "https://cdn.test/retried.jpg" }));
    await waitFor(() =>
      expect(screen.getByTestId("photo-statuses").props.children).toBe("uploaded"),
    );
  });

  it("cancels an in-flight upload when the photo is removed", async () => {
    const cancel = jest.fn();
    mockStartVenueEventImageUpload.mockReturnValue({
      promise: new Promise<{ url: string }>(() => {}),
      cancel,
    });

    const screen = await render(<UploadQueueHarness />);
    fireEvent.press(screen.getByTestId("add-one-photo"));
    await waitFor(() =>
      expect(mockStartVenueEventImageUpload).toHaveBeenCalledTimes(1),
    );
    fireEvent.press(screen.getByTestId("remove-first"));
    expect(cancel).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId("photo-statuses").props.children).toBe(""),
    );
  });
});
