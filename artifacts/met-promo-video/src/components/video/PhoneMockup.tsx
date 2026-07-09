import { motion } from 'framer-motion';
import { ReactNode } from 'react';

export function PhoneMockup({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={`relative rounded-[40px] border-[7px] border-[#0A0A0B] bg-[#0A0A0B] overflow-hidden ${className}`}
      style={{
        width: '230px',
        height: '498px',
        boxShadow: '0 0 60px rgba(0,0,0,0.9), 0 0 0 1px rgba(58,224,106,0.18), 0 20px 60px rgba(0,0,0,0.6)',
      }}
      initial={{ y: 60, opacity: 0, scale: 0.88 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -50, opacity: 0, scale: 0.92, filter: 'blur(8px)' }}
      transition={{ type: 'spring', damping: 26, stiffness: 200 }}
    >
      {/* Status bar */}
      <div className="absolute top-0 inset-x-0 h-[26px] z-50 flex items-start justify-between px-5 pt-[7px]">
        <span className="text-[7px] text-white/60 font-semibold tracking-wide">9:41</span>
        <div className="flex items-center gap-[2px] mt-[1px]">
          <div className="w-[2px] h-[5px] bg-white/40 rounded-[1px]" />
          <div className="w-[2px] h-[7px] bg-white/60 rounded-[1px]" />
          <div className="w-[2px] h-[9px] bg-white/80 rounded-[1px]" />
          <div className="w-[2px] h-[9px] bg-white rounded-[1px] ml-[2px]" />
        </div>
      </div>

      {/* Dynamic Island */}
      <div className="absolute top-[5px] left-1/2 -translate-x-1/2 w-[64px] h-[20px] bg-[#0A0A0B] rounded-full z-50" />

      {/* Home indicator */}
      <div className="absolute bottom-[5px] inset-x-0 flex justify-center z-50">
        <div className="w-[64px] h-[3px] rounded-full bg-white/25" />
      </div>

      {/* Screen */}
      <div className="w-full h-full bg-[var(--color-bg-dark)] overflow-hidden relative text-white">
        {children}
      </div>
    </motion.div>
  );
}
