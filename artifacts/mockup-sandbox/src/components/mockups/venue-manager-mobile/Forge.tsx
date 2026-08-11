/**
 * Forge — Mid-tone blue-grey.
 * Slate blue surface, white cards, green/teal accent.
 * Not pure dark, not pure light — muted professional.
 * Feels like a modern productivity app (Notion, Linear).
 */

export default function Forge() {
  return (
    <div style={{ width: 375, height: 812, background: "#1E2A3A", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 20, flexShrink: 0 }}>
        <span style={{ color: "#E2E8F0", fontSize: 15, fontWeight: 600 }}>9:41</span>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="3" width="3" height="9" rx="1" fill="#94A3B8" opacity="0.5"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill="#94A3B8" opacity="0.7"/><rect x="9" y="0" width="3" height="12" rx="1" fill="#94A3B8" opacity="0.9"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="#E2E8F0"/></svg>
          <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5C10.5 2.5 12.7 3.6 14.2 5.3L15.5 4C13.6 1.9 10.9 0.5 8 0.5C5.1 0.5 2.4 1.9 0.5 4L1.8 5.3C3.3 3.6 5.5 2.5 8 2.5Z" fill="#94A3B8" opacity="0.5"/><path d="M8 5.5C9.7 5.5 11.2 6.2 12.3 7.4L13.6 6.1C12.1 4.6 10.2 3.5 8 3.5C5.8 3.5 3.9 4.6 2.4 6.1L3.7 7.4C4.8 6.2 6.3 5.5 8 5.5Z" fill="#94A3B8" opacity="0.8"/><circle cx="8" cy="10" r="1.5" fill="#E2E8F0"/></svg>
          <div style={{ width: 22, height: 11, border: "1.5px solid rgba(148,163,184,0.5)", borderRadius: 3, padding: 1.5, display: "flex", alignItems: "center" }}>
            <div style={{ width: "80%", height: "100%", background: "#2DD4BF", borderRadius: 1.5 }} />
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ paddingInline: 20, paddingBottom: 14, flexShrink: 0 }}>
        <div style={{ color: "#64748B", fontSize: 12, fontWeight: 600, letterSpacing: 0.5, marginBottom: 3 }}>Venue Manager</div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ color: "#F1F5F9", fontSize: 23, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.15 }}>The Grand Terrace</div>
          <div style={{ background: "#134E2C", borderRadius: 100, padding: "4px 10px", flexShrink: 0, marginLeft: 10, marginTop: 3 }}>
            <span style={{ color: "#4ADE80", fontSize: 11, fontWeight: 700 }}>✓ Approved</span>
          </div>
        </div>
      </div>

      {/* Stats row — white cards */}
      <div style={{ paddingInline: 16, marginBottom: 14, display: "flex", gap: 9, flexShrink: 0 }}>
        {[
          { value: "1,284", label: "Check-ins", color: "#2DD4BF" },
          { value: "3", label: "Events", color: "#60A5FA" },
          { value: "Live", label: "Reward", color: "#A78BFA" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "#243447", borderRadius: 14, padding: "12px 10px", textAlign: "center", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color: s.color, fontSize: 18, fontWeight: 800 }}>{s.value}</div>
            <div style={{ color: "#94A3B8", fontSize: 10, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>

        <div style={{ color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 9 }}>Manage</div>

        {/* 2-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 9 }}>
          {[
            { icon: "👥", label: "Guests", sub: "See regulars", accent: "#2DD4BF", bg: "#0D3330" },
            { icon: "📅", label: "Events", sub: "Create & manage", accent: "#60A5FA", bg: "#0D1F3A" },
            { icon: "🎁", label: "Rewards", sub: "Run campaigns", accent: "#A78BFA", bg: "#1A143A" },
            { icon: "📢", label: "Announce", sub: "Post updates", accent: "#FBBF24", bg: "#2A1F05" },
          ].map((item) => (
            <div key={item.label} style={{ background: "#243447", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 13px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
              </div>
              <div>
                <div style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 700 }}>{item.label}</div>
                <div style={{ color: "#64748B", fontSize: 11, marginTop: 2 }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Edit profile full-width */}
        <div style={{ background: "#243447", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "#2A1A30", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 20 }}>✏️</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 700 }}>Edit Profile</div>
            <div style={{ color: "#64748B", fontSize: 11, marginTop: 2 }}>Name, photos, description</div>
          </div>
          <span style={{ color: "#475569", fontSize: 22 }}>›</span>
        </div>

        {/* Tools */}
        <div style={{ color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 9 }}>Tools</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 16 }}>
          {[
            { icon: "👥", label: "Invite Staff", sub: "One-time registration link", accent: "#A78BFA", bg: "#1A143A" },
            { icon: "🖨️", label: "QR Check-in Kit", sub: "Print a table tent", accent: "#2DD4BF", bg: "#0D3330" },
          ].map((item) => (
            <div key={item.label} style={{ background: "#243447", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 700 }}>{item.label}</div>
                <div style={{ color: "#64748B", fontSize: 11, marginTop: 2 }}>{item.sub}</div>
              </div>
              <span style={{ color: item.accent, fontSize: 22, opacity: 0.7 }}>›</span>
            </div>
          ))}
        </div>

        {/* View public page */}
        <div style={{ color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 9 }}>Venue Page</div>
        <div style={{ background: "#243447", border: "1px solid #2DD4BF30", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: "#0D3330", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 20 }}>👁</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#F1F5F9", fontSize: 14, fontWeight: 700 }}>View public page</div>
            <div style={{ color: "#64748B", fontSize: 11, marginTop: 2 }}>See how guests discover you</div>
          </div>
          <span style={{ color: "#2DD4BF", fontSize: 22 }}>›</span>
        </div>
      </div>

      {/* Home indicator */}
      <div style={{ paddingBottom: 8, display: "flex", justifyContent: "center", flexShrink: 0, background: "#1E2A3A" }}>
        <div style={{ width: 134, height: 5, background: "rgba(255,255,255,0.1)", borderRadius: 3 }} />
      </div>
    </div>
  );
}
