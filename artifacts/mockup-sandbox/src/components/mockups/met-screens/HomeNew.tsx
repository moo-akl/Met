export function HomeNew() {
  const bg = "#0B1A0F";
  const accent = "#29D45A";
  const textPrimary = "#D6EDD8";
  const textMuted = "rgba(180,210,182,0.5)";
  const cardBg = "rgba(29,52,33,0.7)";
  const cardBorder = "rgba(41,212,90,0.12)";
  const gridLine = "rgba(41,212,90,0.05)";

  const encounters = [
    { initials: "SK", name: "Sarah K.", time: "02:14", place: "Coffee Bean", dist: "12m" },
    { initials: "MT", name: "Marcus T.", time: "18:31", place: "Pulse Fitness", dist: "47m" },
    { initials: "AL", name: "Aisha L.", time: "01:09", place: "WeWork SoHo", dist: "1.2km" },
    { initials: "JR", name: "James R.", time: "03:02", place: "Central Park", dist: "2.1km" },
  ];

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

      {/* Glow orb */}
      <div style={{ position: "absolute", top: -60, right: -60, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(41,212,90,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Status */}
        <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <span style={{ fontSize: 12, color: textMuted, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>09:41</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 6px ${accent}` }} />
            <span style={{ fontSize: 10, color: accent, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>LIVE</span>
          </div>
        </div>

        {/* Header */}
        <div style={{ padding: "4px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: `1.5px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 10px rgba(41,212,90,0.25)` }}>
                <span style={{ color: accent, fontSize: 14, fontWeight: 700 }}>M</span>
              </div>
              <span style={{ color: accent, fontSize: 11, letterSpacing: 3, fontFamily: "'SF Mono', monospace" }}>MET.v2</span>
            </div>
            <span style={{ color: textPrimary, fontSize: 21, fontWeight: 600, letterSpacing: -0.3 }}>Nearby People</span>
          </div>
          <div style={{ width: 38, height: 38, borderRadius: 6, border: `1px solid ${cardBorder}`, background: cardBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 12 6 6"/><circle cx="12" cy="12" r="2" fill={accent}/>
            </svg>
          </div>
        </div>

        {/* Status pill */}
        <div style={{ padding: "0 20px 14px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(41,212,90,0.08)", border: `1px solid rgba(41,212,90,0.2)`, borderRadius: 4, padding: "5px 12px" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: accent, boxShadow: `0 0 4px ${accent}` }} />
            <span style={{ color: accent, fontSize: 10, fontWeight: 600, letterSpacing: 2, fontFamily: "'SF Mono', monospace" }}>SCAN.ACTIVE</span>
          </div>
        </div>

        {/* Column headers */}
        <div style={{ padding: "0 20px 8px", display: "flex", gap: 0 }}>
          <span style={{ flex: 1, fontSize: 9, color: textMuted, letterSpacing: 2, fontFamily: "'SF Mono', monospace" }}>ENCOUNTER</span>
          <span style={{ width: 60, fontSize: 9, color: textMuted, letterSpacing: 2, fontFamily: "'SF Mono', monospace", textAlign: "right" }}>T+</span>
        </div>

        {/* Encounters */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {encounters.map((enc, i) => (
            <div key={i} style={{ background: cardBg, borderRadius: 8, border: `1px solid ${cardBorder}`, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 6, background: "rgba(41,212,90,0.08)", border: `1px solid rgba(41,212,90,0.2)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: accent, fontSize: 12, fontWeight: 600, fontFamily: "'SF Mono', monospace" }}>{enc.initials}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: textPrimary, fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{enc.name}</div>
                <div style={{ color: textMuted, fontSize: 11 }}>{enc.place} <span style={{ color: "rgba(41,212,90,0.5)", fontFamily: "'SF Mono', monospace", fontSize: 10 }}>· {enc.dist}</span></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <span style={{ color: textMuted, fontSize: 10, fontFamily: "'SF Mono', monospace" }}>{enc.time}</span>
                <div style={{ border: `1px solid rgba(41,212,90,0.3)`, borderRadius: 3, padding: "3px 8px" }}>
                  <span style={{ color: "rgba(41,212,90,0.7)", fontSize: 9, letterSpacing: 1, fontFamily: "'SF Mono', monospace" }}>REVEAL</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ height: 78, background: "rgba(8,18,11,0.95)", borderTop: `1px solid rgba(41,212,90,0.1)`, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 4px 10px" }}>
          {[
            { glyph: "⌂", label: "HOME", active: true },
            { glyph: "◈", label: "RECENT", active: false },
            { glyph: "◇", label: "CONNECT", active: false },
            { glyph: "⬡", label: "NETWORK", active: false },
            { glyph: "○", label: "PROFILE", active: false },
          ].map((tab, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 8px" }}>
              <span style={{ fontSize: 16, color: tab.active ? accent : "rgba(255,255,255,0.2)" }}>{tab.glyph}</span>
              <span style={{ fontSize: 8, letterSpacing: 1, fontFamily: "'SF Mono', monospace", color: tab.active ? accent : "rgba(255,255,255,0.2)" }}>{tab.label}</span>
              {tab.active && <div style={{ width: 16, height: 1, background: accent, boxShadow: `0 0 4px ${accent}` }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
