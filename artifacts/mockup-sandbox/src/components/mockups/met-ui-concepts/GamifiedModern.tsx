import { Mail, MapPin, MessageCircle, Home, Clock, Users, User, Zap, CheckCircle } from "lucide-react";
import { useState } from "react";

const encounters = [
  { id: 1, initials: "AS", name: "Alex S.", time: "4m", distance: "12m", badge: "1st meet", badgeColor: "#6366F1", count: 1 },
  { id: 2, initials: "MK", name: "Maya K.", time: "11m", distance: "28m", badge: "3× seen", badgeColor: "#A855F7", count: 3 },
  { id: 3, initials: "JL", name: "Jamie L.", time: "22m", distance: "45m", badge: "Reveal sent", badgeColor: "#F59E0B", count: 2 },
];

const connections = [
  { id: 1, initials: "NR", name: "Noah R.", preview: "Heading to the rooftop later?", time: "2m", unread: 2 },
  { id: 2, initials: "SC", name: "Sophia C.", preview: "See you at the gallery 🎨", time: "1h", unread: 0 },
  { id: 3, initials: "DM", name: "Dylan M.", preview: "Nice meeting you last night", time: "3h", unread: 0 },
  { id: 4, initials: "PP", name: "Priya P.", preview: "The after-party was insane 🔥", time: "1d", unread: 1 },
];

const avatarGradients = [
  "linear-gradient(135deg, #6366F1, #A855F7)",
  "linear-gradient(135deg, #EC4899, #F59E0B)",
  "linear-gradient(135deg, #10B981, #6366F1)",
  "linear-gradient(135deg, #A855F7, #EC4899)",
];

