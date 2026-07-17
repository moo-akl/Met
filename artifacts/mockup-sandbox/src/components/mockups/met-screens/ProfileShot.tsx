export function ProfileShot() {
  const bg = "#122B1A";
  const accent = "#3AE06A";
  const gold = "#D4AF37";
  const textPrimary = "#EEF7EF";
  const textMuted = "rgba(210,235,213,0.55)";
  const cardBg = "rgba(40,70,48,0.7)";

  const stars = 4.9;

  return (
    <div style={{ width: 390, height: 844, background: bg, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Status bar */}
      <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <span style={{ fontSize: 12, color: textMuted, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>09:41</span>
        <span style={{ fontSize: 11, color: textMuted }}>●●●● WiFi 100%</span>
      </div>

      {/* Header */}
      <div style={{ padding: "2px 20px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: textPrimary, letterSpacing: -0.5 }}>Profile</span>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: cardBg, border: `1px solid rgba(58,224,106,0.18)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: textMuted, fontSize: 16 }}>✎</span>
        </div>
      </div>

      {/* Pioneer card */}
      <div style={{ margin: "0 14px 14px", borderRadius: 18, background: `rgba(212,175,55,0.06)`, border: `1.5px solid rgba(212,175,55,0.38)`, padding: "18px 18px 14px", position: "relative", overflow: "hidden" }}>
        {/* Shimmer strip */}
        <div style={{ position: "absolute", top: 0, left: "-20%", width: "40%", height: "100%", background: "linear-gradient(105deg, transparent 30%, rgba(212,175,55,0.08) 50%, transparent 70%)", pointerEvents: "none" }}/>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 74, height: 74, borderRadius: 18, background: "rgba(58,224,106,0.12)", border: `2px solid rgba(212,175,55,0.5)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: accent, fontSize: 28, fontWeight: 700 }}>JL</span>
            </div>
            {/* Pioneer crown overlay */}
            <div style={{ position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: 6, background: "rgba(212,175,55,0.2)", border: `1px solid rgba(212,175,55,0.6)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12 }}>👑</span>
            </div>
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: textPrimary, marginBottom: 2 }}>Jordan L.</div>
            <div style={{ fontSize: 12, color: textMuted, marginBottom: 10 }}>New York · Member since 2024</div>

            {/* Pioneer badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(212,175,55,0.12)", border: `1px solid rgba(212,175,55,0.45)`, borderRadius: 20, padding: "4px 10px", marginBottom: 8 }}>
              <span style={{ fontSize: 11 }}>★</span>
              <span style={{ color: gold, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, fontFamily: "'SF Mono', monospace" }}>MET PIONEER</span>
            </div>

            {/* Stars */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", gap: 2 }}>
                {[1,2,3,4,5].map(i => (
                  <span key={i} style={{ fontSize: 13, color: i <= Math.floor(stars) ? gold : "rgba(212,175,55,0.3)" }}>★</span>
                ))}
              </div>
              <span style={{ color: gold, fontSize: 12, fontWeight: 700 }}>{stars}</span>
              <span style={{ color: textMuted, fontSize: 11 }}>(48 reviews)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tags row */}
      <div style={{ padding: "0 14px 14px", display: "flex", gap: 8 }}>
        {[
          { label: "Kind", emoji: "💚", color: "rgba(58,224,106,0.15)", border: "rgba(58,224,106,0.35)", text: accent },
          { label: "Reliable", emoji: "🤝", color: "rgba(58,224,106,0.1)", border: "rgba(58,224,106,0.25)", text: accent },
          { label: "Trusted", emoji: "🛡", color: "rgba(40,120,80,0.15)", border: "rgba(40,180,100,0.3)", text: "#60D996" },
        ].map((tag) => (
          <div key={tag.label} style={{ flex: 1, background: tag.color, border: `1px solid ${tag.border}`, borderRadius: 10, padding: "8px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 18 }}>{tag.emoji}</span>
            <span style={{ color: tag.text, fontSize: 11, fontWeight: 600 }}>{tag.label}</span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ padding: "0 14px 14px", display: "flex", gap: 8 }}>
        {[
          { label: "Encounters", value: "132" },
          { label: "Connections", value: "28" },
          { label: "Reveals", value: "19" },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, background: cardBg, border: `1px solid rgba(58,224,106,0.12)`, borderRadius: 12, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ color: accent, fontSize: 20, fontWeight: 700, fontFamily: "'SF Mono', monospace" }}>{s.value}</span>
            <span style={{ color: textMuted, fontSize: 10, fontFamily: "'SF Mono', monospace", letterSpacing: 0.5 }}>{s.label.toUpperCase()}</span>
          </div>
        ))}
      </div>

      {/* Trophies section */}
      <div style={{ padding: "0 14px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ color: textMuted, fontSize: 10, letterSpacing: 2, fontFamily: "'SF Mono', monospace" }}>TROPHIES</span>
          <span style={{ color: accent, fontSize: 10, fontFamily: "'SF Mono', monospace" }}>3 earned</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { icon: "👑", label: "Monthly Crown", sub: "Central Park", color: "rgba(212,175,55,0.15)", border: "rgba(212,175,55,0.4)" },
            { icon: "🥇", label: "First Reveal", sub: "Early adopter", color: "rgba(58,224,106,0.1)", border: "rgba(58,224,106,0.25)" },
            { icon: "⚡", label: "Fast Connect", sub: "Under 60 sec", color: "rgba(58,224,106,0.08)", border: "rgba(58,224,106,0.2)" },
          ].map((t) => (
            <div key={t.label} style={{ flex: 1, background: t.color, border: `1px solid ${t.border}`, borderRadius: 12, padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 22 }}>{t.icon}</span>
              <span style={{ color: textPrimary, fontSize: 10, fontWeight: 600, textAlign: "center" }}>{t.label}</span>
              <span style={{ color: textMuted, fontSize: 9, textAlign: "center" }}>{t.sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trust score bar */}
      <div style={{ margin: "0 14px 10px", background: cardBg, border: `1px solid rgba(58,224,106,0.12)`, borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ color: textMuted, fontSize: 10, letterSpacing: 2, fontFamily: "'SF Mono', monospace" }}>TRUST SCORE</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ background: "rgba(58,224,106,0.15)", border: `1px solid rgba(58,224,106,0.4)`, borderRadius: 6, padding: "2px 8px" }}>
              <span style={{ color: accent, fontSize: 11, fontWeight: 700 }}>TRUSTED</span>
            </div>
            <span style={{ color: accent, fontSize: 14, fontWeight: 700, fontFamily: "'SF Mono', monospace" }}>175</span>
          </div>
        </div>
        <div style={{ height: 4, background: "rgba(58,224,106,0.1)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: "87%", height: "100%", background: `linear-gradient(90deg, rgba(58,224,106,0.5), ${accent})`, borderRadius: 2 }}/>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
          <span style={{ color: textMuted, fontSize: 9, fontFamily: "'SF Mono', monospace" }}>COMMUNITY</span>
          <span style={{ color: accent, fontSize: 9, fontFamily: "'SF Mono', monospace" }}>98% positive</span>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ marginTop: "auto", height: 76, background: "rgba(12,26,18,0.96)", borderTop: `1px solid rgba(58,224,106,0.12)`, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 4px 8px" }}>
        {[
          { glyph: "⌂", label: "HOME", active: false },
          { glyph: "◈", label: "RECENT", active: false },
          { glyph: "◉", label: "MAP", active: false },
          { glyph: "⬡", label: "NETWORK", active: false },
          { glyph: "○", label: "PROFILE", active: true },
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
