// Indigo — Dense modern SaaS
// Slate dark with electric indigo accent. High-information density.
// Feels like Stripe Dashboard or Linear for venue operations.

const BG = "#0F172A";
const SURFACE = "#1E293B";
const SURFACE2 = "#162032";
const SURFACE3 = "#243044";
const BORDER = "rgba(148,163,184,0.1)";
const BORDER2 = "rgba(148,163,184,0.06)";
const INDIGO = "#818CF8";
const INDIGO_DIM = "rgba(129,140,248,0.12)";
const INDIGO_GLOW = "rgba(129,140,248,0.08)";
const TEAL = "#2DD4BF";
const AMBER = "#FBBF24";
const TEXT = "#F1F5F9";
const TEXT2 = "#94A3B8";
const TEXT3 = "#475569";
const GREEN = "#34D399";

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

const kpis = [
  { label: "Check-ins", value: "1,284", sub: "this month", delta: "+14%", up: true, accent: INDIGO },
  { label: "QR verified", value: "34", sub: "today", delta: "+8", up: true, accent: TEAL },
  { label: "Active reward", value: "1", sub: "campaign live", delta: "", up: true, accent: AMBER },
  { label: "Avg visit / week", value: "3.2", sub: "per regular", delta: "+0.4", up: true, accent: GREEN },
];

const guests = [
  { name: "Marlowe C.", visits: 18, time: "3m ago", verified: true },
  { name: "Petra V.", visits: 14, time: "11m ago", verified: true },
  { name: "James T.", visits: 11, time: "22m ago", verified: true },
  { name: "Suki R.", visits: 9, time: "41m ago", verified: false },
  { name: "Omar B.", visits: 7, time: "1h ago", verified: false },
];

const events = [
  { date: "Aug 14", title: "Rooftop Sessions", rsvp: 47, status: "confirmed" },
  { date: "Aug 19", title: "Wine & Jazz Night", rsvp: 31, status: "confirmed" },
  { date: "Aug 24", title: "Members Evening", rsvp: 22, status: "draft" },
];

const spark = [22, 18, 34, 28, 41, 38, 55, 47, 62, 58, 71, 83];
const sparkMax = Math.max(...spark);

