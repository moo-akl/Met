import { motion } from 'framer-motion';
import { ReactNode } from 'react';

export function PhoneMockup({ children, className = '' }: { children: ReactNode, className?: string }) {
  return (
    <motion.div 
      className={`relative w-[340px] h-[720px] rounded-[48px] border-[8px] border-[#0A0A0B] bg-black overflow-hidden shadow-2xl tactical-glow ${className}`}
      initial={{ y: 100, opacity: 0, scale: 0.8 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -100, opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ type: 'spring', damping: 25, stiffness: 180 }}
    >
      <div className="absolute top-0 inset-x-0 h-[24px] bg-[#0A0A0B] z-50 rounded-b-2xl w-32 mx-auto" />
      <div className="w-full h-full bg-[var(--color-bg-dark)] overflow-hidden relative text-white">
        {children}
      </div>
    </motion.div>
  );
}
