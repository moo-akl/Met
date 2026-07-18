import React from "react";

const W = 1284;
const H = 2778;

const slide = (n: number) => {
  const params = new URLSearchParams(window.location.search);
  return parseInt(params.get("slide") ?? "1") === n;
};

function useSlide() {
  const params = new URLSearchParams(window.location.search);
  return parseInt(params.get("slide") ?? "1");
}

/* ─── shared tokens ─────────────────────────────────────────────── */
const GREEN   = "#22c55e";
const GOLD    = "#D4AF37";
const NAVY    = "#0a0f1e";
const CARD_BG = "rgba(255,255,255,0.06)";
const CARD_BORDER = "rgba(255,255,255,0.10)";

function Avatar({ size = 64, color = "#6366f1", seed = 0 }: { size?: number; color?: string; seed?: number }) {
  const colors = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444"];
  const bg = colors[seed % colors.length];
  const initials = ["AJ","ML","SB","TK","NR","EP"][seed % 6];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${bg}, ${bg}88)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      boxShadow: `0 0 0 2px rgba(255,255,255,0.15)`,
      fontSize: size * 0.3, fontWeight: 700, color: "#fff",
      fontFamily: "system-ui, -apple-system",
    }}>
      {initials}
    </div>
  );
}

function PioneerStar() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "rgba(212,175,55,0.20)", border: "1px solid rgba(212,175,55,0.50)",
      borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700,
      color: GOLD, letterSpacing: 0.8, fontFamily: "system-ui",
    }}>★ PIONEER</span>
  );
}

function TrustedBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "rgba(21,128,61,0.20)", border: "1px solid rgba(34,197,94,0.40)",
      borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700,
      color: GREEN, letterSpacing: 0.8, fontFamily: "system-ui",
    }}>✓ TRUSTED</span>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SLIDE 1 — Discovery
