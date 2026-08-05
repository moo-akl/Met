import React from 'react';
import { MapPin, Trophy, ChevronRight, Zap } from 'lucide-react';

export function NoirLuxury() {
  return (
    <div className="w-[390px] min-h-[844px] overflow-y-auto mx-auto relative bg-[#0A0A0B] text-white font-sans pb-10 shadow-2xl">
      {/* status bar area */}
      <div className="h-[44px] w-full" />
      
      <div className="px-5">
        {/* Header row */}
        <div className="flex justify-between items-center mb-8 mt-2">
          <h1 className="text-xl font-bold tracking-widest text-[#F5C842]">MET</h1>
          <div className="w-10 h-10 rounded-full bg-[#1A1A1F] border border-[#F5C842]/30 flex justify-center items-center">
            <span className="text-[#F5C842] font-semibold text-sm tracking-widest">AK</span>
          </div>
        </div>

        {/* Beacon status */}
        <div className="flex items-center gap-2 mb-6">
          <div className="relative flex items-center justify-center w-3 h-3">
            <div className="absolute w-3 h-3 bg-[#F5C842] rounded-full animate-ping opacity-75"></div>
            <div className="relative w-2 h-2 bg-[#F5C842] rounded-full shadow-[0_0_10px_rgba(245,200,66,0.8)]"></div>
          </div>
          <span className="text-[#F5C842] text-[10px] font-bold tracking-[0.25em] uppercase">
            Beacon Active
          </span>
        </div>

        {/* Hero number */}
        <div className="mb-2">
          <div className="text-[80px] leading-[1] font-light text-[#F5C842] tracking-tighter">
            12
          </div>
          <div className="text-[11px] font-semibold tracking-[0.2em] text-white/70 uppercase mt-2">
            People within 200m
          </div>
        </div>

        {/* Vibe pill */}
        <div className="mt-4 mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1A1A1F] border border-[#F5C842]/20">
            <Zap size={12} className="text-[#F5C842] fill-[#F5C842]" />
            <span className="text-[10px] font-semibold tracking-widest text-[#F5C842] uppercase">
              Lively Here
            </span>
          </div>
        </div>

        {/* Map/radar area */}
        <div className="w-full h-[180px] rounded-2xl bg-[#141416] border border-[#F5C842]/15 relative overflow-hidden mb-8 flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#F5C842]/20 via-transparent to-transparent opacity-80"></div>
          {/* Radar circles */}
          <div className="absolute w-[250px] h-[250px] border border-[#F5C842]/5 rounded-full"></div>
          <div className="absolute w-[150px] h-[150px] border border-[#F5C842]/10 rounded-full"></div>
          <div className="absolute w-[50px] h-[50px] border border-[#F5C842]/20 rounded-full bg-[#F5C842]/5"></div>
          
          {/* Fake dots */}
          <div className="absolute w-1.5 h-1.5 bg-[#F5C842] rounded-full top-[30%] left-[40%] shadow-[0_0_8px_rgba(245,200,66,0.8)]"></div>
          <div className="absolute w-1.5 h-1.5 bg-[#F5C842] rounded-full top-[60%] left-[65%] shadow-[0_0_8px_rgba(245,200,66,0.6)] opacity-80"></div>
          <div className="absolute w-1.5 h-1.5 bg-white rounded-full top-[45%] left-[25%] shadow-[0_0_8px_rgba(255,255,255,0.5)] opacity-50"></div>
          <div className="absolute w-1.5 h-1.5 bg-white rounded-full top-[70%] left-[30%] shadow-[0_0_8px_rgba(255,255,255,0.3)] opacity-30"></div>
        </div>

        {/* Quick actions row */}
        <div className="flex gap-4 mb-8">
          <button className="flex-1 bg-[#141416] border border-[#F5C842]/15 border-t-[#F5C842]/40 rounded-xl p-4 flex flex-col items-start gap-4 active:bg-[#1A1A1F] transition-colors group">
            <MapPin size={22} className="text-[#F5C842]" />
            <span className="text-sm font-medium text-white tracking-wide group-hover:text-[#F5C842] transition-colors">Check In</span>
          </button>
          <button className="flex-1 bg-[#141416] border border-[#F5C842]/15 border-t-[#F5C842]/40 rounded-xl p-4 flex flex-col items-start gap-4 active:bg-[#1A1A1F] transition-colors group">
            <Trophy size={22} className="text-[#F5C842]" />
            <span className="text-sm font-medium text-white tracking-wide group-hover:text-[#F5C842] transition-colors">Leaderboard</span>
          </button>
        </div>

        {/* This Week card */}
        <div className="bg-[#141416] border border-[#F5C842]/15 rounded-xl p-5 mb-8">
          <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase mb-5">
            This Week
          </h3>
          <div className="flex gap-6 mb-5">
            <button className="flex-1 flex flex-col items-start active:opacity-70 transition-opacity">
              <span className="text-3xl font-light text-[#F5C842] mb-1">4</span>
              <span className="text-[10px] text-white/60 uppercase tracking-widest mt-1">New People</span>
            </button>
            <div className="w-[1px] bg-[#F5C842]/10"></div>
            <button className="flex-1 flex flex-col items-start active:opacity-70 transition-opacity">
              <span className="text-3xl font-light text-[#F5C842] mb-1">2</span>
              <span className="text-[10px] text-white/60 uppercase tracking-widest mt-1">Crossed Again</span>
            </button>
          </div>
          <div className="text-xs text-white/40 italic font-light">
            You've been active — keep it up!
          </div>
        </div>

        {/* Rankings snippet */}
        <div className="mb-8">
          <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase mb-4">
            Your Rankings
          </h3>
          <div className="flex flex-col gap-3">
            <div className="bg-[#141416] border border-[#F5C842]/15 border-l-2 border-l-[#F5C842] rounded-lg p-4 flex items-center justify-between">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-white tracking-wide">The Grand Terrace</span>
                <span className="text-[10px] text-[#F5C842]/70 uppercase tracking-widest">Members Only</span>
              </div>
              <div className="text-2xl font-light text-[#F5C842]">#2</div>
            </div>
            
            <div className="bg-[#141416] border border-[#F5C842]/15 rounded-lg p-4 flex items-center justify-between">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-white/80 tracking-wide">Rooftop Bar</span>
                <span className="text-[10px] text-white/40 uppercase tracking-widest">Public Lounge</span>
              </div>
              <div className="text-2xl font-light text-white/40">#7</div>
            </div>
          </div>
        </div>

        {/* Referral CTA */}
        <button className="w-full bg-[#141416] border border-[#F5C842]/15 rounded-xl p-5 flex items-center justify-between active:bg-[#1A1A1F] transition-colors group">
          <span className="text-sm font-medium text-[#F5C842] tracking-wide">
            Invite friends, earn rewards
          </span>
          <ChevronRight size={18} className="text-[#F5C842] group-hover:translate-x-1 transition-transform" />
        </button>

      </div>
    </div>
  );
}
