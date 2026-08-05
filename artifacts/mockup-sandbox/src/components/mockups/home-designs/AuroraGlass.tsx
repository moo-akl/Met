import React from 'react';
import { MapPin, Trophy, Zap, ArrowRight, Activity, Users } from 'lucide-react';

export function AuroraGlass() {
  return (
    <div className="w-[390px] min-h-[844px] overflow-y-auto mx-auto relative bg-[#050814] text-white font-sans hidden-scrollbar">
      {/* Background Aurora Blobs */}
      <div className="absolute top-0 left-[-20%] w-[300px] h-[300px] bg-purple-600/30 rounded-full mix-blend-screen filter blur-[80px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[250px] h-[250px] bg-cyan-600/20 rounded-full mix-blend-screen filter blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[10%] w-[350px] h-[350px] bg-indigo-600/20 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none" />

      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col px-5 pb-10">
        {/* Status bar spacer */}
        <div className="h-[44px] w-full" />

        {/* Header */}
        <header className="flex justify-between items-center py-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Met</h1>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-cyan-400 p-[1px]">
            <div className="w-full h-full rounded-full bg-[#050814] flex items-center justify-center backdrop-blur-sm">
              <span className="text-sm font-medium text-white">AK</span>
            </div>
          </div>
        </header>

        {/* Beacon Status */}
        <div className="flex items-center justify-center mt-6 mb-2">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
            </div>
            <span className="text-xs font-semibold tracking-wider text-purple-200 uppercase">Beacon Active</span>
          </div>
        </div>

        {/* Hero Number */}
        <div className="flex flex-col items-center mt-2 mb-6">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-[80px] font-black leading-none bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(168,85,247,0.4)]">
              12
            </span>
          </div>
          <span className="text-white/60 text-base font-medium mt-1">people within 200m</span>
          
          {/* Vibe Pill */}
          <div className="mt-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
            <Zap size={14} className="fill-cyan-400 text-cyan-400" />
            <span className="text-xs font-bold tracking-wide uppercase">Lively Here</span>
          </div>
        </div>

        {/* Heatmap */}
        <div className="w-full rounded-3xl bg-[#07091a] border border-white/10 mb-6 relative overflow-hidden shadow-lg" style={{ height: 200 }}>
          {/* Street grid — faint lines suggesting a map */}
          <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
            {/* Horizontal streets */}
            <line x1="0" y1="50"  x2="390" y2="50"  stroke="#4f6699" strokeWidth="1"/>
            <line x1="0" y1="90"  x2="390" y2="90"  stroke="#4f6699" strokeWidth="0.5"/>
            <line x1="0" y1="130" x2="390" y2="130" stroke="#4f6699" strokeWidth="1"/>
            <line x1="0" y1="170" x2="390" y2="170" stroke="#4f6699" strokeWidth="0.5"/>
            {/* Vertical streets */}
            <line x1="60"  y1="0" x2="60"  y2="200" stroke="#4f6699" strokeWidth="0.5"/>
            <line x1="130" y1="0" x2="130" y2="200" stroke="#4f6699" strokeWidth="1"/>
            <line x1="200" y1="0" x2="200" y2="200" stroke="#4f6699" strokeWidth="0.5"/>
            <line x1="270" y1="0" x2="270" y2="200" stroke="#4f6699" strokeWidth="1"/>
            <line x1="330" y1="0" x2="330" y2="200" stroke="#4f6699" strokeWidth="0.5"/>
            {/* Diagonal avenue */}
            <line x1="0" y1="80" x2="390" y2="170" stroke="#4f6699" strokeWidth="0.5"/>
          </svg>

          {/* Heat blobs — dense cluster centre */}
          <div className="absolute rounded-full" style={{ width: 130, height: 110, top: 30, left: 100, background: 'radial-gradient(circle, rgba(168,85,247,0.75) 0%, rgba(168,85,247,0.35) 40%, transparent 72%)', filter: 'blur(18px)' }} />
          {/* Secondary hot-spot */}
          <div className="absolute rounded-full" style={{ width: 90, height: 80, top: 60, left: 220, background: 'radial-gradient(circle, rgba(6,182,212,0.65) 0%, rgba(6,182,212,0.28) 45%, transparent 72%)', filter: 'blur(14px)' }} />
          {/* Warm fringe */}
          <div className="absolute rounded-full" style={{ width: 70, height: 60, top: 100, left: 20, background: 'radial-gradient(circle, rgba(236,72,153,0.45) 0%, rgba(236,72,153,0.18) 50%, transparent 72%)', filter: 'blur(12px)' }} />
          {/* Cool fringe right */}
          <div className="absolute rounded-full" style={{ width: 60, height: 50, top: 20, left: 290, background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)', filter: 'blur(10px)' }} />

          {/* Individual people dots */}
          <div className="absolute w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(6,182,212,0.9)]"  style={{ top: 58,  left: 152 }} />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-purple-300 shadow-[0_0_6px_rgba(168,85,247,0.9)]" style={{ top: 78,  left: 178 }} />
          <div className="absolute w-2 h-2 rounded-full bg-fuchsia-300 shadow-[0_0_6px_rgba(232,121,249,0.9)]" style={{ top: 44,  left: 135 }} />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.9)]"  style={{ top: 95,  left: 238 }} />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-white/80 shadow-[0_0_5px_rgba(255,255,255,0.7)]" style={{ top: 120, left: 60  }} />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_5px_rgba(168,85,247,0.8)]" style={{ top: 36,  left: 300 }} />

          {/* "You are here" pin */}
          <div className="absolute flex flex-col items-center" style={{ top: 76, left: 186 }}>
            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] border-2 border-[#050814]" />
            <div className="w-px h-2 bg-white/60" />
          </div>

          {/* Top-left label */}
          <div className="absolute top-3 left-4 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-white/50 tracking-widest uppercase">Live heatmap</span>
          </div>

          {/* Legend bottom-right */}
          <div className="absolute bottom-3 right-4 flex items-center gap-1">
            <div className="w-12 h-1.5 rounded-full" style={{ background: 'linear-gradient(to right, rgba(99,102,241,0.6), rgba(168,85,247,0.8), rgba(236,72,153,0.9), rgba(6,182,212,1))' }} />
            <span className="text-[9px] text-white/40 ml-1">hot</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 relative overflow-hidden group hover:bg-white/10 transition-colors">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <MapPin size={20} className="text-cyan-400" />
            </div>
            <span className="text-sm font-semibold text-white/90">Check In</span>
          </button>
          
          <button className="flex flex-col items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 relative overflow-hidden group hover:bg-white/10 transition-colors">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Trophy size={20} className="text-purple-400" />
            </div>
            <span className="text-sm font-semibold text-white/90">Leaderboard</span>
          </button>
        </div>

        {/* This Week Card */}
        <button className="text-left w-full rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 p-5 mb-6 relative overflow-hidden hover:bg-white/10 transition-colors">
          <h2 className="text-sm font-medium text-white/50 mb-4 uppercase tracking-wider">This Week</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-3xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">4</span>
              <span className="text-sm text-white/70 mt-1 flex items-center gap-1.5"><Users size={14} className="text-purple-400" /> new people</span>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">2</span>
              <span className="text-sm text-white/70 mt-1 flex items-center gap-1.5"><Activity size={14} className="text-cyan-400" /> crossed again</span>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="text-sm text-white/60">You've been active — keep it up!</p>
          </div>
        </button>

        {/* Rankings Snippet */}
        <button className="text-left w-full rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 p-5 mb-6 hover:bg-white/10 transition-colors">
          <h2 className="text-sm font-medium text-white/50 mb-4 uppercase tracking-wider">Your Rankings</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                <span className="text-sm font-bold text-white">#2</span>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white/90">The Grand Terrace</h3>
                <p className="text-xs text-white/50">Top 5% this week</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <span className="text-sm font-bold text-white/80">#7</span>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white/90">Rooftop Bar</h3>
                <p className="text-xs text-white/50">Moving up</p>
              </div>
            </div>
          </div>
        </button>

        {/* Referral CTA */}
        <button className="w-full rounded-2xl bg-gradient-to-r from-purple-600/40 to-cyan-600/40 backdrop-blur-md border border-white/10 p-4 flex items-center justify-between group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="text-sm font-bold text-white relative z-10">Invite friends, earn rewards</span>
          <ArrowRight size={18} className="text-white relative z-10 group-hover:translate-x-1 transition-transform" />
        </button>

      </div>
      <style>{`
        .hidden-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hidden-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

export default AuroraGlass;