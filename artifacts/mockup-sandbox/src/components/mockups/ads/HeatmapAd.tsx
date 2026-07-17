export function HeatmapAd() {
  const hubs = [
    { cx: 105, cy: 118, r: 38, color: "rgba(34,197,94,0.85)" },
    { cx: 178, cy: 170, r: 26, color: "rgba(101,209,104,0.7)" },
    { cx: 68,  cy: 195, r: 20, color: "rgba(163,230,53,0.6)" },
    { cx: 155, cy: 90,  r: 14, color: "rgba(250,204,21,0.55)" },
    { cx: 195, cy: 220, r: 12, color: "rgba(250,204,21,0.45)" },
    { cx: 45,  cy: 148, r: 10, color: "rgba(250,204,21,0.38)" },
    { cx: 80,  cy: 245, r: 9,  color: "rgba(250,204,21,0.32)" },
    { cx: 195, cy: 130, r: 8,  color: "rgba(250,204,21,0.28)" },
  ];

  const streets = [
    { x1: 0, y1: 80,  x2: 220, y2: 80 },
    { x1: 0, y1: 155, x2: 220, y2: 155 },
    { x1: 0, y1: 225, x2: 220, y2: 225 },
    { x1: 55, y1: 0,  x2: 55,  y2: 290 },
    { x1: 130,y1: 0,  x2: 130, y2: 290 },
    { x1: 190,y1: 0,  x2: 190, y2: 290 },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(145deg, #f0fdf4 0%, #dcfce7 50%, #f0f9ff 100%)" }}>
      <div className="flex flex-col items-center gap-5 px-7 py-8 max-w-sm w-full">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full tracking-wider uppercase">
          🗺️ Live Heatmap
        </div>

        {/* Headline */}
        <div className="text-center">
          <h1 className="text-[28px] font-black text-gray-900 leading-tight mb-2">
            See where people<br /><span className="text-green-600">gather near you.</span>
          </h1>
          <p className="text-gray-500 text-[13px] leading-relaxed">
            Real-time heatmap shows the hottest spots in your city. Go where the crowd is.
          </p>
        </div>

        {/* Phone frame */}
        <div className="relative" style={{ width: 220, height: 430 }}>
          {/* Shadow */}
          <div className="absolute inset-0 rounded-[42px]" style={{ boxShadow: "0 30px 60px rgba(0,0,0,0.18), 0 6px 16px rgba(0,0,0,0.1)" }} />
          {/* Frame */}
          <div className="absolute inset-0 rounded-[42px]" style={{ background: "linear-gradient(160deg, #2d2d2d 0%, #1a1a1a 100%)", border: "1px solid rgba(255,255,255,0.08)" }} />
          {/* Side buttons */}
          <div className="absolute" style={{ left: -3, top: 90, width: 3, height: 26, background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
          <div className="absolute" style={{ left: -3, top: 124, width: 3, height: 46, background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
          <div className="absolute" style={{ left: -3, top: 178, width: 3, height: 46, background: "#3a3a3a", borderRadius: "2px 0 0 2px" }} />
          <div className="absolute" style={{ right: -3, top: 120, width: 3, height: 60, background: "#3a3a3a", borderRadius: "0 2px 2px 0" }} />
          {/* Screen */}
          <div className="absolute rounded-[38px] overflow-hidden" style={{ inset: 4, background: "#f8fffe" }}>
            {/* Dynamic island */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="rounded-full bg-gray-900" style={{ width: 90, height: 24 }} />
            </div>

            {/* Status bar */}
            <div className="flex justify-between items-center px-5 pb-1">
              <span className="font-semibold text-gray-900" style={{ fontSize: 9 }}>9:41</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-500" style={{ fontSize: 7 }}>●●●●</span>
                <span className="text-gray-500" style={{ fontSize: 7 }}>WiFi</span>
                <span className="text-gray-500" style={{ fontSize: 7 }}>100%</span>
              </div>
            </div>

            {/* App header */}
            <div className="flex items-center justify-between px-4 pb-2 border-b border-gray-100">
              <span className="font-black text-gray-900" style={{ fontSize: 12 }}>Met</span>
              <div className="flex gap-1.5">
                <div className="rounded-full bg-green-500 text-white font-semibold px-2 py-0.5" style={{ fontSize: 7 }}>Heatmap</div>
                <div className="rounded-full border border-gray-200 text-gray-400 px-2 py-0.5" style={{ fontSize: 7 }}>Map</div>
              </div>
            </div>

            {/* Map area */}
            <div className="mx-3 mt-2 rounded-xl overflow-hidden border border-gray-100" style={{ background: "#f1faf3", height: 200 }}>
              <svg width="214" height="200" viewBox="0 0 214 290" style={{ display: "block" }}>
                {/* Street grid */}
                {streets.map((s, i) => (
                  <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="rgba(0,0,0,0.06)" strokeWidth={1.5} />
                ))}
                {/* Heat blobs */}
                {hubs.map((h, i) => (
                  <g key={i}>
                    <circle cx={h.cx} cy={h.cy} r={h.r * 1.9} fill={h.color.replace(/[\d.]+\)$/, "0.12)")} />
                    <circle cx={h.cx} cy={h.cy} r={h.r * 1.3} fill={h.color.replace(/[\d.]+\)$/, "0.28)")} />
                    <circle cx={h.cx} cy={h.cy} r={h.r} fill={h.color} />
                  </g>
                ))}
                {/* You dot */}
                <circle cx={105} cy={118} r={5} fill="white" stroke="#16a34a" strokeWidth={1.5} />
                <circle cx={105} cy={118} r={2.5} fill="#16a34a" />
              </svg>
            </div>

            {/* Active count */}
            <div className="mx-3 mt-2 flex items-center justify-between bg-green-50 rounded-xl px-3 py-2 border border-green-100">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-green-700 font-medium" style={{ fontSize: 9 }}>People nearby right now</span>
              </div>
              <span className="text-green-600 font-black" style={{ fontSize: 15 }}>47</span>
            </div>
          </div>
          {/* Home indicator */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-gray-600 rounded-full" style={{ width: 64, height: 3.5, opacity: 0.5 }} />
        </div>

        {/* CTA */}
        <div className="w-full">
          <div className="bg-gray-900 text-white text-center rounded-2xl font-bold text-sm tracking-wide shadow-lg" style={{ padding: "14px 0" }}>
            Find your crowd →
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
