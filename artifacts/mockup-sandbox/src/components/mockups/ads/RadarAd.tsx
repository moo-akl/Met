export function RadarAd() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 40%, #f0fdf4 100%)" }}>
      <div className="flex flex-col items-center gap-6 px-8 py-10 max-w-sm w-full">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full mb-3 tracking-wider uppercase">
            ● Live nearby
          </div>
          <h1 className="text-3xl font-black text-gray-900 leading-tight mb-2">
            Meet the people you keep passing by
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            No swiping. No algorithms. Just real people around you, right now.
          </p>
        </div>

        {/* Phone mockup */}
        <div className="relative" style={{ width: 210, height: 430 }}>
          <div className="absolute inset-0 rounded-[38px] bg-gray-900 shadow-2xl" />
          <div className="absolute inset-[3px] rounded-[36px] overflow-hidden" style={{ background: "#f8faf8" }}>
            {/* Dynamic Island */}
            <div className="flex justify-center pt-3">
              <div className="w-24 h-6 bg-gray-900 rounded-full" />
            </div>
            {/* Status bar */}
            <div className="flex justify-between items-center px-5 pt-1 pb-1">
              <span className="text-[9px] font-semibold text-gray-900">9:41</span>
              <div className="flex items-center gap-1">
                <svg width="12" height="8" viewBox="0 0 12 8"><rect x="0" y="2" width="2" height="6" rx="0.5" fill="#111"/><rect x="3" y="1" width="2" height="7" rx="0.5" fill="#111"/><rect x="6" y="0" width="2" height="8" rx="0.5" fill="#111"/><rect x="9" y="1.5" width="2" height="5" rx="0.5" fill="#ddd"/></svg>
                <svg width="10" height="8" viewBox="0 0 10 8"><path d="M5 1.5C6.8 1.5 8.4 2.3 9.5 3.5L10 3L9.2 2.2C7.9 0.8 6.1 0 4.1 0C2.1 0 0.3 0.8 0 2.2L0.8 3C1.9 2.3 3.4 1.5 5 1.5Z" fill="#111"/><circle cx="5" cy="6" r="1.5" fill="#111"/></svg>
              </div>
            </div>
            {/* App header */}
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-[11px] font-bold text-gray-900">MET</span>
              <div className="flex items-center gap-1.5 bg-green-500 rounded-full px-2.5 py-1">
                <div className="w-1.5 h-1.5 bg-white rounded-full" />
                <span className="text-[9px] font-bold text-white">VISIBLE</span>
              </div>
            </div>
            {/* Radar */}
            <div className="flex justify-center mt-1">
              <div className="relative" style={{ width: 150, height: 150 }}>
                <svg width="150" height="150" viewBox="0 0 150 150">
                  <circle cx="75" cy="75" r="70" fill="none" stroke="#dcfce7" strokeWidth="1"/>
                  <circle cx="75" cy="75" r="50" fill="none" stroke="#dcfce7" strokeWidth="1"/>
                  <circle cx="75" cy="75" r="30" fill="none" stroke="#dcfce7" strokeWidth="1"/>
                  <line x1="75" y1="5" x2="75" y2="145" stroke="#dcfce7" strokeWidth="0.5"/>
                  <line x1="5" y1="75" x2="145" y2="75" stroke="#dcfce7" strokeWidth="0.5"/>
                  <path d="M75,75 L75,5 A70,70 0 0,1 145,75 Z" fill="#22c55e" opacity="0.15"/>
                  <line x1="75" y1="75" x2="145" y2="75" stroke="#22c55e" strokeWidth="1.5" opacity="0.8"/>
                  <circle cx="75" cy="75" r="5" fill="#22c55e"/>
                  <circle cx="75" cy="75" r="10" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0.4"/>
                  {/* Blips */}
                  <circle cx="110" cy="55" r="4" fill="#22c55e" opacity="0.9"/>
                  <circle cx="90" cy="40" r="3" fill="#22c55e" opacity="0.7"/>
                  <circle cx="55" cy="100" r="3.5" fill="#22c55e" opacity="0.8"/>
                  <circle cx="115" cy="90" r="2.5" fill="#22c55e" opacity="0.6"/>
                </svg>
              </div>
            </div>
            {/* Live label */}
            <div className="flex justify-center mt-1">
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[9px] font-bold text-green-700 tracking-wider">BEACON ACTIVE</span>
              </div>
            </div>
            {/* Headline */}
            <div className="text-center mt-2 px-4">
              <p className="text-[16px] font-black text-gray-900">4 people <span className="text-green-600">nearby</span></p>
              <p className="text-[8px] text-gray-400 mt-0.5">Met is listening…</p>
            </div>
            {/* Stats row */}
            <div className="flex gap-2 mx-4 mt-3">
              {[{n:"12",l:"Today"},{n:"3",l:"Connected"},{n:"1",l:"Pending"}].map((s) => (
                <div key={s.l} className="flex-1 bg-white rounded-xl p-2 text-center shadow-sm border border-gray-100">
                  <div className="text-[13px] font-black text-gray-900">{s.n}</div>
                  <div className="text-[7px] text-gray-400">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Home indicator */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-700 rounded-full" />
        </div>

        {/* CTA */}
        <div className="w-full">
          <div className="bg-gray-900 text-white text-center py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-lg">
            Download Met — Free
          </div>
          <p className="text-center text-gray-400 text-xs mt-2">Available on iOS & Android</p>
        </div>
      </div>
    </div>
  );
}
