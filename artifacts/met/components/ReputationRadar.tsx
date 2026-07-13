/**
 * ReputationRadar
 *
 * Triangular radar chart showing averaged scores across three review
 * dimensions: Courtesy, Communication, Reliability.
 * Each axis maps score 1–5 to distance from centre.
 * Community Standing is shown as a 0–100 index (normalized from the avg).
 * The data polygon fades in on mount with a React Native Animated.Value.
 * Rendered with react-native-svg (already in the project).
 */
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Polygon, Text as SvgText } from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";

interface ReviewSummary {
  count: number;
  hasEnough: boolean;
  averageCourtesy?: number;
  averageCommunication?: number;
  averageReliability?: number;
  communityStanding?: number;
}

interface Props {
  summary: ReviewSummary | null;
  loading?: boolean;
}

// Equilateral triangle geometry
// Top vertex = Communication (angle -90°)
// Bottom-right = Courtesy (angle 30°)
// Bottom-left = Reliability (angle 150°)
const R = 72; // outer radius
const CX = 110;
const CY = 100;
const SVG_W = 220;
const SVG_H = 200;

const TIERS = [1, 2, 3, 4, 5]; // 5 rings

function vertex(score: number, angleDeg: number): { x: number; y: number } {
  const frac = score / 5;
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + R * frac * Math.cos(rad),
    y: CY + R * frac * Math.sin(rad),
  };
}

function trianglePoints(frac: number): string {
  const top = vertex(5 * frac, -90);
  const br = vertex(5 * frac, 30);
  const bl = vertex(5 * frac, 150);
  return `${top.x},${top.y} ${br.x},${br.y} ${bl.x},${bl.y}`;
}

function dataPath(
  courtesy: number,
  communication: number,
  reliability: number,
): string {
  const top = vertex(communication, -90);
  const br = vertex(courtesy, 30);
  const bl = vertex(reliability, 150);
  return `M ${top.x} ${top.y} L ${br.x} ${br.y} L ${bl.x} ${bl.y} Z`;
}

export function ReputationRadar({ summary, loading }: Props) {
  const colors = useColors();
  const { t } = useT();

  // Animate the chart fill/polygon into view on mount
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const cardBg = colors.card;
  const borderColor = colors.border;
  const muted = colors.mutedForeground;
  const primary = colors.primary;
  const fg = colors.foreground;

  if (loading) {
    return null;
  }

  if (!summary || !summary.hasEnough) {
    return (
      <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
        <Text style={[styles.heading, { color: fg }]}>
          {t("review.communityStanding")}
        </Text>
        <Text style={[styles.emptyText, { color: muted }]}>
          {t("review.notEnoughReviews")}
        </Text>
      </View>
    );
  }

  const courtesy = Math.max(1, Math.min(5, summary.averageCourtesy ?? 1));
  const communication = Math.max(1, Math.min(5, summary.averageCommunication ?? 1));
  const reliability = Math.max(1, Math.min(5, summary.averageReliability ?? 1));

  // communityStanding arrives as 0–100 from the server; fall back to local normalization
  const standingPct = Math.round(
    summary.communityStanding ??
      (((courtesy + communication + reliability) / 3 - 1) / 4) * 100,
  );

  // Label positions (outside each vertex)
  const LABEL_OFFSET = 18;
  const topV = vertex(5, -90);
  const brV = vertex(5, 30);
  const blV = vertex(5, 150);

  const topLabel = { x: topV.x, y: topV.y - LABEL_OFFSET };
  const brLabel = { x: brV.x + LABEL_OFFSET, y: brV.y + 4 };
  const blLabel = { x: blV.x - LABEL_OFFSET, y: blV.y + 4 };

  const gridColor = borderColor;
  const fillColor = primary + "33";
  const strokeColor = primary;

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.headingRow}>
        <Text style={[styles.heading, { color: fg }]}>
          {t("review.communityStanding")}
        </Text>
        <View style={[styles.standingBadge, { backgroundColor: primary + "18" }]}>
          <Text style={[styles.standingPct, { color: primary }]}>
            {standingPct}%
          </Text>
        </View>
      </View>

      {/* Animated chart area — fades in on mount */}
      <Animated.View style={[styles.chartArea, { opacity: fadeAnim }]}>
        <Svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
          {/* Grid rings */}
          {TIERS.map((tier) => (
            <Polygon
              key={tier}
              points={trianglePoints(tier / 5)}
              fill="none"
              stroke={gridColor}
              strokeWidth={0.8}
              strokeDasharray={tier < 5 ? "3,3" : undefined}
              opacity={0.5}
            />
          ))}

          {/* Axis lines from centre */}
          <Line
            x1={CX} y1={CY}
            x2={vertex(5, -90).x} y2={vertex(5, -90).y}
            stroke={gridColor} strokeWidth={0.8} opacity={0.4}
          />
          <Line
            x1={CX} y1={CY}
            x2={vertex(5, 30).x} y2={vertex(5, 30).y}
            stroke={gridColor} strokeWidth={0.8} opacity={0.4}
          />
          <Line
            x1={CX} y1={CY}
            x2={vertex(5, 150).x} y2={vertex(5, 150).y}
            stroke={gridColor} strokeWidth={0.8} opacity={0.4}
          />

          {/* Data polygon */}
          <Path
            d={dataPath(courtesy, communication, reliability)}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {/* Data dots */}
          {[
            vertex(communication, -90),
            vertex(courtesy, 30),
            vertex(reliability, 150),
          ].map((v, i) => (
            <Circle
              key={i}
              cx={v.x}
              cy={v.y}
              r={4}
              fill={strokeColor}
            />
          ))}

          {/* Axis labels */}
          <SvgText
            x={topLabel.x}
            y={topLabel.y}
            textAnchor="middle"
            fill={muted}
            fontSize={9.5}
            fontFamily="Inter_600SemiBold"
          >
            {t("review.communication")}
          </SvgText>
          <SvgText
            x={brLabel.x}
            y={brLabel.y}
            textAnchor="start"
            fill={muted}
            fontSize={9.5}
            fontFamily="Inter_600SemiBold"
          >
            {t("review.courtesy")}
          </SvgText>
          <SvgText
            x={blLabel.x}
            y={blLabel.y}
            textAnchor="end"
            fill={muted}
            fontSize={9.5}
            fontFamily="Inter_600SemiBold"
          >
            {t("review.reliability")}
          </SvgText>
        </Svg>
      </Animated.View>

      {/* Score row */}
      <View style={styles.scoreRow}>
        {[
          { label: t("review.courtesy"), val: courtesy },
          { label: t("review.communication"), val: communication },
          { label: t("review.reliability"), val: reliability },
        ].map(({ label, val }) => (
          <View key={label} style={styles.scoreItem}>
            <Text style={[styles.scoreVal, { color: primary }]}>
              {val.toFixed(1)}
            </Text>
            <Text style={[styles.scoreLabel, { color: muted }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.reviewCount, { color: muted }]}>
        {summary.count} {summary.count === 1 ? "review" : "reviews"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heading: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  standingBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  standingPct: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  chartArea: {
    alignItems: "center",
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 4,
    marginBottom: 6,
  },
  scoreItem: {
    alignItems: "center",
    flex: 1,
  },
  scoreVal: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  scoreLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 16,
  },
  reviewCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
  },
});
