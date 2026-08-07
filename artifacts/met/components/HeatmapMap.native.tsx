import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  api,
  type ActiveVenueResult,
  type HeatmapVenueResult,
  type VenueOwnerMapPoint,
} from "@/lib/api/client";
import { VenueOwnerMarker } from "@/components/VenueOwnerMarker";

// Refetch heatmap if the map center moved more than ~500 m (~0.005°)
const SIGNIFICANT_PAN_DEG = 0.005;
// Refetch if zoom changed by more than ~25 % of the current span
const SIGNIFICANT_ZOOM_RATIO = 0.25;
// Cap fetch radius at 100 km so we don't hammer the API on extreme zoom-out
const MAX_FETCH_RADIUS_M = 100_000;

/** Derive a fetch radius (metres) from the visible latitude span. */
function fetchRadiusFromDelta(latitudeDelta: number): number {
  return Math.min(
    Math.round(latitudeDelta * 111_000 * 0.6),
    MAX_FETCH_RADIUS_M,
  );
}

function regionMovedSignificantly(a: Region, b: Region): boolean {
  const panned =
    Math.abs(a.latitude - b.latitude) > SIGNIFICANT_PAN_DEG ||
    Math.abs(a.longitude - b.longitude) > SIGNIFICANT_PAN_DEG;
  const zoomed =
    Math.abs(a.latitudeDelta - b.latitudeDelta) >
    b.latitudeDelta * SIGNIFICANT_ZOOM_RATIO;
  return panned || zoomed;
}

export interface HeatmapMapProps {
  style?: StyleProp<ViewStyle>;
  onVenuePress?: (placeId: string) => void;
}

const DEFAULT_REGION = {
  latitude: 51.505,
  longitude: -0.09,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const POLL_MS = 60_000;

interface PulsingMarkerProps {
  coordinate: { latitude: number; longitude: number };
  checkinCount: number;
  primaryColor: string;
}

function PulsingMarker({
  coordinate,
  checkinCount,
  primaryColor,
}: PulsingMarkerProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2.6,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.65,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [scale, opacity]);

  const dotSize = Math.min(44, 22 + Math.min(checkinCount - 1, 4) * 5);

  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }}>
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          width: dotSize * 2.6,
          height: dotSize * 2.6,
        }}
      >
        <Animated.View
          style={{
            position: "absolute",
            width: dotSize * 2,
            height: dotSize * 2,
            borderRadius: dotSize,
            backgroundColor: primaryColor,
            opacity,
            transform: [{ scale }],
          }}
        />
        <View
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: primaryColor,
            borderWidth: 2,
            borderColor: "#ffffff",
          }}
        />
      </View>
    </Marker>
  );
}

