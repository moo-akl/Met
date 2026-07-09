const connections = [
  { initials: "S", name: "Sarah J.", msg: "Hey! Small world 😊", time: "2m", color: "#f0fdf4", tc: "#15803d", unread: true },
  { initials: "M", name: "Marcus W.", msg: "Great meeting you!", time: "1h", color: "#eff6ff", tc: "#1d4ed8", unread: false },
  { initials: "L", name: "Lena T.", msg: "Coffee next week?", time: "3h", color: "#fdf4ff", tc: "#7c3aed", unread: true },
];

export function ConnectionsAd() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(140deg, #f8fafc 0%, #f0fdf4 60%, #ecfdf5 100%)" }}>
      <div className="flex flex-col items-center gap-6 px-8 py-10 max-w-sm w-full">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full mb-3 tracking-wider uppercase">
            💬 Real Connections
          </div>
          <h1 className="text-3xl font-black text-gray-900 leading-tight mb-2">
            Strangers become<br /><span className="text-green-600">real connections.</span>
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Chat with people you've actually crossed paths with. No cold strangers.
          </p>
        </div>

        {/* Phone mockup */}
        <div className="relative" style={{ width: 210, height: 420 }}>
          <div className="absolute inset-0 rounded-[38px] bg-gray-900 shadow-2xl" />
          <div className="absolute inset-[3px] rounded-[36px] overflow-hidden" style={{ background: "#f8faf8" }}>
            <div className="flex justify-center pt-3"><div className="w-24 h-6 bg-gray-900 rounded-full" /></div>
            <div className="flex justify-between px-5 pt-1 pb-0.5">
              <span className="text-[9px] font-semibold text-gray-900">9:41</span>
              <span className="text-[9px] text-gray-400">●●●</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <span className="text-[12px] font-black text-gray-900">Connections</span>
              <div className="bg-green-500 text-white text-[7px] font-bold px-2 py-0.5 rounded-full">2 NEW</div>
            </div>

            {/* Search bar */}
            <div className="mx-3 mt-2 bg-white rounded-xl flex items-center gap-2 px-3 py-2 border border-gray-100 shadow-sm">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="#9ca3af" strokeWidth="1.5"/><path d="M11 11l3 3" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/></svg>
              <span className="text-[8px] text-gray-300">Search connections</span>
            </div>

            {/* Connections list */}
            <div className="flex flex-col gap-1.5 px-3 pt-2">
              {connections.map((c) => (
                <div key={c.name} className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 shadow-sm border border-gray-100">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm" style={{ background: c.color, color: c.tc }}>
                      {c.initials}
                    </div>
                    {c.unread && <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border border-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-900">{c.name}</span>
                      <span className="text-[7px] text-gray-400">{c.time}</span>
                    </div>
                    <div className="text-[8px] text-gray-400 truncate">{c.msg}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom pulse */}
            <div className="flex justify-center mt-3">
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-full px-3 py-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-[7.5px] text-green-700 font-medium">3 people met nearby today</span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-700 rounded-full" />
        </div>

        <div className="w-full">
          <div className="bg-gray-900 text-white text-center py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-lg">
            Meet people around you →
          </div>
          <div className="flex justify-center gap-4 mt-2">
            <span className="text-gray-400 text-xs">⭐ 4.9 App Store</span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-400 text-xs">Free Download</span>
          </div>
        </div>
      </div>
    </div>
  );
}