export default function GamifiedModern() {
  const [beacon, setBeacon] = useState(true);
  const xpProgress = 68;

  return (
    <div
      className="w-[390px] min-h-[844px] flex flex-col relative overflow-hidden"
      style={{ background: "#F0F2FF", fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
      <div className="relative z-10 px-5 pt-12 pb-3 bg-white"
        style={{ boxShadow: "0 1px 0 rgba(99,102,241,0.08)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span style={{
              fontWeight: 800,
              fontSize: 24,
              background: "linear-gradient(135deg, #6366F1, #A855F7)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: -0.5,
            }}>Met</span>
            <div
              className="flex items-center gap-1.5 mt-0.5 cursor-pointer"
              onClick={() => setBeacon(!beacon)}
            >
              <div className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: beacon ? "#10B981" : "#D1D5DB",
                  boxShadow: beacon ? "0 0 6px rgba(16,185,129,0.6)" : "none",
                }} />
              <span style={{ fontSize: 10, color: beacon ? "#10B981" : "#9CA3AF", fontWeight: 600 }}>
                {beacon ? "Beacon Active" : "Beacon Off"}
              </span>
            </div>
          </div>
          <div className="relative">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "#F0F2FF" }}>
              <Mail size={18} color="#6B7280" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #EC4899, #F43F5E)", fontSize: 9, color: "#fff", fontWeight: 700 }}>3</div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="rounded-xl px-3.5 py-2.5"
          style={{ background: "#F0F2FF" }}>
          <div className="flex justify-between items-center mb-1.5">
            <div className="flex items-center gap-1.5">
              <Zap size={12} color="#6366F1" fill="#6366F1" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6366F1" }}>Weekly Activity</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#A855F7" }}>{xpProgress} pts</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#E0E7FF" }}>
            <div className="h-full rounded-full" style={{
              width: `${xpProgress}%`,
              background: "linear-gradient(90deg, #6366F1, #A855F7, #EC4899)",
              boxShadow: "0 0 8px rgba(99,102,241,0.4)",
            }} />
          </div>
          <div className="flex justify-between mt-1">
            <span style={{ fontSize: 9, color: "#A5B4FC" }}>0</span>
            <span style={{ fontSize: 9, color: "#A5B4FC" }}>100 pts = Level Up 🏆</span>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto pb-24 px-4 pt-4">

        {/* Recent Encounters */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span style={{ fontSize: 15 }}>🔥</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1E1B4B" }}>Recent Encounters</span>
            <div className="ml-auto px-2 py-0.5 rounded-full"
              style={{ background: "rgba(99,102,241,0.10)", fontSize: 10, color: "#6366F1", fontWeight: 600 }}>
              {encounters.length} nearby
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {encounters.map((e, idx) => (
              <div key={e.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{
                  boxShadow: "0 2px 12px rgba(99,102,241,0.08)",
                  borderLeft: `3px solid ${e.badgeColor}`,
                }}>
                {/* Avatar */}
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: avatarGradients[idx % avatarGradients.length] }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{e.initials}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1E1B4B" }}>{e.name}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={10} color="#A5B4FC" />
                    <span style={{ fontSize: 11, color: "#6B7280" }}>{e.distance} · {e.time} ago</span>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    background: `${e.badgeColor}15`,
                    border: `1px solid ${e.badgeColor}50`,
                    fontSize: 10,
                    fontWeight: 600,
                    color: e.badgeColor,
                  }}>
                  {e.badge}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connections */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} color="#10B981" fill="#10B981" />
            <span style={{ fontWeight: 700, fontSize: 14, color: "#1E1B4B" }}>Connections</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#6B7280", fontWeight: 500 }}>Sort ↕</span>
          </div>

          {/* Search */}
          <div className="bg-white flex items-center gap-2.5 px-4 py-2.5 rounded-xl mb-3"
            style={{ boxShadow: "0 1px 6px rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.08)" }}>
            <span style={{ color: "#A5B4FC", fontSize: 15 }}>⌕</span>
            <span style={{ fontSize: 13, color: "#C7D2FE" }}>Search connections…</span>
          </div>

          <div className="flex flex-col gap-2">
            {connections.map((c, idx) => (
              <div key={c.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ boxShadow: "0 2px 12px rgba(99,102,241,0.06)" }}>
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: avatarGradients[(idx + 1) % avatarGradients.length] }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{c.initials}</span>
                  </div>
                  {c.unread > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: "#EF4444", fontSize: 9, color: "#fff", fontWeight: 700 }}>
                      {c.unread}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-2">
                    <span style={{ fontWeight: c.unread ? 700 : 600, fontSize: 14, color: "#1E1B4B" }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>{c.time}</span>
                  </div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: "#6B7280" }}>{c.preview}</div>
                </div>
                {/* Chat pill */}
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #6366F1, #A855F7)" }}>
                  <MessageCircle size={11} color="#fff" />
                  <span style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>Chat</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-4 pb-6 pt-3 bg-white"
        style={{ boxShadow: "0 -1px 0 rgba(99,102,241,0.08)" }}>
        {[
          { icon: Home, label: "Home", active: false, badge: 0 },
          { icon: Clock, label: "Recent", active: false, badge: 0 },
          { icon: Users, label: "Connect", active: true, badge: 3 },
          { icon: User, label: "Profile", active: false, badge: 0 },
        ].map(({ icon: Icon, label, active, badge }) => (
          <div key={label} className="flex flex-col items-center gap-1 relative">
            <div className="relative">
              {active ? (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #6366F1, #A855F7)" }}>
                  <Icon size={20} color="#fff" strokeWidth={2} />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                  <Icon size={20} color="#9CA3AF" strokeWidth={1.5} />
                </div>
              )}
              {badge > 0 && !active && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: "#10B981", fontSize: 9, color: "#fff", fontWeight: 700 }}>
                  {badge}
                </div>
              )}
            </div>
            <span style={{
              fontSize: 9,
              fontWeight: active ? 700 : 500,
              color: active ? "#6366F1" : "#9CA3AF",
              letterSpacing: 0.5,
            }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
