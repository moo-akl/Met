import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startVenueEventImageUpload } from "@/lib/api/client";
import { prepareVenueEventImage } from "@/lib/venueEventImage";

export type VenueEventPhotoStatus =
  | "queued"
  | "preparing"
  | "uploading"
  | "uploaded"
  | "failed";

export type VenueEventPhoto = {
  id: string;
  localUri: string;
  preparedUri: string | null;
  url: string | null;
  width: number;
  status: VenueEventPhotoStatus;
  progress: number;
  error?: string;
};

type PhotoAsset = { uri: string; width: number };
type UploadJob = { id: string; width: number };

const MAX_PHOTOS = 10;
const MAX_CONCURRENT_UPLOADS = 2;

export function useVenueEventPhotoUploads(
  uid: string | null,
  initialUrls: string[],
) {
  const [photos, setPhotos] = useState<VenueEventPhoto[]>(() =>
    initialUrls.map((url, index) => ({
      id: `existing-${index}`,
      localUri: url,
      preparedUri: url,
      url,
      width: 0,
      status: "uploaded",
      progress: 1,
    })),
  );
  const photosRef = useRef(photos);
  const queueRef = useRef<UploadJob[]>([]);
  const activeCountRef = useRef(0);
  const nextIdRef = useRef(0);
  const uploadTasksRef = useRef(
    new Map<string, { cancel: () => void }>(),
  );
  const cancelledIdsRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const drainRef = useRef<() => void>(() => {});

  const updatePhotos = useCallback(
    (update: (current: VenueEventPhoto[]) => VenueEventPhoto[]) => {
      if (!mountedRef.current) return;
      const next = update(photosRef.current);
      photosRef.current = next;
      setPhotos(next);
    },
    [],
  );

  const patchPhoto = useCallback(
    (id: string, patch: Partial<VenueEventPhoto>) => {
      updatePhotos((current) =>
        current.map((photo) =>
          photo.id === id ? { ...photo, ...patch } : photo,
        ),
      );
    },
    [updatePhotos],
  );

  const processPhoto = useCallback(
    async ({ id, width }: UploadJob) => {
      let photo = photosRef.current.find((candidate) => candidate.id === id);
      if (!photo || !uid || cancelledIdsRef.current.has(id)) return;

      try {
        let preparedUri = photo.preparedUri;
        let contentType = "image/jpeg";
        if (!preparedUri || preparedUri === photo.url) {
          patchPhoto(id, { status: "preparing", error: undefined, progress: 0 });
          const prepared = await prepareVenueEventImage(photo.localUri, width);
          if (cancelledIdsRef.current.has(id)) return;
          preparedUri = prepared.uri;
          contentType = prepared.contentType;
          patchPhoto(id, { preparedUri, status: "uploading" });
        }

        photo = photosRef.current.find((candidate) => candidate.id === id);
        if (!photo || !preparedUri || cancelledIdsRef.current.has(id)) return;
        const upload = startVenueEventImageUpload(
          { uid },
          {
            uri: preparedUri,
            contentType,
            uploadId: id,
          },
          (sentBytes, totalBytes) => {
            if (totalBytes > 0) {
              patchPhoto(id, {
                progress: Math.min(1, sentBytes / totalBytes),
                status: "uploading",
              });
            }
          },
        );
        uploadTasksRef.current.set(id, upload);
        patchPhoto(id, { status: "uploading", error: undefined, progress: 0 });
        const { url } = await upload.promise;
        if (cancelledIdsRef.current.has(id)) return;
        patchPhoto(id, {
          url,
          preparedUri,
          status: "uploaded",
          progress: 1,
          error: undefined,
        });
      } catch (error) {
        if (!cancelledIdsRef.current.has(id)) {
          patchPhoto(id, {
            status: "failed",
            error:
              error instanceof Error
                ? error.message
                : "Could not upload this photo.",
          });
        }
      } finally {
        uploadTasksRef.current.delete(id);
      }
    },
    [patchPhoto, uid],
  );

  const drainQueue = useCallback(() => {
    while (
      activeCountRef.current < MAX_CONCURRENT_UPLOADS &&
      queueRef.current.length > 0
    ) {
      const job = queueRef.current.shift();
      if (!job) break;
      if (
        cancelledIdsRef.current.has(job.id) ||
        !photosRef.current.some((photo) => photo.id === job.id)
      ) {
        continue;
      }
      activeCountRef.current += 1;
      void processPhoto(job).finally(() => {
        activeCountRef.current = Math.max(0, activeCountRef.current - 1);
        drainRef.current();
      });
    }
  }, [processPhoto]);
  drainRef.current = drainQueue;

  const addPhotos = useCallback((assets: PhotoAsset[]) => {
    if (!uid) return 0;
    const slots = Math.max(0, MAX_PHOTOS - photosRef.current.length);
    const selected = assets.slice(0, slots);
    if (!selected.length) return 0;
    const newPhotos = selected.map((asset) => {
      const randomSuffix = Math.random().toString(36).slice(2, 10);
      const id = `photo-${Date.now().toString(36)}-${randomSuffix}-${nextIdRef.current++}`;
      return {
        id,
        localUri: asset.uri,
        preparedUri: null,
        url: null,
        width: asset.width,
        status: "queued" as const,
        progress: 0,
      };
    });
    updatePhotos((current) => [...current, ...newPhotos]);
    queueRef.current.push(...newPhotos.map((photo) => ({
      id: photo.id,
      width: photo.width,
    })));
    drainRef.current();
    return newPhotos.length;
  }, [uid, updatePhotos]);

  const removePhoto = useCallback(
    (id: string) => {
      cancelledIdsRef.current.add(id);
      uploadTasksRef.current.get(id)?.cancel();
      uploadTasksRef.current.delete(id);
      queueRef.current = queueRef.current.filter((job) => job.id !== id);
      updatePhotos((current) => current.filter((photo) => photo.id !== id));
    },
    [updatePhotos],
  );

  const retryPhoto = useCallback(
    (id: string) => {
      const photo = photosRef.current.find((candidate) => candidate.id === id);
      if (!photo || photo.status !== "failed") return;
      queueRef.current.push({ id, width: photo.width });
      patchPhoto(id, { status: "queued", progress: 0, error: undefined });
      drainRef.current();
    },
    [patchPhoto],
  );

  const cancelAll = useCallback(() => {
    queueRef.current = [];
    photosRef.current.forEach((photo) => cancelledIdsRef.current.add(photo.id));
    uploadTasksRef.current.forEach((task) => task.cancel());
    uploadTasksRef.current.clear();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelAll();
    };
  }, [cancelAll]);

  const uploadedUrls = useMemo(
    () =>
      photos.flatMap((photo) =>
        photo.status === "uploaded" && photo.url ? [photo.url] : [],
      ),
    [photos],
  );
  const hasPendingUploads = photos.some(
    (photo) =>
      photo.status === "queued" ||
      photo.status === "preparing" ||
      photo.status === "uploading",
  );
  const hasFailedUploads = photos.some((photo) => photo.status === "failed");

  return {
    photos,
    uploadedUrls,
    addPhotos,
    removePhoto,
    retryPhoto,
    cancelAll,
    hasPendingUploads,
    hasFailedUploads,
    allPhotosUploaded: !hasPendingUploads && !hasFailedUploads,
  };
}
