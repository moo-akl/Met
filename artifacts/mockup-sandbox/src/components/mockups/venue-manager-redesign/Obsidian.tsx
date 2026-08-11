// Obsidian — Dark luxury hospitality SaaS
// Deep emerald-on-black palette. Feels like a premium venue operating platform.
// Note: uses system fonts only (no @fontsource import needed).

const EMERALD = "#10B981";
const EMERALD_DIM = "rgba(16,185,129,0.12)";
const EMERALD_GLOW = "rgba(16,185,129,0.25)";
const BG = "#06100C";
const SIDEBAR = "#0A1A13";
const CARD = "#0E2018";
const CARD2 = "#0B1A14";
const BORDER = "rgba(16,185,129,0.14)";
const BORDER2 = "rgba(16,185,129,0.08)";
const TEXT = "#E8F5EF";
const TEXT2 = "#7BA898";
const TEXT3 = "#4A7060";
const MUTED = "#2A4038";

const navItems = [
  { icon: "⊞", label: "Overview", active: true },
  { icon: "🏛", label: "Venue profile", active: false },
  { icon: "◷", label: "Events", active: false },
  { icon: "◈", label: "Rewards", active: false },
  { icon: "◉", label: "Announcements", active: false },
  { icon: "▦", label: "Analytics", active: false },
  { icon: "◎", label: "Team", active: false },
  { icon: "★", label: "Guests", active: false },
];

const guests = [
  { name: "Marlowe C.", visits: 18, time: "3m ago" },
  { name: "Petra V.", visits: 14, time: "11m ago" },
  { name: "James T.", visits: 11, time: "22m ago" },
  { name: "Suki R.", visits: 9, time: "41m ago" },
];

const events = [
  { date: "Aug 14", title: "Rooftop Sessions", rsvp: 47 },
  { date: "Aug 19", title: "Wine & Jazz Night", rsvp: 31 },
  { date: "Aug 24", title: "Members Evening", rsvp: 22 },
];

const sparkData = [22, 18, 34, 28, 41, 38, 55, 47, 62, 58, 71, 83];
const max = Math.max(...sparkData);

