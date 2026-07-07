export function OnboardingNew() {
  const bg = "#122B1A";
  const accent = "#3AE06A";
  const accentDim = "rgba(58,224,106,0.15)";
  const textPrimary = "#EEF7EF";
  const textMuted = "rgba(210,235,213,0.6)";
  const gridLine = "rgba(58,224,106,0.07)";

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

      {/* Glow orbs */}
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(58,224,106,0.12) 0%, transparent 68%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: 200, height: 200, background: "radial-gradient(circle, rgba(58,224,106,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Status bar */}
        <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: textMuted, letterSpacing: 1, fontFamily: "'SF Mono', monospace" }}>9:41</span>
          <span style={{ fontSize: 11, color: textMuted, letterSpacing: 2 }}>● ● ●</span>
        </div>

        {/* Skip */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 24px" }}>
          <span style={{ fontSize: 11, color: textMuted, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'SF Mono', monospace" }}>Skip</span>
        </div>

        {/* M logo */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <div style={{ position: "relative" }}>
            <div style={{ width: 42, height: 42, borderRadius: "50%", border: `1.5px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(58,224,106,0.1)", boxShadow: `0 0 18px rgba(58,224,106,0.35), inset 0 0 12px rgba(58,224,106,0.05)` }}>
              <span style={{ color: accent, fontSize: 20, fontWeight: 700, fontFamily: "sans-serif" }}>M</span>
            </div>
            <div style={{ position: "absolute", top: -7, left: -7, width: 56, height: 56, borderRadius: "50%", border: `1px dashed rgba(58,224,106,0.22)` }} />
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", gap: 28 }}>

          {/* Hex icon */}
          <div style={{ position: "relative", width: 128, height: 128 }}>
            <svg viewBox="0 0 128 128" width="128" height="128" style={{ position: "absolute", inset: 0 }}>
              <polygon points="64,6 114,34 114,90 64,118 14,90 14,34" fill={accentDim} stroke={accent} strokeWidth="1.2" opacity="0.65"/>
              <polygon points="64,16 104,39 104,85 64,108 24,85 24,39" fill="none" stroke={`rgba(58,224,106,0.22)`} strokeWidth="0.8"/>
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="6"/>
                <circle cx="12" cy="12" r="2.5" fill={accent} opacity="0.8"/>
              </svg>
            </div>
          </div>

          {/* Text */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: accent, fontFamily: "'SF Mono', monospace", marginBottom: 10, opacity: 0.8 }}>// PROXIMITY.INIT</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: textPrimary, lineHeight: 1.22, marginBottom: 14, letterSpacing: -0.5 }}>
              Discover Nearby People
            </div>
            <div style={{ fontSize: 15, color: textMuted, lineHeight: 1.7 }}>
              Met uses your location to find others nearby. No more missed connections.
            </div>
          </div>

          {/* Indicators */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 28, height: 4, borderRadius: 2, background: accent, boxShadow: `0 0 8px rgba(58,224,106,0.6)` }} />
            <div style={{ width: 4, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
            <div style={{ width: 4, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }} />
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: "0 24px 44px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ height: 54, borderRadius: 8, border: `1px solid rgba(58,224,106,0.55)`, background: `rgba(58,224,106,0.15)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", boxShadow: `0 0 24px rgba(58,224,106,0.15)` }}>
            <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(58,224,106,0.025) 4px)" }} />
            <span style={{ color: accent, fontSize: 14, fontWeight: 700, letterSpacing: 2.5, fontFamily: "'SF Mono', monospace", position: "relative" }}>NEXT →</span>
          </div>
          <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: textMuted, fontSize: 12, letterSpacing: 1 }}>Get Started</span>
          </div>
        </div>
      </div>
    </div>
  );
}
