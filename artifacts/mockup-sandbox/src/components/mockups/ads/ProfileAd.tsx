const socials = [
  { icon: "📸", name: "Instagram", handle: "@yourname", color: "#fdf2f8", border: "#f9a8d4" },
  { icon: "🔗", name: "LinkedIn", handle: "yourname", color: "#eff6ff", border: "#93c5fd" },
];

export function ProfileAd() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(160deg, #ffffff 0%, #f0fdf4 70%, #dcfce7 100%)" }}>
      <div className="flex flex-col items-center gap-6 px-8 py-10 max-w-sm w-full">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full mb-3 tracking-wider uppercase">
            ✓ Verified Profile
          </div>
          <h1 className="text-3xl font-black text-gray-900 leading-tight mb-2">
            Be real.<br /><span className="text-green-600">No filters needed.</span>
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            A verified profile that shows the authentic you — not an algorithm-optimised persona.
          </p>
        </div>

        {/* Phone mockup */}
        <div className="relative" style={{ width: 210, height: 420 }}>
          <div className="absolute inset-0 rounded-[38px] bg-gray-900 shadow-2xl" />
          <div className="absolute inset-[3px] rounded-[36px] overflow-hidden" style={{ background: "#f8faf8" }}>
            <div className="flex justify-center pt-3"><div className="w-24 h-6 bg-gray-900 rounded-full" /></div>
            <div className="flex justify-between px-5 pt-1 pb-1">
              <span className="text-[9px] font-semibold text-gray-900">9:41</span>
              <span className="text-[9px] text-gray-400">●●●</span>
            </div>
            {/* Profile header */}
            <div className="text-center px-4 pt-1">
              {/* Avatar */}
              <div className="flex justify-center mb-2">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-md">
                    <span className="text-2xl font-black text-white">A</span>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="white"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                  </div>
                </div>
              </div>
              <p className="text-[13px] font-black text-gray-900">Alex Rivera</p>
              <p className="text-[8px] text-gray-400">Designer · SF Bay Area</p>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-[7px] text-green-600 font-semibold">Verified photo</span>
              </div>
            </div>

            {/* Bio */}
            <div className="mx-3 mt-2 bg-white rounded-xl p-2.5 border border-gray-100 shadow-sm">
              <p className="text-[8px] text-gray-600 italic text-center leading-relaxed">"Coffee, long walks & spontaneous conversations."</p>
            </div>

            {/* Socials */}
            <div className="mx-3 mt-2">
              <p className="text-[7px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Socials</p>
              {socials.map((s) => (
                <div key={s.name} className="flex items-center gap-2 bg-white rounded-xl p-2 border mb-1.5 shadow-sm" style={{ borderColor: s.border }}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px]" style={{ background: s.color }}>
                    {s.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-[8px] font-bold text-gray-700">{s.name}</div>
                    <div className="text-[7px] text-gray-400">{s.handle}</div>
                  </div>
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 12 12" fill="white"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-700 rounded-full" />
        </div>

        <div className="w-full">
          <div className="bg-green-500 text-white text-center py-3.5 rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-green-200">
            Create your authentic profile
          </div>
          <p className="text-center text-gray-400 text-xs mt-2">Free to join · Always private</p>
        </div>
      </div>
    </div>
  );
}
