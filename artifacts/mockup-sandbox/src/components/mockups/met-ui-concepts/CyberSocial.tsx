import { Mail, Eye, EyeOff, Home, Clock, Users, User, MapPin, MessageCircle, ChevronRight, Crown } from "lucide-react";
import { useState } from "react";

const encounters = [
  { id: 1, initials: "AS", name: "Alex S.", time: "4m ago", distance: "12m away", status: "reveal_sent", ring: true },
  { id: 2, initials: "MK", name: "Maya K.", time: "11m ago", distance: "28m away", status: "none", ring: false },
  { id: 3, initials: "JL", name: "Jamie L.", time: "22m ago", distance: "45m away", status: "reveal_received", ring: true },
];

const connections = [
  { id: 1, initials: "NR", name: "Noah R.", preview: "You: Heading to the rooftop later?", time: "2m", unread: true },
  { id: 2, initials: "SC", name: "Sofia C.", preview: "See you at the gallery 🎨", time: "1h", unread: false },
  { id: 3, initials: "DM", name: "Dylan M.", preview: "You: Nice meeting you last night", time: "3h", unread: false },
  { id: 4, initials: "PP", name: "Priya P.", preview: "The after-party was insane 🔥", time: "1d", unread: true },
];

export default function CyberSocial() {
  const [beacon, setBeacon] = useState(true);

  return (
    <div
      className="w-[390px] min-h-[844px] flex flex-col relative overflow-hidden"
      style={{
        background: "#080B0F",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px)",
        }}
      />
      {/* Subtle radial glow top center */}
      <div
        className="pointer-events-none absolute z-0"
        style={{
          top: -80,
          left: "50%",
          transform: "translateX(-50%)",
          width: 320,
          height: 220,
          background: "radial-gradient(ellipse, rgba(245,158,11,0.10) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <div className="relative z-10 px-5 pt-12 pb-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <span
            style={{
              fontFamily: "'Space Grotesk', monospace",
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: 6,
              color: "#F59E0B",
              textTransform: "uppercase",
            }}
          >MET</span>
          <div className="flex items-center gap-2 mt-1">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: beacon ? "#22D3EE" : "#374151",
                boxShadow: beacon ? "0 0 6px #22D3EE" : "none",
                animation: beacon ? "pulse 1.5s infinite" : "none",
              }}
            />
            <span
              onClick={() => setBeacon(!beacon)}
              style={{
                fontFamily: "'Space Grotesk', monospace",
                fontSize: 9,
                letterSpacing: 3,
                color: beacon ? "#22D3EE" : "#4B5563",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >{beacon ? "BEACON · ACTIVE" : "BEACON · OFF"}</span>
          </div>
        </div>
        <div className="relative">
          <Mail size={20} color="#9CA3AF" />
          <div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "#EF4444", fontSize: 9, color: "#fff", fontWeight: 700 }}
          >3</div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto pb-20">

        {/* Recent Encounters */}
        <div className="px-5 pt-5">
          <div className="flex items-center gap-2 mb-3">
            <span style={{
              fontFamily: "'Space Grotesk', monospace",
              fontSize: 9,
              letterSpacing: 3,
              color: "#22D3EE",
              textTransform: "uppercase",
            }}>// RECENT ENCOUNTERS</span>
            <div style={{ flex: 1, height: 1, background: "rgba(34,211,238,0.15)" }} />
          </div>

          <div className="flex flex-col gap-2">
            {encounters.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl relative overflow-hidden"
                style={{
                  background: "#0F1318",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: e.ring ? "2px solid #F59E0B" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {e.ring && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.06) 0%, transparent 40%)" }} />
                )}
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "#1A1F2A",
                    border: e.ring ? "1.5px solid #F59E0B" : "1px solid rgba(255,255,255,0.1)",
                    boxShadow: e.ring ? "0 0 8px rgba(245,158,11,0.3)" : "none",
                    fontFamily: "'Space Grotesk', monospace",
                    fontWeight: 700,
                    fontSize: 13,
                    color: e.ring ? "#F59E0B" : "#9CA3AF",
                  }}
                >{e.initials}</div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: "#F9FAFB" }}>{e.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <MapPin size={10} color="#4B5563" />
                    <span style={{ fontSize: 11, color: "#4B5563" }}>{e.distance}</span>
                    <span style={{ fontSize: 11, color: "#374151" }}>·</span>
                    <span style={{ fontSize: 11, color: "#4B5563" }}>{e.time}</span>
                  </div>
                </div>

                {e.status === "reveal_sent" && (
                  <div className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ border: "1px solid #F59E0B", color: "#F59E0B", fontSize: 10, letterSpacing: 0.5 }}>
                    Sent
                  </div>
                )}
                {e.status === "reveal_received" && (
                  <div className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: "rgba(245,158,11,0.15)", border: "1px solid #F59E0B", color: "#F59E0B", fontSize: 10 }}>
                    Reveal ↑
                  </div>
                )}
                {e.status === "none" && (
                  <div className="px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer"
                    style={{ border: "1px solid rgba(255,255,255,0.15)", color: "#9CA3AF", fontSize: 10 }}>
                    Reveal
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Connections section */}
        <div className="px-5 pt-6">
          <div className="flex items-center gap-2 mb-3">
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{
              fontFamily: "'Space Grotesk', monospace",
              fontSize: 9,
              letterSpacing: 3,
              color: "#6B7280",
              textTransform: "uppercase",
            }}>— CONNECTIONS —</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3"
            style={{ background: "#0F1318", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span style={{ fontSize: 11, color: "#374151", letterSpacing: 2, fontFamily: "'Space Grotesk', monospace" }}>⌕</span>
            <span style={{ fontSize: 13, color: "#374151" }}>Search connections…</span>
          </div>

          <div className="flex flex-col">
            {connections.map((c, i) => (
              <div key={c.id}>
                <div className="flex items-center gap-3 py-3 px-1">
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{
                        background: "#1A1F2A",
                        border: c.unread ? "1.5px solid #F59E0B" : "1px solid rgba(255,255,255,0.08)",
                        boxShadow: c.unread ? "0 0 10px rgba(245,158,11,0.25)" : "none",
                        fontFamily: "'Space Grotesk', monospace",
                        fontWeight: 700,
                        fontSize: 14,
                        color: c.unread ? "#F59E0B" : "#6B7280",
                      }}
                    >{c.initials}</div>
                    {c.unread && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full"
                        style={{ background: "#F59E0B", boxShadow: "0 0 6px rgba(245,158,11,0.6)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold text-sm" style={{ color: c.unread ? "#F9FAFB" : "#D1D5DB" }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: c.unread ? "#F59E0B" : "#374151" }}>{c.time}</span>
                    </div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: c.unread ? "#9CA3AF" : "#4B5563" }}>{c.preview}</div>
                  </div>
                  <MessageCircle size={16} color={c.unread ? "#F59E0B" : "#1F2937"} />
                </div>
                {i < connections.length - 1 && (
                  <div style={{ height: 1, background: "rgba(255,255,255,0.04)", marginLeft: 60 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-4 pb-6 pt-3"
        style={{
          background: "#0A0D12",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {[
          { icon: Home, label: "Home", active: false },
          { icon: Clock, label: "Recent", active: false },
          { icon: Users, label: "Connect", active: true },
          { icon: User, label: "Profile", active: false },
        ].map(({ icon: Icon, label, active }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div className="relative">
              <Icon size={22} color={active ? "#F59E0B" : "#374151"} strokeWidth={active ? 2 : 1.5} />
              {active && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                  style={{ background: "#F59E0B", boxShadow: "0 0 6px #F59E0B" }} />
              )}
            </div>
            <span style={{
              fontSize: 9,
              letterSpacing: 1.5,
              fontFamily: "'Space Grotesk', monospace",
              color: active ? "#F59E0B" : "#374151",
              textTransform: "uppercase",
            }}>{label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap');
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
      `}</style>
    </div>
  );
}
