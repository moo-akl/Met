import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  api,
  type ActiveVenueResult,
  type HeatmapVenueResult,
} from "@/lib/api/client";

// Refetch heatmap if the map center moved more than ~500 m (~0.005°)
const SIGNIFICANT_PAN_DEG = 0.005;

function regionMovedSignificantly(a: Region, b: Region): boolean {
  return (
    Math.abs(a.latitude - b.latitude) > SIGNIFICANT_PAN_DEG ||
    Math.abs(a.longitude - b.longitude) > SIGNIFICANT_PAN_DEG
  );
}

export interface HeatmapMapProps {
  style?: StyleProp<ViewStyle>;
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
            toValue: 2.0,
            duration: 1100,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1100,
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
            toValue: 0.55,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [scale, opacity]);

  const dotSize = Math.min(28, 14 + Math.min(checkinCount - 1, 4) * 3);

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

function HeatmapMapInner({ style }: HeatmapMapProps) {
  const { authedUid } = useApp();
  const colors = useColors();

  const mapRef = useRef<MapView>(null);
  const [activeVenues, setActiveVenues] = useState<ActiveVenueResult[]>([]);
  const [heatmapVenues, setHeatmapVenues] = useState<HeatmapVenueResult[]>([]);
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
    const r: Region = { latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 };
    mapRef.current?.animateToRegion(r, 400);
  }, []);

  const fetchActive = useCallback(async () => {
    if (!authedUid || !mountedRef.current) return;
    try {
      const { venues } = await api.hubActive({ uid: authedUid });
      if (mountedRef.current) setActiveVenues(venues);
    } catch {}
  }, [authedUid]);

  const fetchHeatmap = useCallback(
    async (lat: number, lng: number) => {
      if (!authedUid || !mountedRef.current) return;
      try {
        const { venues } = await api.hubHeatmap(
          { uid: authedUid },
          { lat, lng, radius: 1000 },
        );
        if (mountedRef.current) setHeatmapVenues(venues);
      } catch {}
    },
    [authedUid],
  );

  // Fired by MapView after the user finishes panning or zooming. Only
  // refetches heatmap data if the center moved significantly (> ~500 m)
  // from the position used for the last fetch — prevents excessive API
  // calls on every tiny drag.
  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      const prev = lastFetchedRegionRef.current;
      if (prev && !regionMovedSignificantly(prev, region)) return;
      lastFetchedRegionRef.current = region;
      void fetchHeatmap(region.latitude, region.longitude);
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
          lastFetchedRegionRef.current = {
            latitude,
            longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          };
          void fetchHeatmap(latitude, longitude);
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
          lastFetchedRegionRef.current = {
            latitude,
            longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          };
          void fetchHeatmap(latitude, longitude);
        }
      } catch {}
    };

    void init();
    void fetchActive();

    const pollId = setInterval(() => {
      void fetchActive();
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [authedUid, centerOn, fetchActive, fetchHeatmap]);

  // Memoize Circle and Marker children so MapView's child tree is stable
  // between renders and doesn't trigger unnecessary Google Maps SDK redraws.
  const heatCircles = useMemo(
    () =>
      heatmapVenues.map((venue) => {
        const pop = venue.popularity ?? 0;
        const radius = 20 + (pop / 100) * 80;
        const fillOpacity = pop > 0 ? 0.1 + (pop / 100) * 0.22 : 0.07;
        return (
          <Circle
            key={`heat-${venue.placeId}`}
            center={{ latitude: venue.lat, longitude: venue.lng }}
            radius={radius}
            strokeWidth={1}
            strokeColor="rgba(110,110,110,0.4)"
            fillColor={`rgba(110,110,110,${fillOpacity.toFixed(2)})`}
          />
        );
      }),
    [heatmapVenues],
  );

  const activeMarkers = useMemo(
    () =>
      activeVenues
        .filter((v) => !isNaN(v.lat) && !isNaN(v.lng))
        .map((venue) => (
          <PulsingMarker
            key={`active-${venue.placeId}`}
            coordinate={{ latitude: venue.lat, longitude: venue.lng }}
            checkinCount={venue.checkinCount}
            primaryColor={colors.primary}
          />
        )),
    [activeVenues, colors.primary],
  );

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={[styles.map, style]}
      initialRegion={DEFAULT_REGION}
      showsUserLocation
      showsMyLocationButton={false}
      onRegionChangeComplete={handleRegionChangeComplete}
    >
      {heatCircles}
      {activeMarkers}
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
