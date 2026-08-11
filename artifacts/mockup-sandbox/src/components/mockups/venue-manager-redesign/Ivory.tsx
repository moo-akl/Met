// Ivory — Refined editorial warmth
// Warm off-white with gold accents and generous serif typography.
// Feels like a boutique hotel's private management portal.

const CREAM = "#F9F5EE";
const CREAM2 = "#F2EDE2";
const SIDEBAR_BG = "#EEEAE0";
const SIDEBAR_BORDER = "#D8D2C4";
const GOLD = "#A07830";
const GOLD_LIGHT = "rgba(160,120,48,0.1)";
const GOLD_BORDER = "rgba(160,120,48,0.2)";
const INK = "#1A1714";
const INK2 = "#5A5248";
const INK3 = "#8A8078";
const CARD_BG = "#FFFFFF";
const CARD_BORDER = "#E4DED4";
const ACCENT_LINE = "#C9A055";

const navItems = [
  { label: "Overview", active: true },
  { label: "Venue profile", active: false },
  { label: "Events", active: false },
  { label: "Rewards", active: false },
  { label: "Announcements", active: false },
  { label: "Analytics", active: false },
  { label: "Team", active: false },
  { label: "Guests", active: false },
];

const spark = [22, 18, 34, 28, 41, 38, 55, 47, 62, 58, 71, 83];
const sparkMax = Math.max(...spark);

const events = [
  { month: "AUG", day: "14", title: "Rooftop Sessions", rsvp: 47 },
  { month: "AUG", day: "19", title: "Wine & Jazz Night", rsvp: 31 },
  { month: "AUG", day: "24", title: "Members Evening", rsvp: 22 },
];

const guests = [
  { name: "Marlowe C.", visits: 18, initials: "M" },
  { name: "Petra V.", visits: 14, initials: "P" },
  { name: "James T.", visits: 11, initials: "J" },
  { name: "Suki R.", visits: 9, initials: "S" },
];

