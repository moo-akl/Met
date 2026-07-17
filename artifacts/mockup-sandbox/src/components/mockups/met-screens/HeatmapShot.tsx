import { useEffect, useRef, useState } from "react";

const HUBS = [
  { x: 175, y: 210, r: 52, intensity: 0.95, label: "Central Park", users: 22 },
  { x: 280, y: 310, r: 34, intensity: 0.7, label: "The Plaza", users: 11 },
  { x: 100, y: 350, r: 28, intensity: 0.55, label: "MoMA", users: 7 },
  { x: 310, y: 430, r: 20, intensity: 0.4, label: "Bryant Park", users: 5 },
  { x: 145, y: 490, r: 16, intensity: 0.3, label: "High Line", users: 3 },
  { x: 240, y: 510, r: 14, intensity: 0.25, label: "", users: 2 },
  { x: 330, y: 230, r: 12, intensity: 0.22, label: "", users: 2 },
  { x: 80,  y: 440, r: 10, intensity: 0.18, label: "", users: 1 },
];

const STREETS_H = [160, 240, 320, 400, 480, 560];
const STREETS_V = [60, 130, 210, 290, 355, 390];

function blend(intensity: number) {
  if (intensity > 0.8) return "rgba(58,224,106,0.9)";
  if (intensity > 0.55) return "rgba(130,230,80,0.75)";
  if (intensity > 0.35) return "rgba(200,230,50,0.6)";
  return "rgba(255,200,40,0.45)";
}

