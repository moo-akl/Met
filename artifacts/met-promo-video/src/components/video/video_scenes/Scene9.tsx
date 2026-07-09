import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const privacyPoints = [
  'No location ever stored',
  'Anonymous until you reveal',
  'You control who sees you',
  'Delete your data anytime',
];

export function Scene9() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 700),
      setTimeout(() => setPhase(3), 1150),
      setTimeout(() => setPhase(4), 1600),
      setTimeout(() => setPhase(5), 2050),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-8"
      initial={{ opacity: 0, clipPath: 'polygon(0 100%, 100% 100%, 100% 100%, 0 100%)' }}
      animate={{ opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ opacity: 0, y: -60, filter: 'blur(12px)' }}
      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Shield icon */}
      <motion.div
        className="mb-6 relative"
        initial={{ scale: 0, rotate: -20 }}
        animate={phase >= 1 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      >
        <svg width="56" height="64" viewBox="0 0 56 64" fill="none">
          <motion.path
            d="M28 2L4 12V30C4 44 14.4 57.2 28 62C41.6 57.2 52 44 52 30V12L28 2Z"
            stroke="#3AE06A"
            strokeWidth="2.5"
            fill="rgba(58,224,106,0.08)"
            initial={{ pathLength: 0 }}
            animate={phase >= 1 ? { pathLength: 1 } : { pathLength: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          <motion.path
            d="M18 32l6 6 14-14"
            stroke="#3AE06A"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={phase >= 2 ? { pathLength: 1 } : { pathLength: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </svg>
        {/* Glow */}
        <motion.div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: 'rgba(58,224,106,0.2)' }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      </motion.div>

      {/* Headline */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 16 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <h2 className="text-[28px] font-black tracking-tight text-[var(--color-text-primary)] leading-tight">
          Your privacy.
        </h2>
        <h2 className="text-[28px] font-black tracking-tight leading-tight text-[var(--color-accent)] drop-shadow-[0_0_12px_rgba(58,224,106,0.4)]">
          Non-negotiable.
        </h2>
      </motion.div>

      {/* Privacy points */}
      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        {privacyPoints.map((point, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={phase >= i + 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          >
            <motion.div
              className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0"
              style={{ boxShadow: '0 0 8px rgba(58,224,106,0.4)' }}
              initial={{ scale: 0 }}
              animate={phase >= i + 2 ? { scale: 1 } : { scale: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.05 }}
            >
              <svg className="w-3 h-3 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <span className="text-[13px] font-semibold text-[var(--color-text-primary)] tracking-wide">{point}</span>
          </motion.div>
        ))}
      </div>

      {/* Scan line effect */}
      <motion.div
        className="absolute inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-30"
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  );
}
