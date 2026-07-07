export function OnboardingCurrent() {
  const bg = "#F1F8F0";
  const primary = "#3DCC44";
  const text = "#16161E";
  const muted = "#6B7280";
  const card = "#FFFFFF";
  const border = "#E5E7EB";

  return (
    <div style={{ width: 390, height: 844, background: bg, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* Status bar */}
      <div style={{ height: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: text }}>9:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: text }}>●●●</span>
          <span style={{ fontSize: 13, color: text }}>WiFi</span>
          <span style={{ fontSize: 13, color: text }}>🔋</span>
        </div>
      </div>

      {/* Skip button */}
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 24px" }}>
        <span style={{ fontSize: 14, color: muted, fontWeight: 500 }}>Skip</span>
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", gap: 24 }}>
        {/* Icon */}
        <div style={{ width: 100, height: 100, borderRadius: 50, background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </div>

        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: text, lineHeight: 1.2, marginBottom: 12 }}>
            Discover Nearby People
          </div>
          <div style={{ fontSize: 16, color: muted, lineHeight: 1.6, textAlign: "center" }}>
            Met uses your location to find others nearby. No more missed connections.
          </div>
        </div>

        {/* Page dots */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <div style={{ width: 22, height: 8, borderRadius: 4, background: primary }} />
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#CBD5D1" }} />
          <div style={{ width: 8, height: 8, borderRadius: 4, background: "#CBD5D1" }} />
        </div>
      </div>

      {/* Bottom buttons */}
      <div style={{ padding: "0 24px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: primary, borderRadius: 999, height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 600 }}>Next</span>
        </div>
        <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: primary, fontSize: 16, fontWeight: 600 }}>Get Started</span>
        </div>
      </div>
    </div>
  );
}
