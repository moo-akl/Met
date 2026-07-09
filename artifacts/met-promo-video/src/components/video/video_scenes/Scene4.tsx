import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { PhoneMockup } from '../PhoneMockup';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 2000), // highlight button
      setTimeout(() => setPhase(4), 4800), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: 100, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-col items-center w-full max-w-6xl gap-12 px-12">
        {/* Text */}
        <div className="text-center z-10">
          <motion.h2 
            className="text-[4.5vw] font-bold leading-[1.1] tracking-tight text-[var(--color-text-primary)]"
            initial={{ opacity: 0, y: -30 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -30 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            Reveal when <br/>
            <span className="text-[var(--color-accent)] drop-shadow-[0_0_15px_rgba(58,224,106,0.3)]">you're ready.</span>
          </motion.h2>
        </div>

        {/* Phone */}
        <div className="flex justify-center perspective-1000">
          <PhoneMockup>
            <div className="w-full h-full bg-[var(--color-bg-dark)] relative flex flex-col justify-end">
              
              {/* Background list simulation */}
              <div className="absolute inset-0 p-6 pt-16 opacity-30 pointer-events-none filter blur-[2px]">
                <div className="w-full h-20 bg-[var(--color-bg-light)] rounded-xl mb-4" />
                <div className="w-full h-20 bg-[var(--color-bg-light)] rounded-xl mb-4" />
                <div className="w-full h-20 bg-[var(--color-bg-light)] rounded-xl" />
              </div>

              {/* Overlay shadow */}
              <motion.div 
                className="absolute inset-0 bg-black/60"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.5 }}
              />

              {/* Bottom Sheet */}
              <motion.div 
                className="relative bg-[var(--color-bg-light)] rounded-t-3xl border-t border-[var(--color-accent)]/20 p-6 pb-12 w-full shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
                initial={{ y: "100%" }}
                animate={phase >= 2 ? { y: 0 } : { y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
              >
                <div className="w-12 h-1 bg-[var(--color-text-muted)] rounded-full mx-auto mb-6" />
                
                <div className="flex flex-col items-center mb-8">
                  <div className="w-24 h-24 rounded-full bg-[var(--color-bg-dark)] border border-[var(--color-accent)]/30 overflow-hidden mb-4 relative flex items-center justify-center filter blur-[4px]">
                     <div className="text-[var(--color-text-muted)] text-3xl font-bold">?</div>
                  </div>
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">Reveal Request</h3>
                  <p className="text-[var(--color-text-secondary)] text-center text-sm">
                    Someone from Dolores Park wants to connect.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <motion.button 
                    className="w-full py-4 rounded-xl bg-[var(--color-accent)] text-[var(--color-primary)] font-bold text-base shadow-[0_0_15px_rgba(58,224,106,0.3)] relative overflow-hidden"
                    animate={phase >= 3 ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    Accept Reveal
                    {phase >= 3 && (
                      <motion.div 
                        className="absolute inset-0 bg-white/30"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      />
                    )}
                  </motion.button>
                  <button className="w-full py-4 rounded-xl border border-[var(--color-text-muted)] text-[var(--color-text-secondary)] font-semibold text-base">
                    Not Now
                  </button>
                </div>
              </motion.div>

            </div>
          </PhoneMockup>
        </div>
      </div>
    </motion.div>
  );
}
