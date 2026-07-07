export function HomeNew() {
  const accent = "#3DCC44";
  const accentGlow = "rgba(61,204,68,0.25)";

  const encounters = [
    { initials: "S", name: "Sarah K.", time: "2 min ago", place: "Coffee Bean" },
    { initials: "M", name: "Marcus T.", time: "18 min ago", place: "Pulse Fitness" },
    { initials: "A", name: "Aisha L.", time: "1 hr ago", place: "WeWork SoHo" },
    { initials: "J", name: "James R.", time: "3 hr ago", place: "Central Park" },
  ];

  return (
    <div style={{ width: 390, height: 844, background: "#1A3320", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg,#152C1A 0%,#1E3D24 60%,#162B1B 100%)" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Status bar */}
        <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "white" }}>9:41</span>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>●●●</span>
          </div>
        </div>

        {/* Header */}
        <div style={{ padding: "8px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "white", fontSize: 16, fontWeight: 800 }}>M</span>
              </div>
              <span style={{ color: accent, fontSize: 18, fontWeight: 700 }}>Met</span>
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{ color: "white", fontSize: 22, fontWeight: 700 }}>Nearby People</span>
            </div>
          </div>
          {/* Radar pulse button */}
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(61,204,68,0.15)", border: `1.5px solid rgba(61,204,68,0.4)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
              <path d="M2 12a10 10 0 1 0 20 0 10 10 0 0 0-20 0" />
              <path d="M12 12 4.93 4.93" stroke={accent} strokeWidth="2" />
              <circle cx="12" cy="12" r="2" fill={accent} />
            </svg>
          </div>
        </div>

        {/* Active pill */}
        <div style={{ padding: "0 24px 16px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(61,204,68,0.15)", border: `1px solid rgba(61,204,68,0.35)`, borderRadius: 999, padding: "6px 14px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: accent, boxShadow: `0 0 6px ${accent}` }} />
            <span style={{ color: accent, fontSize: 13, fontWeight: 600 }}>Scanning nearby</span>
          </div>
        </div>

        {/* Encounters list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {encounters.map((enc, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: `rgba(61,204,68,0.2)`, border: `2px solid rgba(61,204,68,0.4)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: accent, fontSize: 18, fontWeight: 700 }}>{enc.initials}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "white", fontSize: 15, fontWeight: 600 }}>{enc.name}</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 }}>Met at: <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{enc.place}</span></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{enc.time}</span>
                <div style={{ background: "rgba(61,204,68,0.15)", border: `1px solid rgba(61,204,68,0.35)`, borderRadius: 999, padding: "4px 10px" }}>
                  <span style={{ color: accent, fontSize: 11, fontWeight: 600 }}>Reveal</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ height: 82, background: "rgba(20,40,24,0.95)", borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 8px 12px", backdropFilter: "blur(20px)" }}>
          {[
            { icon: "🏠", label: "Home", active: true },
            { icon: "👥", label: "Recent", active: false },
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