export function Ivory() {
  return (
    <div style={{
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      display: "flex", height: "100vh", width: "100%",
      background: CREAM, color: INK, overflow: "hidden",
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 230,
        background: SIDEBAR_BG,
        borderRight: `1px solid ${SIDEBAR_BORDER}`,
        display: "flex", flexDirection: "column",
        padding: "32px 0",
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "0 26px 36px", borderBottom: `1px solid ${SIDEBAR_BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50% 50% 42% 50%",
              background: GOLD, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontStyle: "italic", fontWeight: 800, color: "#fff", letterSpacing: -1,
            }}>m</div>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.5, color: INK }}>
              met <em style={{ color: GOLD, fontStyle: "italic" }}>business</em>
            </span>
          </div>
        </div>

        {/* Venue name */}
        <div style={{ padding: "20px 26px 24px", borderBottom: `1px solid ${SIDEBAR_BORDER}` }}>
          <div style={{ fontSize: 9, color: INK3, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 6 }}>Active venue</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: INK, lineHeight: 1.3 }}>The Grand Terrace</div>
          <div style={{ fontSize: 11, color: INK3, marginTop: 3 }}>Chelsea · owner</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "16px 14px" }}>
          {navItems.map(item => (
            <button key={item.label} style={{
              display: "flex", alignItems: "center",
              width: "100%", padding: "9px 12px",
              borderRadius: 7, border: "none", cursor: "pointer",
              background: item.active ? GOLD_LIGHT : "transparent",
              color: item.active ? GOLD : INK2,
              fontSize: 13, fontWeight: item.active ? 700 : 400,
              textAlign: "left", marginBottom: 1,
              borderLeft: item.active ? `2px solid ${GOLD}` : "2px solid transparent",
            }}>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "16px 20px 0", borderTop: `1px solid ${SIDEBAR_BORDER}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: INK2 }}>Sarah Mitchell</div>
          <div style={{ fontSize: 10, color: INK3, marginTop: 2 }}>sarah@grandterrace.co</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: "auto", background: CREAM }}>
        {/* Page header */}
        <header style={{
          padding: "36px 40px 28px",
          borderBottom: `1px solid ${CARD_BORDER}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        }}>
          <div>
            <div style={{
              fontSize: 9, color: GOLD, fontWeight: 700,
              letterSpacing: 2, textTransform: "uppercase", marginBottom: 8,
            }}>The Grand Terrace</div>
            <h1 style={{
              margin: 0, fontSize: 32, fontWeight: 700,
              fontFamily: "'Georgia', 'Playfair Display', serif",
              letterSpacing: -1.2, color: INK, lineHeight: 1,
            }}>
              Good to see you.
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: INK3, lineHeight: 1.5 }}>
              The pulse of your place, right now.
            </p>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 12, color: INK3,
          }}>
            <span>Mon, Aug 11, 2026</span>
          </div>
        </header>

        {/* Content */}
        <div style={{ padding: "28px 40px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Top row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>

            {/* Check-in hero */}
            <div style={{
              background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12, padding: "28px 28px 24px",
              borderTop: `3px solid ${ACCENT_LINE}`,
            }}>
              <div style={{ fontSize: 10, color: INK3, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
                Check-ins this month
              </div>
              <div style={{
                fontSize: 56, fontWeight: 700, letterSpacing: -2.5, color: INK,
                fontFamily: "'Georgia', serif", lineHeight: 1,
              }}>
                1,284
              </div>
              <div style={{ fontSize: 12, color: INK3, marginTop: 6 }}>
                <span style={{ color: "#2A7A4A", fontWeight: 600 }}>↑ 14%</span> vs last month
              </div>
              {/* Spark */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 42, marginTop: 20 }}>
                {spark.map((v, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: `${(v / sparkMax) * 100}%`,
                    borderRadius: "2px 2px 0 0",
                    background: i === spark.length - 1 ? GOLD : CREAM2,
                    border: `1px solid ${i === spark.length - 1 ? GOLD : CARD_BORDER}`,
                    minHeight: 4,
                  }} />
                ))}
              </div>
            </div>

            {/* QR */}
            <div style={{
              background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12, padding: "28px 28px 24px",
              borderTop: `3px solid ${CARD_BORDER}`,
            }}>
              <div style={{ fontSize: 10, color: INK3, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
                QR verified today
              </div>
              <div style={{
                fontSize: 56, fontWeight: 700, letterSpacing: -2.5, color: GOLD,
                fontFamily: "'Georgia', serif", lineHeight: 1,
              }}>
                34
              </div>
              <div style={{ fontSize: 12, color: INK3, marginTop: 6 }}>guests confirmed present</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 42, marginTop: 20 }}>
                {[12, 19, 8, 24, 31, 27, 34].map((v, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${(v / 34) * 100}%`,
                    borderRadius: "2px 2px 0 0",
                    background: i === 6 ? GOLD : CREAM2,
                    border: `1px solid ${i === 6 ? GOLD : CARD_BORDER}`,
                    minHeight: 4,
                  }} />
                ))}
              </div>
            </div>

            {/* Regulars */}
            <div style={{
              background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12, padding: "24px 24px",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 16 }}>Top regulars</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {guests.map(g => (
                  <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: GOLD_LIGHT, border: `1px solid ${GOLD_BORDER}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: GOLD, flexShrink: 0,
                    }}>{g.initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: INK3 }}>{g.visits} visits this month</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>

            {/* Events */}
            <div style={{
              background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12, padding: "24px 28px",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 20 }}>Coming up</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {events.map((ev, i) => (
                  <div key={ev.title} style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "14px 0",
                    borderBottom: i < events.length - 1 ? `1px solid ${CARD_BORDER}` : "none",
                  }}>
                    <div style={{
                      width: 42, flexShrink: 0,
                      background: CREAM2, border: `1px solid ${CARD_BORDER}`,
                      borderRadius: 8, padding: "6px 0", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: INK3, letterSpacing: 1 }}>{ev.month}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: INK, lineHeight: 1, fontFamily: "'Georgia', serif" }}>{ev.day}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: INK }}>{ev.title}</div>
                      <div style={{ fontSize: 12, color: INK3, marginTop: 2 }}>{ev.rsvp} RSVPs confirmed</div>
                    </div>
                    <div style={{ fontSize: 12, color: INK3 }}>→</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reward callout */}
            <div style={{
              background: `linear-gradient(135deg, #F5EDD8, #FBF6EC)`,
              border: `1px solid ${GOLD_BORDER}`,
              borderLeft: `4px solid ${GOLD}`,
              borderRadius: 12, padding: "24px 24px",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 20, marginBottom: 12 }}>◈</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: INK, fontFamily: "'Georgia', serif" }}>
                  A reward is live
                </div>
                <p style={{ fontSize: 13, color: INK2, lineHeight: 1.6, marginTop: 8 }}>
                  Your current campaign is bringing regulars back to the bar each week.
                </p>
              </div>
              <button style={{
                marginTop: 20, padding: "10px 18px",
                background: GOLD, color: "#fff", border: "none",
                borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>View campaign →</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
