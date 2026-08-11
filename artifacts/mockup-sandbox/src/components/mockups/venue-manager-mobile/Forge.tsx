/**
 * Terminal — Brutalist / data-terminal aesthetic.
 * Absolute black. One electric accent: #C8FF00 (chartreuse).
 * Monospaced stat numbers. Sharp corners. Grid-ruled layout.
 * Inspired by Bloomberg Terminal, Teenage Engineering, and Virgil Abloh's OFF-WHITE.
 * The most distinctive design direction of the three.
 */

const LIME = "#C8FF00";
const BG = "#060606";

function Divider() {
  return <div style={{ height: 1, background: "rgba(200,255,0,0.12)", marginInline: 0 }} />;
}

export default function Forge() {
  return (
    <div style={{ width: 375, height: 812, background: BG, fontFamily: "'Courier New', 'Courier', monospace", overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>

      {/* Subtle grid lines */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.04 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: i * 40, height: 1, background: LIME }} />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: i * 42, width: 1, background: LIME }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Status bar — monospaced */}
        <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", paddingInline: 18, flexShrink: 0, borderBottom: `1px solid rgba(200,255,0,0.12)` }}>
          <span style={{ color: LIME, fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>09:41</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: "rgba(200,255,0,0.4)", fontSize: 11, letterSpacing: 1 }}>▲▲▲▲</span>
            <span style={{ color: "rgba(200,255,0,0.5)", fontSize: 11 }}>WiFi</span>
            <span style={{ color: LIME, fontSize: 11 }}>████</span>
          </div>
        </div>

        {/* ── Header block ── */}
        <div style={{ paddingInline: 18, paddingTop: 16, paddingBottom: 16, borderBottom: `1px solid rgba(200,255,0,0.12)`, flexShrink: 0 }}>
          <div style={{ color: "rgba(200,255,0,0.45)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>// VENUE_MANAGER.APP</div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -0.5, color: "#fff", lineHeight: 1.05, textTransform: "uppercase" }}>THE GRAND<br />TERRACE</div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ background: LIME, color: BG, fontSize: 9, fontWeight: 900, letterSpacing: 1.5, paddingInline: 8, paddingBlock: 3, textTransform: "uppercase" }}>
              ✓ APPROVED
            </div>
            <span style={{ color: "rgba(200,255,0,0.3)", fontSize: 10, letterSpacing: 1 }}>CHELSEA · LONDON</span>
          </div>
        </div>

        {/* ── Stats: big monospaced numbers ── */}
        <div style={{ display: "flex", borderBottom: `1px solid rgba(200,255,0,0.12)`, flexShrink: 0 }}>
          {[
            { value: "1284", label: "CHECK-INS", meta: "30D" },
            { value: "003", label: "EVENTS", meta: "LIVE" },
            { value: "001", label: "REWARDS", meta: "ACTIVE" },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: "14px 14px 12px", borderRight: i < 2 ? `1px solid rgba(200,255,0,0.12)` : "none" }}>
              <div style={{ color: LIME, fontSize: 28, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>{s.value}</div>
              <div style={{ marginTop: 5, color: "rgba(255,255,255,0.35)", fontSize: 9, letterSpacing: 1.5 }}>{s.label}</div>
              <div style={{ color: "rgba(200,255,0,0.5)", fontSize: 8, letterSpacing: 1, marginTop: 2 }}>[{s.meta}]</div>
            </div>
          ))}
        </div>

        {/* ── Navigation: terminal-list style ── */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          {/* Section: MANAGE */}
          <div style={{ paddingInline: 18, paddingTop: 14, paddingBottom: 4 }}>
            <div style={{ color: "rgba(200,255,0,0.35)", fontSize: 9, letterSpacing: 3, marginBottom: 10 }}>// MANAGE</div>
          </div>

          {[
            { cmd: "guests", label: "GUESTS", desc: "WHO IS RETURNING" },
            { cmd: "events", label: "EVENTS", desc: "UPCOMING + PAST" },
            { cmd: "rewards", label: "REWARDS", desc: "ACTIVE CAMPAIGNS" },
            { cmd: "announce", label: "ANNOUNCE", desc: "PUSH TO GUESTS" },
            { cmd: "profile", label: "PROFILE", desc: "EDIT VENUE DATA" },
          ].map((item, i) => (
            <div key={item.cmd}>
              {i > 0 && <Divider />}
              <div style={{ paddingInline: 18, paddingBlock: 13, display: "flex", alignItems: "center", gap: 0 }}>
                <span style={{ color: "rgba(200,255,0,0.35)", fontSize: 11, letterSpacing: 0.5, width: 20, flexShrink: 0 }}>›</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontSize: 15, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" }}>{item.label}</div>
                  <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, letterSpacing: 1.5, marginTop: 2 }}>{item.desc}</div>
                </div>
                <span style={{ color: LIME, fontSize: 14, letterSpacing: -0.5 }}>⟶</span>
              </div>
            </div>
          ))}

          {/* Section: TOOLS */}
          <div style={{ marginTop: 4 }}>
            <div style={{ height: 1, background: `rgba(200,255,0,0.2)` }} />
            <div style={{ paddingInline: 18, paddingTop: 14, paddingBottom: 4 }}>
              <div style={{ color: "rgba(200,255,0,0.35)", fontSize: 9, letterSpacing: 3, marginBottom: 10 }}>// TOOLS</div>
            </div>
            {[
              { cmd: "staff", label: "INVITE STAFF", desc: "GENERATE ONE-TIME LINK" },
              { cmd: "qr", label: "QR KIT", desc: "EXPORT CHECK-IN CODE" },
              { cmd: "page", label: "VIEW PAGE", desc: "GUEST-FACING PROFILE" },
            ].map((item, i) => (
              <div key={item.cmd}>
                {i > 0 && <Divider />}
                <div style={{ paddingInline: 18, paddingBlock: 12, display: "flex", alignItems: "center", gap: 0 }}>
                  <span style={{ color: "rgba(200,255,0,0.35)", fontSize: 11, letterSpacing: 0.5, width: 20, flexShrink: 0 }}>›</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase" }}>{item.label}</div>
                    <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, letterSpacing: 1.5, marginTop: 2 }}>{item.desc}</div>
                  </div>
                  <span style={{ color: LIME, fontSize: 14 }}>⟶</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom signature */}
          <div style={{ paddingInline: 18, paddingTop: 16, paddingBottom: 8 }}>
            <div style={{ color: "rgba(200,255,0,0.18)", fontSize: 9, letterSpacing: 2 }}>MET™ VENUE_OPS v2.1 — {new Date().toISOString().split("T")[0]}</div>
          </div>
        </div>

        {/* Home indicator */}
        <div style={{ paddingBottom: 8, display: "flex", justifyContent: "center", flexShrink: 0, borderTop: `1px solid rgba(200,255,0,0.08)` }}>
          <div style={{ width: 134, height: 5, marginTop: 8, background: "rgba(200,255,0,0.15)", borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
}
