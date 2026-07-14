import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import * as Location from "expo-location";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import {
  api,
  type ActiveVenueResult,
  type HeatmapVenueResult,
} from "@/lib/api/client";

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

export function HeatmapMap({ style }: HeatmapMapProps) {
  const { authedUid } = useApp();
  const colors = useColors();

  const [region, setRegion] = useState(DEFAULT_REGION);
  const [activeVenues, setActiveVenues] = useState<ActiveVenueResult[]>([]);
  const [heatmapVenues, setHeatmapVenues] = useState<HeatmapVenueResult[]>([]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
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

  useEffect(() => {
    if (!authedUid) return;
    let cancelled = false;

    const init = async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) {
          const { latitude, longitude } = last.coords;
          setRegion({ latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 });
          void fetchHeatmap(latitude, longitude);
        }
      } catch {}

      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted" || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          const { latitude, longitude } = pos.coords;
          setRegion({ latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 });
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
  }, [authedUid, fetchActive, fetchHeatmap]);

  return (
    <MapView
      style={[styles.map, style]}
      region={region}
      showsUserLocation
      showsMyLocationButton={false}
    >
      {heatmapVenues.map((venue) => {
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
      })}
      {activeVenues
        .filter((v) => !isNaN(v.lat) && !isNaN(v.lng))
        .map((venue) => (
          <PulsingMarker
            key={`active-${venue.placeId}`}
            coordinate={{ latitude: venue.lat, longitude: venue.lng }}
            checkinCount={venue.checkinCount}
            primaryColor={colors.primary}
          />
        ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
  },
});
