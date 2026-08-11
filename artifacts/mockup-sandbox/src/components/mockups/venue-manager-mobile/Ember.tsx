/**
 * Ember — Clean white/light mode.
 * Soft off-white background, dark text, green primary accent.
 * Feels like a polished consumer app (think Airbnb host tools).
 */

export default function Ember() {
  const NAV = [
    { icon: "👥", label: "Guests", sub: "See who's visiting", accent: "#16A34A" },
    { icon: "📅", label: "Events", sub: "Create & manage", accent: "#2563EB" },
    { icon: "🎁", label: "Rewards", sub: "Run campaigns", accent: "#7C3AED" },
    { icon: "📢", label: "Announcements", sub: "Post updates", accent: "#D97706" },
  ];

  return (
    <div style={{ width: 375, height: 812, background: "#F7F7F5", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 20, flexShrink: 0 }}>
        <span style={{ color: "#111", fontSize: 15, fontWeight: 600 }}>9:41</span>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="3" width="3" height="9" rx="1" fill="#111" opacity="0.3"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill="#111" opacity="0.5"/><rect x="9" y="0" width="3" height="12" rx="1" fill="#111" opacity="0.7"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="#111"/></svg>
          <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5C10.5 2.5 12.7 3.6 14.2 5.3L15.5 4C13.6 1.9 10.9 0.5 8 0.5C5.1 0.5 2.4 1.9 0.5 4L1.8 5.3C3.3 3.6 5.5 2.5 8 2.5Z" fill="#111" opacity="0.4"/><path d="M8 5.5C9.7 5.5 11.2 6.2 12.3 7.4L13.6 6.1C12.1 4.6 10.2 3.5 8 3.5C5.8 3.5 3.9 4.6 2.4 6.1L3.7 7.4C4.8 6.2 6.3 5.5 8 5.5Z" fill="#111" opacity="0.7"/><circle cx="8" cy="10" r="1.5" fill="#111"/></svg>
          <div style={{ width: 22, height: 11, border: "1.5px solid rgba(0,0,0,0.4)", borderRadius: 3, padding: 1.5, display: "flex", alignItems: "center" }}>
            <div style={{ width: "80%", height: "100%", background: "#16A34A", borderRadius: 1.5 }} />
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ paddingInline: 20, paddingBottom: 12, flexShrink: 0 }}>
        <div style={{ color: "#6B7280", fontSize: 12, fontWeight: 500, marginBottom: 3 }}>Venue Manager</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ color: "#111", fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>The Grand Terrace</div>
          <div style={{ background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: 100, padding: "4px 10px", flexShrink: 0, marginLeft: 8 }}>
            <span style={{ color: "#15803D", fontSize: 12, fontWeight: 700 }}>✓ Approved</span>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ marginInline: 16, marginBottom: 14, background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", display: "flex", flexShrink: 0, overflow: "hidden" }}>
        {[
          { value: "1,284", label: "Check-ins", sub: "this month", color: "#16A34A" },
          { value: "3", label: "Events", sub: "upcoming", color: "#2563EB" },
          { value: "Active", label: "Reward", sub: "running", color: "#7C3AED" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, padding: "13px 8px", textAlign: "center", borderRight: i < 2 ? "1px solid #F3F4F6" : "none" }}>
            <div style={{ color: s.color, fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{s.value}</div>
            <div style={{ color: "#111", fontSize: 11, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            <div style={{ color: "#9CA3AF", fontSize: 10, marginTop: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>

        {/* MANAGE section heading */}
        <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Manage</div>

        {/* 2×2 grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {NAV.map((item) => (
            <div key={item.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: "15px 14px 13px", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: item.accent + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
              </div>
              <div>
                <div style={{ color: "#111", fontSize: 14, fontWeight: 700 }}>{item.label}</div>
                <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Edit profile — full width */}
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "#FDF2F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 20 }}>✏️</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#111", fontSize: 14, fontWeight: 700 }}>Edit Profile</div>
            <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>Name, photos, description</div>
          </div>
          <span style={{ color: "#D1D5DB", fontSize: 22 }}>›</span>
        </div>

        {/* Tools */}
        <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Tools</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {[
            { icon: "👥", label: "Invite Staff", sub: "One-time registration link", bg: "#F5F3FF", accent: "#7C3AED" },
            { icon: "🖨️", label: "QR Check-in Kit", sub: "Print a table tent", bg: "#F0FDF4", accent: "#16A34A" },
          ].map((item) => (
            <div key={item.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#111", fontSize: 14, fontWeight: 700 }}>{item.label}</div>
                <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>{item.sub}</div>
              </div>
              <span style={{ color: "#D1D5DB", fontSize: 22 }}>›</span>
            </div>
          ))}
        </div>

        {/* View public page */}
        <div style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>Venue Page</div>
        <div style={{ background: "#fff", border: "1px solid #16A34A30", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 20 }}>👁</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#111", fontSize: 14, fontWeight: 700 }}>View public page</div>
            <div style={{ color: "#9CA3AF", fontSize: 11, marginTop: 2 }}>See how guests discover you</div>
          </div>
          <span style={{ color: "#16A34A", fontSize: 22 }}>›</span>
        </div>
      </div>

      {/* Home indicator */}
      <div style={{ paddingBottom: 8, display: "flex", justifyContent: "center", flexShrink: 0, background: "#F7F7F5" }}>
        <div style={{ width: 134, height: 5, background: "rgba(0,0,0,0.12)", borderRadius: 3 }} />
      </div>
    </div>
  );
}
