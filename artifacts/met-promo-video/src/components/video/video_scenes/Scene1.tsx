import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1600),
      setTimeout(() => setPhase(3), 2800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const text1 = "You walk past them every day.";
  const text2 = "What if you could actually meet them?";

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(20px)', scale: 1.4 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* Accent line */}
      <motion.div
        className="h-[2px] bg-[var(--color-accent)] mb-10 rounded-full"
        initial={{ width: 0 }}
        animate={phase >= 1 ? { width: '48px' } : { width: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      />

      <div className="relative h-[200px] w-full flex items-center justify-center">
        {/* Text 1 */}
        <div className="absolute inset-x-0 flex flex-wrap justify-center gap-x-[6px] gap-y-1 px-4">
          {text1.split(' ').map((word, i) => (
            <motion.span
              key={`w1-${i}`}
              className="text-[22px] font-bold tracking-tight text-[var(--color-text-primary)] leading-tight inline-block"
              initial={{ opacity: 0, y: 30, rotateX: -25 }}
              animate={
                phase === 1
                  ? { opacity: 1, y: 0, rotateX: 0 }
                  : phase >= 2
                    ? { opacity: 0, y: -25, rotateX: 20 }
                    : { opacity: 0, y: 30, rotateX: -25 }
              }
              transition={{
                type: 'spring',
                stiffness: 320,
                damping: 22,
                delay: phase === 1 ? i * 0.07 : i * 0.03,
              }}
            >
              {word}
            </motion.span>
          ))}
        </div>

        {/* Text 2 */}
        <div className="absolute inset-x-0 flex flex-wrap justify-center gap-x-[5px] gap-y-1 px-4">
          {text2.split(' ').map((word, i) => (
            <motion.span
              key={`w2-${i}`}
              className="text-[24px] font-black tracking-tighter text-[var(--color-accent)] leading-tight inline-block drop-shadow-[0_0_12px_rgba(58,224,106,0.35)]"
              initial={{ opacity: 0, y: 30, scale: 0.85 }}
              animate={
                phase >= 2 && phase < 3
                  ? { opacity: 1, y: 0, scale: 1 }
                  : { opacity: 0, y: phase >= 3 ? -30 : 30, scale: phase >= 3 ? 1.1 : 0.85 }
              }
              transition={{
                type: 'spring',
                stiffness: 380,
                damping: 24,
                delay: phase >= 2 ? i * 0.05 : 0,
              }}
            >
              {word}
            </motion.span>
          ))}
        </div>
      </div>

      {/* Bottom accent */}
      <motion.div
        className="h-[2px] bg-[var(--color-accent)] mt-10 rounded-full"
        initial={{ width: 0 }}
        animate={phase >= 1 ? { width: '48px' } : { width: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-[var(--color-accent)]"
          style={{ left: `${15 + i * 14}%`, top: `${20 + (i % 3) * 25}%` }}
          animate={{
            y: [0, -12, 0],
            opacity: [0.15, 0.5, 0.15],
            scale: [1, 1.4, 1],
          }}
          transition={{ duration: 2 + i * 0.3, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </motion.div>
  );
}
