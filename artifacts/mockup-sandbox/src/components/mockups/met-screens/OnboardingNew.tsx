export function OnboardingNew() {
  const bg = "#0B1A0F";
  const accent = "#29D45A";
  const accentDim = "rgba(41,212,90,0.18)";
  const textPrimary = "#D6EDD8";
  const textMuted = "rgba(180,210,182,0.55)";
  const gridLine = "rgba(41,212,90,0.06)";

  return (
    <div style={{ width: 390, height: 844, background: bg, fontFamily: "'SF Mono', 'Fira Code', monospace, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

      {/* Subtle grid */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 1 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 44} x2="390" y2={i * 44} stroke={gridLine} strokeWidth="1" />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 44} y1="0" x2={i * 44} y2="844" stroke={gridLine} strokeWidth="1" />
        ))}
      </svg>

      {/* Glow orb */}
      <div style={{ position: "absolute", top: "28%", left: "50%", transform: "translateX(-50%)", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(41,212,90,0.07) 0%, transparent 68%)" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Status bar */}
        <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: textMuted, letterSpacing: 1, fontFamily: "'SF Mono', monospace" }}>9:41</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: textMuted, letterSpacing: 2 }}>⬡⬡⬡</span>
          </div>
        </div>

        {/* Skip */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 24px" }}>
          <span style={{ fontSize: 11, color: textMuted, letterSpacing: 2, textTransform: "uppercase" }}>Skip</span>
        </div>

        {/* M logo */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}>
          <div style={{ position: "relative" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "transparent", border: `1.5px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 16px rgba(41,212,90,0.3), inset 0 0 10px rgba(41,212,90,0.05)` }}>
              <span style={{ color: accent, fontSize: 18, fontWeight: 700, fontFamily: "sans-serif" }}>M</span>
            </div>
            {/* Orbit ring */}
            <div style={{ position: "absolute", top: -6, left: -6, width: 50, height: 50, borderRadius: "50%", border: `1px dashed rgba(41,212,90,0.25)` }} />
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", gap: 30 }}>

          {/* Hexagonal icon frame */}
          <div style={{ position: "relative", width: 120, height: 120 }}>
            <svg viewBox="0 0 120 120" width="120" height="120" style={{ position: "absolute", inset: 0 }}>
              <polygon points="60,4 110,32 110,88 60,116 10,88 10,32" fill={accentDim} stroke={accent} strokeWidth="1" opacity="0.5" />
              <polygon points="60,14 100,37 100,83 60,106 20,83 20,37" fill="none" stroke={`rgba(41,212,90,0.2)`} strokeWidth="0.5" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="6"/>
                <circle cx="12" cy="12" r="2" fill={accent} opacity="0.7"/>
              </svg>
            </div>
          </div>

          {/* Text */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: 3, color: accent, fontFamily: "'SF Mono', monospace", marginBottom: 10, opacity: 0.7 }}>// PROXIMITY.INIT</div>
            <div style={{ fontSize: 27, fontWeight: 600, color: textPrimary, lineHeight: 1.25, marginBottom: 14, letterSpacing: -0.3, fontFamily: "Inter, sans-serif" }}>
              Discover Nearby People
            </div>
            <div style={{ fontSize: 15, color: textMuted, lineHeight: 1.7, fontFamily: "Inter, sans-serif" }}>
              Met uses your location to find others nearby. No more missed connections.
            </div>
          </div>

          {/* Page indicators */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 28, height: 4, borderRadius: 2, background: accent, boxShadow: `0 0 6px rgba(41,212,90,0.5)` }} />
            <div style={{ width: 4, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
            <div style={{ width: 4, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ padding: "0 24px 44px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Scanline button */}
          <div style={{ height: 52, borderRadius: 6, border: `1px solid rgba(41,212,90,0.5)`, background: `rgba(41,212,90,0.12)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", boxShadow: `0 0 20px rgba(41,212,90,0.12)` }}>
            <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(41,212,90,0.03) 4px)" }} />
            <span style={{ color: accent, fontSize: 14, fontWeight: 600, letterSpacing: 2, fontFamily: "'SF Mono', monospace", position: "relative" }}>NEXT →</span>
          </div>
          <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: textMuted, fontSize: 12, letterSpacing: 1 }}>Get Started</span>
          </div>
        </div>
      </div>
    </div>
  );
}
