import React from 'react';
import { motion } from 'framer-motion';

export function HeroPhone() {
  return (
    <div className="relative mx-auto" style={{ width: 220, height: 450 }}>
      {/* Phone Body */}
      <div className="absolute inset-0 rounded-[40px] bg-gray-900 shadow-2xl shadow-green-900/20" />
      <div className="absolute inset-[4px] rounded-[36px] overflow-hidden bg-white">
        
        {/* Dynamic Island */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[88px] h-[24px] bg-black rounded-full z-20" />
        
        {/* Top Nav */}
        <div className="absolute top-10 w-full px-5 flex justify-between items-center z-10">
          <span className="text-[12px] font-black text-gray-900 tracking-tighter">MET</span>
          <div className="flex items-center gap-1.5 bg-green-500 rounded-full px-2.5 py-1 shadow-sm">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
            <span className="text-[9px] font-bold text-white tracking-widest">VISIBLE</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="pt-24 px-4 flex flex-col items-center h-full relative">
          
          {/* Live Badge */}
          <div className="mb-6 flex items-center gap-1.5 bg-green-50 border border-green-100 rounded-full px-3 py-1 shadow-sm">
            <motion.div 
              className="w-1.5 h-1.5 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[9px] font-bold text-green-700 tracking-wider">BEACON ACTIVE</span>
          </div>

          {/* Radar */}
          <div className="relative flex justify-center items-center mb-8" style={{ width: 160, height: 160 }}>
            {/* Concentric rings */}
            <div className="absolute inset-0 rounded-full border border-green-100/60" />
            <div className="absolute inset-[20px] rounded-full border border-green-100/80" />
            <div className="absolute inset-[40px] rounded-full border border-green-200" />
            <div className="absolute inset-[60px] rounded-full border border-green-300" />
            
            {/* Center dot */}
            <div className="absolute w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)] z-10" />
            <div className="absolute w-4 h-4 rounded-full border border-green-400 opacity-50" />
            
            {/* Crosshairs */}
            <div className="absolute w-full h-[1px] bg-green-100/50" />
            <div className="absolute h-full w-[1px] bg-green-100/50" />

            {/* Sweep */}
            <div className="absolute inset-0 rounded-full overflow-hidden radar-sweep z-0">
              <div 
                className="absolute inset-0"
                style={{
                  background: 'conic-gradient(from 0deg at 50% 50%, rgba(34,197,94,0) 0deg, rgba(34,197,94,0.05) 260deg, rgba(34,197,94,0.4) 360deg)'
                }}
              />
              {/* Sweep trailing edge line */}
              <div className="absolute top-0 left-1/2 w-[1.5px] h-1/2 bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)] -translate-x-1/2" />
            </div>

            {/* Blips */}
            <motion.div 
              className="absolute w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] z-10"
              style={{ top: '25%', left: '70%' }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div 
              className="absolute w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] z-10"
              style={{ top: '65%', left: '20%' }}
              animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
            />
            <motion.div 
              className="absolute w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] z-10"
              style={{ top: '80%', left: '75%' }}
              animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.3, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: 0.8 }}
            />
            <motion.div 
              className="absolute w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] z-10"
              style={{ top: '35%', left: '30%' }}
              animate={{ opacity: [0.1, 0.9, 0.1], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 3.5, repeat: Infinity, delay: 2.1 }}
            />
          </div>

          {/* Headline */}
          <div className="text-center mb-6 z-10">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">
              4 people <span className="text-green-500">nearby</span>
            </h2>
          </div>

          {/* Stats Chips */}
          <div className="flex w-full gap-2 px-1 z-10">
            <div className="flex-1 bg-gray-50 border border-green-50 rounded-xl py-2 flex flex-col items-center">
              <span className="text-sm font-black text-gray-900">12</span>
              <span className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">Today</span>
            </div>
            <div className="flex-1 bg-gray-50 border border-green-50 rounded-xl py-2 flex flex-col items-center">
              <span className="text-sm font-black text-gray-900">3</span>
              <span className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">Met</span>
            </div>
            <div className="flex-1 bg-gray-50 border border-green-50 rounded-xl py-2 flex flex-col items-center">
              <span className="text-sm font-black text-gray-900">1</span>
              <span className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">Req</span>
            </div>
          </div>

        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-black rounded-full z-20" />
      </div>
    </div>
  );
}
