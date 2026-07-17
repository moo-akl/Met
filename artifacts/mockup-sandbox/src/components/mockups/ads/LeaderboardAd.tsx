const leaders = [
  { rank: 1, initials: "JL", name: "Jordan L.", pts: 175, trophies: "👑🥇⚡", you: true },
  { rank: 2, initials: "AK", name: "Aisha K.", pts: 142, trophies: "🥇🏅", you: false },
  { rank: 3, initials: "MT", name: "Marcus T.", pts: 118, trophies: "🏅", you: false },
  { rank: 4, initials: "SC", name: "Sofia C.", pts: 95, trophies: "", you: false },
];

const rankColor = (r: number) =>
  r === 1 ? "#d4af37" : r === 2 ? "#94a3b8" : r === 3 ? "#cd7f32" : "#9ca3af";

export function LeaderboardAd() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 40%, #f0fdf4 100%)" }}>
      <div className="flex flex-col items-center gap-5 px-7 py-8 max-w-sm w-full">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full tracking-wider uppercase">
          👑 Hub Leaderboard
        </div>

        {/* Headline */}
        <div className="text-center">
          <h1 className="text-[28px] font-black text-gray-900 leading-tight mb-2">
            Earn your place at<br /><span className="text-amber-600">the top.</span>
          </h1>
          <p className="text-gray-500 text-[13px] leading-relaxed">
            Check in to local hubs, collect trophies, and claim the Monthly Crown at your favourite spots.
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
          {/* Screen */}
          <div className="absolute rounded-[38px] overflow-hidden" style={{ inset: 4, background: "#fffdf7" }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="rounded-full bg-gray-900" style={{ width: 90, height: 24 }} />
            </div>
            <div className="flex justify-between items-center px-5 pb-1">
              <span className="font-semibold text-gray-900" style={{ fontSize: 9 }}>9:41</span>
              <span className="text-gray-400" style={{ fontSize: 7 }}>●●●● WiFi 100%</span>
            </div>

            {/* Screen header */}
            <div className="flex items-center justify-between px-4 pb-2 border-b border-amber-100">
              <div>
                <div className="font-black text-gray-900 leading-tight" style={{ fontSize: 11 }}>Central Park</div>
                <div className="text-amber-600 font-semibold" style={{ fontSize: 7 }}>JULY LEADERBOARD</div>
              </div>
              <span style={{ fontSize: 18 }}>🏆</span>
            </div>

            {/* Crown banner */}
            <div className="mx-3 mt-2 rounded-xl px-3 py-2 border border-amber-200" style={{ background: "rgba(212,175,55,0.08)" }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 18 }}>👑</span>
                <div>
                  <div className="font-black text-amber-700" style={{ fontSize: 8 }}>MONTHLY CROWN</div>
                  <div className="text-gray-700" style={{ fontSize: 8 }}><b>Jordan L.</b> · 22 checkins</div>
                </div>
              </div>
            </div>

            {/* Leaderboard rows */}
            <div className="flex flex-col gap-1.5 px-3 mt-2">
              {leaders.map((l) => (
                <div key={l.rank} className="flex items-center gap-2 rounded-xl px-2.5 py-2 border" style={{ background: l.you ? "rgba(34,197,94,0.07)" : "white", borderColor: l.you ? "rgba(34,197,94,0.25)" : "#f3f4f6" }}>
                  <div className="w-5 text-center font-black" style={{ fontSize: 10, color: rankColor(l.rank) }}>
                    {l.rank === 1 ? "👑" : `#${l.rank}`}
                  </div>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center font-black flex-shrink-0" style={{ fontSize: 8, background: l.you ? "#dcfce7" : "#f8fafc", color: l.you ? "#16a34a" : "#6b7280", border: `1.5px solid ${l.you ? "#86efac" : "#e5e7eb"}` }}>
                    {l.initials}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-gray-900" style={{ fontSize: 9 }}>{l.name}</span>
                      {l.you && <span className="text-green-600 font-black" style={{ fontSize: 7 }}>YOU</span>}
                    </div>
                    {l.trophies && <div style={{ fontSize: 9, lineHeight: 1 }}>{l.trophies}</div>}
                  </div>
                  <span className="font-black" style={{ fontSize: 11, color: l.you ? "#16a34a" : "#374151" }}>{l.pts}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-gray-600 rounded-full" style={{ width: 64, height: 3.5, opacity: 0.5 }} />
        </div>

        {/* CTA */}
        <div className="w-full">
          <div className="bg-gray-900 text-white text-center rounded-2xl font-bold text-sm tracking-wide shadow-lg" style={{ padding: "14px 0" }}>
            Claim your crown →
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