───────────────────────────────────────────────────────────────── */
function Slide1() {
  const encounters = [
    { seed: 0, name: "Alex J.", dist: "12m away", time: "Just now", met: 3 },
    { seed: 2, name: "Sophia B.", dist: "28m away", time: "2 min ago", met: 1 },
    { seed: 4, name: "Noah R.", dist: "45m away", time: "5 min ago", met: 7 },
  ];

  return (
    <div style={{
      width: W, height: H, overflow: "hidden", position: "relative",
      background: `radial-gradient(ellipse 90% 60% at 50% 20%, #1a2440 0%, ${NAVY} 60%)`,
      display: "flex", flexDirection: "column",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {/* glow bg */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 70% 40% at 50% 30%, rgba(34,197,94,0.12) 0%, transparent 70%)`,
      }} />

      {/* status bar */}
      <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 52px 0 52px" }}>
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 22, fontWeight: 600 }}>9:41</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <svg width="20" height="14" viewBox="0 0 20 14"><rect x="0" y="4" width="3" height="10" rx="1" fill="white"/><rect x="4.5" y="3" width="3" height="11" rx="1" fill="white"/><rect x="9" y="1" width="3" height="13" rx="1" fill="white"/><rect x="13.5" y="0" width="3" height="14" rx="1" fill="white"/></svg>
          <svg width="22" height="16" viewBox="0 0 22 16"><path d="M11 4C13.8 4 16.3 5.2 18 7.1L20 5.1C17.7 2.8 14.5 1.3 11 1.3C7.5 1.3 4.3 2.8 2 5.1L4 7.1C5.7 5.2 8.2 4 11 4Z" fill="white"/><path d="M11 7.5C12.9 7.5 14.6 8.3 15.8 9.5L17.8 7.5C16 5.7 13.6 4.7 11 4.7C8.4 4.7 6 5.7 4.2 7.5L6.2 9.5C7.4 8.3 9.1 7.5 11 7.5Z" fill="white"/><circle cx="11" cy="13" r="2.2" fill="white"/></svg>
          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
            <div style={{ width: 7, height: 12, border: "1.5px solid white", borderRadius: 2, position: "relative" }}>
              <div style={{ position: "absolute", top: 1.5, left: 1.5, right: 1.5, bottom: 1.5, background: "white", borderRadius: 1 }} />
            </div>
          </div>
        </div>
      </div>

      {/* nav bar */}
      <div style={{ padding: "24px 52px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>Encounters</div>
          <div style={{ fontSize: 22, color: "rgba(255,255,255,0.50)", marginTop: 4 }}>People nearby today</div>
        </div>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(34,197,94,0.15)", border: "1.5px solid rgba(34,197,94,0.30)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke={GREEN} strokeWidth={2}>
            <circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity={0.4}/><circle cx="12" cy="12" r="11" opacity={0.15}/>
          </svg>
        </div>
      </div>

      {/* live pill */}
      <div style={{ padding: "0 52px 32px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.35)",
          borderRadius: 999, padding: "8px 20px",
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
          <span style={{ color: GREEN, fontSize: 20, fontWeight: 600 }}>3 encounters nearby</span>
        </div>
      </div>

      {/* encounter cards */}
      <div style={{ padding: "0 40px", display: "flex", flexDirection: "column", gap: 22 }}>
        {encounters.map((e, i) => (
          <div key={i} style={{
            background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
            borderRadius: 24, padding: "32px 36px",
            display: "flex", alignItems: "center", gap: 28,
            backdropFilter: "blur(20px)",
          }}>
            <Avatar size={90} seed={e.seed} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 30, fontWeight: 700, color: "#fff" }}>{e.name}</span>
                {i === 0 && <PioneerStar />}
                {i === 1 && <TrustedBadge />}
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                <span style={{ fontSize: 20, color: "rgba(255,255,255,0.50)" }}>📍 {e.dist}</span>
                <span style={{ fontSize: 20, color: "rgba(255,255,255,0.35)" }}>{e.time}</span>
              </div>
              <div style={{ marginTop: 10, fontSize: 19, color: "rgba(255,255,255,0.40)" }}>
                Met {e.met}× · Tap to reveal
              </div>
            </div>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: GREEN, display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        ))}
      </div>

      {/* phone bottom chrome */}
      <div style={{ flex: 1 }} />

      {/* hero copy */}
      <div style={{ padding: "0 52px 80px", textAlign: "center" }}>
        <div style={{
          display: "inline-block",
          background: "linear-gradient(90deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))",
          border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: 16, padding: "16px 36px", marginBottom: 36,
        }}>
          <span style={{ fontSize: 20, color: GREEN, fontWeight: 600 }}>Proximity-based social</span>
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: -2, marginBottom: 28 }}>
          Discover who you've<br />just crossed paths with
        </div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
          Met finds the people nearby.<br />You decide when to connect.
        </div>
      </div>

      {/* home indicator */}
      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 30 }}>
        <div style={{ width: 140, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.25)" }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SLIDE 2 — Mutual reveal / connections
───────────────────────────────────────────────────────────────── */
function Slide2() {
  const connections = [
    { seed: 0, name: "Alex Johnson", handle: "@alexj", msg: "Great meeting you at the café!", time: "2m", unread: 2, pioneer: true },
    { seed: 2, name: "Sophia Blake", handle: "@sblake", msg: "Are you heading downtown today?", time: "18m", unread: 0, trusted: true },
    { seed: 4, name: "Noah Rivera", handle: "@noahr", msg: "That coffee spot was amazing 😄", time: "1h", unread: 0 },
    { seed: 1, name: "Maya Lim", handle: "@mayalim", msg: "Looking forward to seeing you!", time: "3h", unread: 1 },
  ];

  return (
    <div style={{
      width: W, height: H, overflow: "hidden", position: "relative",
      background: `radial-gradient(ellipse 100% 50% at 50% -10%, #112240 0%, ${NAVY} 55%)`,
      display: "flex", flexDirection: "column",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 60% 30% at 70% 60%, rgba(99,102,241,0.08) 0%, transparent 70%)`,
      }} />

      {/* status bar */}
      <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 52px" }}>
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 22, fontWeight: 600 }}>9:41</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <svg width="20" height="14" viewBox="0 0 20 14"><rect x="0" y="4" width="3" height="10" rx="1" fill="white"/><rect x="4.5" y="3" width="3" height="11" rx="1" fill="white"/><rect x="9" y="1" width="3" height="13" rx="1" fill="white"/><rect x="13.5" y="0" width="3" height="14" rx="1" fill="white"/></svg>
          <div style={{ width: 7, height: 12, border: "1.5px solid white", borderRadius: 2, position: "relative" }}>
            <div style={{ position: "absolute", top: 1.5, left: 1.5, right: 1.5, bottom: 1.5, background: "white", borderRadius: 1 }} />
          </div>
        </div>
      </div>

      {/* header */}
      <div style={{ padding: "24px 52px 16px" }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: -1 }}>Connections</div>
        <div style={{ fontSize: 22, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>People who mutually revealed</div>
      </div>

      {/* reveal illustration */}
      <div style={{ padding: "24px 52px 36px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.20)",
          borderRadius: 24, padding: "28px 40px",
          display: "flex", alignItems: "center", gap: 24, width: "100%",
        }}>
          <Avatar size={72} seed={0} />
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{
              fontSize: 16, color: GREEN, fontWeight: 700, marginBottom: 8, letterSpacing: 1,
            }}>BOTH SAID YES ✓</div>
            <div style={{
              width: "100%", height: 3, background: `linear-gradient(90deg, #6366f1, ${GREEN})`,
              borderRadius: 2,
            }} />
          </div>
          <Avatar size={72} seed={2} />
        </div>
      </div>

      {/* connection list */}
      <div style={{ padding: "0 40px", display: "flex", flexDirection: "column", gap: 4 }}>
        {connections.map((c, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 24,
            padding: "24px 28px", borderRadius: 20,
            background: i === 0 ? "rgba(255,255,255,0.07)" : "transparent",
            borderBottom: i < connections.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}>
            <Avatar size={76} seed={c.seed} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 27, fontWeight: 700, color: "#fff" }}>{c.name}</span>
                {c.pioneer && <PioneerStar />}
                {c.trusted && <TrustedBadge />}
              </div>
              <div style={{
                fontSize: 21, color: c.unread > 0 ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.40)",
                fontWeight: c.unread > 0 ? 500 : 400,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{c.msg}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <span style={{ fontSize: 18, color: "rgba(255,255,255,0.35)" }}>{c.time}</span>
              {c.unread > 0 && (
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", background: GREEN,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: "#fff",
                }}>{c.unread}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* hero copy */}
      <div style={{ padding: "0 52px 80px", textAlign: "center" }}>
        <div style={{
          display: "inline-block",
          background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.30)",
          borderRadius: 16, padding: "16px 36px", marginBottom: 36,
        }}>
          <span style={{ fontSize: 20, color: "#818cf8", fontWeight: 600 }}>Mutual consent required</span>
        </div>
        <div style={{ fontSize: 68, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: -2, marginBottom: 28 }}>
          Connect only when<br />you're both ready
        </div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
          No one-sided follows. Reveal your identity only when you both choose to.
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 30 }}>
        <div style={{ width: 140, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.25)" }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SLIDE 3 — Pioneer / reputation
───────────────────────────────────────────────────────────────── */
function Slide3() {
  const leaderboard = [
    { seed: 3, name: "Tyler K.", score: 840, rank: 1 },
    { seed: 5, name: "Emma P.", score: 720, rank: 2 },
    { seed: 1, name: "You", score: 590, rank: 3, isYou: true },
    { seed: 2, name: "Sophia B.", score: 440, rank: 4 },
  ];

  return (
    <div style={{
      width: W, height: H, overflow: "hidden", position: "relative",
      background: `radial-gradient(ellipse 100% 55% at 50% -5%, #1c150a 0%, ${NAVY} 60%)`,
      display: "flex", flexDirection: "column",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 70% 40% at 50% 25%, rgba(212,175,55,0.12) 0%, transparent 65%)`,
      }} />

      {/* status bar */}
      <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 52px" }}>
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 22, fontWeight: 600 }}>9:41</span>
        <div style={{ width: 7, height: 12, border: "1.5px solid white", borderRadius: 2, position: "relative" }}>
          <div style={{ position: "absolute", top: 1.5, left: 1.5, right: 1.5, bottom: 1.5, background: "white", borderRadius: 1 }} />
        </div>
      </div>

      {/* pioneer badge hero */}
      <div style={{ padding: "40px 52px 20px", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 12,
          background: "rgba(212,175,55,0.12)", border: "1.5px solid rgba(212,175,55,0.40)",
          borderRadius: 999, padding: "14px 36px", marginBottom: 32,
        }}>
          <span style={{ fontSize: 30 }}>★</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: GOLD, letterSpacing: 2 }}>MET PIONEER</span>
          <span style={{ fontSize: 30 }}>★</span>
        </div>

        <div style={{
          width: 180, height: 180, borderRadius: "50%", margin: "0 auto 28px",
          background: `radial-gradient(circle, rgba(212,175,55,0.25) 0%, rgba(212,175,55,0.06) 70%)`,
          border: `2px solid rgba(212,175,55,0.35)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 60px rgba(212,175,55,0.20)`,
        }}>
          <Avatar size={140} seed={0} />
        </div>
        <div style={{ fontSize: 38, fontWeight: 800, color: "#fff", marginBottom: 10 }}>Alex Johnson</div>
        <div style={{ fontSize: 22, color: "rgba(255,255,255,0.45)" }}>Pioneer #247 of 1,000</div>
      </div>

      {/* stats row */}
      <div style={{ padding: "24px 52px", display: "flex", gap: 20 }}>
        {[
          { label: "Trust Score", value: "590", icon: "🛡️" },
          { label: "Encounters", value: "48", icon: "⚡" },
          { label: "Connections", value: "12", icon: "🔗" },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, background: CARD_BG, border: `1px solid ${CARD_BORDER}`,
            borderRadius: 20, padding: "28px 20px", textAlign: "center",
          }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
            <div style={{ fontSize: 38, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.40)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* leaderboard */}
      <div style={{ padding: "16px 40px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.50)", padding: "0 12px 8px", letterSpacing: 0.5 }}>
          PIONEER LEADERBOARD
        </div>
        {leaderboard.map((l, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 24, padding: "22px 24px",
            background: l.isYou ? "rgba(212,175,55,0.08)" : "rgba(255,255,255,0.04)",
            border: l.isYou ? "1px solid rgba(212,175,55,0.25)" : "1px solid rgba(255,255,255,0.06)",
            borderRadius: 18,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              background: l.rank <= 2 ? `rgba(212,175,55,0.20)` : "rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800,
              color: l.rank <= 2 ? GOLD : "rgba(255,255,255,0.40)",
            }}>
              {l.rank <= 2 ? ["🥇","🥈"][l.rank - 1] : `#${l.rank}`}
            </div>
            <Avatar size={60} seed={l.seed} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 26, fontWeight: l.isYou ? 800 : 600, color: l.isYou ? GOLD : "#fff" }}>
                {l.name}
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: l.isYou ? GOLD : "rgba(255,255,255,0.60)" }}>
              {l.score}
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* hero copy */}
      <div style={{ padding: "0 52px 80px", textAlign: "center" }}>
        <div style={{
          display: "inline-block",
          background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.30)",
          borderRadius: 16, padding: "16px 36px", marginBottom: 36,
        }}>
          <span style={{ fontSize: 20, color: GOLD, fontWeight: 600 }}>First 1,000 only</span>
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: -2, marginBottom: 28 }}>
          Be a Pioneer.<br />Build your reputation.
        </div>
        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
          Earn trust. Rise on the leaderboard.<br />Join the founding community.
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 30 }}>
        <div style={{ width: 140, height: 6, borderRadius: 3, background: "rgba(255,255,255,0.25)" }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Root — pick slide from ?slide=N
───────────────────────────────────────────────────────────────── */
export default function Screenshots() {
  const n = useSlide();
  return (
    <div style={{ margin: 0, padding: 0, background: "#000", minHeight: "100vh", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      {n === 1 && <Slide1 />}
      {n === 2 && <Slide2 />}
      {n === 3 && <Slide3 />}
    </div>
  );
}