export function HeatmapShot() {
  const bg = "#122B1A";
  const accent = "#3AE06A";
  const mapBg = "#0D2215";
  const textPrimary = "#EEF7EF";
  const textMuted = "rgba(210,235,213,0.55)";

  const [pulse, setPulse] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      setPulse(((ts - startRef.current) % 2400) / 2400);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const scale = 0.95 + Math.sin(pulse * Math.PI * 2) * 0.05;

  return (
    <div style={{ width: 390, height: 844, background: bg, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

      {/* Status bar */}
      <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", zIndex: 10, position: "relative" }}>
        <span style={{ fontSize: 12, color: textMuted, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>09:41</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: textMuted }}>●●●●</span>
          <span style={{ fontSize: 11, color: textMuted }}>WiFi</span>
          <span style={{ fontSize: 11, color: textMuted }}>100%</span>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: "2px 20px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", border: `1.5px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(58,224,106,0.1)" }}>
            <span style={{ color: accent, fontSize: 15, fontWeight: 700 }}>M</span>
          </div>
          <span style={{ color: textPrimary, fontSize: 20, fontWeight: 600, letterSpacing: -0.3 }}>Met</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ background: "rgba(58,224,106,0.1)", border: `1px solid rgba(58,224,106,0.25)`, borderRadius: 20, padding: "5px 14px" }}>
            <span style={{ color: accent, fontSize: 11, fontWeight: 600 }}>Heatmap</span>
          </div>
          <div style={{ background: "transparent", border: `1px solid rgba(58,224,106,0.15)`, borderRadius: 20, padding: "5px 14px" }}>
            <span style={{ color: textMuted, fontSize: 11 }}>Map</span>
          </div>
        </div>
      </div>

      {/* Map area */}
      <div style={{ position: "relative", flex: 1, margin: "0 14px 10px", borderRadius: 16, overflow: "hidden", background: mapBg, border: `1px solid rgba(58,224,106,0.12)` }}>

        {/* Street grid */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {STREETS_H.map((y, i) => (
            <line key={`h${i}`} x1="0" y1={y} x2="362" y2={y} stroke="rgba(58,224,106,0.08)" strokeWidth={i % 2 === 0 ? 2 : 1}/>
          ))}
          {STREETS_V.map((x, i) => (
            <line key={`v${i}`} x1={x} y1="0" x2={x} y2="580" stroke="rgba(58,224,106,0.08)" strokeWidth={i % 2 === 0 ? 2 : 1}/>
          ))}
          {/* Block fills */}
          {[[65,165,60,70],[215,285,70,75],[295,345,165,70],[65,125,245,70],[215,345,245,130]].map(([x1,x2,y1,h],i) => (
            <rect key={`b${i}`} x={x1} y={y1} width={x2-x1} height={h} fill="rgba(20,50,30,0.6)" rx="3"/>
          ))}

          {/* Heat blobs */}
          {HUBS.map((hub, i) => {
            const s = i === 0 ? scale : 1;
            const r = hub.r * s;
            const color = blend(hub.intensity);
            return (
              <g key={i}>
                <circle cx={hub.x} cy={hub.y} r={r * 1.8} fill={color.replace(/[\d.]+\)$/, m => `${parseFloat(m)*0.15})`)}/>
                <circle cx={hub.x} cy={hub.y} r={r * 1.2} fill={color.replace(/[\d.]+\)$/, m => `${parseFloat(m)*0.35})`)}/>
                <circle cx={hub.x} cy={hub.y} r={r} fill={color}/>
              </g>
            );
          })}

          {/* Dot markers on top hubs */}
          {HUBS.slice(0, 5).map((hub, i) => (
            <g key={`m${i}`}>
              <circle cx={hub.x} cy={hub.y} r={5} fill="#122B1A" stroke={accent} strokeWidth="1.5"/>
              <circle cx={hub.x} cy={hub.y} r={2} fill={accent}/>
            </g>
          ))}
        </svg>

        {/* Central Park label */}
        <div style={{ position: "absolute", left: 108, top: 168, background: "rgba(10,25,15,0.88)", border: `1px solid rgba(58,224,106,0.3)`, borderRadius: 6, padding: "3px 8px", display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 6px ${accent}` }}/>
          <span style={{ color: textPrimary, fontSize: 10, fontWeight: 600 }}>Central Park</span>
          <span style={{ color: accent, fontSize: 10, fontFamily: "'SF Mono', monospace" }}>22</span>
        </div>

        {/* Scale indicator */}
        <div style={{ position: "absolute", bottom: 12, right: 14, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 40, height: 1.5, background: textMuted }}/>
          <span style={{ color: textMuted, fontSize: 9, fontFamily: "'SF Mono', monospace" }}>500m</span>
        </div>

        {/* Legend */}
        <div style={{ position: "absolute", bottom: 12, left: 12, background: "rgba(10,25,15,0.88)", borderRadius: 8, padding: "6px 10px", border: `1px solid rgba(58,224,106,0.12)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
            <div style={{ width: 28, height: 6, borderRadius: 3, background: "linear-gradient(90deg, rgba(255,200,40,0.45), rgba(58,224,106,0.9))" }}/>
            <span style={{ color: textMuted, fontSize: 8, fontFamily: "'SF Mono', monospace" }}>DENSITY</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span style={{ color: textMuted, fontSize: 7, fontFamily: "'SF Mono', monospace" }}>LOW</span>
            <span style={{ color: textMuted, fontSize: 7, fontFamily: "'SF Mono', monospace" }}>HIGH</span>
          </div>
        </div>
      </div>

      {/* Active users pill */}
      <div style={{ margin: "0 14px 10px", background: "rgba(58,224,106,0.07)", border: `1px solid rgba(58,224,106,0.18)`, borderRadius: 12, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent, boxShadow: `0 0 8px ${accent}` }}/>
          <span style={{ color: textPrimary, fontSize: 13, fontWeight: 500 }}>People near you right now</span>
        </div>
        <span style={{ color: accent, fontSize: 18, fontWeight: 700, fontFamily: "'SF Mono', monospace" }}>47</span>
      </div>

      {/* Tab bar */}
      <div style={{ height: 76, background: "rgba(12,26,18,0.96)", borderTop: `1px solid rgba(58,224,106,0.12)`, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 4px 8px" }}>
        {[
          { glyph: "⌂", label: "HOME", active: false },
          { glyph: "◈", label: "RECENT", active: false },
          { glyph: "◉", label: "MAP", active: true },
          { glyph: "⬡", label: "NETWORK", active: false },
          { glyph: "○", label: "PROFILE", active: false },
        ].map((tab, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 8px" }}>
            <span style={{ fontSize: 17, color: tab.active ? accent : "rgba(255,255,255,0.22)" }}>{tab.glyph}</span>
            <span style={{ fontSize: 8, letterSpacing: 1.2, fontFamily: "'SF Mono', monospace", color: tab.active ? accent : "rgba(255,255,255,0.22)" }}>{tab.label}</span>
            {tab.active && <div style={{ width: 16, height: 1.5, background: accent, boxShadow: `0 0 5px ${accent}` }}/>}
          </div>
        ))}
      </div>
    </div>
  );
}
