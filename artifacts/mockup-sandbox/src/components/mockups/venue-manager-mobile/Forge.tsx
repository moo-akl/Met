/**
 * Forge — Near-black + violet/indigo accent.
 * Icon-only quick-action row pinned below header.
 * Bold gradient stat card as hero. Modern, dense, premium.
 */

const W = 375;
const H = 812;

const QUICK = [
  { icon: "👥", label: "Guests", color: "#60A5FA" },
  { icon: "📅", label: "Events", color: "#818CF8" },
  { icon: "🎁", label: "Rewards", color: "#34D399" },
  { icon: "📢", label: "Posts", color: "#FBBF24" },
  { icon: "✏️", label: "Profile", color: "#F472B6" },
];

export default function Forge() {
  return (
    <div style={{ width: W, height: H, background: "#09090E", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 20, flexShrink: 0 }}>
        <span style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>9:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="3" width="3" height="9" rx="1" fill="white" opacity="0.4"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill="white" opacity="0.6"/><rect x="9" y="0" width="3" height="12" rx="1" fill="white" opacity="0.8"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="white"/></svg>
          <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5C10.5 2.5 12.7 3.6 14.2 5.3L15.5 4C13.6 1.9 10.9 0.5 8 0.5C5.1 0.5 2.4 1.9 0.5 4L1.8 5.3C3.3 3.6 5.5 2.5 8 2.5Z" fill="white" opacity="0.5"/><path d="M8 5.5C9.7 5.5 11.2 6.2 12.3 7.4L13.6 6.1C12.1 4.6 10.2 3.5 8 3.5C5.8 3.5 3.9 4.6 2.4 6.1L3.7 7.4C4.8 6.2 6.3 5.5 8 5.5Z" fill="white" opacity="0.7"/><circle cx="8" cy="10" r="1.5" fill="white"/></svg>
          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
            <div style={{ width: 22, height: 11, border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 3, padding: 1.5, display: "flex", alignItems: "center" }}>
              <div style={{ width: "80%", height: "100%", background: "#818CF8", borderRadius: 1.5 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Top header row */}
      <div style={{ paddingInline: 20, paddingBottom: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 }}>Venue Manager</div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1 }}>The Grand Terrace</div>
        </div>
        {/* Avatar initials */}
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>GT</span>
        </div>
      </div>

      {/* Hero stat card — gradient */}
      <div style={{ marginInline: 16, marginBottom: 14, borderRadius: 18, background: "linear-gradient(135deg, #1A1040 0%, #0F0A2E 40%, #16103A 100%)", border: "1px solid rgba(99,102,241,0.25)", padding: "18px 20px", position: "relative", overflow: "hidden", flexShrink: 0 }}>
        {/* Glow orb */}
        <div style={{ position: "absolute", top: -30, right: -20, width: 160, height: 160, background: "radial-gradient(circle, #6366F130 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ color: "rgba(165,164,255,0.6)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>This month</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
          <div style={{ color: "#fff", fontSize: 38, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1 }}>1,284</div>
          <div style={{ color: "#818CF8", fontSize: 14, fontWeight: 700 }}>check-ins</div>
        </div>
        {/* Mini bar sparkline */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 28 }}>
          {[40, 55, 45, 70, 60, 80, 65, 90, 75, 100, 85, 95].map((h, i) => (
            <div key={i} style={{ flex: 1, background: i === 11 ? "#818CF8" : "rgba(129,140,248,0.25)", borderRadius: 3, height: `${h}%` }} />
          ))}
        </div>
        <div style={{ color: "rgba(165,164,255,0.4)", fontSize: 10, marginTop: 5 }}>12-month trend</div>

        {/* Side stats */}
        <div style={{ position: "absolute", top: 18, right: 20, display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#34D399", fontSize: 16, fontWeight: 800 }}>3</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 600 }}>EVENTS</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#FBBF24", fontSize: 13, fontWeight: 800 }}>● Live</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 600 }}>REWARD</div>
          </div>
        </div>
      </div>

      {/* Quick-action icon row */}
      <div style={{ paddingInline: 16, marginBottom: 12, display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        {QUICK.map((q) => (
          <div key={q.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: "#14141C", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 22 }}>{q.icon}</span>
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600 }}>{q.label}</div>
          </div>
        ))}
      </div>

      {/* Scrollable rest */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 24px" }}>

        {/* Active reward callout */}
        <div style={{ background: "#14141C", border: "1px solid #FBBF2430", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13, marginBottom: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "#FBBF2415", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 20 }}>🎁</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Active Reward</div>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Summer loyalty campaign</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>48 enrolled · 12 redeemed · 3 days left</div>
          </div>
          <span style={{ color: "#FBBF24", fontSize: 22 }}>›</span>
        </div>

        {/* Tools */}
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Tools</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {[
            { icon: "👥", label: "Invite Staff", sub: "One-time registration link", accent: "#A78BFA" },
            { icon: "🖨️", label: "QR Check-in Kit", sub: "Print a table tent", accent: "#34D399" },
          ].map((item) => (
            <div key={item.label} style={{ background: "#14141C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: item.accent + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 19 }}>{item.icon}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>{item.sub}</div>
              </div>
              <span style={{ color: item.accent, fontSize: 22, opacity: 0.7 }}>›</span>
            </div>
          ))}
        </div>

        {/* View public page */}
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>Venue Page</div>
        <div style={{ background: "#14141C", border: "1px solid #6366F140", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#6366F115", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 19 }}>👁</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>View public page</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>See how guests discover you</div>
          </div>
          <span style={{ color: "#6366F1", fontSize: 22 }}>›</span>
        </div>
      </div>

      {/* Home indicator */}
      <div style={{ paddingBottom: 8, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: 134, height: 5, background: "rgba(129,140,248,0.2)", borderRadius: 3 }} />
      </div>
    </div>
  );
}
