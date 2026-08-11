/**
 * Aurora — Deep immersive gradient. Glassmorphism done with craft.
 * Inspired by Apple Vision Pro spatial computing and high-end music/art apps.
 * Rich aurora gradient backdrop. Stats float as glass orbs.
 * Navigation as frosted glass tiles with subtle inner glow.
 */

export default function Ember() {
  const NAV = [
    { icon: "👥", label: "Guests", glow: "rgba(96,165,250,0.5)" },
    { icon: "📅", label: "Events", glow: "rgba(167,139,250,0.5)" },
    { icon: "🎁", label: "Rewards", glow: "rgba(52,211,153,0.5)" },
    { icon: "📢", label: "Posts", glow: "rgba(251,191,36,0.5)" },
    { icon: "✏️", label: "Profile", glow: "rgba(244,114,182,0.5)" },
  ];

  return (
    <div style={{ width: 375, height: 812, background: "#0A0518", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* ── Deep aurora background ── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {/* Main aurora sweeps */}
        <div style={{ position: "absolute", top: -100, left: -80, width: 400, height: 400, background: "radial-gradient(ellipse, rgba(99,30,180,0.6) 0%, transparent 65%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: 80, right: -100, width: 350, height: 300, background: "radial-gradient(ellipse, rgba(16,185,129,0.25) 0%, transparent 65%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: 300, left: -60, width: 280, height: 280, background: "radial-gradient(ellipse, rgba(59,130,246,0.3) 0%, transparent 65%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: 500, right: -80, width: 300, height: 300, background: "radial-gradient(ellipse, rgba(139,92,246,0.2) 0%, transparent 65%)", borderRadius: "50%" }} />
        {/* Fine noise-like texture overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,5,24,0) 0%, rgba(10,5,24,0.7) 100%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Status bar */}
        <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 22, flexShrink: 0 }}>
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: 600 }}>9:41</span>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="3" width="3" height="9" rx="1" fill="white" opacity="0.3"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill="white" opacity="0.55"/><rect x="9" y="0" width="3" height="12" rx="1" fill="white" opacity="0.8"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="white"/></svg>
            <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5C10.5 2.5 12.7 3.6 14.2 5.3L15.5 4C13.6 1.9 10.9 0.5 8 0.5C5.1 0.5 2.4 1.9 0.5 4L1.8 5.3C3.3 3.6 5.5 2.5 8 2.5Z" fill="white" opacity="0.4"/><path d="M8 5.5C9.7 5.5 11.2 6.2 12.3 7.4L13.6 6.1C12.1 4.6 10.2 3.5 8 3.5C5.8 3.5 3.9 4.6 2.4 6.1L3.7 7.4C4.8 6.2 6.3 5.5 8 5.5Z" fill="white" opacity="0.7"/><circle cx="8" cy="10" r="1.5" fill="white"/></svg>
            <div style={{ width: 22, height: 11, border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: 3, padding: 1.5, display: "flex", alignItems: "center" }}>
              <div style={{ width: "80%", height: "100%", background: "linear-gradient(90deg, #34D399, #10B981)", borderRadius: 1.5 }} />
            </div>
          </div>
        </div>

        {/* ── Identity ── */}
        <div style={{ paddingInline: 22, paddingBottom: 6, flexShrink: 0 }}>
          <div style={{ color: "rgba(200,180,255,0.5)", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>Venue Manager</div>
          <div style={{ color: "#fff", fontSize: 26, fontWeight: 800, letterSpacing: -0.8, textShadow: "0 0 40px rgba(139,92,246,0.8)", lineHeight: 1.1 }}>The Grand Terrace</div>
          <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 100, paddingInline: 10, paddingBlock: 4, backdropFilter: "blur(8px)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#34D399", boxShadow: "0 0 6px #34D399" }} />
            <span style={{ color: "#34D399", fontSize: 11, fontWeight: 600, letterSpacing: 0.3 }}>Approved venue</span>
          </div>
        </div>

        {/* ── Glass stat orbs ── */}
        <div style={{ paddingInline: 16, marginTop: 16, marginBottom: 16, display: "flex", gap: 9, flexShrink: 0 }}>
          {[
            { value: "1,284", label: "Check-ins", sub: "this month", glow: "rgba(99,102,241,0.4)", border: "rgba(99,102,241,0.35)" },
            { value: "3", label: "Events", sub: "upcoming", glow: "rgba(52,211,153,0.3)", border: "rgba(52,211,153,0.3)" },
            { value: "Live", label: "Reward", sub: "active", glow: "rgba(251,191,36,0.3)", border: "rgba(251,191,36,0.3)" },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1,
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: `1px solid ${s.border}`,
              borderRadius: 18,
              padding: "14px 10px",
              textAlign: "center",
              boxShadow: `0 4px 24px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.1)`,
            }}>
              <div style={{ color: "#fff", fontSize: 20, fontWeight: 800, letterSpacing: -0.5, textShadow: `0 0 20px ${s.glow}` }}>{s.value}</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, marginTop: 3 }}>{s.label}</div>
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Quick nav icon row ── */}
        <div style={{ paddingInline: 16, marginBottom: 16, display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
          {NAV.map((item) => (
            <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 54, height: 54, borderRadius: 17,
                background: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 2px 16px ${item.glow}`,
              }}>
                <span style={{ fontSize: 22 }}>{item.icon}</span>
              </div>
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 600 }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* ── Glass card: main content ── */}
        <div style={{
          flex: 1,
          marginInline: 12,
          marginBottom: 12,
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 28,
          overflow: "hidden",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 40px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Active reward callout */}
          <div style={{ padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ color: "rgba(251,191,36,0.6)", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Active Reward</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>Summer loyalty campaign</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>48 enrolled · 12 redeemed · 3 days left</div>
              </div>
              <div style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "4px 10px" }}>
                <span style={{ color: "#FBBF24", fontSize: 11, fontWeight: 700 }}>● Live</span>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ marginTop: 10, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ width: "25%", height: "100%", background: "linear-gradient(90deg, #FBBF24, #F59E0B)", borderRadius: 100 }} />
            </div>
          </div>

          {/* Tool rows */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 18px 16px" }}>
            {[
              { icon: "👥", label: "Invite Staff", sub: "One-time registration link", glow: "#A78BFA" },
              { icon: "🖨️", label: "QR Check-in Kit", sub: "Print a table tent for your venue", glow: "#34D399" },
              { icon: "👁", label: "View public page", sub: "See how guests discover you", glow: "#60A5FA" },
            ].map((item, i) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12, paddingBlock: 12, borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 2 }}>{item.sub}</div>
                </div>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9h10M9 4l5 5-5 5" stroke={item.glow} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ))}
          </div>
        </div>

        {/* Home indicator */}
        <div style={{ paddingBottom: 8, display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 134, height: 5, background: "rgba(255,255,255,0.15)", borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}
