/**
 * Ember — Warm charcoal + amber/gold accent.
 * Prominent venue cover banner. Tab strip navigation for sections.
 * Feels like a premium bar/restaurant operator tool.
 */

const W = 375;
const H = 812;

export default function Ember() {
  return (
    <div style={{ width: W, height: H, background: "#111009", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 20, flexShrink: 0, position: "relative", zIndex: 2 }}>
        <span style={{ color: "#fff", fontSize: 15, fontWeight: 600 }}>9:41</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="3" width="3" height="9" rx="1" fill="white" opacity="0.4"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill="white" opacity="0.6"/><rect x="9" y="0" width="3" height="12" rx="1" fill="white" opacity="0.8"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill="white"/></svg>
          <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5C10.5 2.5 12.7 3.6 14.2 5.3L15.5 4C13.6 1.9 10.9 0.5 8 0.5C5.1 0.5 2.4 1.9 0.5 4L1.8 5.3C3.3 3.6 5.5 2.5 8 2.5Z" fill="white" opacity="0.5"/><path d="M8 5.5C9.7 5.5 11.2 6.2 12.3 7.4L13.6 6.1C12.1 4.6 10.2 3.5 8 3.5C5.8 3.5 3.9 4.6 2.4 6.1L3.7 7.4C4.8 6.2 6.3 5.5 8 5.5Z" fill="white" opacity="0.7"/><circle cx="8" cy="10" r="1.5" fill="white"/></svg>
          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
            <div style={{ width: 22, height: 11, border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 3, padding: 1.5, display: "flex", alignItems: "center" }}>
              <div style={{ width: "80%", height: "100%", background: "#FBBF24", borderRadius: 1.5 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Cover banner */}
      <div style={{ position: "relative", height: 140, flexShrink: 0, background: "linear-gradient(135deg, #1C1508 0%, #2A1C00 50%, #1A1206 100%)", overflow: "hidden" }}>
        {/* Decorative warm glow */}
        <div style={{ position: "absolute", top: -40, right: -20, width: 180, height: 180, background: "radial-gradient(circle, #D9770640 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -30, left: 20, width: 120, height: 120, background: "radial-gradient(circle, #FBBF2420 0%, transparent 70%)" }} />

        {/* Back */}
        <div style={{ position: "absolute", top: 12, left: 20, color: "#FBBF24", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, opacity: 0.8 }}>
          ‹ Back
        </div>

        {/* Venue identity */}
        <div style={{ position: "absolute", bottom: 16, left: 20, right: 20 }}>
          <div style={{ color: "rgba(255,220,100,0.6)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>Venue Manager</div>
          <div style={{ color: "#fff", fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4 }}>The Grand Terrace</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FBBF2415", border: "1px solid #FBBF2440", borderRadius: 100, paddingInline: 10, paddingBlock: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80" }} />
            <span style={{ color: "#FBBF24", fontSize: 11, fontWeight: 700 }}>Approved venue</span>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: "#1A140A", borderBottom: "1px solid rgba(255,191,36,0.1)", display: "flex", flexShrink: 0 }}>
        {[
          { value: "1,284", label: "Check-ins", color: "#FBBF24" },
          { value: "3", label: "Upcoming events", color: "#F97316" },
          { value: "Live", label: "Reward", color: "#4ADE80" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, padding: "12px 8px", textAlign: "center", borderRight: i < 2 ? "1px solid rgba(255,191,36,0.1)" : "none" }}>
            <div style={{ color: s.color, fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>{s.value}</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 28px" }}>

        {/* Manage section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "rgba(255,191,36,0.5)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Manage</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {[
              { icon: "👥", label: "Guests", sub: "See regulars", accent: "#60A5FA" },
              { icon: "📅", label: "Events", sub: "Create & manage", accent: "#A78BFA" },
              { icon: "🎁", label: "Rewards", sub: "Run campaigns", accent: "#34D399" },
              { icon: "📢", label: "Announce", sub: "Post updates", accent: "#FBBF24" },
            ].map((item) => (
              <div key={item.label} style={{ background: "#1C1710", border: "1px solid rgba(255,191,36,0.08)", borderRadius: 14, padding: "14px 14px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: item.accent + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 19 }}>{item.icon}</span>
                </div>
                <div>
                  <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{item.label}</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
          {/* Edit profile — full width */}
          <div style={{ marginTop: 9, background: "#1C1710", border: "1px solid rgba(255,191,36,0.08)", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F472B618", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 19 }}>✏️</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Edit Profile</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>Name, photos, description</div>
            </div>
            <span style={{ color: "#FBBF24", fontSize: 22, opacity: 0.6 }}>›</span>
          </div>
        </div>

        {/* Tools */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "rgba(255,191,36,0.5)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Tools</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              { icon: "👥", label: "Invite Staff", sub: "One-time registration link", accent: "#A78BFA" },
              { icon: "🖨️", label: "QR Check-in Kit", sub: "Print a table tent", accent: "#34D399" },
            ].map((item) => (
              <div key={item.label} style={{ background: "#1C1710", border: "1px solid rgba(255,191,36,0.08)", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: item.accent + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 19 }}>{item.icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>{item.label}</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>{item.sub}</div>
                </div>
                <span style={{ color: item.accent, fontSize: 22, opacity: 0.7 }}>›</span>
              </div>
            ))}
          </div>
        </div>

        {/* View public page */}
        <div>
          <div style={{ color: "rgba(255,191,36,0.5)", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Venue Page</div>
          <div style={{ background: "#1C1710", border: "1px solid #FBBF2430", borderRadius: 14, padding: "13px 14px", display: "flex", alignItems: "center", gap: 13 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#FBBF2415", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 19 }}>👁</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>View public page</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>See how guests discover you</div>
            </div>
            <span style={{ color: "#FBBF24", fontSize: 22 }}>›</span>
          </div>
        </div>
      </div>

      {/* Home indicator */}
      <div style={{ paddingBottom: 8, display: "flex", justifyContent: "center", flexShrink: 0, background: "#111009" }}>
        <div style={{ width: 134, height: 5, background: "rgba(255,191,36,0.15)", borderRadius: 3 }} />
      </div>
    </div>
  );
}
