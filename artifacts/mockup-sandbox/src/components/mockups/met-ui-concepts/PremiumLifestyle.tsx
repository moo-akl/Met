import { Mail, MapPin, MessageCircle, Home, Clock, Users, User } from "lucide-react";
import { useState } from "react";

const encounters = [
  { id: 1, initials: "AS", name: "Alexandra S.", time: "4 min ago", distance: "12m away", status: "reveal_sent" },
  { id: 2, initials: "MK", name: "Maya K.", time: "11 min ago", distance: "28m away", status: "none" },
  { id: 3, initials: "JL", name: "James L.", time: "22 min ago", distance: "45m away", status: "reveal_received" },
];

const connections = [
  { id: 1, initials: "NR", name: "Noah R.", preview: "Heading to the rooftop later?", time: "2m", unread: true },
  { id: 2, initials: "SC", name: "Sophia C.", preview: "See you at the gallery opening", time: "1h", unread: false },
  { id: 3, initials: "DM", name: "Dylan M.", preview: "Lovely meeting you last evening", time: "3h", unread: false },
  { id: 4, initials: "PP", name: "Priya P.", preview: "The after-party was wonderful ✨", time: "1d", unread: true },
];

export default function PremiumLifestyle() {
  const [beacon, setBeacon] = useState(true);

  return (
    <div
      className="w-[390px] min-h-[844px] flex flex-col relative overflow-hidden"
      style={{ background: "#F8F4EF", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Subtle warm texture overlay */}
      <div className="absolute inset-0 pointer-events-none z-0"
        style={{ background: "radial-gradient(ellipse at 60% 0%, rgba(181,147,90,0.07) 0%, transparent 60%)" }} />

      {/* Header */}
      <div className="relative z-10 px-6 pt-12 pb-4"
        style={{ borderBottom: "1px solid rgba(181,147,90,0.18)" }}>
        <div className="flex items-start justify-between">
          <div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontWeight: 700,
              fontSize: 28,
              color: "#1C1510",
              letterSpacing: -0.5,
            }}>Met</div>
            <div
              className="flex items-center gap-1.5 mt-1 cursor-pointer"
              onClick={() => setBeacon(!beacon)}
            >
              <div className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: beacon ? "#B5935A" : "#C4B09A",
                  boxShadow: beacon ? "0 0 5px rgba(181,147,90,0.5)" : "none",
                }} />
              <span style={{
                fontSize: 9,
                letterSpacing: 2.5,
                color: beacon ? "#B5935A" : "#C4B09A",
                textTransform: "uppercase",
                fontWeight: 500,
              }}>BEACON · {beacon ? "ACTIVE" : "OFF"}</span>
            </div>
          </div>
          <div className="mt-1 relative">
            <Mail size={20} color="#9C8B75" strokeWidth={1.5} />
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: "#B5935A", fontSize: 9, color: "#fff", fontWeight: 600 }}>3</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto pb-24 px-5 pt-5">

        {/* Recent Encounters */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div style={{ flex: 1, height: 1, background: "rgba(181,147,90,0.25)" }} />
            <span style={{
              fontSize: 9,
              letterSpacing: 3,
              color: "#B5935A",
              textTransform: "uppercase",
              fontWeight: 500,
            }}>Recent Encounters</span>
            <div style={{ flex: 1, height: 1, background: "rgba(181,147,90,0.25)" }} />
          </div>

          {/* Glass card container */}
          <div className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.70)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.95)",
              boxShadow: "0 4px 24px rgba(181,147,90,0.10), 0 1px 3px rgba(0,0,0,0.04)",
            }}>
            {encounters.map((e, i) => (
              <div key={e.id}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "rgba(248,244,239,0.9)",
                      border: `1.5px solid ${e.status !== "none" ? "#B5935A" : "rgba(181,147,90,0.25)"}`,
                      fontFamily: "'Playfair Display', serif",
                      fontStyle: "italic",
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#B5935A",
                    }}
                  >{e.initials}</div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#1C1510" }}>{e.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin size={9} color="#C4B09A" />
                      <span style={{ fontSize: 11, color: "#9C8B75" }}>{e.distance} · {e.time}</span>
                    </div>
                  </div>
                  {e.status === "reveal_sent" && (
                    <div className="px-3 py-1 rounded-full"
                      style={{ border: "1px solid #B5935A", color: "#B5935A", fontSize: 10, letterSpacing: 0.5, fontWeight: 500 }}>
                      Sent
                    </div>
                  )}
                  {e.status === "reveal_received" && (
                    <div className="px-3 py-1 rounded-full"
                      style={{ background: "rgba(181,147,90,0.12)", border: "1px solid #B5935A", color: "#8B6914", fontSize: 10, fontWeight: 600 }}>
                      Reveal ↑
                    </div>
                  )}
                  {e.status === "none" && (
                    <div className="px-3 py-1 rounded-full cursor-pointer"
                      style={{ border: "1px solid rgba(181,147,90,0.4)", color: "#B5935A", fontSize: 10, fontWeight: 500 }}>
                      Reveal
                    </div>
                  )}
                </div>
                {i < encounters.length - 1 && (
                  <div style={{ height: 1, background: "rgba(181,147,90,0.10)", marginLeft: 56 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Connections */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div style={{ flex: 1, height: 1, background: "rgba(181,147,90,0.25)" }} />
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: "italic",
              fontSize: 14,
              color: "#9C8B75",
            }}>Connections</span>
            <div style={{ flex: 1, height: 1, background: "rgba(181,147,90,0.25)" }} />
          </div>

          {/* Search */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl mb-4"
            style={{
              background: "rgba(255,255,255,0.70)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.90)",
              boxShadow: "0 1px 6px rgba(181,147,90,0.06)",
            }}>
            <span style={{ color: "#C4B09A", fontSize: 14 }}>⌕</span>
            <span style={{ fontSize: 13, color: "#C4B09A", fontStyle: "italic" }}>Search by name or note…</span>
          </div>

          <div className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.70)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.95)",
              boxShadow: "0 4px 24px rgba(181,147,90,0.10), 0 1px 3px rgba(0,0,0,0.04)",
            }}>
            {connections.map((c, i) => (
              <div key={c.id}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{
                        background: "rgba(248,244,239,0.9)",
                        border: `1.5px solid ${c.unread ? "#B5935A" : "rgba(181,147,90,0.20)"}`,
                        boxShadow: c.unread ? "0 0 10px rgba(181,147,90,0.18)" : "none",
                        fontFamily: "'Playfair Display', serif",
                        fontStyle: "italic",
                        fontWeight: 700,
                        fontSize: 15,
                        color: "#B5935A",
                      }}>
                      {c.initials}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                      <span style={{ fontWeight: c.unread ? 600 : 500, fontSize: 14, color: "#1C1510" }}>{c.name}</span>
                      <span style={{ fontSize: 11, color: c.unread ? "#B5935A" : "#C4B09A", flexShrink: 0 }}>{c.time}</span>
                    </div>
                    <div className="text-xs mt-0.5 truncate" style={{ color: c.unread ? "#9C8B75" : "#C4B09A", fontStyle: c.unread ? "normal" : "italic" }}>
                      {c.preview}
                    </div>
                  </div>
                  <MessageCircle size={16} color={c.unread ? "#B5935A" : "#D1C5B5"} strokeWidth={1.5} />
                </div>
                {i < connections.length - 1 && (
                  <div style={{ height: 1, background: "rgba(181,147,90,0.08)", marginLeft: 64 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-4 pb-6 pt-3"
        style={{
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(181,147,90,0.18)",
        }}>
        {[
          { icon: Home, label: "Home", active: false },
          { icon: Clock, label: "Recent", active: false },
          { icon: Users, label: "Connect", active: true },
          { icon: User, label: "Profile", active: false },
        ].map(({ icon: Icon, label, active }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <Icon size={22} color={active ? "#B5935A" : "#C4B09A"} strokeWidth={active ? 1.75 : 1.5} />
            <span style={{
              fontSize: 9,
              letterSpacing: 1.5,
              color: active ? "#B5935A" : "#C4B09A",
              textTransform: "uppercase",
              fontWeight: active ? 600 : 400,
            }}>{label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400;1,700&display=swap');
      `}</style>
    </div>
  );
}
