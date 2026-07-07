import { useEffect, useRef, useState } from "react";

const BLIPS = [
  { initials: "SK", angle: 52, r: 62, mutual: true },
  { initials: "MT", angle: 145, r: 70 },
  { initials: "AL", angle: 238, r: 80 },
  { initials: "JR", angle: 310, r: 88 },
];

const CARDS = [
  { initials: "SK", name: "Sarah K.", place: "Groundwork Cafe", mutual: true, angle: 52 },
  { initials: "MT", name: "Marcus T.", place: "Pulse Fitness", mutual: false, angle: 145 },
  { initials: "AL", name: "Aisha L.", place: "WeWork SoHo", mutual: false, angle: 238 },
  { initials: "JR", name: "James R.", place: "Central Park", mutual: false, angle: 310 },
];

function toXY(angleDeg: number, r: number, cx = 95, cy = 95) {
  const a = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function angleDiff(a: number, sweep: number) {
  const d = ((sweep - a) % 360 + 360) % 360;
  return d < 60 ? 1 - d / 60 : 0;
}

export function EncountersNew() {
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
  const PERIOD = 3500;

  useEffect(() => {
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      setSweep(((ts - startRef.current) % PERIOD) / PERIOD * 360);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const sweepEnd = toXY(sweep, 90);

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

      <div style={{ position: "absolute", top: 80, left: "50%", transform: "translateX(-50%)", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(58,224,106,0.08) 0%, transparent 68%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Status */}
        <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <span style={{ fontSize: 12, color: textMuted, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>09:41</span>
          <span style={{ fontSize: 10, color: textMuted, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>SIG:████</span>
        </div>

        {/* Header */}
        <div style={{ padding: "0 20px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, color: textMuted, letterSpacing: 3, fontFamily: "'SF Mono', monospace", marginBottom: 4 }}>// ENCOUNTERS</div>
            <span style={{ color: textPrimary, fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>Proximity Log</span>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 6, border: `1px solid ${cardBorder}`, background: cardBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={`rgba(58,224,106,0.65)`} strokeWidth="1.5">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/>
            </svg>
          </div>
        </div>

        {/* Animated Radar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ width: 190, height: 190, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 190 190" width="190" height="190" style={{ position: "absolute", inset: 0 }}>
              {/* Rings */}
              {[90, 70, 50, 28].map((r, i) => (
                <circle key={i} cx="95" cy="95" r={r} fill="none" stroke={`rgba(58,224,106,${0.1 + i * 0.04})`} strokeWidth="1"/>
              ))}
              {/* Crosshairs */}
              <line x1="95" y1="5" x2="95" y2="185" stroke="rgba(58,224,106,0.06)" strokeWidth="1"/>
              <line x1="5" y1="95" x2="185" y2="95" stroke="rgba(58,224,106,0.06)" strokeWidth="1"/>

              {/* Sweep trail */}
              <path
                d={(() => {
                  const trailAngle = 60;
                  const s = toXY(sweep - trailAngle, 90);
                  const e = toXY(sweep, 90);
                  return `M95,95 L${s.x},${s.y} A90,90 0 0,1 ${e.x},${e.y} Z`;
                })()}
                fill="rgba(58,224,106,0.07)"
              />

              {/* Sweep line */}
              <line x1="95" y1="95" x2={sweepEnd.x} y2={sweepEnd.y} stroke="rgba(58,224,106,0.75)" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx={sweepEnd.x} cy={sweepEnd.y} r="2.2" fill={accent} opacity="0.9"/>

              {/* Blips */}
              {BLIPS.map((b, i) => {
                const p = toXY(b.angle, b.r);
                const bright = angleDiff(b.angle, sweep);
                const alpha = 0.3 + bright * 0.7;
                return (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={7 + bright * 5} fill={`rgba(58,224,106,${bright * 0.13})`}/>
                    <circle cx={p.x} cy={p.y} r="8" fill={`rgba(58,224,106,${0.08 + bright * 0.1})`} stroke={`rgba(58,224,106,${alpha})`} strokeWidth="1"/>
                    <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize="7" fontWeight="700" fill={`rgba(58,224,106,${alpha})`} fontFamily="'SF Mono', monospace">{b.initials}</text>
                  </g>
                );
              })}
            </svg>

            {/* Center */}
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${accent}`, background: "rgba(58,224,106,0.12)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, boxShadow: `0 0 14px rgba(58,224,106,0.4)` }}>
              <span style={{ color: accent, fontSize: 12, fontWeight: 700 }}>M</span>
            </div>
          </div>
        </div>

        {/* Section header */}
        <div style={{ padding: "0 20px 8px", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 9, color: textMuted, letterSpacing: 2, fontFamily: "'SF Mono', monospace" }}>LOG · 4 NODES</span>
          <span style={{ fontSize: 9, color: textMuted, letterSpacing: 1, fontFamily: "'SF Mono', monospace" }}>SORT: TIME ▼</span>
        </div>

        {/* Cards */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {CARDS.map((enc, i) => {
            const bright = angleDiff(enc.angle, sweep);
            return (
              <div key={i} style={{
                background: enc.mutual ? "rgba(58,224,106,0.1)" : cardBg,
                borderRadius: 8,
                border: enc.mutual ? `1px solid rgba(58,224,106,${0.35 + bright * 0.3})` : `1px solid rgba(58,224,106,${0.14 + bright * 0.2})`,
                padding: "11px 14px", display: "flex", alignItems: "center", gap: 12,
                boxShadow: bright > 0.2 ? `0 0 10px rgba(58,224,106,${bright * 0.1})` : "none",
                transition: "border-color 0.1s, box-shadow 0.1s",
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 6, background: "rgba(58,224,106,0.1)", border: `1px solid rgba(58,224,106,${enc.mutual ? 0.4 : 0.18 + bright * 0.3})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: enc.mutual ? accent : `rgba(58,224,106,${0.55 + bright * 0.45})`, fontSize: 11, fontWeight: 600, fontFamily: "'SF Mono', monospace" }}>{enc.initials}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: textPrimary, fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{enc.name}</div>
                  <div style={{ color: textMuted, fontSize: 11 }}>{enc.place}</div>
                </div>
                {enc.mutual
                  ? <div style={{ background: "rgba(58,224,106,0.18)", border: `1px solid rgba(58,224,106,0.55)`, borderRadius: 4, padding: "5px 10px" }}>
                      <span style={{ color: accent, fontSize: 9, letterSpacing: 1.5, fontFamily: "'SF Mono', monospace" }}>CONNECT</span>
                    </div>
                  : <div style={{ border: `1px solid rgba(58,224,106,0.2)`, borderRadius: 4, padding: "5px 10px" }}>
                      <span style={{ color: "rgba(58,224,106,0.5)", fontSize: 9, letterSpacing: 1, fontFamily: "'SF Mono', monospace" }}>REVEAL</span>
                    </div>
                }
              </div>
            );
          })}
        </div>

        {/* Tab bar */}
        <div style={{ height: 76, background: "rgba(12,26,18,0.96)", borderTop: `1px solid rgba(58,224,106,0.12)`, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 4px 8px" }}>
          {[
            { glyph: "⌂", label: "HOME", active: false },
            { glyph: "◈", label: "RECENT", active: true },
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
