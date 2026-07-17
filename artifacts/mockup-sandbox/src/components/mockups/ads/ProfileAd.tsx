export function ProfileAd() {
  const stars = 4.9;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(145deg, #fdf4ff 0%, #f5f3ff 50%, #f0fdf4 100%)" }}>
      <div className="flex flex-col items-center gap-5 px-7 py-8 max-w-sm w-full">

        <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full tracking-wider uppercase">
          ★ Pioneer Profile
        </div>

        <div className="text-center">
          <h1 className="text-[28px] font-black text-gray-900 leading-tight mb-2">
            Your reputation<br /><span className="text-purple-600">travels with you.</span>
          </h1>
          <p className="text-gray-500 text-[13px] leading-relaxed">
            Build trust through real encounters. Earn Pioneer status, collect trophies, and let your community speak for you.
          </p>
        </div>

        {/* Phone frame */}
        <div className="relative" style={{ width: 220, height: 430 }}>
          <div className="absolute inset-0 rounded-[42px]" style={{ boxShadow: "0 30px 60px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.1)" }} />
          <div className="absolute inset-0 rounded-[42px]" style={{ background: "linear-gradient(160deg, #2d2d2d 0%, #1a1a1a 100%)", border: "1px solid rgba(255,255,255,0.08)" }} />
          <div className="absolute" style={{ left: -3, top: 90, width: 3, height: 26, background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
          <div className="absolute" style={{ left: -3, top: 124, width: 3, height: 46, background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
          <div className="absolute" style={{ left: -3, top: 178, width: 3, height: 46, background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
          <div className="absolute" style={{ right: -3, top: 120, width: 3, height: 60, background: "#3a3a3a", borderRadius: "0 2px 2px 0" }} />
          <div className="absolute rounded-[38px] overflow-hidden" style={{ inset: 4, background: "#fafafa" }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="rounded-full bg-gray-900" style={{ width: 90, height: 24 }} />
            </div>
            <div className="flex justify-between items-center px-5 pb-1">
              <span className="font-semibold text-gray-900" style={{ fontSize: 9 }}>9:41</span>
              <span className="text-gray-400" style={{ fontSize: 7 }}>●●●● WiFi 100%</span>
            </div>
            <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100">
              <span className="font-black text-gray-900" style={{ fontSize: 12 }}>Profile</span>
              <span className="text-gray-400" style={{ fontSize: 13 }}>✎</span>
            </div>

            {/* Pioneer card */}
            <div className="mx-3 mt-2 rounded-2xl p-3 border" style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.06), rgba(147,51,234,0.05))", borderColor: "rgba(212,175,55,0.35)" }}>
              <div className="flex gap-3 items-start">
                <div className="relative flex-shrink-0">
                  <div className="rounded-2xl flex items-center justify-center font-black" style={{ width: 46, height: 46, fontSize: 14, background: "linear-gradient(135deg, #f3e8ff, #dcfce7)", border: "2px solid rgba(212,175,55,0.45)", color: "#7c3aed" }}>JL</div>
                  <div className="absolute -top-1.5 -right-1.5 rounded-md flex items-center justify-center" style={{ width: 16, height: 16, background: "rgba(212,175,55,0.15)", border: "1px solid rgba(212,175,55,0.6)", fontSize: 9 }}>👑</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-gray-900" style={{ fontSize: 11 }}>Jordan L.</div>
                  <div className="text-gray-400 mb-1.5" style={{ fontSize: 8 }}>New York · Member since 2024</div>
                  <div className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.4)" }}>
                    <span style={{ fontSize: 7 }}>★</span>
                    <span className="font-black" style={{ fontSize: 7, color: "#d4af37", letterSpacing: 1 }}>MET PIONEER</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5">
                {[1,2,3,4,5].map(i => (
                  <span key={i} style={{ fontSize: 10, color: i <= Math.floor(stars) ? "#d4af37" : "#e5e7eb" }}>★</span>
                ))}
                <span className="font-black" style={{ fontSize: 10, color: "#d4af37" }}>{stars}</span>
                <span className="text-gray-400" style={{ fontSize: 9 }}>(48 reviews)</span>
              </div>
            </div>

            {/* Tags */}
            <div className="flex gap-1.5 mx-3 mt-2">
              {[
                { label: "Kind", emoji: "💚", bg: "#f0fdf4", border: "#86efac", text: "#16a34a" },
                { label: "Reliable", emoji: "🤝", bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8" },
                { label: "Trusted", emoji: "🛡", bg: "#fdf4ff", border: "#d8b4fe", text: "#7c3aed" },
              ].map((t) => (
                <div key={t.label} className="flex-1 flex flex-col items-center gap-1 rounded-xl py-2 border" style={{ background: t.bg, borderColor: t.border }}>
                  <span style={{ fontSize: 14 }}>{t.emoji}</span>
                  <span className="font-bold" style={{ fontSize: 8, color: t.text }}>{t.label}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="flex gap-1.5 mx-3 mt-2">
              {[{ l: "Encounters", v: "132" }, { l: "Connects", v: "28" }, { l: "Reveals", v: "19" }].map((s) => (
                <div key={s.l} className="flex-1 bg-white border border-gray-100 rounded-xl py-2 flex flex-col items-center gap-0.5 shadow-sm">
                  <span className="font-black text-green-600" style={{ fontSize: 13 }}>{s.v}</span>
                  <span className="text-gray-400" style={{ fontSize: 7 }}>{s.l}</span>
                </div>
              ))}
            </div>

            {/* Trophies */}
            <div className="flex gap-1.5 mx-3 mt-2">
              {[{ icon: "👑", label: "Monthly Crown" }, { icon: "🥇", label: "First Reveal" }, { icon: "⚡", label: "Fast Connect" }].map((t) => (
                <div key={t.label} className="flex-1 bg-white border border-gray-100 rounded-xl py-2 flex flex-col items-center gap-0.5 shadow-sm">
                  <span style={{ fontSize: 14 }}>{t.icon}</span>
                  <span className="text-gray-600 text-center" style={{ fontSize: 6.5, lineHeight: 1.2 }}>{t.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-gray-600 rounded-full" style={{ width: 64, height: 3.5, opacity: 0.5 }} />
        </div>

        <div className="w-full">
          <div className="bg-gray-900 text-white text-center rounded-2xl font-bold text-sm tracking-wide shadow-lg" style={{ padding: "14px 0" }}>
            Build your reputation →
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
