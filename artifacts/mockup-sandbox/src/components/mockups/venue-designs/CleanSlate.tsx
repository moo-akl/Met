import React from "react";
import { 
  BadgeCheck, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Phone, 
  Globe, 
  CalendarDays, 
  Trophy,
  Medal,
  Award,
  Star
} from "lucide-react";

export function CleanSlate() {
  return (
    <div className="w-[390px] min-h-[844px] overflow-y-auto mx-auto bg-white text-gray-900 font-sans shadow-2xl relative">
      
      {/* Hero Section */}
      <div className="relative h-[400px] w-full bg-gradient-to-b from-[#0f766e] via-[#38bdf8] to-[#cffafe]">
        {/* Top Nav Area */}
        <div className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-bold tracking-wider text-sm shadow-sm border border-white/30">
            GT
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-sm border border-white/30">
            <Star className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Hero Content Bottom */}
        <div className="absolute bottom-0 w-full p-6 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-medium text-white border border-white/30 flex items-center gap-1">
              Rooftop Bar & Restaurant
            </span>
            <span className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-xs font-semibold text-teal-800 shadow-sm flex items-center gap-1">
              <BadgeCheck className="w-3.5 h-3.5 text-teal-600" /> Verified
            </span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight mb-2">
            The Grand<br />Terrace
          </h1>
          <p className="text-white/90 text-sm font-medium">Where Every Night Tells a Story</p>
        </div>
      </div>

      <div className="p-6 space-y-12">
        {/* Description Section */}
        <section>
          <p className="text-gray-600 text-[15px] leading-relaxed">
            Award-winning rooftop bar with panoramic city views, craft cocktails, and live music every weekend. The perfect place to unwind after a long day.
          </p>
          
          <div className="flex flex-col gap-3 mt-6">
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <Clock className="w-4 h-4 text-teal-600" />
              <span className="font-medium">Open today: 5:00 PM – 2:00 AM</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <Phone className="w-4 h-4 text-teal-600" />
              <span>+1 (415) 555-0182</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <Globe className="w-4 h-4 text-teal-600" />
              <span>www.grandterrace.com</span>
            </div>
          </div>
        </section>

        {/* Reward Section */}
        <section>
          <div className="flex items-end justify-between mb-5">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">Be the Winner</h2>
          </div>
          
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)]">
            <div className="h-1 w-full bg-teal-600"></div>
            <div className="p-5">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-teal-50 text-teal-600 mb-4">
                <Trophy className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Active Reward</h3>
              <p className="text-xl font-bold text-gray-900 leading-tight mb-2">
                Cocktail Night King
              </p>
              <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                Win a free bottle service for 4 (worth $350). Ends in 12 days.
              </p>
              <button className="w-full py-3 px-4 border border-teal-600 text-teal-600 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-teal-50 transition-colors">
                See how to win
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Leaderboard Section */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-5">Leaderboards</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6 snap-x snap-mandatory hide-scrollbar">
            {/* 1st Place */}
            <div className="snap-start shrink-0 w-[140px] bg-white border border-gray-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)]">
              <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center mb-3">
                <span className="text-yellow-600 font-bold text-lg">1</span>
              </div>
              <p className="font-bold text-gray-900 text-[15px] mb-1">Rosa M.</p>
              <p className="text-xs text-gray-500 font-medium">47 check-ins</p>
            </div>
            
            {/* 2nd Place */}
            <div className="snap-start shrink-0 w-[140px] bg-white border border-gray-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)]">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <span className="text-gray-400 font-bold text-lg">2</span>
              </div>
              <p className="font-bold text-gray-900 text-[15px] mb-1">Alex K.</p>
              <p className="text-xs text-gray-500 font-medium">31 check-ins</p>
            </div>

            {/* 3rd Place */}
            <div className="snap-start shrink-0 w-[140px] bg-white border border-gray-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)]">
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mb-3">
                <span className="text-orange-600 font-bold text-lg">3</span>
              </div>
              <p className="font-bold text-gray-900 text-[15px] mb-1">Jade P.</p>
              <p className="text-xs text-gray-500 font-medium">24 check-ins</p>
            </div>
          </div>
        </section>

        {/* Announcements Section */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-5">Announcements</h2>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Live Jazz This Friday</h3>
            <p className="text-[15px] text-gray-600 leading-relaxed mb-4">
              Our legendary Friday Jazz Night is back with special guest Trio Deluxe. Doors open at 8pm. Dress code: Smart casual.
            </p>
            <div className="h-[1px] w-full bg-gray-100"></div>
          </div>
        </section>

        {/* Events Section */}
        <section className="pb-10">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-5">Upcoming Events</h2>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 flex gap-4 items-center shadow-[0_2px_8px_-3px_rgba(0,0,0,0.04)]">
            <div className="bg-teal-50 rounded-xl p-3 flex flex-col items-center justify-center min-w-[64px]">
              <span className="text-xs font-bold text-teal-600 uppercase">Dec</span>
              <span className="text-xl font-bold text-teal-700 leading-none mt-1">31</span>
            </div>
            <div className="flex-1">
              <h3 className="text-[16px] font-bold text-gray-900 mb-1">NYE Countdown 2025</h3>
              <p className="text-sm text-gray-500">9:00 PM • 142 going</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </div>
        </section>

      </div>
    </div>
  );
}

export default CleanSlate;
