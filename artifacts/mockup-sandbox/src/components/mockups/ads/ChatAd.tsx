const messages = [
  { from: "them", text: "Hey! We were both at Central Park this morning 😄", time: "10:14" },
  { from: "me",   text: "I know! Saw you near the fountain. Small world 🌿", time: "10:15" },
  { from: "them", text: "Are you usually around here? I come every Tuesday", time: "10:16" },
  { from: "me",   text: "Same! We should link up sometime 🙌", time: "10:17" },
];

export function ChatAd() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(145deg, #f0fdf4 0%, #eff6ff 60%, #fdf4ff 100%)" }}>
      <div className="flex flex-col items-center gap-5 px-7 py-8 max-w-sm w-full">

        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full tracking-wider uppercase">
          💬 Real Conversations
        </div>

        <div className="text-center">
          <h1 className="text-[28px] font-black text-gray-900 leading-tight mb-2">
            Strangers become<br /><span className="text-green-600">real connections.</span>
          </h1>
          <p className="text-gray-500 text-[13px] leading-relaxed">
            Chat with people you've actually crossed paths with. No cold messages — just genuine encounters.
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
          <div className="absolute rounded-[38px] overflow-hidden" style={{ inset: 4, background: "#f9fafb" }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="rounded-full bg-gray-900" style={{ width: 90, height: 24 }} />
            </div>
            <div className="flex justify-between items-center px-5 pb-1">
              <span className="font-semibold text-gray-900" style={{ fontSize: 9 }}>9:41</span>
              <span className="text-gray-400" style={{ fontSize: 7 }}>●●●● WiFi 100%</span>
            </div>

            {/* Chat header */}
            <div className="flex items-center gap-2 px-3 pb-2 border-b border-gray-100">
              <span className="text-green-500 font-black" style={{ fontSize: 14 }}>‹</span>
              <div className="relative">
                <div className="rounded-xl flex items-center justify-center font-black" style={{ width: 30, height: 30, fontSize: 10, background: "linear-gradient(135deg, #fef3c7, #f3e8ff)", border: "1.5px solid rgba(212,175,55,0.4)", color: "#d97706" }}>AK</div>
                <div className="absolute -bottom-1 -right-1 rounded flex items-center justify-center" style={{ width: 12, height: 12, background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.5)", fontSize: 7 }}>👑</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <span className="font-black text-gray-900" style={{ fontSize: 10 }}>Aisha K.</span>
                  <span className="rounded-full px-1 py-0.5 font-black" style={{ fontSize: 6, background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.35)", color: "#d4af37" }}>★ PIONEER</span>
                </div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(i => <span key={i} style={{ fontSize: 7, color: "#d4af37" }}>★</span>)}
                  <span className="text-gray-400" style={{ fontSize: 7 }}>4.8 · Kind · Reliable</span>
                </div>
              </div>
            </div>

            {/* Location context */}
            <div className="mx-3 mt-1.5 rounded-xl px-2.5 py-1.5 border border-green-100 bg-green-50 flex items-center gap-1.5">
              <span style={{ fontSize: 9 }}>📍</span>
              <span className="text-gray-500" style={{ fontSize: 8 }}>Met at <b className="text-gray-700">Central Park</b> · Today 8:32 AM</span>
            </div>

            {/* Messages */}
            <div className="flex flex-col gap-2 px-3 mt-2">
              {messages.map((msg, i) => {
                const isMe = msg.from === "me";
                return (
                  <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className="rounded-2xl px-2.5 py-1.5 border" style={{
                      maxWidth: "80%",
                      background: isMe ? "#dcfce7" : "white",
                      borderColor: isMe ? "#86efac" : "#e5e7eb",
                      borderRadius: isMe ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
                    }}>
                      <p className="text-gray-800 leading-snug" style={{ fontSize: 9, margin: 0 }}>{msg.text}</p>
                    </div>
                    <span className="text-gray-400 mt-0.5" style={{ fontSize: 7 }}>{msg.time}{isMe && " ✓✓"}</span>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="absolute bottom-5 left-0 right-0 px-3">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-2 shadow-sm">
                <span className="text-gray-300 flex-1" style={{ fontSize: 9 }}>Message Aisha…</span>
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-black" style={{ fontSize: 10 }}>↑</span>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-gray-600 rounded-full" style={{ width: 64, height: 3.5, opacity: 0.5 }} />
        </div>

        <div className="w-full">
          <div className="bg-gray-900 text-white text-center rounded-2xl font-bold text-sm tracking-wide shadow-lg" style={{ padding: "14px 0" }}>
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
