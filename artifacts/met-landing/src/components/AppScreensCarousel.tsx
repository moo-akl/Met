import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const screens = [
  {
    id: "networks",
    label: "Networks",
    headline: "Everyone you've ever crossed paths with, in one place.",
    sub: "University. Work. Gym. Your world, organised.",
    phone: <NetworksScreen />,
  },
  {
    id: "chat",
    label: "Chat",
    headline: "Go from 'who was that?' to 'hey, want to grab coffee?'",
    sub: "Private messaging unlocks the moment you both match.",
    phone: <ChatScreen />,
  },
  {
    id: "social",
    label: "Profiles",
    headline: "One tap to follow on Instagram, LinkedIn, or TikTok.",
    sub: "See their vibe before you say hello.",
    phone: <SocialScreen />,
  },
];

function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: 200, height: 410 }}>
      <div className="absolute inset-0 rounded-[38px] bg-gray-900 shadow-2xl shadow-green-900/20" />
      <div className="absolute inset-[3px] rounded-[35px] overflow-hidden bg-white flex flex-col">
        <div className="shrink-0 h-8 flex items-end justify-center pb-1">
          <div className="w-20 h-5 bg-black rounded-full" />
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
        <div className="shrink-0 h-5 flex items-center justify-center">
          <div className="w-20 h-1 bg-black rounded-full opacity-60" />
        </div>
      </div>
    </div>
  );
}

function NetworksScreen() {
  const groups = [
    { icon: "🎓", label: "University", count: 14, color: "bg-blue-50 border-blue-100" },
    { icon: "💼", label: "Work", count: 9, color: "bg-purple-50 border-purple-100" },
    { icon: "🏋️", label: "Gym", count: 5, color: "bg-orange-50 border-orange-100" },
    { icon: "☕", label: "Coffee shops", count: 7, color: "bg-yellow-50 border-yellow-100" },
  ];
  return (
    <div className="h-full flex flex-col bg-white px-3 pt-2">
      <p className="text-[10px] font-black text-gray-900 mb-2 tracking-tight">Your Networks</p>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.label} className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${g.color}`}>
            <div className="flex items-center gap-2">
              <span className="text-base">{g.icon}</span>
              <span className="text-[11px] font-bold text-gray-800">{g.label}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-black text-gray-500">{g.count}</span>
              <div className="flex -space-x-1">
                {[...Array(Math.min(3, g.count))].map((_, i) => (
                  <div key={i} className="w-4 h-4 rounded-full bg-gray-200 border border-white" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-green-50 border border-green-100 px-3 py-2.5 flex items-center gap-2">
        <motion.div
          className="w-2 h-2 rounded-full bg-green-500"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-[10px] font-bold text-green-700">3 people nearby right now</span>
      </div>
    </div>
  );
}

function ChatScreen() {
  const messages = [
    { from: "them", text: "Hey! Met just told me we matched 😄", time: "2:14 PM" },
    { from: "me", text: "Haha yeah! I've seen you in the library a few times", time: "2:15 PM" },
    { from: "them", text: "Same! Coffee sometime? ☕", time: "2:15 PM" },
    { from: "me", text: "Definitely 🙌", time: "2:16 PM" },
  ];
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white px-3 py-2 flex items-center gap-2 border-b border-gray-100">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
          <span className="text-[8px] font-black text-white">S</span>
        </div>
        <div>
          <p className="text-[10px] font-black text-gray-900">Sara</p>
          <p className="text-[8px] text-green-500 font-semibold">Met today · library</p>
        </div>
      </div>
      <div className="flex-1 px-2 py-2 space-y-1.5 overflow-hidden">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-2.5 py-1.5 ${m.from === "me" ? "bg-green-500 text-white" : "bg-white border border-gray-100 text-gray-800"}`}>
              <p className="text-[9px] font-medium leading-relaxed">{m.text}</p>
              <p className={`text-[7px] mt-0.5 ${m.from === "me" ? "text-green-100" : "text-gray-400"}`}>{m.time}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white border-t border-gray-100 px-2 py-1.5 flex gap-1.5 items-center">
        <div className="flex-1 bg-gray-100 rounded-full px-2.5 py-1">
          <p className="text-[9px] text-gray-400">Message...</p>
        </div>
        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function SocialScreen() {
  const socials = [
    { icon: "📸", label: "Instagram", handle: "@sara.m", color: "bg-pink-50 border-pink-100 text-pink-600" },
    { icon: "💼", label: "LinkedIn", handle: "Sara Moran", color: "bg-blue-50 border-blue-100 text-blue-600" },
    { icon: "🎵", label: "TikTok", handle: "@saramoran", color: "bg-gray-50 border-gray-200 text-gray-700" },
  ];
  return (
    <div className="h-full flex flex-col bg-white px-3 pt-2">
      <div className="flex flex-col items-center mb-3">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-1.5">
          <span className="text-xl font-black text-white">S</span>
        </div>
        <p className="text-[12px] font-black text-gray-900">Sara Moran</p>
        <p className="text-[9px] text-gray-400 mt-0.5">Met 3× this week · library &amp; gym</p>
        <div className="mt-1.5 bg-green-100 rounded-full px-2.5 py-0.5">
          <span className="text-[8px] font-bold text-green-700">✓ Mutual Match</span>
        </div>
      </div>
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Follow on</p>
      <div className="space-y-1.5">
        {socials.map((s) => (
          <div key={s.label} className={`flex items-center justify-between rounded-xl px-3 py-2 border ${s.color}`}>
            <div className="flex items-center gap-2">
              <span className="text-sm">{s.icon}</span>
              <div>
                <p className="text-[9px] font-black text-gray-800">{s.label}</p>
                <p className="text-[8px] text-gray-500">{s.handle}</p>
              </div>
            </div>
            <div className="text-[8px] font-bold text-gray-500 border border-current rounded-full px-1.5 py-0.5">
              Follow
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppScreensCarousel() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(0);

  const go = (idx: number) => {
    setDirection(idx > active ? 1 : -1);
    setActive(idx);
  };

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 260 : -260, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -260 : 260, opacity: 0 }),
  };

  return (
    <section className="py-24 bg-gray-50 border-y border-gray-100 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <h2 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tight mb-4">
            Everything you need to connect, in one app.
          </h2>
          <p className="text-lg text-gray-500 font-medium">Free. No swiping. No strangers online.</p>
        </motion.div>

        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

          {/* Phone with sliding screens */}
          <div className="flex-1 flex justify-center">
            <div className="relative" style={{ width: 200, height: 410 }}>
              <AnimatePresence initial={false} custom={direction} mode="popLayout">
                <motion.div
                  key={active}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute inset-0"
                >
                  <PhoneShell>{screens[active].phone}</PhoneShell>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Copy + tabs */}
          <div className="flex-1 text-center lg:text-left">
            {/* Tab pills */}
            <div className="inline-flex bg-white border border-gray-200 rounded-full p-1 gap-1 mb-8">
              {screens.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => go(i)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200 ${
                    i === active
                      ? "bg-gray-900 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
              >
                <h3 className="text-2xl lg:text-3xl font-black text-gray-900 leading-tight mb-4">
                  {screens[active].headline}
                </h3>
                <p className="text-lg text-gray-500 font-medium">{screens[active].sub}</p>
              </motion.div>
            </AnimatePresence>

            {/* Dot indicators */}
            <div className="flex items-center justify-center lg:justify-start gap-2 mt-8">
              {screens.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === active ? "w-6 h-2 bg-green-500" : "w-2 h-2 bg-gray-300 hover:bg-gray-400"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
