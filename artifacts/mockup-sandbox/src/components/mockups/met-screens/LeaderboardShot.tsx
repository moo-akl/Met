export function LeaderboardShot() {
  const bg = "#122B1A";
  const accent = "#3AE06A";
  const gold = "#D4AF37";
  const textPrimary = "#EEF7EF";
  const textMuted = "rgba(210,235,213,0.55)";
  const cardBg = "rgba(40,70,48,0.7)";

  const leaders = [
    { rank: 1, initials: "JL", name: "Jordan L.", score: 175, trophies: 3, crown: true, you: true },
    { rank: 2, initials: "AK", name: "Aisha K.", score: 142, trophies: 2, crown: false, you: false },
    { rank: 3, initials: "MT", name: "Marcus T.", score: 118, trophies: 1, crown: false, you: false },
    { rank: 4, initials: "SC", name: "Sofia C.", score: 95, trophies: 1, crown: false, you: false },
    { rank: 5, initials: "RN", name: "Ravi N.", score: 82, trophies: 0, crown: false, you: false },
    { rank: 6, initials: "EW", name: "Emma W.", score: 71, trophies: 0, crown: false, you: false },
  ];

  const trophyTypes = ["🥇", "🏅", "⚡"];

  return (
    <div style={{ width: 390, height: 844, background: bg, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Status bar */}
      <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <span style={{ fontSize: 12, color: textMuted, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>09:41</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: textMuted }}>●●●● WiFi 100%</span>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: "2px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: textPrimary, letterSpacing: -0.5 }}>Central Park</span>
          </div>
          <span style={{ fontSize: 11, color: textMuted, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>HUB LEADERBOARD · JULY 2026</span>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(212,175,55,0.12)", border: `1px solid rgba(212,175,55,0.35)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 20 }}>🏆</span>
        </div>
      </div>

      {/* Trophy summary */}
      <div style={{ margin: "0 14px 14px", background: `rgba(212,175,55,0.08)`, border: `1px solid rgba(212,175,55,0.22)`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: `rgba(212,175,55,0.15)`, border: `1.5px solid rgba(212,175,55,0.5)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 28 }}>👑</span>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
            <span style={{ color: gold, fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>MONTHLY CROWN</span>
          </div>
          <span style={{ color: textPrimary, fontSize: 15, fontWeight: 600 }}>Jordan L. </span>
          <span style={{ color: textMuted, fontSize: 13 }}>holds rank #1</span>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: accent }}/>
            <span style={{ color: accent, fontSize: 11, fontFamily: "'SF Mono', monospace" }}>22 checkins this month</span>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {leaders.map((l) => (
          <div key={l.rank} style={{ background: l.you ? "rgba(58,224,106,0.08)" : cardBg, borderRadius: 10, border: l.you ? `1.5px solid rgba(58,224,106,0.35)` : `1px solid rgba(58,224,106,0.1)`, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            {/* Rank */}
            <div style={{ width: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {l.rank === 1
                ? <span style={{ fontSize: 18 }}>👑</span>
                : <span style={{ fontSize: 14, fontWeight: 700, color: l.rank <= 3 ? gold : textMuted, fontFamily: "'SF Mono', monospace" }}>#{l.rank}</span>
              }
            </div>
            {/* Avatar */}
            <div style={{ width: 38, height: 38, borderRadius: 9, background: l.you ? "rgba(58,224,106,0.15)" : "rgba(40,70,48,0.9)", border: l.you ? `1.5px solid rgba(58,224,106,0.5)` : `1px solid rgba(58,224,106,0.2)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: l.you ? accent : textMuted, fontSize: 12, fontWeight: 700, fontFamily: "'SF Mono', monospace" }}>{l.initials}</span>
            </div>
            {/* Name + trophies */}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ color: textPrimary, fontSize: 14, fontWeight: l.you ? 700 : 500 }}>{l.name}</span>
                {l.you && <span style={{ fontSize: 9, color: accent, fontFamily: "'SF Mono', monospace", letterSpacing: 1, border: `1px solid rgba(58,224,106,0.3)`, borderRadius: 4, padding: "1px 5px" }}>YOU</span>}
                {l.crown && <span style={{ fontSize: 10, color: gold, fontFamily: "'SF Mono', monospace", letterSpacing: 0.5 }}>★ PIONEER</span>}
              </div>
              {l.trophies > 0 && (
                <div style={{ display: "flex", gap: 4 }}>
                  {Array.from({ length: l.trophies }).map((_, i) => (
                    <span key={i} style={{ fontSize: 12 }}>{trophyTypes[i % trophyTypes.length]}</span>
                  ))}
                </div>
              )}
            </div>
            {/* Score */}
            <div style={{ textAlign: "right" }}>
              <div style={{ color: l.you ? accent : textPrimary, fontSize: 16, fontWeight: 700, fontFamily: "'SF Mono', monospace" }}>{l.score}</div>
              <div style={{ color: textMuted, fontSize: 9, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>PTS</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ height: 76, background: "rgba(12,26,18,0.96)", borderTop: `1px solid rgba(58,224,106,0.12)`, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 4px 8px" }}>
        {[
          { glyph: "⌂", label: "HOME", active: false },
          { glyph: "◈", label: "RECENT", active: false },
          { glyph: "◉", label: "MAP", active: false },
          { glyph: "⬡", label: "NETWORK", active: true },
          { glyph: "○", label: "PROFILE", active: false },
        ].map((tab, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "6px 8px" }}>
            <span style={{ fontSize: 17, color: tab.active ? accent : "rgba(255,255,255,0.22)" }}>{tab.glyph}</span>
            <span style={{ fontSize: 8, letterSpacing: 1.2, fontFamily: "'SF Mono', monospace", color: tab.active ? accent : "rgba(255,255,255,0.22)" }}>{tab.label}</span>
            {tab.active && <div style={{ width: 16, height: 1.5, background: accent, boxShadow: `0 0 5px ${accent}` }}/>}
          </div>
        ))}
      </div>
    </div>
  );
}
