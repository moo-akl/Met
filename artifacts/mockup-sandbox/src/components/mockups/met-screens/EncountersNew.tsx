export function EncountersNew() {
  const bg = "#0B1A0F";
  const accent = "#29D45A";
  const textPrimary = "#D6EDD8";
  const textMuted = "rgba(180,210,182,0.5)";
  const cardBg = "rgba(29,52,33,0.65)";
  const cardBorder = "rgba(41,212,90,0.11)";
  const gridLine = "rgba(41,212,90,0.05)";

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

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Status */}
        <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
          <span style={{ fontSize: 12, color: textMuted, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>09:41</span>
          <span style={{ fontSize: 10, color: textMuted, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>SIG:⬛⬛⬛⬛</span>
        </div>

        {/* Header */}
        <div style={{ padding: "0 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, color: textMuted, letterSpacing: 3, fontFamily: "'SF Mono', monospace", marginBottom: 4 }}>// ENCOUNTERS</div>
            <span style={{ color: textPrimary, fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>Proximity Log</span>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 6, border: `1px solid ${cardBorder}`, background: cardBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={`rgba(41,212,90,0.6)`} strokeWidth="1.5">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/>
            </svg>
          </div>
        </div>

        {/* Radar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ width: 188, height: 188, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 188 188" width="188" height="188" style={{ position: "absolute", inset: 0 }}>
              {/* Rings */}
              {[188, 140, 96, 52].map((r, i) => (
                <circle key={i} cx="94" cy="94" r={r / 2 - 2} fill="none" stroke={`rgba(41,212,90,${0.06 + i * 0.04})`} strokeWidth="1"/>
              ))}
              {/* Cross hairs */}
              <line x1="94" y1="4" x2="94" y2="184" stroke="rgba(41,212,90,0.06)" strokeWidth="1"/>
              <line x1="4" y1="94" x2="184" y2="94" stroke="rgba(41,212,90,0.06)" strokeWidth="1"/>
              {/* Sweep line */}
              <line x1="94" y1="94" x2="94" y2="16" stroke={`rgba(41,212,90,0.5)`} strokeWidth="1.5" strokeLinecap="round"/>
              {/* Sweep fill */}
              <path d="M94,94 L94,16 A78,78 0 0,1 150,140 Z" fill="rgba(41,212,90,0.04)"/>
              {/* Blips */}
              <circle cx="128" cy="58" r="3" fill={accent} opacity="0.7"/>
              <circle cx="128" cy="58" r="7" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.3"/>
              <circle cx="68" cy="130" r="2.5" fill="#60A5FA" opacity="0.6"/>
              <circle cx="48" cy="78" r="2" fill="#F59E0B" opacity="0.5"/>
            </svg>
            {/* Center */}
            <div style={{ width: 30, height: 30, borderRadius: "50%", border: `1.5px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(41,212,90,0.1)", zIndex: 1, boxShadow: `0 0 12px rgba(41,212,90,0.3)` }}>
              <span style={{ color: accent, fontSize: 13, fontWeight: 700 }}>M</span>
            </div>
          </div>
        </div>

        {/* Section */}
        <div style={{ padding: "0 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: textMuted, letterSpacing: 2, fontFamily: "'SF Mono', monospace" }}>RECENT · 4 NODES</span>
          <span style={{ fontSize: 9, color: textMuted, letterSpacing: 1, fontFamily: "'SF Mono', monospace" }}>SORT: TIME ▼</span>
        </div>

        {/* Encounters */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { initials: "SK", name: "Sarah K.", place: "Groundwork Cafe", mutual: true },
            { initials: "MT", name: "Marcus T.", place: "Pulse Fitness", mutual: false },
            { initials: "AL", name: "Aisha L.", place: "WeWork SoHo", mutual: false },
            { initials: "JR", name: "James R.", place: "Central Park", mutual: false },
          ].map((enc, i) => (
            <div key={i} style={{
              background: enc.mutual ? "rgba(41,212,90,0.09)" : cardBg,
              borderRadius: 8,
              border: enc.mutual ? `1px solid rgba(41,212,90,0.3)` : `1px solid ${cardBorder}`,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 6, background: "rgba(41,212,90,0.08)", border: `1px solid rgba(41,212,90,${enc.mutual ? 0.35 : 0.15})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: enc.mutual ? accent : "rgba(41,212,90,0.55)", fontSize: 12, fontWeight: 600, fontFamily: "'SF Mono', monospace" }}>{enc.initials}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: textPrimary, fontSize: 14, fontWeight: 500, marginBottom: 3 }}>{enc.name}</div>
                <div style={{ color: textMuted, fontSize: 11 }}>{enc.place}</div>
              </div>
              {enc.mutual
                ? <div style={{ background: "rgba(41,212,90,0.18)", border: `1px solid rgba(41,212,90,0.5)`, borderRadius: 4, padding: "5px 10px" }}>
                    <span style={{ color: accent, fontSize: 9, letterSpacing: 1.5, fontFamily: "'SF Mono', monospace" }}>CONNECT</span>
                  </div>
                : <div style={{ border: `1px solid rgba(41,212,90,0.18)`, borderRadius: 4, padding: "5px 10px" }}>
                    <span style={{ color: "rgba(41,212,90,0.45)", fontSize: 9, letterSpacing: 1, fontFamily: "'SF Mono', monospace" }}>REVEAL</span>
                  </div>
              }
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ height: 78, background: "rgba(8,18,11,0.95)", borderTop: `1px solid rgba(41,212,90,0.1)`, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 4px 10px" }}>
          {[
            { glyph: "⌂", label: "HOME", active: false },
            { glyph: "◈", label: "RECENT", active: true },
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
