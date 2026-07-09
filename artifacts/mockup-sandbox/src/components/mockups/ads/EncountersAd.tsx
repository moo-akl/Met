const encounters = [
  { initials: "S", name: "Sarah J.", sub: "Blue Bottle Coffee · 2m ago", color: "#f0fdf4", tc: "#15803d" },
  { initials: "M", name: "Marcus W.", sub: "The Grove · 18m ago", color: "#eff6ff", tc: "#1d4ed8" },
  { initials: "A", name: "Aisha K.", sub: "Central Park · 1h ago", color: "#fdf4ff", tc: "#7c3aed" },
];

export function EncountersAd() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(160deg, #ffffff 0%, #f0fdf4 60%, #ecfdf5 100%)" }}>
      <div className="flex flex-col items-center gap-6 px-8 py-10 max-w-sm w-full">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full mb-3 tracking-wider uppercase">
            ✦ Encounter Log
          </div>
          <h1 className="text-3xl font-black text-gray-900 leading-tight mb-2">
            Every crossing,<br />
            <span className="text-green-600">remembered.</span>
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Met logs every person you've been near — so you never lose a connection again.
          </p>
        </div>

        {/* Phone mockup */}
        <div className="relative" style={{ width: 210, height: 420 }}>
          <div className="absolute inset-0 rounded-[38px] bg-gray-900 shadow-2xl" />
          <div className="absolute inset-[3px] rounded-[36px] overflow-hidden" style={{ background: "#f8faf8" }}>
            {/* Dynamic Island */}
            <div className="flex justify-center pt-3"><div className="w-24 h-6 bg-gray-900 rounded-full" /></div>
            {/* Status */}
            <div className="flex justify-between px-5 pt-1 pb-0.5">
              <span className="text-[9px] font-semibold text-gray-900">9:41</span>
              <div className="flex items-center gap-1">
                <svg width="12" height="8" viewBox="0 0 12 8"><rect x="0" y="2" width="2" height="6" rx="0.5" fill="#111"/><rect x="3" y="1" width="2" height="7" rx="0.5" fill="#111"/><rect x="6" y="0" width="2" height="8" rx="0.5" fill="#111"/></svg>
                <svg width="10" height="8" viewBox="0 0 10 8"><circle cx="5" cy="6" r="1.5" fill="#111"/></svg>
              </div>
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <span className="text-[12px] font-black text-gray-900">Recent</span>
              <span className="text-[9px] text-green-600 font-semibold">3 NODES</span>
            </div>
            {/* Encounters */}
            <div className="flex flex-col gap-1.5 px-3 pt-2">
              {encounters.map((e) => (
                <div key={e.name} className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 shadow-sm border border-gray-100">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm relative flex-shrink-0" style={{ background: e.color, color: e.tc }}>
                    {e.initials}
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-gray-900">{e.name}</div>
                    <div className="text-[8px] text-gray-400 truncate">{e.sub}</div>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 3L7.5 6L4 9" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
              ))}
              {/* Blurred / ghost item */}
              <div className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-gray-100 opacity-40">
                <div className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-2.5 bg-gray-200 rounded w-20 mb-1.5" />
                  <div className="h-2 bg-gray-100 rounded w-28" />
                </div>
              </div>
            </div>
            <div className="text-center mt-4 px-4">
              <p className="text-[8px] text-gray-400">Tap any encounter to send a reveal request</p>
            </div>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-700 rounded-full" />
        </div>

        <div className="w-full">
          <div className="bg-green-500 text-white text-center py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-green-200">
            Start Meeting People →
          </div>
          <p className="text-center text-gray-400 text-xs mt-2">Free · No credit card needed</p>
        </div>
      </div>
    </div>
  );
}
