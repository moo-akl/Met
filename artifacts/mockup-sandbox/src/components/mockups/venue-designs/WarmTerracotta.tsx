import React from 'react';
import { 
  Clock, 
  Globe, 
  Phone, 
  ChevronRight, 
  Music,
  Wine,
  Star,
  Share,
  Heart
} from 'lucide-react';

export function WarmTerracotta() {
  return (
    <div className="w-[390px] min-h-[844px] overflow-y-auto mx-auto bg-[#FFF7EE] font-sans text-stone-800 pb-12 shadow-2xl relative">
      {/* Hero Section */}
      <div className="relative h-80 bg-gradient-to-b from-[#b34833] via-[#D87D56] to-[#f4bc9e] flex flex-col justify-end px-5 pb-6 overflow-hidden">
        {/* Subtle texture/glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/40 to-transparent"></div>

        {/* Top Nav */}
        <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-20">
           <div className="bg-white/20 backdrop-blur-md w-10 h-10 rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-white/30 transition-colors">
             <ChevronRight className="w-6 h-6 rotate-180" />
           </div>
           <div className="flex gap-3">
             <div className="bg-white/20 backdrop-blur-md w-10 h-10 rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-white/30 transition-colors">
               <Share className="w-5 h-5" />
             </div>
             <div className="bg-white/20 backdrop-blur-md w-10 h-10 rounded-full flex items-center justify-center text-white cursor-pointer hover:bg-white/30 transition-colors">
               <Heart className="w-5 h-5" />
             </div>
           </div>
        </div>
        
        {/* Hero Content */}
        <div className="relative z-20 flex items-end gap-4 mt-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#FFFCF7] flex items-center justify-center text-[#C2553F] text-2xl font-bold shadow-xl flex-shrink-0 border border-white/50">
            GT
          </div>
          <div>
            <div className="inline-flex items-center gap-1 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-md text-white/95 text-xs font-semibold mb-2 tracking-wide">
              <Star className="w-3 h-3 fill-current" />
              <span>Verified</span>
            </div>
            <h1 className="text-3xl font-bold text-white leading-tight tracking-tight shadow-sm">
              The Grand Terrace
            </h1>
            <p className="text-orange-50 text-sm mt-1.5 font-medium drop-shadow-sm">
              Where Every Night Tells a Story
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 space-y-8">
        
        {/* Info & Categories */}
        <div>
          <div className="flex gap-2 flex-wrap mb-4">
            <span className="px-3 py-1.5 bg-[#FFFCF7] border border-orange-200/60 rounded-full text-xs font-semibold text-orange-900 shadow-sm flex items-center gap-1.5">
              <Wine className="w-3.5 h-3.5 text-orange-600" /> Rooftop Bar
            </span>
            <span className="px-3 py-1.5 bg-[#FFFCF7] border border-orange-200/60 rounded-full text-xs font-semibold text-orange-900 shadow-sm flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-orange-600" /> Restaurant
            </span>
          </div>
          <p className="text-stone-600 leading-relaxed text-[15px]">
            Award-winning rooftop bar with panoramic city views, craft cocktails, and live music every weekend. The perfect place to unwind after a long day.
          </p>
        </div>

        {/* Reward Card */}
        <div className="bg-gradient-to-br from-[#D87D56] to-[#C2553F] rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-900/10 rounded-full -ml-8 -mb-8 blur-xl"></div>
          
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="text-4xl filter drop-shadow-sm">🏆</div>
            <h2 className="text-[22px] font-bold font-serif italic tracking-wide text-orange-50">Be the Winner</h2>
          </div>
          <h3 className="text-xl font-bold mb-1.5 relative z-10 tracking-tight text-white">Cocktail Night King</h3>
          <p className="text-orange-100 text-[15px] mb-5 relative z-10 leading-snug">
            Win a free bottle service for 4 <span className="opacity-75">(worth $350)</span>.
          </p>
          <div className="flex items-center justify-between mt-2 relative z-10">
            <span className="text-xs font-semibold bg-black/25 px-3 py-1.5 rounded-full backdrop-blur-md text-white border border-white/10">
              Ends in 12 days
            </span>
            <button className="bg-[#FFFCF7] text-[#C2553F] text-sm font-bold px-5 py-2.5 rounded-full shadow-md hover:scale-105 active:scale-95 transition-transform">
              Join Race
            </button>
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <h2 className="text-[#C2553F] font-bold text-lg mb-5 flex items-center gap-2">
            Top Patrons
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {/* 2nd Place */}
            <div className="bg-[#FFFCF7] border border-orange-100/50 rounded-2xl p-4 flex flex-col items-center shadow-sm relative pt-6 mt-4">
              <div className="absolute -top-4 bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-md border-2 border-[#FFFCF7]">
                🥈
              </div>
              <div className="w-12 h-12 rounded-full bg-stone-200 mb-2 flex items-center justify-center text-stone-600 font-bold border-2 border-white shadow-sm text-lg">
                AK
              </div>
              <div className="text-[13px] font-bold text-stone-800">Alex K.</div>
              <div className="text-[11px] text-stone-500 font-semibold mt-0.5">31 visits</div>
            </div>

            {/* 1st Place */}
            <div className="bg-[#FFFCF7] border border-orange-200/60 rounded-2xl p-4 flex flex-col items-center shadow-md relative z-10 pb-6 border-b-[5px] border-b-[#C2553F]">
              <div className="absolute -top-5 bg-amber-100 w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-md border-2 border-[#FFFCF7]">
                🥇
              </div>
              <div className="w-14 h-14 rounded-full bg-amber-100 mb-2 flex items-center justify-center text-amber-700 font-bold border-2 border-white shadow-sm text-xl">
                RM
              </div>
              <div className="text-[15px] font-bold text-stone-800">Rosa M.</div>
              <div className="text-[11px] text-[#C2553F] font-bold mt-0.5 bg-orange-50 px-2 py-0.5 rounded-full">47 visits</div>
            </div>

            {/* 3rd Place */}
            <div className="bg-[#FFFCF7] border border-orange-100/50 rounded-2xl p-4 flex flex-col items-center shadow-sm relative pt-6 mt-6">
              <div className="absolute -top-4 bg-orange-100 w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-md border-2 border-[#FFFCF7]">
                🥉
              </div>
              <div className="w-12 h-12 rounded-full bg-stone-200 mb-2 flex items-center justify-center text-stone-600 font-bold border-2 border-white shadow-sm text-lg">
                JP
              </div>
              <div className="text-[13px] font-bold text-stone-800">Jade P.</div>
              <div className="text-[11px] text-stone-500 font-semibold mt-0.5">24 visits</div>
            </div>
          </div>
        </div>

        {/* Announcement */}
        <div>
           <h2 className="text-[#C2553F] font-bold text-lg mb-4">Notice</h2>
           <div className="bg-[#FFFCF7] border border-orange-100 border-l-[6px] border-l-[#D87D56] rounded-xl p-5 shadow-sm">
             <h3 className="font-bold text-stone-800 mb-1.5 text-base">Live Jazz This Friday</h3>
             <p className="text-[14px] text-stone-600 leading-relaxed">
               Our legendary Friday Jazz Night is back with special guest Trio Deluxe. Doors open at 8pm. Dress code: Smart casual.
             </p>
           </div>
        </div>

        {/* Events */}
        <div>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-[#C2553F] font-bold text-lg">Upcoming Events</h2>
            <button className="text-[11px] text-stone-500 font-bold uppercase tracking-widest hover:text-[#C2553F] transition-colors">
              See all
            </button>
          </div>
          
          <div className="bg-[#FFFCF7] border border-orange-200/50 rounded-2xl p-4 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-300 transition-colors group">
             <div className="bg-[#FFF7EE] border border-orange-200/60 rounded-xl px-3 py-2.5 flex flex-col items-center justify-center min-w-[68px] shadow-sm">
               <span className="text-[10px] font-black text-[#C2553F] uppercase tracking-wider mb-0.5">Dec</span>
               <span className="text-[22px] font-bold text-stone-800 leading-none">31</span>
             </div>
             <div className="flex-1">
               <h3 className="font-bold text-stone-800 mb-1.5 text-[15px]">NYE Countdown 2025</h3>
               <div className="flex items-center gap-3 text-[12px] text-stone-500 font-medium">
                 <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> 9:00 PM</span>
                 <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" /> 142 going</span>
               </div>
             </div>
             <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-[#C2553F] transition-colors" />
          </div>
        </div>

        {/* Details */}
        <div className="bg-[#FFFCF7] border border-orange-200/50 rounded-2xl overflow-hidden shadow-sm">
           <div className="p-4 border-b border-orange-100/50 flex items-center gap-3.5">
             <div className="w-10 h-10 rounded-full bg-[#FFF7EE] text-[#D87D56] flex items-center justify-center shadow-sm border border-orange-100/50">
               <Clock className="w-4 h-4" />
             </div>
             <div>
               <div className="text-[14px] font-bold text-stone-800">Open today</div>
               <div className="text-[13px] text-stone-500 font-medium mt-0.5">5:00 PM – 2:00 AM</div>
             </div>
           </div>
           
           <div className="p-4 border-b border-orange-100/50 flex items-center gap-3.5">
             <div className="w-10 h-10 rounded-full bg-[#FFF7EE] text-[#D87D56] flex items-center justify-center shadow-sm border border-orange-100/50">
               <Phone className="w-4 h-4" />
             </div>
             <div>
               <div className="text-[14px] font-bold text-stone-800">Contact</div>
               <div className="text-[13px] text-stone-500 font-medium mt-0.5">+1 (415) 555-0182</div>
             </div>
           </div>
           
           <div className="p-4 flex items-center gap-3.5 cursor-pointer group hover:bg-[#FFF7EE]/50 transition-colors">
             <div className="w-10 h-10 rounded-full bg-[#FFF7EE] text-[#D87D56] flex items-center justify-center shadow-sm border border-orange-100/50 group-hover:bg-[#FFFCF7] transition-colors">
               <Globe className="w-4 h-4" />
             </div>
             <div>
               <div className="text-[14px] font-bold text-stone-800">Website</div>
               <div className="text-[13px] text-stone-500 font-medium mt-0.5">www.grandterrace.com</div>
             </div>
             <ChevronRight className="w-4 h-4 text-stone-300 ml-auto group-hover:text-[#C2553F] transition-colors" />
           </div>
        </div>
        
      </div>
    </div>
  );
}
