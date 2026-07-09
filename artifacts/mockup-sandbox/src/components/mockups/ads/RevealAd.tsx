export function RevealAd() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(145deg, #fafafa 0%, #f0fdf4 50%, #fafafa 100%)" }}>
      <div className="flex flex-col items-center gap-6 px-8 py-10 max-w-sm w-full">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full mb-3 tracking-wider uppercase">
            🔒 Mutual Consent
          </div>
          <h1 className="text-3xl font-black text-gray-900 leading-tight mb-2">
            Connect only<br />when <span className="text-green-600">you're ready.</span>
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Both people must agree before any identity is shared. No surprises.
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
            <div className="flex items-center px-4 py-2 border-b border-gray-100">
              <span className="text-[12px] font-black text-gray-900">Reveal Request</span>
            </div>

            {/* Reveal card */}
            <div className="mx-3 mt-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              {/* Anonymous avatar */}
              <div className="flex justify-center mb-3">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-200 to-emerald-300 flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                </div>
              </div>
              <div className="text-center mb-3">
                <p className="text-[11px] font-black text-gray-900">Someone nearby</p>
                <p className="text-[8px] text-gray-400 mt-0.5">Blue Bottle Coffee · 3m ago</p>
              </div>
              <div className="bg-green-50 border border-green-100 rounded-xl p-2.5 text-center mb-3">
                <p className="text-[9px] text-green-800 italic">"Hey! I think we keep crossing paths at the coffee shop 😊"</p>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 bg-gray-100 text-gray-500 text-[9px] font-bold py-2.5 rounded-xl">Not now</button>
                <button className="flex-1 bg-green-500 text-white text-[9px] font-bold py-2.5 rounded-xl shadow-sm">Reveal ✓</button>
              </div>
            </div>

            <div className="mx-3 mt-2.5 bg-green-50 rounded-xl p-2.5 border border-green-100">
              <p className="text-[7.5px] text-green-700 text-center">🔒 Your identity stays hidden until both sides agree</p>
            </div>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-700 rounded-full" />
        </div>

        <div className="w-full">
          <div className="bg-gray-900 text-white text-center py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-lg">
            Privacy-first connections
          </div>
          <p className="text-center text-gray-400 text-xs mt-2">Download Met — iOS & Android</p>
        </div>
      </div>
    </div>
  );
}
