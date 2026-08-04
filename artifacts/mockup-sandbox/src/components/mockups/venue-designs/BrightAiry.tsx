import React from "react";
import { 
  MapPin, 
  Clock, 
  Phone, 
  Globe, 
  ChevronRight, 
  Share, 
  Heart, 
  Gift, 
  CalendarDays,
  Info,
  CheckCircle2,
  Trophy,
  Users
} from "lucide-react";

export function BrightAiry() {
  return (
    <div className="w-[390px] min-h-[844px] overflow-y-auto mx-auto bg-[#FAFAF8] font-sans text-[#222222] relative shadow-2xl">
      {/* Top Navigation Bar (transparent/overlay) */}
      <div className="absolute top-0 w-full px-4 pt-12 pb-4 flex justify-between items-center z-10">
        <button className="w-10 h-10 rounded-full bg-white/80 backdrop-blur shadow-sm flex items-center justify-center text-gray-800">
          <ChevronRight className="w-6 h-6 rotate-180" strokeWidth={2.5} />
        </button>
        <div className="flex gap-2">
          <button className="w-10 h-10 rounded-full bg-white/80 backdrop-blur shadow-sm flex items-center justify-center text-gray-800">
            <Share className="w-5 h-5" strokeWidth={2.5} />
          </button>
          <button className="w-10 h-10 rounded-full bg-white/80 backdrop-blur shadow-sm flex items-center justify-center text-gray-800">
            <Heart className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative w-full h-[420px] bg-gradient-to-br from-[#73c8a9] via-[#dee1b6] to-[#e1b866] pt-12 pb-6 px-5 flex flex-col justify-end">
        {/* Soft overlay to ensure text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/60 to-transparent"></div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-white/90 px-2 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase text-gray-800 shadow-sm flex items-center gap-1">
              Rooftop Bar & Restaurant
            </span>
            <span className="bg-[#FF385C]/10 text-[#FF385C] px-2 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase shadow-sm flex items-center gap-1 backdrop-blur-md">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified
            </span>
          </div>
          
          <h1 className="text-4xl font-extrabold text-[#222222] leading-tight mb-2 tracking-tight">
            The Grand Terrace
          </h1>
          <p className="text-gray-800 font-medium text-[15px] opacity-90">
            Where Every Night Tells a Story
          </p>
        </div>
      </div>

      {/* Content Body */}
      <div className="px-5 pt-8 pb-12 space-y-8">
        
        {/* About */}
        <section>
          <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">About</h2>
          <p className="text-[#484848] leading-relaxed text-[15px]">
            Award-winning rooftop bar with panoramic city views, craft cocktails, and live music every weekend. The perfect place to unwind after a long day.
          </p>
        </section>

        {/* Reward */}
        <section>
          <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Active Reward</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex relative">
            <div className="w-1.5 bg-[#FF385C] absolute left-0 top-0 bottom-0"></div>
            <div className="p-4 pl-5 flex items-start gap-4">
              <div className="bg-[#FF385C]/10 p-2.5 rounded-full text-[#FF385C]">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#222222] text-[16px] mb-1">Cocktail Night King</h3>
                <p className="text-gray-500 text-[14px] leading-snug mb-3">
                  Win a free bottle service for 4 (worth $350).
                </p>
                <div className="flex items-center text-[12px] font-semibold text-[#FF385C]">
                  <Clock className="w-3.5 h-3.5 mr-1" /> Ends in 12 days
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Leaderboard */}
        <section>
          <div className="flex justify-between items-end mb-3">
            <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Leaderboard</h2>
            <button className="text-[#FF385C] text-[13px] font-semibold">View All</button>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {/* 1st Place */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col items-center text-center relative pt-6">
              <div className="absolute -top-3 text-2xl">🥇</div>
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-200 to-yellow-400 flex items-center justify-center shadow-inner mb-2 border-2 border-white text-[#222222] font-bold text-lg">
                RM
              </div>
              <h3 className="font-bold text-[14px] text-[#222222]">Rosa M.</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">47 visits</p>
            </div>
            
            {/* 2nd Place */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col items-center text-center relative pt-6">
              <div className="absolute -top-3 text-2xl">🥈</div>
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-gray-200 to-gray-400 flex items-center justify-center shadow-inner mb-2 border-2 border-white text-[#222222] font-bold text-lg">
                AK
              </div>
              <h3 className="font-bold text-[14px] text-[#222222]">Alex K.</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">31 visits</p>
            </div>
            
            {/* 3rd Place */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col items-center text-center relative pt-6">
              <div className="absolute -top-3 text-2xl">🥉</div>
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-orange-200 to-amber-600 flex items-center justify-center shadow-inner mb-2 border-2 border-white text-[#222222] font-bold text-lg">
                JP
              </div>
              <h3 className="font-bold text-[14px] text-[#222222]">Jade P.</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">24 visits</p>
            </div>
          </div>
        </section>

        {/* Announcement */}
        <section>
          <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Announcement</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-bold text-[17px] text-[#222222] mb-2 flex items-center gap-2">
              <Info className="w-5 h-5 text-[#FF385C]" /> Live Jazz This Friday
            </h3>
            <p className="text-[#484848] text-[15px] leading-relaxed">
              Our legendary Friday Jazz Night is back with special guest Trio Deluxe. Doors open at 8pm. Dress code: Smart casual.
            </p>
          </div>
        </section>

        {/* Events */}
        <section>
          <div className="flex justify-between items-end mb-3">
            <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Upcoming Events</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x -mx-5 px-5 hide-scrollbar">
            <div className="min-w-[280px] bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-4 snap-start">
              <div className="w-[60px] h-[60px] rounded-lg bg-[#FF385C]/10 flex flex-col items-center justify-center shrink-0">
                <span className="text-[#FF385C] text-[11px] font-bold uppercase">Dec</span>
                <span className="text-[#FF385C] text-[20px] font-extrabold leading-none">31</span>
              </div>
              <div className="flex flex-col justify-center">
                <h3 className="font-bold text-[#222222] text-[16px] mb-1 leading-tight">NYE Countdown 2025</h3>
                <div className="flex items-center text-gray-500 text-[13px] gap-2">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> 9:00 PM</span>
                  <span className="text-gray-300">•</span>
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> 142 going</span>
                </div>
              </div>
            </div>
            
            <div className="min-w-[280px] bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-4 snap-start opacity-70 border-dashed">
              <div className="w-[60px] h-[60px] rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div className="flex flex-col justify-center">
                <h3 className="font-bold text-gray-500 text-[16px] mb-1">More events soon</h3>
                <p className="text-gray-400 text-[13px]">Stay tuned for updates</p>
              </div>
            </div>
          </div>
        </section>

        {/* Info & Contact */}
        <section>
          <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">Info & Contact</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
            <div className="p-4 flex items-center gap-3 text-[#222222]">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <span className="font-medium">Open today:</span> 5:00 PM – 2:00 AM
              </div>
            </div>
            <div className="p-4 flex items-center gap-3 text-[#222222]">
              <Phone className="w-5 h-5 text-gray-400" />
              <a href="tel:+14155550182" className="font-medium">+1 (415) 555-0182</a>
            </div>
            <div className="p-4 flex items-center gap-3 text-[#222222]">
              <Globe className="w-5 h-5 text-gray-400" />
              <a href="https://www.grandterrace.com" className="font-medium text-[#FF385C]">www.grandterrace.com</a>
            </div>
          </div>
        </section>

      </div>
      
      {/* Sticky Bottom CTA */}
      <div className="sticky bottom-0 w-full bg-white border-t border-gray-100 p-4 pb-8 flex items-center justify-between shadow-[0_-4px_10px_rgba(0,0,0,0.03)] z-10">
        <div className="flex flex-col">
          <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">Ready to visit?</span>
          <span className="font-bold text-[#222222] text-[15px]">Check in to earn points</span>
        </div>
        <button className="bg-[#FF385C] hover:bg-[#E31C5F] text-white font-bold py-3.5 px-8 rounded-lg shadow-sm transition-colors text-[15px]">
          Check In Now
        </button>
      </div>
      
    </div>
  );
}
