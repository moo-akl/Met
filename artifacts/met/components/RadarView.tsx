import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { useColors } from "@/hooks/useColors";
import { hexToRgba } from "@/lib/color";

export type RadarBlip = {
  initials: string;
  angle: number;
  radiusFraction: number;
  /** Pro users appear with a gold glow on the radar. */
  spotlight?: boolean;
};

type Props = {
  size?: number;
  blips?: RadarBlip[];
  periodMs?: number;
  color?: string;
  /** When true the center dot (the current user) renders with a Pro spotlight glow. */
  isSpotlight?: boolean;
};

const SPOTLIGHT_GOLD = "#F5B700";

function toXY(angleDeg: number, r: number, cx: number, cy: number) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function angleDiff(a: number, sweep: number): number {
  const d = ((sweep - a) % 360 + 360) % 360;
  return d < 60 ? 1 - d / 60 : 0;
}

export function RadarView({ size = 220, blips = [], periodMs = 3500, color, isSpotlight = false }: Props) {
  const colors = useColors();
  const primaryColor = color ?? colors.primary;

  const [sweep, setSweep] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.455;

  useEffect(() => {
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      setSweep((((ts - startRef.current) % periodMs) / periodMs) * 360);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [periodMs]);

  const sweepEnd = toXY(sweep, maxR, cx, cy);
  const trailStart = toXY(sweep - 60, maxR, cx, cy);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          {/* Gold spotlight gradient for Pro center dot */}
          <RadialGradient id="proGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={SPOTLIGHT_GOLD} stopOpacity="0.55" />
            <Stop offset="100%" stopColor={SPOTLIGHT_GOLD} stopOpacity="0" />
          </RadialGradient>
          {/* Gold glow for Pro blips */}
          <RadialGradient id="blipProGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={SPOTLIGHT_GOLD} stopOpacity="0.45" />
            <Stop offset="100%" stopColor={SPOTLIGHT_GOLD} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Concentric rings */}
        {[1, 0.78, 0.56, 0.32].map((f, i) => (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={maxR * f}
            fill="none"
            stroke={hexToRgba(primaryColor, 0.1 + i * 0.04)}
            strokeWidth="1"
          />
        ))}

        {/* Cross-hairs */}
        <Line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke={hexToRgba(primaryColor, 0.06)} strokeWidth="1" />
        <Line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke={hexToRgba(primaryColor, 0.06)} strokeWidth="1" />

        {/* Sweep trail */}
        <Path
          d={`M${cx},${cy} L${trailStart.x},${trailStart.y} A${maxR},${maxR} 0 0,1 ${sweepEnd.x},${sweepEnd.y} Z`}
          fill={hexToRgba(primaryColor, 0.08)}
        />

        {/* Sweep line */}
        <Line x1={cx} y1={cy} x2={sweepEnd.x} y2={sweepEnd.y} stroke={hexToRgba(primaryColor, 0.75)} strokeWidth="1.5" strokeLinecap="round" />
        <Circle cx={sweepEnd.x} cy={sweepEnd.y} r="2.5" fill={primaryColor} opacity="0.9" />

        {/* Blips */}
        {blips.map((b, i) => {
          const r = maxR * Math.max(0.25, Math.min(0.93, b.radiusFraction));
          const p = toXY(b.angle, r, cx, cy);
          const bright = angleDiff(b.angle, sweep);
          const alpha = 0.35 + bright * 0.65;

          if (b.spotlight) {
            // Pro user blip — larger, gold-tinted glow
            const glowR = 14 + bright * 7;
            return (
              <G key={i}>
                {/* Outer gold halo */}
                <Circle cx={p.x} cy={p.y} r={glowR} fill="url(#blipProGlow)" />
                {/* Inner ring with gold border */}
                <Circle
                  cx={p.x} cy={p.y} r="11"
                  fill={hexToRgba(SPOTLIGHT_GOLD, 0.1 + bright * 0.15)}
                  stroke={hexToRgba(SPOTLIGHT_GOLD, 0.5 + bright * 0.5)}
                  strokeWidth="1.5"
                />
                <SvgText x={p.x} y={p.y + 4} textAnchor="middle" fontSize="7" fontWeight="700" fill={hexToRgba(SPOTLIGHT_GOLD, 0.6 + bright * 0.4)}>
                  {b.initials}
                </SvgText>
              </G>
            );
          }

          const glowR = 8 + bright * 6;
          return (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={glowR} fill={hexToRgba(primaryColor, bright * 0.15)} />
              <Circle cx={p.x} cy={p.y} r="9" fill={hexToRgba(primaryColor, 0.08 + bright * 0.12)} stroke={hexToRgba(primaryColor, alpha)} strokeWidth="1" />
              <SvgText x={p.x} y={p.y + 4} textAnchor="middle" fontSize="7" fontWeight="700" fill={hexToRgba(primaryColor, alpha)}>
                {b.initials}
              </SvgText>
            </G>
          );
        })}

        {/* Center dot — user themselves */}
        {isSpotlight ? (
          <G>
            {/* Pulsing gold glow for Pro users */}
            <Circle cx={cx} cy={cy} r="20" fill="url(#proGlow)" />
            <Circle cx={cx} cy={cy} r="9" fill={hexToRgba(SPOTLIGHT_GOLD, 0.2)} stroke={SPOTLIGHT_GOLD} strokeWidth="2" />
            <Circle cx={cx} cy={cy} r="3" fill={SPOTLIGHT_GOLD} opacity="1" />
          </G>
        ) : (
          <G>
            <Circle cx={cx} cy={cy} r="7" fill={hexToRgba(primaryColor, 0.15)} stroke={primaryColor} strokeWidth="1.5" />
            <Circle cx={cx} cy={cy} r="2.5" fill={primaryColor} opacity="0.9" />
          </G>
        )}
      </Svg>
    </View>
  );
}