export function Obsidian() {
  return (
    <div style={{
      fontFamily: "'Inter Variable', sans-serif",
      display: "flex", height: "100vh", width: "100%",
      background: BG, color: TEXT, overflow: "hidden",
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: SIDEBAR,
        borderRight: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column", padding: "28px 0",
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "0 24px 32px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50% 50% 42% 50%",
            background: EMERALD, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontStyle: "italic", fontWeight: 800, color: "#fff",
          }}>m</div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.5 }}>
            met <em style={{ color: EMERALD, fontStyle: "italic", fontWeight: 600 }}>business</em>
          </span>
        </div>

        {/* Venue picker */}
        <div style={{
          margin: "0 14px 28px",
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 10, padding: "10px 12px",
          cursor: "pointer",
        }}>
          <div style={{ fontSize: 11, color: TEXT3, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Active venue</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>The Grand Terrace</div>
          <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>Chelsea, London · owner</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0 8px" }}>
          {navItems.map(item => (
            <button key={item.label} style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "10px 14px",
              borderRadius: 8, border: "none", cursor: "pointer",
              background: item.active ? EMERALD_DIM : "transparent",
              color: item.active ? EMERALD : TEXT2,
              fontSize: 13, fontWeight: item.active ? 600 : 400,
              textAlign: "left", marginBottom: 2,
              boxShadow: item.active ? `inset 1px 0 0 ${EMERALD}, inset 0 0 0 1px ${EMERALD_GLOW}` : "none",
            }}>
              <span style={{ fontSize: 14, opacity: item.active ? 1 : 0.6 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "16px 14px 0", borderTop: `1px solid ${BORDER2}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 6px" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: EMERALD_DIM, border: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: EMERALD, fontWeight: 700,
            }}>S</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>Sarah M.</div>
              <div style={{ fontSize: 10, color: TEXT3 }}>owner access</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <header style={{
          padding: "28px 36px 0",
          borderBottom: `1px solid ${BORDER2}`,
          paddingBottom: 24,
        }}>
          <div style={{ fontSize: 10, color: TEXT3, fontWeight: 600, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 }}>
            THE GRAND TERRACE
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -1, color: TEXT }}>
            Good to see you.
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: TEXT2 }}>
            The pulse of your place, right now.
          </p>
        </header>

        {/* Grid */}
        <div style={{
          padding: "28px 36px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gridTemplateRows: "auto auto",
          gap: 16,
        }}>

          {/* Hero stat */}
          <div style={{
            gridColumn: "1 / 2", gridRow: "1 / 2",
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            padding: "28px 28px 24px",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -30, right: -30,
              width: 120, height: 120, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)",
            }} />
            <div style={{ fontSize: 10, color: EMERALD, fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 12 }}>
              Community this month
            </div>
            <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: -2, color: TEXT, lineHeight: 1 }}>
              1,284
              <span style={{ fontSize: 18, color: TEXT2, fontWeight: 500, marginLeft: 6, letterSpacing: 0 }}>check-ins</span>
            </div>
            {/* Sparkline */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 48, marginTop: 20 }}>
              {sparkData.map((v, i) => (
                <div key={i} style={{
                  flex: 1,
                  height: `${(v / max) * 100}%`,
                  borderRadius: "3px 3px 1px 1px",
                  background: `linear-gradient(to top, ${EMERALD}, rgba(16,185,129,0.4))`,
                  minHeight: 4,
                  opacity: i === sparkData.length - 1 ? 1 : 0.55 + (i / sparkData.length) * 0.45,
                }} />
              ))}
            </div>
            <div style={{ fontSize: 10, color: TEXT3, marginTop: 6 }}>12-month trend</div>
          </div>

          {/* QR panel */}
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "24px 28px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 10, color: TEXT3, fontWeight: 600, letterSpacing: 1.4, textTransform: "uppercase" }}>
                  QR verifications
                </div>
                <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, color: EMERALD, marginTop: 8, lineHeight: 1 }}>
                  34
                </div>
                <div style={{ fontSize: 12, color: TEXT2, marginTop: 4 }}>guests today</div>
              </div>
              <div style={{
                width: 42, height: 42, borderRadius: 10,
                background: EMERALD_DIM, border: `1px solid ${BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}>⬡</div>
            </div>
            {/* 7-day bars */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 38, marginTop: 20 }}>
              {[12, 19, 8, 24, 31, 27, 34].map((v, i) => (
                <div key={i} style={{
                  flex: 1, height: `${(v / 34) * 100}%`,
                  borderRadius: 3,
                  background: i === 6 ? EMERALD : "rgba(16,185,129,0.25)",
                  minHeight: 4,
                }} />
              ))}
            </div>
            <div style={{ fontSize: 10, color: TEXT3, marginTop: 6 }}>7-day trend</div>
          </div>

          {/* Live now */}
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "24px 24px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Scanned today</span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: EMERALD,
                background: EMERALD_DIM, padding: "2px 8px", borderRadius: 999,
                letterSpacing: 0.5,
              }}>LIVE</span>
            </div>
            {guests.map((g, i) => (
              <div key={g.name} style={{
                display: "flex", alignItems: "center", gap: 10,
                paddingBottom: i < guests.length - 1 ? 12 : 0,
                marginBottom: i < guests.length - 1 ? 12 : 0,
                borderBottom: i < guests.length - 1 ? `1px solid ${BORDER2}` : "none",
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: EMERALD_DIM, border: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: EMERALD, flexShrink: 0,
                }}>{g.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{g.name}</div>
                  <div style={{ fontSize: 11, color: TEXT2 }}>{g.visits} visits · {g.time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Coming up */}
          <div style={{
            gridColumn: "1 / 3",
            background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "24px 28px",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 16 }}>Coming up</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {events.map((ev, i) => (
                <div key={ev.title} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "12px 0",
                  borderBottom: i < events.length - 1 ? `1px solid ${BORDER2}` : "none",
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: EMERALD,
                    fontVariantNumeric: "tabular-nums", width: 48, flexShrink: 0,
                    fontFamily: "'DM Mono', monospace",
                  }}>{ev.date}</div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TEXT }}>{ev.title}</div>
                  <div style={{
                    fontSize: 11, color: TEXT2,
                    background: CARD2, border: `1px solid ${BORDER}`,
                    padding: "3px 10px", borderRadius: 999, flexShrink: 0,
                  }}>{ev.rsvp} RSVPs</div>
                </div>
              ))}
            </div>
          </div>

          {/* Reward callout */}
          <div style={{
            background: `linear-gradient(135deg, #0d3024, ${CARD})`,
            border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: "24px 24px",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 22, marginBottom: 10 }}>◈</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 }}>A reward is live</div>
              <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.6 }}>
                Your current campaign is bringing regulars back to the bar.
              </div>
            </div>
            <button style={{
              marginTop: 18, padding: "9px 16px",
              background: EMERALD, color: "#fff", border: "none",
              borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>View reward →</button>
          </div>
        </div>
      </main>
    </div>
  );
}