export function Indigo() {
  return (
    <div style={{
      fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
      display: "flex", height: "100vh", width: "100%",
      background: BG, color: TEXT, overflow: "hidden",
      fontSize: 13,
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 200,
        background: SURFACE2,
        borderRight: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column",
        padding: "24px 0",
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "0 18px 24px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50% 50% 42% 50%",
            background: INDIGO, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontStyle: "italic", fontWeight: 800, color: "#fff",
          }}>m</div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.4, color: TEXT }}>
            met <span style={{ color: INDIGO, fontStyle: "italic" }}>business</span>
          </span>
        </div>

        {/* Venue chip */}
        <div style={{
          margin: "0 12px 20px",
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 8, padding: "8px 10px",
        }}>
          <div style={{ fontSize: 10, color: TEXT3, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 }}>venue</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>The Grand Terrace</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, color: INDIGO,
              background: INDIGO_DIM, padding: "1px 6px", borderRadius: 999,
            }}>OWNER</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "4px 8px" }}>
          {navItems.map(item => (
            <button key={item.label} style={{
              display: "flex", alignItems: "center", gap: 8,
              width: "100%", padding: "8px 10px",
              borderRadius: 6, border: "none", cursor: "pointer",
              background: item.active ? INDIGO_DIM : "transparent",
              color: item.active ? INDIGO : TEXT2,
              fontSize: 12, fontWeight: item.active ? 600 : 400,
              textAlign: "left", marginBottom: 1,
            }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{
          margin: "16px 12px 0", paddingTop: 16,
          borderTop: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: INDIGO_DIM, border: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: INDIGO, flexShrink: 0,
          }}>S</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: TEXT }}>Sarah M.</div>
            <div style={{ fontSize: 10, color: TEXT3 }}>owner</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* Header bar */}
        <header style={{
          padding: "20px 28px 16px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{
              fontSize: 9, color: TEXT3, fontWeight: 600, letterSpacing: 1.4,
              textTransform: "uppercase", marginBottom: 4,
            }}>THE GRAND TERRACE · CHELSEA</div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: -0.6, color: TEXT }}>
              Overview
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{
              padding: "6px 12px", background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 6, fontSize: 11, fontWeight: 600, color: TEXT2, cursor: "pointer",
            }}>This month ▾</button>
            <button style={{
              padding: "6px 12px", background: INDIGO, border: "none",
              borderRadius: 6, fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer",
            }}>+ New event</button>
          </div>
        </header>

        {/* KPI strip */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1, background: BORDER, borderBottom: `1px solid ${BORDER}`,
        }}>
          {kpis.map(kpi => (
            <div key={kpi.label} style={{
              background: SURFACE2, padding: "16px 20px",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <div style={{ fontSize: 10, color: TEXT3, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>
                {kpi.label}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, color: kpi.accent, lineHeight: 1 }}>
                  {kpi.value}
                </span>
                {kpi.delta && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: kpi.up ? GREEN : "#F87171",
                    background: kpi.up ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
                    padding: "1px 5px", borderRadius: 4,
                  }}>{kpi.delta}</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: TEXT3 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Content grid */}
        <div style={{
          padding: "20px 28px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          flex: 1,
        }}>

          {/* Trend chart + events */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Monthly trend */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: "18px 20px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Check-in trend</span>
                <span style={{ fontSize: 10, color: TEXT3 }}>12 months</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 64 }}>
                {spark.map((v, i) => (
                  <div key={i} style={{
                    flex: 1,
                    height: `${(v / sparkMax) * 100}%`,
                    borderRadius: "3px 3px 1px 1px",
                    background: i === spark.length - 1
                      ? `linear-gradient(to top, ${INDIGO}, rgba(129,140,248,0.4))`
                      : `linear-gradient(to top, rgba(129,140,248,0.35), rgba(129,140,248,0.1))`,
                    minHeight: 4,
                  }} />
                ))}
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                marginTop: 6, fontSize: 9, color: TEXT3,
              }}>
                <span>Sep</span><span>Nov</span><span>Jan</span><span>Mar</span><span>May</span><span>Aug</span>
              </div>
            </div>

            {/* Events table */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 10, overflow: "hidden",
            }}>
              <div style={{
                padding: "14px 18px 12px",
                borderBottom: `1px solid ${BORDER}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>Upcoming events</span>
                <span style={{ fontSize: 11, color: INDIGO, cursor: "pointer" }}>View all →</span>
              </div>
              <div>
                {events.map((ev, i) => (
                  <div key={ev.title} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 18px",
                    borderBottom: i < events.length - 1 ? `1px solid ${BORDER2}` : "none",
                    cursor: "pointer",
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600, color: TEXT3,
                      fontVariantNumeric: "tabular-nums",
                      fontFamily: "'DM Mono', monospace",
                      flexShrink: 0, width: 42,
                    }}>{ev.date}</div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: TEXT }}>{ev.title}</div>
                    <div style={{ fontSize: 10, color: TEXT2, flexShrink: 0 }}>{ev.rsvp} RSVPs</div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                      color: ev.status === "confirmed" ? GREEN : AMBER,
                      background: ev.status === "confirmed" ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)",
                      flexShrink: 0,
                    }}>{ev.status.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* QR live feed */}
            <div style={{
              background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 10, overflow: "hidden",
            }}>
              <div style={{
                padding: "14px 18px 12px",
                borderBottom: `1px solid ${BORDER}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>QR scans today</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: TEAL,
                  background: "rgba(45,212,191,0.1)",
                  padding: "2px 8px", borderRadius: 999, letterSpacing: 0.5,
                }}>● LIVE</span>
              </div>
              <div>
                {guests.map((g, i) => (
                  <div key={g.name} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 16px",
                    borderBottom: i < guests.length - 1 ? `1px solid ${BORDER2}` : "none",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: INDIGO_DIM, border: `1px solid ${BORDER}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: INDIGO, flexShrink: 0,
                    }}>{g.name[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{g.name}</div>
                      <div style={{ fontSize: 10, color: TEXT3 }}>{g.visits} visits · {g.time}</div>
                    </div>
                    {g.verified && (
                      <div style={{
                        fontSize: 9, fontWeight: 700, color: TEAL,
                        background: "rgba(45,212,191,0.08)",
                        padding: "2px 6px", borderRadius: 4,
                      }}>✓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Reward */}
            <div style={{
              background: `linear-gradient(135deg, ${SURFACE3}, ${SURFACE})`,
              border: `1px solid ${BORDER}`,
              borderLeft: `3px solid ${INDIGO}`,
              borderRadius: 10, padding: "18px 18px",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: INDIGO,
                  letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6,
                }}>Active reward</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Summer loyalty campaign</div>
                <div style={{ fontSize: 11, color: TEXT2, marginTop: 4, lineHeight: 1.6 }}>
                  8 check-ins unlock a complimentary welcome drink.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["48 enrolled", "12 redeemed", "3 days left"].map(tag => (
                  <span key={tag} style={{
                    fontSize: 10, fontWeight: 600, color: TEXT2,
                    background: SURFACE3, border: `1px solid ${BORDER}`,
                    padding: "3px 9px", borderRadius: 6,
                  }}>{tag}</span>
                ))}
              </div>
              <button style={{
                padding: "8px 14px", background: INDIGO_DIM,
                border: `1px solid rgba(129,140,248,0.25)`,
                borderRadius: 6, fontSize: 11, fontWeight: 700, color: INDIGO,
                cursor: "pointer", textAlign: "left",
              }}>Manage reward →</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
