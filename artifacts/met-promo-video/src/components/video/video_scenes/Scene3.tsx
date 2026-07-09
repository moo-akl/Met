import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { PhoneMockup } from '../PhoneMockup';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1100),
      setTimeout(() => setPhase(4), 1400),
      setTimeout(() => setPhase(5), 4800), // exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const encounters = [
    { initials: 'SJ', name: 'Sarah J.', loc: 'Blue Bottle Coffee', time: '2m ago' },
    { initials: 'MK', name: 'Mike K.', loc: 'Dolores Park', time: '14m ago' },
    { initials: 'AL', name: 'Alex L.', loc: 'Whole Foods', time: '1h ago' },
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, filter: 'blur(20px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: -100, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex flex-row-reverse items-center w-full max-w-6xl gap-16 px-12">
        {/* Text Side */}
        <div className="flex-1 text-right">
          <motion.h2 
            className="text-[4.5vw] font-bold leading-[1.1] tracking-tight text-[var(--color-text-primary)]"
            initial={{ opacity: 0, x: 30 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            Every crossing. <br/>
            <span className="text-[var(--color-accent)] drop-shadow-[0_0_15px_rgba(58,224,106,0.3)]">Logged.</span>
          </motion.h2>
        </div>

        {/* Phone Side */}
        <div className="flex-1 flex justify-center perspective-1000">
          <PhoneMockup>
            <div className="w-full h-full pt-16 px-6 flex flex-col bg-[var(--color-bg-dark)]">
              <motion.div 
                className="text-[10px] tracking-[0.2em] text-[var(--color-text-secondary)] font-semibold mb-6 flex justify-between"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <span>// ENCOUNTERS</span>
                <span className="text-[var(--color-accent)]">4 NODES</span>
              </motion.div>

              <div className="flex flex-col gap-3">
                {encounters.map((enc, i) => (
                  <motion.div 
                    key={i}
                    className="bg-[var(--color-bg-light)] border border-[var(--color-accent)]/10 rounded-xl p-4 flex items-center gap-4 tactical-border"
                    initial={{ opacity: 0, x: -20 }}
                    animate={phase >= i + 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                    transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-[var(--color-bg-dark)] border-2 border-[var(--color-accent)] flex items-center justify-center text-[var(--color-accent)] font-bold text-sm">
                        {enc.initials}
                      </div>
                      {i === 0 && (
                        <motion.div 
                          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#EF4444] border-2 border-[var(--color-bg-light)]"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-[var(--color-text-primary)] text-base">{enc.name}</div>
                      <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {enc.loc}
                      </div>
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)] font-mono">
                      {enc.time}
                    </div>
                  </motion.div>
                ))}
              </div>

            </div>
          </PhoneMockup>
        </div>
      </div>
    </motion.div>
  );
}
