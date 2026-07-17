export function ChatShot() {
  const bg = "#122B1A";
  const accent = "#3AE06A";
  const gold = "#D4AF37";
  const textPrimary = "#EEF7EF";
  const textMuted = "rgba(210,235,213,0.55)";
  const cardBg = "rgba(40,70,48,0.7)";
  const msgBg = "rgba(30,58,38,0.9)";

  const messages = [
    { from: "them", text: "Hey! We both ended up at Central Park this morning 😄", time: "10:14", read: true },
    { from: "me", text: "I know! Saw you near the fountain. Small world 🌿", time: "10:15", read: true },
    { from: "them", text: "Are you usually in the area? I come here every Tuesday", time: "10:16", read: true },
    { from: "me", text: "Same! I run along the reservoir every week. We should link up sometime", time: "10:17", read: true },
    { from: "them", text: "Absolutely 🙌 I'm also at the High Line most Fridays if you're around", time: "10:18", read: true },
    { from: "me", text: "Perfect, I'll look out for you there 👋", time: "10:19", read: false },
  ];

  return (
    <div style={{ width: 390, height: 844, background: bg, fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Status bar */}
      <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <span style={{ fontSize: 12, color: textMuted, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>09:41</span>
        <span style={{ fontSize: 11, color: textMuted }}>●●●● WiFi 100%</span>
      </div>

      {/* Chat header */}
      <div style={{ padding: "4px 16px 12px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid rgba(58,224,106,0.1)` }}>
        {/* Back arrow */}
        <span style={{ color: accent, fontSize: 18, marginRight: 2 }}>‹</span>

        {/* Avatar with pioneer badge */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(212,175,55,0.12)", border: `1.5px solid rgba(212,175,55,0.45)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: gold, fontSize: 16, fontWeight: 700 }}>AK</span>
          </div>
          <div style={{ position: "absolute", bottom: -4, right: -4, width: 16, height: 16, borderRadius: 5, background: "rgba(212,175,55,0.2)", border: `1px solid rgba(212,175,55,0.6)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 9 }}>👑</span>
          </div>
        </div>

        {/* Name + badges */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
            <span style={{ color: textPrimary, fontSize: 15, fontWeight: 700 }}>Aisha K.</span>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(212,175,55,0.1)", border: `1px solid rgba(212,175,55,0.4)`, borderRadius: 10, padding: "1px 6px" }}>
              <span style={{ fontSize: 8 }}>★</span>
              <span style={{ color: gold, fontSize: 9, fontWeight: 700, fontFamily: "'SF Mono', monospace", letterSpacing: 1 }}>PIONEER</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Stars mini */}
            <div style={{ display: "flex", gap: 1 }}>
              {[1,2,3,4,5].map(i => (
                <span key={i} style={{ fontSize: 9, color: gold }}>★</span>
              ))}
            </div>
            <span style={{ color: gold, fontSize: 10, fontWeight: 600 }}>4.8</span>
            <span style={{ color: textMuted, fontSize: 10 }}>· Kind · Reliable</span>
          </div>
        </div>

        {/* More options */}
        <span style={{ color: textMuted, fontSize: 20, letterSpacing: 1 }}>···</span>
      </div>

      {/* Encounter context banner */}
      <div style={{ margin: "10px 14px 8px", background: "rgba(58,224,106,0.06)", border: `1px solid rgba(58,224,106,0.15)`, borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13 }}>📍</span>
        <div>
          <span style={{ color: textMuted, fontSize: 11 }}>Met at </span>
          <span style={{ color: textPrimary, fontSize: 11, fontWeight: 600 }}>Central Park</span>
          <span style={{ color: textMuted, fontSize: 11 }}> · Today 8:32 AM</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 14px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((msg, i) => {
          const isMe = msg.from === "me";
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "78%",
                background: isMe ? "rgba(58,224,106,0.14)" : msgBg,
                border: `1px solid ${isMe ? "rgba(58,224,106,0.28)" : "rgba(58,224,106,0.1)"}`,
                borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                padding: "9px 13px",
              }}>
                <p style={{ margin: 0, color: textPrimary, fontSize: 14, lineHeight: 1.45 }}>{msg.text}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                <span style={{ color: textMuted, fontSize: 10, fontFamily: "'SF Mono', monospace" }}>{msg.time}</span>
                {isMe && <span style={{ color: msg.read ? accent : textMuted, fontSize: 10 }}>✓✓</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reaction bar */}
      <div style={{ padding: "8px 14px 6px", display: "flex", gap: 8, overflowX: "auto" }}>
        {["🙌", "😄", "🌿", "👋", "💚", "🔥"].map((em) => (
          <div key={em} style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: cardBg, border: `1px solid rgba(58,224,106,0.15)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 18 }}>{em}</span>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div style={{ padding: "6px 14px 14px", display: "flex", alignItems: "center", gap: 10, borderTop: `1px solid rgba(58,224,106,0.1)` }}>
        <div style={{ flex: 1, background: cardBg, border: `1px solid rgba(58,224,106,0.18)`, borderRadius: 22, padding: "11px 16px", display: "flex", alignItems: "center" }}>
          <span style={{ color: textMuted, fontSize: 14 }}>Message Aisha…</span>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(58,224,106,0.15)", border: `1.5px solid rgba(58,224,106,0.4)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: accent, fontSize: 16 }}>↑</span>
        </div>
      </div>
    </div>
  );
}
