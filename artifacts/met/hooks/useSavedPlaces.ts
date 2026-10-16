import { useCallback } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import {
  useListSavedPlaces,
  useSavePlace,
  useUnsavePlace,
  type SavedPlace,
} from "@workspace/api-client-react";
import { useApp } from "@/contexts/AppContext";

/** One account-scoped server cache shared by Home, venue detail and Saved. */
export function useSavedPlaces(enabled = true) {
  const { authedUid } = useApp();
  const client = useQueryClient();
  const queryKey = ["saved-places", authedUid];
  const mutationKey = ["saved-place-write", authedUid];
  // Matches the existing client's dev-only identity fallback. Production
  // always requires the Firebase bearer token installed at app startup.
  const request = { headers: { "X-Met-Uid": authedUid ?? "" } };
  const query = useListSavedPlaces({
    query: { queryKey, enabled: enabled && !!authedUid, staleTime: 0, gcTime: 0 },
    request,
  });
  const refresh = query.refetch;
  useFocusEffect(useCallback(() => {
    if (enabled && authedUid) void refresh();
  }, [enabled, authedUid, refresh]));

  const onError = () => Alert.alert(
    "Couldn’t update Saved",
    "We couldn’t confirm the change. Refresh Saved or try again when you’re connected.",
  );
  const onSettled = () => { void client.invalidateQueries({ queryKey }); };
  const save = useSavePlace({
    request,
    mutation: {
      mutationKey,
      onSuccess: (place) => {
        client.setQueryData<SavedPlace[]>(queryKey, (old) =>
          [place, ...(old ?? []).filter((p) => p.placeId !== place.placeId)]
            .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
        );
      },
      onError,
      onSettled,
    },
  });
  const unsave = useUnsavePlace({
    request,
    mutation: {
      mutationKey,
      onSuccess: (_, { placeId }) => {
        client.setQueryData<SavedPlace[]>(queryKey, (old) =>
          (old ?? []).filter((p) => p.placeId !== placeId),
        );
      },
      onError,
      onSettled,
    },
  });
  const pending = useIsMutating({ mutationKey }) > 0;
  const toggle = (placeId: string) => {
    if (!enabled) return;
    if (!authedUid) {
      Alert.alert("Sign in to save places", "Sign in to keep your favorite venues in Saved.");
      return;
    }
    if (query.isError) {
      void refresh();
      return;
    }
    // Read live mutation/cache state so rapid presses cannot race a render.
    if (!query.data || client.isMutating({ mutationKey }) > 0) return;
    void client.cancelQueries({ queryKey });
    if (query.data.some((p) => p.placeId === placeId)) {
      unsave.mutate({ placeId });
    } else {
      save.mutate({ placeId });
    }
  };
  return { ...query, pending, toggle, signedIn: !!authedUid };
}
