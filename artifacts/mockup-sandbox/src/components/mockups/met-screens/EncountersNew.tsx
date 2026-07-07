export function EncountersNew() {
  const accent = "#3DCC44";

  return (
    <div style={{ width: 390, height: 844, background: "#1A3320", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#152C1A 0%,#1E3D24 60%,#162B1B 100%)" }} />
      {/* Radar glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)", width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle,rgba(61,204,68,0.08) 0%,transparent 70%)" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Status bar */}
        <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "white" }}>9:41</span>
        </div>

        {/* Header */}
        <div style={{ padding: "0 24px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "white", fontSize: 24, fontWeight: 700 }}>Encounters</span>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/>
            </svg>
          </div>
        </div>

        {/* Radar visualization */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ width: 200, height: 200, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Concentric circles */}
            {[200, 150, 100, 60].map((size, i) => (
              <div key={i} style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: `1px solid rgba(61,204,68,${0.08 + i * 0.04})`, }} />
            ))}
            {/* Scan line */}
            <div style={{ position: "absolute", width: 1, height: 90, background: `linear-gradient(to top, ${accent}, transparent)`, transformOrigin: "bottom center", transform: "rotate(-45deg)", bottom: "50%" }} />
            {/* Center M */}
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, boxShadow: "0 0 20px rgba(61,204,68,0.5)" }}>
              <span style={{ color: "white", fontSize: 20, fontWeight: 800 }}>M</span>
            </div>
            {/* Dots representing nearby people */}
            {[
              { top: "15%", left: "20%", color: "#60A5FA" },
              { top: "30%", right: "18%", color: "#F59E0B" },
              { bottom: "25%", left: "25%", color: "#EC4899" },
            ].map((dot, i) => (
              <div key={i} style={{ position: "absolute", width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", ...dot }}>
                <span style={{ fontSize: 14 }}>👤</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section label */}
        <div style={{ padding: "0 24px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Recent · 4 encounters</span>
        </div>

        {/* Encounters */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { initials: "S", name: "Sarah K.", place: "Groundwork Cafe", mutual: true },
            { initials: "M", name: "Marcus T.", place: "Pulse Fitness", mutual: false },
            { initials: "A", name: "Aisha L.", place: "WeWork SoHo", mutual: false },
            { initials: "J", name: "James R.", place: "Central Park Trail", mutual: false },
          ].map((enc, i) => (
            <div key={i} style={{
              background: enc.mutual ? "rgba(61,204,68,0.12)" : "rgba(255,255,255,0.06)",
              borderRadius: 16,
              border: enc.mutual ? "1px solid rgba(61,204,68,0.4)" : "1px solid rgba(255,255,255,0.09)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              boxShadow: enc.mutual ? "0 0 16px rgba(61,204,68,0.1)" : "none",
            }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(61,204,68,0.2)", border: `2px solid rgba(61,204,68,${enc.mutual ? 0.7 : 0.3})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: accent, fontSize: 17, fontWeight: 700 }}>{enc.initials}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "white", fontSize: 15, fontWeight: 600 }}>{enc.name}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 3 }}>Met at: <span style={{ color: "rgba(255,255,255,0.65)" }}>{enc.place}</span></div>
              </div>
              {enc.mutual
                ? <div style={{ background: accent, borderRadius: 999, padding: "6px 12px", display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>Connect ✦</span>
                  </div>
                : <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 999, padding: "6px 12px" }}>
                    <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600 }}>Reveal</span>
                  </div>
              }
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ height: 82, background: "rgba(20,40,24,0.95)", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px 12px" }}>
          {[
            { icon: "🏠", label: "Home", active: false },
            { icon: "👥", label: "Recent", active: true },
            { icon: "💬", label: "Connects", active: false },
            { icon: "🌐", label: "Networks", active: false },
            { icon: "👤", label: "Profile", active: false },
          ].map((tab, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 10px" }}>
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <span style={{ fontSize: 10, fontWeight: tab.active ? 700 : 400, color: tab.active ? accent : "rgba(255,255,255,0.4)" }}>{tab.label}</span>
              {tab.active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: accent }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
