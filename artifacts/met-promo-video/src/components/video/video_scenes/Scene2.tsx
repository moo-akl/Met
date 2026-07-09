import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { PhoneMockup } from '../PhoneMockup';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 5000), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-row items-center w-full max-w-6xl gap-16 px-12">
        {/* Text Side */}
        <div className="flex-1">
          <motion.h2 
            className="text-[4.5vw] font-bold leading-[1.1] tracking-tight text-[var(--color-text-primary)]"
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            Detect who's <br/>
            <span className="text-[var(--color-accent)] drop-shadow-[0_0_15px_rgba(58,224,106,0.3)]">nearby.</span>
          </motion.h2>
        </div>

        {/* Phone Side */}
        <div className="flex-1 flex justify-center perspective-1000">
          <PhoneMockup>
            <div className="w-full h-full pt-16 px-6 flex flex-col">
              <motion.div 
                className="text-[10px] tracking-[0.2em] text-[var(--color-accent)] font-semibold mb-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                // RADAR
              </motion.div>

              {/* Radar Element */}
              <div className="relative w-full aspect-square rounded-full border border-[var(--color-accent)]/20 mt-4 mb-12 flex items-center justify-center">
                {/* Concentric circles */}
                <div className="absolute w-[66%] h-[66%] rounded-full border border-[var(--color-accent)]/20" />
                <div className="absolute w-[33%] h-[33%] rounded-full border border-[var(--color-accent)]/20" />
                
                {/* Crosshairs */}
                <div className="absolute w-full h-[1px] bg-[var(--color-accent)]/20" />
                <div className="absolute h-full w-[1px] bg-[var(--color-accent)]/20" />

                {/* Sweep line */}
                <motion.div 
                  className="absolute top-1/2 left-1/2 w-1/2 h-[2px] bg-gradient-to-r from-transparent to-[var(--color-accent)] origin-left"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                
                {/* Sweep gradient */}
                <motion.div 
                  className="absolute top-1/2 left-1/2 w-1/2 h-1/2 origin-top-left"
                  style={{ background: 'conic-gradient(from 0deg at 0% 0%, transparent 0deg, rgba(58,224,106,0.2) 90deg, transparent 90deg)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />

                {/* Blips */}
                {phase >= 2 && (
                  <motion.div 
                    className="absolute w-2 h-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)] top-[20%] left-[30%]"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.8] }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="absolute -top-4 -left-2 text-[8px] text-[var(--color-text-primary)] font-bold">JK</div>
                  </motion.div>
                )}
                
                {phase >= 3 && (
                  <motion.div 
                    className="absolute w-2 h-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)] bottom-[30%] right-[25%]"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.8] }}
                    transition={{ duration: 0.5 }}
                  >
                    <div className="absolute -top-4 -left-2 text-[8px] text-[var(--color-text-primary)] font-bold">AM</div>
                  </motion.div>
                )}

                {/* Center pulse */}
                <motion.div 
                  className="absolute w-4 h-4 rounded-full bg-[var(--color-accent)] shadow-[0_0_15px_var(--color-accent)]"
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.8, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 gap-3">
                <motion.div 
                  className="bg-[var(--color-bg-light)] border border-[var(--color-accent)]/10 rounded-xl p-4 tactical-border"
                  initial={{ opacity: 0, y: 20 }}
                  animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Today</div>
                  <div className="text-2xl font-bold text-[var(--color-text-primary)]">3</div>
                </motion.div>
                <motion.div 
                  className="bg-[var(--color-bg-light)] border border-[var(--color-accent)]/10 rounded-xl p-4 tactical-border"
                  initial={{ opacity: 0, y: 20 }}
                  animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  <div className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Connections</div>
                  <div className="text-2xl font-bold text-[var(--color-text-primary)]">12</div>
                </motion.div>
                <motion.div 
                  className="bg-[var(--color-bg-light)] border border-[var(--color-accent)]/10 rounded-xl p-4 tactical-border col-span-2 flex justify-between items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <div className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">Pending Reveals</div>
                  <div className="text-lg font-bold text-[var(--color-accent)]">2</div>
                </motion.div>
              </div>

            </div>
          </PhoneMockup>
        </div>
      </div>
    </motion.div>
  );
}
