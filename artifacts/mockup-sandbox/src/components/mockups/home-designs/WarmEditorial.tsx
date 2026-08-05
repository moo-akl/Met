import React from 'react';
import { MapPin, Trophy, Users, RefreshCcw, ArrowRight, Battery, Wifi, Signal } from 'lucide-react';

export default function WarmEditorial() {
  return (
    <div className="w-[390px] min-h-[844px] overflow-y-auto mx-auto relative bg-[#F9F6F0] text-[#1C1C1C] font-sans pb-12">
      {/* Status bar area */}
      <div className="h-[44px] w-full flex items-center justify-between px-6 pt-2 select-none">
        <span className="text-[14px] font-semibold tracking-tight">9:41</span>
        <div className="flex gap-2 items-center text-[#1C1C1C]">
          <Signal size={14} strokeWidth={2.5} />
          <Wifi size={14} strokeWidth={2.5} />
          <Battery size={14} strokeWidth={2.5} />
        </div>
      </div>

      <div className="px-5 pt-2">
        {/* Header row */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-serif font-bold tracking-tighter">Met.</h1>
          <div className="w-10 h-10 rounded-full bg-white border border-stone-200 shadow-sm flex items-center justify-center text-sm font-semibold text-[#C2553F]">
            AK
          </div>
        </div>

        {/* Beacon status */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#fcedea] border border-[#f7dbd5] shadow-sm">
            <div className="w-2 h-2 rounded-full bg-[#C2553F] animate-pulse"></div>
            <span className="text-[10px] font-bold tracking-widest text-[#C2553F]">BEACON ACTIVE</span>
          </div>
        </div>

        {/* Map area & Hero number */}
        <div className="mb-6 rounded-3xl bg-[#FAFAF5] border border-stone-200 shadow-sm p-8 relative overflow-hidden flex flex-col items-center">
          {/* Radial gradient heat signature */}
          <div className="absolute inset-0 flex items-center justify-center opacity-80 pointer-events-none">
            <div className="w-[120%] h-[120%]" style={{ background: 'radial-gradient(circle at center, #F4D3CC 0%, rgba(250,250,245,0) 50%)' }}></div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-40 pointer-events-none">
            <div className="w-[80%] h-[80%]" style={{ background: 'radial-gradient(circle at center, #E8A89A 0%, rgba(250,250,245,0) 40%)' }}></div>
          </div>
          
          <div className="relative z-10 flex flex-col items-center py-6">
            <div className="text-[88px] font-serif font-medium leading-none tracking-tighter text-[#1C1C1C]">
              12
            </div>
            <div className="text-lg font-serif italic text-stone-500 mt-2 text-center leading-tight">
              people within <br/> 200m
            </div>
            
            {/* Vibe pill */}
            <div className="mt-6 px-3 py-1.5 rounded-full border border-stone-200 bg-white/80 backdrop-blur shadow-sm">
              <span className="text-[11px] font-bold tracking-wider text-[#C2553F]">⚡ LIVELY HERE</span>
            </div>
          </div>
        </div>

        {/* Quick actions row */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button className="flex flex-col items-start gap-4 p-4 rounded-2xl bg-white border border-stone-200 shadow-sm active:scale-95 transition-transform text-left">
            <div className="w-9 h-9 rounded-full bg-[#FAFAF5] border border-stone-100 flex items-center justify-center text-[#C2553F]">
              <MapPin size={18} strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-sm">Check In</span>
          </button>
          <button className="flex flex-col items-start gap-4 p-4 rounded-2xl bg-white border border-stone-200 shadow-sm active:scale-95 transition-transform text-left">
            <div className="w-9 h-9 rounded-full bg-[#FAFAF5] border border-stone-100 flex items-center justify-center text-[#C2553F]">
              <Trophy size={18} strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-sm">Leaderboard</span>
          </button>
        </div>

        {/* This Week card */}
        <div className="mb-6 p-5 rounded-2xl bg-white border border-stone-200 shadow-sm">
          <h3 className="text-[10px] font-bold tracking-widest text-stone-400 mb-5 uppercase">This Week</h3>
          <div className="flex items-center justify-between">
            <div className="flex-1 cursor-pointer group">
              <div className="text-3xl font-serif font-medium mb-1 text-[#1C1C1C]">4</div>
              <div className="text-xs font-medium text-stone-500 flex items-center gap-1.5 group-hover:text-[#C2553F] transition-colors">
                <Users size={14} className="text-[#C2553F]" />
                <span>new people</span>
              </div>
            </div>
            <div className="w-[1px] h-12 bg-stone-100"></div>
            <div className="flex-1 pl-5 cursor-pointer group">
              <div className="text-3xl font-serif font-medium mb-1 text-[#1C1C1C]">2</div>
              <div className="text-xs font-medium text-stone-500 flex items-center gap-1.5 group-hover:text-[#C2553F] transition-colors">
                <RefreshCcw size={14} className="text-[#C2553F]" />
                <span>crossed again</span>
              </div>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-stone-100">
            <p className="text-[13px] font-serif italic text-stone-500">You've been active — keep it up!</p>
          </div>
        </div>

        {/* Rankings snippet */}
        <div className="mb-6 p-5 rounded-2xl bg-white border border-stone-200 shadow-sm">
          <h3 className="text-[10px] font-bold tracking-widest text-stone-400 mb-5 uppercase">Your Rankings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="text-xl font-serif font-bold text-[#C2553F] w-8">#2</div>
                <div className="text-sm font-semibold text-[#1C1C1C]">The Grand Terrace</div>
              </div>
              <div className="text-xs font-medium text-stone-400 bg-stone-50 px-2 py-1 rounded">Top 5%</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-xl font-serif font-bold text-[#C2553F] w-8">#7</div>
                <div className="text-sm font-semibold text-[#1C1C1C]">Rooftop Bar</div>
              </div>
              <div className="text-xs font-medium text-stone-400 bg-stone-50 px-2 py-1 rounded">Top 15%</div>
            </div>
          </div>
        </div>

        {/* Referral CTA */}
        <button className="w-full flex items-center justify-between p-5 rounded-2xl bg-[#C2553F] text-white shadow-md active:scale-[0.98] transition-transform">
          <span className="font-semibold text-sm">Invite friends, earn rewards</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
