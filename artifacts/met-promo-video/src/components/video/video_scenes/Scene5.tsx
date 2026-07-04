import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 4000), // Hold before loop
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center bg-black"
      initial={{ opacity: 0, scale: 1.2 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="w-32 h-32 rounded-3xl bg-gradient-to-tr from-emerald-400 to-cyan-500 mb-8 shadow-[0_0_80px_rgba(16,185,129,0.4)] flex items-center justify-center text-5xl font-bold text-white"
        initial={{ scale: 0, rotate: -45 }}
        animate={phase >= 1 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -45 }}
        transition={{ duration: 1, type: "spring", bounce: 0.5 }}
      >
        Met.
      </motion.div>

      <div className="overflow-hidden">
        <motion.h1 
          className="text-[6vw] font-bold tracking-tight text-white leading-none"
          initial={{ y: "100%" }}
          animate={phase >= 2 ? { y: "0%" } : { y: "100%" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          Find your people.
        </motion.h1>
      </div>
      
      <motion.p
        className="text-[1.8vw] text-white/50 mt-6 tracking-widest uppercase font-medium"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        Download Now
      </motion.p>
    </motion.div>
  );
}
