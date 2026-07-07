export function OnboardingNew() {
  const bg = "linear-gradient(160deg, #152C1A 0%, #1E3D24 60%, #162B1B 100%)";
  const accent = "#3DCC44";
  const accentGlow = "rgba(61,204,68,0.25)";
  const surface = "rgba(255,255,255,0.07)";
  const surfaceBorder = "rgba(255,255,255,0.12)";

  return (
    <div style={{ width: 390, height: 844, background: "#1A3320", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* Gradient overlay */}
      <div style={{ position: "absolute", inset: 0, background: bg, zIndex: 0 }} />
      {/* Radial glow behind icon */}
      <div style={{ position: "absolute", top: "25%", left: "50%", transform: "translateX(-50%)", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(61,204,68,0.12) 0%, transparent 70%)", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Status bar */}
        <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "white" }}>9:41</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>●●●</span>
          </div>
        </div>

        {/* Skip button */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 24px" }}>
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>Skip</span>
        </div>

        {/* M logo top */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px ${accentGlow}` }}>
            <span style={{ color: "white", fontSize: 22, fontWeight: 800, letterSpacing: -1 }}>M</span>
          </div>
        </div>

        {/* Slide content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", gap: 28 }}>
          {/* Icon circle */}
          <div style={{ width: 110, height: 110, borderRadius: "50%", background: "rgba(61,204,68,0.15)", border: `2px solid rgba(61,204,68,0.35)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 40px rgba(61,204,68,0.2)` }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" fill={accent} />
            </svg>
          </div>

          {/* Text */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: "white", lineHeight: 1.2, marginBottom: 14, letterSpacing: -0.5 }}>
              Discover Nearby People
            </div>
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, textAlign: "center" }}>
              Met uses your location to find others nearby. No more missed connections.
            </div>
          </div>

          {/* Page dots */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 24, height: 8, borderRadius: 4, background: accent, boxShadow: `0 0 8px ${accentGlow}` }} />
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.2)" }} />
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.2)" }} />
          </div>
        </div>

        {/* Bottom buttons */}
        <div style={{ padding: "0 24px 44px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: accent, borderRadius: 999, height: 54, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 24px rgba(61,204,68,0.4)` }}>
            <span style={{ color: "white", fontSize: 16, fontWeight: 700 }}>Next</span>
          </div>
          <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, fontWeight: 500 }}>Get Started</span>
          </div>
        </div>
      </div>
    </div>
  );
}
