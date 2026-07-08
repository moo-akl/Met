import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Text as SvgText,
} from "react-native-svg";

export type RadarBlip = {
  initials: string;
  angle: number;
  radiusFraction: number;
};

type Props = {
  size?: number;
  blips?: RadarBlip[];
  periodMs?: number;
};

function toXY(angleDeg: number, r: number, cx: number, cy: number) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function angleDiff(a: number, sweep: number): number {
  const d = ((sweep - a) % 360 + 360) % 360;
  return d < 60 ? 1 - d / 60 : 0;
}

export function RadarView({ size = 220, blips = [], periodMs = 3500 }: Props) {
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
        {[1, 0.78, 0.56, 0.32].map((f, i) => (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={maxR * f}
            fill="none"
            stroke={`rgba(58,224,106,${0.1 + i * 0.04})`}
            strokeWidth="1"
          />
        ))}

        <Line
          x1={cx}
          y1={cy - maxR}
          x2={cx}
          y2={cy + maxR}
          stroke="rgba(58,224,106,0.06)"
          strokeWidth="1"
        />
        <Line
          x1={cx - maxR}
          y1={cy}
          x2={cx + maxR}
          y2={cy}
          stroke="rgba(58,224,106,0.06)"
          strokeWidth="1"
        />

        <Path
          d={`M${cx},${cy} L${trailStart.x},${trailStart.y} A${maxR},${maxR} 0 0,1 ${sweepEnd.x},${sweepEnd.y} Z`}
          fill="rgba(58,224,106,0.08)"
        />

        <Line
          x1={cx}
          y1={cy}
          x2={sweepEnd.x}
          y2={sweepEnd.y}
          stroke="rgba(58,224,106,0.75)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <Circle cx={sweepEnd.x} cy={sweepEnd.y} r="2.5" fill="#3AE06A" opacity="0.9" />

        {blips.map((b, i) => {
          const r = maxR * Math.max(0.25, Math.min(0.93, b.radiusFraction));
          const p = toXY(b.angle, r, cx, cy);
          const bright = angleDiff(b.angle, sweep);
          const alpha = 0.35 + bright * 0.65;
          const glowR = 8 + bright * 6;
          return (
            <G key={i}>
              <Circle
                cx={p.x}
                cy={p.y}
                r={glowR}
                fill={`rgba(58,224,106,${bright * 0.15})`}
              />
              <Circle
                cx={p.x}
                cy={p.y}
                r="9"
                fill={`rgba(58,224,106,${0.08 + bright * 0.12})`}
                stroke={`rgba(58,224,106,${alpha})`}
                strokeWidth="1"
              />
              <SvgText
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize="7"
                fontWeight="700"
                fill={`rgba(58,224,106,${alpha})`}
              >
                {b.initials}
              </SvgText>
            </G>
          );
        })}

        <Circle
          cx={cx}
          cy={cy}
          r="7"
          fill="rgba(58,224,106,0.15)"
          stroke="#3AE06A"
          strokeWidth="1.5"
        />
        <Circle cx={cx} cy={cy} r="2.5" fill="#3AE06A" opacity="0.9" />
      </Svg>
    </View>
  );
}
