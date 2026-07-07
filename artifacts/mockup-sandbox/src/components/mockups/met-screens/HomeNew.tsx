import { useEffect, useRef, useState } from "react";

const ENCOUNTERS = [
  { initials: "SK", name: "Sarah K.", place: "Coffee Bean", dist: "12m", angle: 52, r: 58 },
  { initials: "MT", name: "Marcus T.", place: "Pulse Fitness", dist: "47m", angle: 145, r: 72 },
  { initials: "AL", name: "Aisha L.", place: "WeWork SoHo", dist: "1.2km", angle: 238, r: 86 },
];

function toXY(angleDeg: number, r: number, cx = 110, cy = 110) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function angleDiff(a: number, sweep: number) {
  const d = ((sweep - a) % 360 + 360) % 360;
  return d < 60 ? 1 - d / 60 : 0;
}

export function HomeNew() {
  const bg = "#122B1A";
  const accent = "#3AE06A";
  const textPrimary = "#EEF7EF";
  const textMuted = "rgba(210,235,213,0.55)";
  const cardBg = "rgba(40,70,48,0.7)";
  const cardBorder = "rgba(58,224,106,0.14)";
  const gridLine = "rgba(58,224,106,0.07)";

  const [sweep, setSweep] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const PERIOD = 3500; // ms per full rotation

  useEffect(() => {
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      setSweep((elapsed % PERIOD) / PERIOD * 360);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const sweepEnd = toXY(sweep, 100);

  return (
    <div style={{ width: 390, height: 844, background: bg, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

      {/* Grid */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        {Array.from({ length: 22 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 40} x2="390" y2={i * 40} stroke={gridLine} strokeWidth="1"/>
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 44} y1="0" x2={i * 44} y2="844" stroke={gridLine} strokeWidth="1"/>
        ))}
      </svg>

      {/* Radar glow */}
      <div style={{ position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)", width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(58,224,106,0.09) 0%, transparent 68%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Status */}
        <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <span style={{ fontSize: 12, color: textMuted, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>09:41</span>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 7px ${accent}` }} />
            <span style={{ fontSize: 10, color: accent, fontFamily: "'SF Mono', monospace", letterSpacing: 1.5 }}>LIVE</span>
          </div>
        </div>

        {/* Header */}
        <div style={{ padding: "2px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", border: `1.5px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(58,224,106,0.1)", boxShadow: `0 0 12px rgba(58,224,106,0.3)` }}>
              <span style={{ color: accent, fontSize: 15, fontWeight: 700 }}>M</span>
            </div>
            <span style={{ color: textPrimary, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>Met</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(58,224,106,0.08)", border: `1px solid rgba(58,224,106,0.2)`, borderRadius: 5, padding: "5px 11px" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: accent, boxShadow: `0 0 4px ${accent}` }} />
            <span style={{ color: accent, fontSize: 9, letterSpacing: 2, fontFamily: "'SF Mono', monospace" }}>SCAN.ACTIVE</span>
          </div>
        </div>

        {/* ── ANIMATED RADAR ── */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "4px 0 6px" }}>
          <div style={{ position: "relative", width: 220, height: 220 }}>
            <svg viewBox="0 0 220 220" width="220" height="220" style={{ position: "absolute", inset: 0 }}>
              <defs>
                {/* Sweep gradient — fades behind the line */}
                <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(58,224,106,0.18)"/>
                  <stop offset="100%" stopColor="rgba(58,224,106,0)"/>
                </radialGradient>
              </defs>

              {/* Rings */}
              {[100, 78, 56, 32].map((r, i) => (
                <circle key={i} cx="110" cy="110" r={r} fill="none" stroke={`rgba(58,224,106,${0.1 + i * 0.04})`} strokeWidth="1"/>
              ))}
              {/* Crosshairs */}
              <line x1="110" y1="10" x2="110" y2="210" stroke="rgba(58,224,106,0.06)" strokeWidth="1"/>
              <line x1="10" y1="110" x2="210" y2="110" stroke="rgba(58,224,106,0.06)" strokeWidth="1"/>

              {/* Sweep trail — 60° arc behind line */}
              <path
                d={(() => {
                  const trailAngle = 60;
                  const startAngle = sweep - trailAngle;
                  const s = toXY(startAngle, 100);
                  const e = toXY(sweep, 100);
                  const large = trailAngle > 180 ? 1 : 0;
                  return `M110,110 L${s.x},${s.y} A100,100 0 ${large},1 ${e.x},${e.y} Z`;
                })()}
                fill="rgba(58,224,106,0.08)"
              />

              {/* Sweep line */}
              <line
                x1="110" y1="110"
                x2={sweepEnd.x} y2={sweepEnd.y}
                stroke="rgba(58,224,106,0.75)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* Bright tip */}
              <circle cx={sweepEnd.x} cy={sweepEnd.y} r="2.5" fill={accent} opacity="0.9"/>

              {/* Blips — brightness pulses when sweep passes over */}
              {ENCOUNTERS.map((enc, i) => {
                const p = toXY(enc.angle, enc.r);
                const brightness = angleDiff(enc.angle, sweep);
                const alpha = 0.35 + brightness * 0.65;
                const glowSize = 8 + brightness * 6;
                return (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={glowSize} fill={`rgba(58,224,106,${brightness * 0.15})`}/>
                    <circle cx={p.x} cy={p.y} r="9" fill={`rgba(58,224,106,${0.08 + brightness * 0.12})`} stroke={`rgba(58,224,106,${alpha})`} strokeWidth="1"/>
                    <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="7" fontWeight="700" fill={`rgba(58,224,106,${alpha})`} fontFamily="'SF Mono', monospace">{enc.initials}</text>
                  </g>
                );
              })}
            </svg>

            {/* Center M */}
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 32, height: 32, borderRadius: "50%", border: `2px solid ${accent}`, background: "rgba(58,224,106,0.15)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 16px rgba(58,224,106,0.45)`, zIndex: 2 }}>
              <span style={{ color: accent, fontSize: 14, fontWeight: 700 }}>M</span>
            </div>
          </div>
        </div>

        {/* Section label */}
        <div style={{ padding: "2px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: textMuted, letterSpacing: 2, fontFamily: "'SF Mono', monospace" }}>NEARBY · 3 NODES</span>
          <span style={{ fontSize: 9, color: textMuted, letterSpacing: 1, fontFamily: "'SF Mono', monospace" }}>SORT: DIST ▲</span>
        </div>

        {/* Encounter cards */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {ENCOUNTERS.map((enc, i) => {
            const brightness = angleDiff(enc.angle, sweep);
            return (
              <div key={i} style={{ background: cardBg, borderRadius: 8, border: `1px solid rgba(58,224,106,${0.14 + brightness * 0.25})`, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: brightness > 0.3 ? `0 0 12px rgba(58,224,106,${brightness * 0.12})` : "none", transition: "box-shadow 0.1s, border-color 0.1s" }}>
                <div style={{ width: 38, height: 38, borderRadius: 6, background: "rgba(58,224,106,0.1)", border: `1px solid rgba(58,224,106,${0.25 + brightness * 0.4})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: accent, fontSize: 11, fontWeight: 600, fontFamily: "'SF Mono', monospace" }}>{enc.initials}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: textPrimary, fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{enc.name}</div>
                  <div style={{ color: textMuted, fontSize: 11 }}>{enc.place}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                  <span style={{ color: accent, fontSize: 11, fontFamily: "'SF Mono', monospace", fontWeight: 600 }}>{enc.dist}</span>
                  <div style={{ border: `1px solid rgba(58,224,106,0.3)`, borderRadius: 4, padding: "3px 8px" }}>
                    <span style={{ color: "rgba(58,224,106,0.75)", fontSize: 9, letterSpacing: 1.5, fontFamily: "'SF Mono', monospace" }}>REVEAL</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tab bar */}
        <div style={{ height: 76, background: "rgba(12,26,18,0.96)", borderTop: `1px solid rgba(58,224,106,0.12)`, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 4px 8px" }}>
          {[
            { glyph: "⌂", label: "HOME", active: true },
            { glyph: "◈", label: "RECENT", active: false },
            { glyph: "◇", label: "CONNECT", active: false },
            { glyph: "⬡", label: "NETWORK", active: false },
            { glyph: "○", label: "PROFILE", active: false },
          ].map((tab, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 8px" }}>
              <span style={{ fontSize: 17, color: tab.active ? accent : "rgba(255,255,255,0.22)" }}>{tab.glyph}</span>
              <span style={{ fontSize: 8, letterSpacing: 1.2, fontFamily: "'SF Mono', monospace", color: tab.active ? accent : "rgba(255,255,255,0.22)" }}>{tab.label}</span>
              {tab.active && <div style={{ width: 16, height: 1.5, background: accent, boxShadow: `0 0 5px ${accent}` }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
