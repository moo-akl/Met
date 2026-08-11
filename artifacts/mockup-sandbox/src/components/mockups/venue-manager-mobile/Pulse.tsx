/**
 * Pulse — Dark command-centre feel.
 * Hero stat at the top. Vertical full-width nav list instead of grid.
 * Clean, no emojis, geometric icon containers.
 */

const W = 375;
const H = 812;

const NAV = [
  { icon: "👥", label: "Guests", sub: "Who's been visiting", accent: "#60A5FA" },
  { icon: "📅", label: "Events", sub: "Upcoming & past", accent: "#818CF8" },
  { icon: "🎁", label: "Rewards", sub: "Active campaigns", accent: "#34D399" },
  { icon: "📢", label: "Announcements", sub: "Posts to guests", accent: "#FBBF24" },
  { icon: "✏️", label: "Edit Profile", sub: "Photos, hours, description", accent: "#F472B6" },
];

const TOOLS = [
  { icon: "👥", label: "Invite Staff", sub: "One-time registration link", accent: "#A78BFA" },
  { icon: "🖨️", label: "QR Check-in Kit", sub: "Print a table tent", accent: "#34D399" },
];

export default function Pulse() {
  return (
    <div style={{ width: W, height: H, background: "#0A0A0D", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 20, flexShrink: 0 }}>
        <span style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>9:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="3" width="3" height="9" rx="1" fill="white" opacity="0.4"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill="white" opacity="0.6"/><rect x="9" y="0" width="3" height="12" rx="1" fill="white" opacity="0.8"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="white"/></svg>
          <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5C10.5 2.5 12.7 3.6 14.2 5.3L15.5 4C13.6 1.9 10.9 0.5 8 0.5C5.1 0.5 2.4 1.9 0.5 4L1.8 5.3C3.3 3.6 5.5 2.5 8 2.5Z" fill="white" opacity="0.5"/><path d="M8 5.5C9.7 5.5 11.2 6.2 12.3 7.4L13.6 6.1C12.1 4.6 10.2 3.5 8 3.5C5.8 3.5 3.9 4.6 2.4 6.1L3.7 7.4C4.8 6.2 6.3 5.5 8 5.5Z" fill="white" opacity="0.7"/><circle cx="8" cy="10" r="1.5" fill="white"/></svg>
          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
            <div style={{ width: 22, height: 11, border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 3, padding: 1.5, display: "flex", alignItems: "center" }}>
              <div style={{ width: "80%", height: "100%", background: "#4ADE80", borderRadius: 1.5 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ paddingInline: 20, paddingBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2 }}>Venue Manager</div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>The Grand Terrace</div>
        </div>
        <div style={{ background: "#16A34A1A", border: "1px solid #16A34A50", borderRadius: 8, padding: "4px 10px" }}>
          <span style={{ color: "#4ADE80", fontSize: 12, fontWeight: 700 }}>✓ Approved</span>
        </div>
      </div>

      {/* Hero stats strip */}
      <div style={{ marginInline: 16, marginTop: 12, background: "#141418", borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", padding: "14px 16px", display: "flex", gap: 0, flexShrink: 0 }}>
        {[
          { value: "1,284", label: "Check-ins", sub: "this month", color: "#818CF8" },
          { value: "3", label: "Events", sub: "upcoming", color: "#34D399" },
          { value: "Active", label: "Reward", sub: "running", color: "#FBBF24" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid rgba(255,255,255,0.07)" : "none", padding: "0 8px" }}>
            <div style={{ color: s.color, fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>{s.value}</div>
            <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, marginTop: 1 }}>{s.label}</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px" }}>

        {/* MANAGE label */}
        <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginTop: 4 }}>Manage</div>

        {/* Vertical nav list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {NAV.map((item) => (
            <div key={item.label} style={{ background: "#141418", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: item.accent + "1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>{item.label}</div>
                <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, marginTop: 2 }}>{item.sub}</div>
              </div>
              <div style={{ color: item.accent, fontSize: 22, lineHeight: 1, opacity: 0.7 }}>›</div>
            </div>
          ))}
        </div>

        {/* TOOLS */}
        <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Tools</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {TOOLS.map((item) => (
            <div key={item.label} style={{ background: "#141418", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: item.accent + "1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>{item.label}</div>
                <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, marginTop: 2 }}>{item.sub}</div>
              </div>
              <div style={{ color: item.accent, fontSize: 22, lineHeight: 1, opacity: 0.7 }}>›</div>
            </div>
          ))}
        </div>

        {/* View public page */}
        <div style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Venue Page</div>
        <div style={{ background: "#141418", border: "1px solid #6366F140", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "#6366F115", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 20 }}>👁</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>View public page</div>
            <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 12, marginTop: 2 }}>See how guests discover you</div>
          </div>
          <div style={{ color: "#818CF8", fontSize: 22, lineHeight: 1 }}>›</div>
        </div>
      </div>

      {/* Bottom home indicator */}
      <div style={{ paddingBottom: 8, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: 134, height: 5, background: "rgba(255,255,255,0.2)", borderRadius: 3 }} />
      </div>
    </div>
  );
}