function HeatmapMapInner({ style, onVenuePress }: HeatmapMapProps) {
  const { authedUid } = useApp();
  const colors = useColors();
  const router = useRouter();

  const mapRef = useRef<MapView>(null);
  const mapReadyRef = useRef(false);
  const pendingCenterRef = useRef<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [activeVenues, setActiveVenues] = useState<ActiveVenueResult[]>([]);
  const [heatmapVenues, setHeatmapVenues] = useState<HeatmapVenueResult[]>([]);
  const [venueOwnerPoints, setVenueOwnerPoints] = useState<VenueOwnerMapPoint[]>([]);
  // Tracks the current visible region so heatCircles can scale with zoom.
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  // Tracks the region at which we last fetched heatmap data to avoid
  // redundant fetches when the user pans only a tiny amount.
  const lastFetchedRegionRef = useRef<Region | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const centerOn = useCallback((latitude: number, longitude: number) => {
    pendingCenterRef.current = { latitude, longitude };
    const r: Region = { latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 };
    if (mapReadyRef.current) {
      mapRef.current?.animateToRegion(r, 400);
    }
  }, []);

  const fetchActive = useCallback(async () => {
    if (!authedUid || !mountedRef.current) return;
    try {
      const { venues } = await api.hubActive({ uid: authedUid });
      if (mountedRef.current) setActiveVenues(venues);
    } catch {}
  }, [authedUid]);

  const fetchVenueOwners = useCallback(async () => {
    if (!authedUid || !mountedRef.current) return;
    try {
      const { venues } = await api.getVenueOwnerMapPoints({ uid: authedUid });
      if (mountedRef.current) setVenueOwnerPoints(venues);
    } catch {}
  }, [authedUid]);

  const fetchHeatmap = useCallback(
    async (lat: number, lng: number, radius: number) => {
      if (!authedUid || !mountedRef.current) return;
      try {
        const { venues } = await api.hubHeatmap(
          { uid: authedUid },
          { lat, lng, radius },
        );
        if (mountedRef.current) setHeatmapVenues(venues);
      } catch {}
    },
    [authedUid],
  );

  // Fired by MapView after the user finishes panning or zooming. Only
  // refetches heatmap data if the center moved significantly (> ~500 m)
  // or the zoom level changed significantly — prevents excessive API
  // calls on every tiny drag.
  const handleRegionChangeComplete = useCallback(
    (newRegion: Region) => {
      setRegion(newRegion);
      const prev = lastFetchedRegionRef.current;
      if (prev && !regionMovedSignificantly(prev, newRegion)) return;
      lastFetchedRegionRef.current = newRegion;
      const radius = fetchRadiusFromDelta(newRegion.latitudeDelta);
      void fetchHeatmap(newRegion.latitude, newRegion.longitude, radius);
    },
    [fetchHeatmap],
  );

  useEffect(() => {
    if (!authedUid) return;
    let cancelled = false;

    const init = async () => {
      // Quick initial center from last known position
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) {
          const { latitude, longitude } = last.coords;
          centerOn(latitude, longitude);
          const initialDelta = 0.015;
          lastFetchedRegionRef.current = {
            latitude,
            longitude,
            latitudeDelta: initialDelta,
            longitudeDelta: initialDelta,
          };
          void fetchHeatmap(latitude, longitude, fetchRadiusFromDelta(initialDelta));
        }
      } catch {}

      // Then get a fresh accurate position
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted" || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          const { latitude, longitude } = pos.coords;
          centerOn(latitude, longitude);
          const initialDelta = 0.015;
          lastFetchedRegionRef.current = {
            latitude,
            longitude,
            latitudeDelta: initialDelta,
            longitudeDelta: initialDelta,
          };
          void fetchHeatmap(latitude, longitude, fetchRadiusFromDelta(initialDelta));
        }
      } catch {}
    };

    void init();
    void fetchActive();
    void fetchVenueOwners();

    const pollId = setInterval(() => {
      void fetchActive();
    }, POLL_MS);

    // Venue owner map points refresh every 5 minutes (they change infrequently)
    const voPollId = setInterval(() => {
      void fetchVenueOwners();
    }, 5 * POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      clearInterval(voPollId);
    };
  }, [authedUid, centerOn, fetchActive, fetchHeatmap, fetchVenueOwners]);

  // Memoize Circle and Marker children so MapView's child tree is stable
  // between renders and doesn't trigger unnecessary Google Maps SDK redraws.
  //
  // Visual radius scales with the visible latitude span so density spots
  // remain perceptible at both street level and city/country level.
  // Base circle ≈ 2.5 % of the visible height; high-popularity venues grow
  // up to 5 % of the visible height. These fractions keep circles visually
  // distinguishable without swamping the map at any zoom.
  const heatCircles = useMemo(() => {
    const visibleHeightM = region.latitudeDelta * 111_000;
    const baseRadiusM = visibleHeightM * 0.025;
    const popBoostM = visibleHeightM * 0.025;

    return heatmapVenues.map((venue) => {
      const pop = venue.popularity ?? 0;
      const radius = baseRadiusM + (pop / 100) * popBoostM;
      // Gradient from cool blue-violet (low) → warm orange-red (high)
      const r = Math.round(80 + (pop / 100) * 175);
      const g = Math.round(60 - (pop / 100) * 20);
      const b = Math.round(200 - (pop / 100) * 180);
      const fillOpacity = pop > 0 ? 0.18 + (pop / 100) * 0.32 : 0.1;
      const strokeOpacity = pop > 0 ? 0.4 + (pop / 100) * 0.3 : 0.2;
      return (
        <Circle
          key={`heat-${venue.placeId}`}
          center={{ latitude: venue.lat, longitude: venue.lng }}
          radius={radius}
          strokeWidth={1.5}
          strokeColor={`rgba(${r},${g},${b},${strokeOpacity.toFixed(2)})`}
          fillColor={`rgba(${r},${g},${b},${fillOpacity.toFixed(2)})`}
        />
      );
    });
  }, [heatmapVenues, region.latitudeDelta]);

  const activeMarkers = useMemo(
    () =>
      activeVenues
        .filter((v) => !isNaN(v.lat) && !isNaN(v.lng))
        .map((venue) => (
          <PulsingMarker
            key={`active-${venue.placeId}`}
            coordinate={{ latitude: venue.lat, longitude: venue.lng }}
            checkinCount={venue.checkinCount}
            primaryColor="#34C759"
          />
        )),
    [activeVenues],
  );

  // Layer 3 — approved venue owner branded pins (gold stars, top layer)
  const venueOwnerMarkers = useMemo(
    () =>
      venueOwnerPoints
        .filter((v) => v.lat !== null && v.lng !== null)
        .map((venue) => (
          <VenueOwnerMarker
            key={`vo-${venue.placeId}`}
            venue={venue}
            onPress={(placeId) => {
              if (onVenuePress) {
                onVenuePress(placeId);
              } else {
                router.push({ pathname: "/venue/[placeId]", params: { placeId } } as never);
              }
            }}
          />
        )),
    [venueOwnerPoints, router],
  );

  return (
    <MapView
      ref={mapRef}
      provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      style={[styles.map, style]}
      initialRegion={DEFAULT_REGION}
      onMapReady={() => {
        mapReadyRef.current = true;
        const pending = pendingCenterRef.current;
        if (pending) {
          const r: Region = {
            latitude: pending.latitude,
            longitude: pending.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          };
          mapRef.current?.animateToRegion(r, 400);
        }
      }}
      showsUserLocation
      showsMyLocationButton={false}
      onRegionChangeComplete={handleRegionChangeComplete}
    >
      {heatCircles}
      {activeMarkers}
      {venueOwnerMarkers}
    </MapView>
  );
}

// React.memo prevents re-renders when the parent re-renders but props are
// unchanged — critical for HeatmapMap because the Google Maps SDK incurs
// non-trivial memory and GPU cost on every mount/unmount cycle.
export const HeatmapMap = React.memo(HeatmapMapInner);

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
  },
});
