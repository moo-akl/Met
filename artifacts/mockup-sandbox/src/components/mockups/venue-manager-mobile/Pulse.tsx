/**
 * Signal — Editorial / magazine cover.
 * White background. The venue name is a MASSIVE typographic presence.
 * Stats as hairline-divided newspaper numbers. Navigation as minimal text links.
 * One electric accent: #00E87A. Inspired by high-fashion editorial layouts.
 */

const GREEN = "#00E87A";
const BLACK = "#0D0D0D";

export default function Pulse() {
  return (
    <div style={{ width: 375, height: 812, background: "#FAFAF8", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column" }}>

      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 20, flexShrink: 0 }}>
        <span style={{ color: BLACK, fontSize: 15, fontWeight: 600 }}>9:41</span>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <svg width="17" height="12" viewBox="0 0 17 12"><rect x="0" y="3" width="3" height="9" rx="1" fill={BLACK} opacity="0.25"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill={BLACK} opacity="0.45"/><rect x="9" y="0" width="3" height="12" rx="1" fill={BLACK} opacity="0.7"/><rect x="13.5" y="0" width="3" height="12" rx="1" fill={BLACK}/></svg>
          <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.5C10.5 2.5 12.7 3.6 14.2 5.3L15.5 4C13.6 1.9 10.9 0.5 8 0.5C5.1 0.5 2.4 1.9 0.5 4L1.8 5.3C3.3 3.6 5.5 2.5 8 2.5Z" fill={BLACK} opacity="0.4"/><path d="M8 5.5C9.7 5.5 11.2 6.2 12.3 7.4L13.6 6.1C12.1 4.6 10.2 3.5 8 3.5C5.8 3.5 3.9 4.6 2.4 6.1L3.7 7.4C4.8 6.2 6.3 5.5 8 5.5Z" fill={BLACK} opacity="0.7"/><circle cx="8" cy="10" r="1.5" fill={BLACK}/></svg>
          <div style={{ width: 22, height: 11, border: `1.5px solid rgba(0,0,0,0.35)`, borderRadius: 3, padding: 1.5, display: "flex", alignItems: "center" }}>
            <div style={{ width: "80%", height: "100%", background: GREEN, borderRadius: 1.5 }} />
          </div>
        </div>
      </div>

      {/* ── Top strip: eyebrow + approved badge ── */}
      <div style={{ paddingInline: 22, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, paddingTop: 4, paddingBottom: 8 }}>
        <span style={{ color: "rgba(0,0,0,0.35)", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Venue Manager</span>
        <span style={{ background: GREEN, color: BLACK, fontSize: 10, fontWeight: 800, letterSpacing: 0.5, borderRadius: 100, paddingInline: 10, paddingBlock: 4 }}>✓ APPROVED</span>
      </div>

      {/* ── HERO: giant venue name ── */}
      <div style={{ paddingInline: 22, flexShrink: 0, borderBottom: "1.5px solid rgba(0,0,0,0.08)", paddingBottom: 20 }}>
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: -2, lineHeight: 1.0, color: BLACK, textTransform: "uppercase" }}>
          The Grand<br />Terrace
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />
          <span style={{ color: "rgba(0,0,0,0.4)", fontSize: 11, fontWeight: 500 }}>Chelsea, London</span>
        </div>
      </div>

      {/* ── Newspaper stats row ── */}
      <div style={{ display: "flex", borderBottom: "1.5px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
        {[
          { value: "1,284", label: "Check-ins", flag: "30d" },
          { value: "3", label: "Events", flag: "ahead" },
          { value: "1", label: "Reward", flag: "live" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, padding: "16px 14px 14px", borderRight: i < 2 ? "1.5px solid rgba(0,0,0,0.08)" : "none" }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1.5, color: BLACK, lineHeight: 1 }}>{s.value}</div>
            <div style={{ marginTop: 4, display: "flex", gap: 5, alignItems: "baseline" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(0,0,0,0.5)" }}>{s.label}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: GREEN, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.flag}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Scrollable nav ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Manage links */}
        <div style={{ paddingInline: 22, paddingTop: 20, paddingBottom: 4 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: "rgba(0,0,0,0.3)", textTransform: "uppercase", marginBottom: 14 }}>Manage</div>

          {[
            { label: "Guests", meta: "Who's been visiting" },
            { label: "Events", meta: "Upcoming & past" },
            { label: "Rewards", meta: "Active campaigns" },
            { label: "Announcements", meta: "Posts to guests" },
            { label: "Edit Profile", meta: "Photos, hours, description" },
          ].map((item, i) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", paddingBlock: 15, borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)" }}>
              {/* Large index number */}
              <span style={{ color: "rgba(0,0,0,0.12)", fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", width: 22, flexShrink: 0 }}>0{i + 1}</span>
              <div style={{ flex: 1, marginLeft: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, color: BLACK }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", marginTop: 1 }}>{item.meta}</div>
              </div>
              {/* Electric arrow */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 10h12M11 5l5 5-5 5" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1.5, background: "rgba(0,0,0,0.08)", marginInline: 22, marginTop: 4, marginBottom: 20 }} />

        {/* Tools + Venue page as compact text links */}
        <div style={{ paddingInline: 22, paddingBottom: 28, display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: "rgba(0,0,0,0.3)", textTransform: "uppercase", marginBottom: 14 }}>Tools</div>
          {[
            { label: "Invite Staff", meta: "One-time registration link" },
            { label: "QR Check-in Kit", meta: "Print a table tent" },
            { label: "View public page →", meta: "See how guests find you", accent: true },
          ].map((item, i) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", paddingBlock: 13, borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.3, color: item.accent ? GREEN : BLACK }}>{item.label}</div>
                <div style={{ fontSize: 11, color: "rgba(0,0,0,0.38)", marginTop: 1 }}>{item.meta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Home indicator */}
      <div style={{ paddingBottom: 8, display: "flex", justifyContent: "center", flexShrink: 0, background: "#FAFAF8" }}>
        <div style={{ width: 134, height: 5, background: "rgba(0,0,0,0.1)", borderRadius: 3 }} />
      </div>
    </div>
  );
}
